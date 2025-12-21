import { Express, Request, Response } from 'express';
import { IStorage } from './storage.js';

/**
 * 포트원(PortOne) 결제 취소 개선 API 입니다.
 * - 재시도 로직
 * - 상세 로그 샵
 * - 포트원 API 콜 성공 여부 확인
 */
export async function cancelPaymentWithRetry(
  payment: any,
  orderId: string,
  reason: string,
  storage: IStorage,
  res: Response
) {
  try {
    const { convertToV2PaymentId } = await import('./portone-v2-client.js');
    const { smartCancelPayment } = await import('./portone-payment-finder.js');
    // 포트원 V2 클라이언트 가져오기
    const portoneV2Client = await import('./portone-v2-client.js');
    const portoneClient = portoneV2Client.default;

    if (!payment.paymentKey) {
      throw new Error('취소할 결제 키가 없습니다.');
    }

    // API 요청 전 디버깅 정보 출력
    console.log('[결제 취소 API] 요청 세부정보:');
    console.log('- 결제 ID (UUID):', payment.id);
    console.log('- 결제 키:', payment.paymentKey);
    console.log('- 주문 ID:', orderId);
    console.log('- API 시크릿 키 길이:', portoneClient.apiSecret ? portoneClient.apiSecret.length : 0);
    console.log('- 취소 사유:', reason || '고객 요청에 의한 취소');

    // 재시도 관련 변수
    let portoneCallSuccess = false;
    let response: any = null;
    let attempts = 0;
    const maxAttempts = 3;
    const retryDelay = 1000; // 재시도 지연 시간(ms)

    // 유효한 포트원 결제 ID 검색 시도
    let portonePaymentId = payment.paymentKey;

    try {
      console.log('[결제 취소 API] 주문 ID로 유효한 포트원 결제 ID 검색 시도...');
      // 주문 ID로 결제 검색하여 올바른 ID 형식 찾기
      const searchResult = await portoneClient.searchPayments({
        orderId: orderId
      });

      if (searchResult && searchResult.payments && searchResult.payments.length > 0) {
        const foundPayment = searchResult.payments[0];
        if (foundPayment.payment_id) {
          console.log('[결제 취소 API] 주문에서 포트원 결제 ID 찾음:', foundPayment.payment_id);
          // 검색된 ID가 pay_ 형식인지 확인
          if (foundPayment.payment_id.startsWith('pay_')) {
            console.log('[결제 취소 API] 유효한 pay_ 접두사 형식의 결제 ID 발견');
            portonePaymentId = foundPayment.payment_id;
          } else {
            console.log('[결제 취소 API] 비표준 ID 형식 발견, V2 형식으로 변환 시도');
            portonePaymentId = convertToV2PaymentId(foundPayment.payment_id);
          }
        }
      } else {
        console.log('[결제 취소 API] 주문으로 결제 정보 검색 실패: 결과 없음');
      }
    } catch (searchError) {
      console.error('[결제 취소 API] 결제 검색 오류:', searchError);
      console.log('[결제 취소 API] 원래 결제 ID 사용 계속');
    }

    // 최종 결제 ID를 V2 규격(pay_ + 22자)으로 보정
    if (!portonePaymentId.startsWith('pay_') || portonePaymentId.length !== 26) {
      console.log('[결제 취소 API] 최종 결제 ID 형식 보정 필요, 변환 수행');
      portonePaymentId = convertToV2PaymentId(portonePaymentId);
      console.log('[결제 취소 API] 변환된 최종 결제 ID:', portonePaymentId);
    }

    // 재시도 로직 추가
    while (attempts < maxAttempts && !portoneCallSuccess) {
      attempts++;
      console.log(`[결제 취소 API] 시도 ${attempts}/${maxAttempts}`);
      console.log(`[결제 취소 API] 사용할 결제 ID: ${portonePaymentId}`);

      try {
        // 포트원 API 호출 - 반드시 pay_ 형식의 결제 ID 사용
        response = await portoneClient.cancelPayment({
          paymentId: portonePaymentId,
          reason: reason || '고객 요청에 의한 취소'
        });

        // 성공 플래그 설정
        portoneCallSuccess = true;
        console.log(`[결제 취소 API] 시도 ${attempts} - 포트원 결제 취소 성공. 응답:`, JSON.stringify(response, null, 2));
        break;
      } catch (retryError: any) {
        console.error(`[결제 취소 API] 시도 ${attempts} - 실패:`, retryError?.message || retryError);

        // 마지막 시도가 아니면 재시도
        if (attempts < maxAttempts) {
          console.log(`[결제 취소 API] ${retryDelay}ms 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // 최종 대안: 스마트 취소 유틸 사용 시도
    if (!portoneCallSuccess) {
      console.log('[결제 취소 API] 모든 재시도 실패. 스마트 취소 유틸을 사용하여 최종 시도 진행');
      try {
        const smartResult = await smartCancelPayment(portonePaymentId, reason || '고객 요청에 의한 취소');
        if (smartResult.success) {
          portoneCallSuccess = true;
          response = smartResult.data;
          console.log('[결제 취소 API] 스마트 취소 유틸을 통한 취소 성공');
        } else {
          console.error('[결제 취소 API] 스마트 취소 유틸 실패:', smartResult.error);
        }
      } catch (smartError: any) {
        console.error('[결제 취소 API] 스마트 취소 유틸 시도 중 오류:', smartError?.message || smartError);
      }
    }

    // 성공 시에만 DB 업데이트
    if (portoneCallSuccess) {
      const updatedPayment = await storage.updatePayment(payment.id, {
        status: 'CANCELLED',
        updatedAt: new Date(),
        cancelReason: reason || '고객 요청에 의한 취소',
        cancelledAt: new Date()
      });

      const updatedOrder = await storage.updateOrderStatusByOrderId(orderId, 'cancelled');
      if (!updatedOrder) {
        console.error(`주문 ID ${orderId}의 상태를 변경하지 못했습니다.`);
      } else {
        console.log(`결제 취소 완료 - 주문 ID: ${orderId}, 결제 ID: ${payment.id}`);
      }

      const refreshedPayment = await storage.getPaymentByOrderId(orderId);
      return res.json({
        success: true,
        message: '결제가 성공적으로 취소되었습니다.',
        portoneCallSuccess: true,
        payment: refreshedPayment || updatedPayment,
        order: updatedOrder,
        timestamp: new Date().toISOString()
      });
    } else {
      // 실패 시 상태 변경 없이 오류 반환
      console.warn('[결제 취소 API] 모든 취소 시도 실패. 데이터베이스 상태는 변경하지 않습니다.');
      return res.status(502).json({
        success: false,
        message: '포트원 결제 취소 요청이 실패했습니다.',
        portoneCallSuccess: false,
        error: '포트원 API 취소 실패',
        payment,
        orderId,
        timestamp: new Date().toISOString()
      });
    }
  } catch (portoneError: any) {
    console.error('포트원 API 취소 오류:', portoneError?.message || portoneError);

    // 오류 객체 상세 출력
    if (portoneError.response) {
      console.error('포트원 API 오류 응답 상태:', portoneError.response.status);
      console.error('포트원 API 오류 응답 데이터:', JSON.stringify(portoneError.response.data, null, 2));
    } else if (portoneError.request) {
      console.error('포트원 API 요청은 전송되었으나 응답이 없음:', portoneError.request);
    }

    // 포트원 API 오류 시 DB 상태 변경하지 않음 (실제 취소가 되지 않았으므로)
    console.error('[결제 취소 API] 포트원 API 오류로 인해 취소 실패. DB 상태는 변경하지 않습니다.');

    // API 오류 정보 추출
    let errorType = 'UNKNOWN_ERROR';
    let errorDetails = null;

    if (portoneError?.response?.data) {
      try {
        const errorData = portoneError.response.data;
        if (typeof errorData === 'string') {
          try {
            const parsedError = JSON.parse(errorData);
            errorType = parsedError.type || errorType;
            errorDetails = parsedError;
          } catch (e) {
            errorType = 'PARSE_ERROR';
            errorDetails = { raw: errorData };
          }
        } else {
          errorType = errorData.type || errorType;
          errorDetails = errorData;
        }
      } catch (e) {
        console.error('오류 데이터 파싱 실패:', e);
      }
    }

    // 오류 응답 반환 (DB 상태 변경 없음)
    return res.status(502).json({
      success: false,
      message: '포트원 결제 취소 요청이 실패했습니다. 다시 시도해주세요.',
      portoneCallSuccess: false,
      error: portoneError?.message || '포트원 API 오류',
      errorType,
      details: errorDetails,
      payment,
      orderId,
      timestamp: new Date().toISOString()
    });
  }
}
