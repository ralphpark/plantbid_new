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
    const portoneV2Module = await import('./portone-v2-client.js');
    const PortOneV2Client = portoneV2Module.PortOneV2Client;

    // 환경 변수에서 시크릿 키 직접 조회 (함수 실행 시점의 최신 값 사용)
    const apiSecret = process.env.PORTONE_SECRET_KEY || process.env.PORTONE_API_SECRET || process.env.PORTONE_V2_API_SECRET;

    if (!apiSecret) {
      console.error('[결제 취소 API] 치명적 오류: 포트원 API Secret Key가 설정되지 않았습니다.');
      throw new Error('서버 설정 오류: 포트원 API Secret Key가 누락되었습니다.');
    }

    // 새 인스턴스 생성 (명시적 시크릿 사용)
    const portoneClient = new PortOneV2Client(apiSecret);

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
    let lastError: any = null;
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
        lastError = retryError; // 오류 캡처 (덮어쓰지 않고 보존)
        console.error(`[결제 취소 API] 시도 ${attempts} - 실패:`, retryError?.message || retryError);

        // 401 Unauthorized 에러면 즉시 중단 (키가 틀린 것이므로 재시도 불필요)
        if (retryError?.response?.status === 401) {
          console.error('[결제 취소 API] 401 인증 오류 감지. 재시도 중단.');
          break;
        }

        // 마지막 시도가 아니면 재시도
        if (attempts < maxAttempts) {
          console.log(`[결제 취소 API] ${retryDelay}ms 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // 1차 시도가 실패했고, 401 에러가 아니라면 스마트 취소 유틸 시도
    let smartCancelError: any = null;

    if (!portoneCallSuccess && lastError?.response?.status !== 401) {
      console.log('[결제 취소 API] 모든 재시도 실패. 스마트 취소 유틸을 사용하여 최종 시도 진행');
      try {
        const smartResult = await smartCancelPayment(portonePaymentId, reason || '고객 요청에 의한 취소');
        if (smartResult.success) {
          portoneCallSuccess = true;
          response = smartResult.data;
          console.log('[결제 취소 API] 스마트 취소 유틸을 통한 취소 성공');
        } else {
          smartCancelError = smartResult.error; // 스마트 취소 에러 별도 저장
          console.error('[결제 취소 API] 스마트 취소 유틸 실패:', smartResult.error);
        }
      } catch (smartError: any) {
        smartCancelError = smartError?.message || smartError;
        console.error('[결제 취소 API] 스마트 취소 유틸 시도 중 오류:', smartError?.message || smartError);
      }
    }

    // 2차 시도도 실패했다면, 마지막으로 orderId가 pay_ 형식인지 확인하고 이것으로 취소 시도
    // (DB의 paymentKey가 잘못되었을 가능성 높음)
    // lastError가 래핑되어 있을 수 있으므로 메시지 확인도 추가
    const isNotFoundError = lastError?.response?.status === 404 ||
      lastError?.message?.includes('PAYMENT_NOT_FOUND') ||
      lastError?.message?.includes('404');

    if (!portoneCallSuccess && isNotFoundError && orderId.startsWith('pay_')) {
      console.log('[결제 취소 API] 모든 시도 실패했으나 orderId가 pay_ 형식임. 주문 ID를 결제 ID로 간주하고 최종 시도.');
      console.log(`[결제 취소 API] 최종 시도 사용할 ID: ${orderId}`);

      try {
        // 검색으로 확인 절차 (선택사항이나 안전을 위해)
        let verifySuccess = false;
        try {
          const checkPayment = await portoneClient.getPayment(orderId);
          if (checkPayment && checkPayment.status) {
            console.log(`[결제 취소 API] 주문 ID로 결제 확인 성공. 상태: ${checkPayment.status}`);
            verifySuccess = true;
          }
        } catch (checkErr) {
          console.warn('[결제 취소 API] 주문 ID로 결제 확인 시 오류 (무시하고 취소 시도 진행):', checkErr);
        }

        response = await portoneClient.cancelPayment({
          paymentId: orderId,
          reason: reason || '고객 요청에 의한 취소'
        });

        portoneCallSuccess = true;
        console.log('[결제 취소 API] 주문 ID를 사용한 강제 취소 성공. 응답:', JSON.stringify(response, null, 2));
      } catch (finalRetryError: any) {
        console.error('[결제 취소 API] 주문 ID를 사용한 최종 취소 시도 실패:', finalRetryError?.message);
        // lastError를 업데이트하지 않아 초기 에러 정보를 유지할지, 아니면 이 에러를 추가할지 결정
        // 여기서는 details에 추가하는 방식으로 처리
        smartCancelError = `Final attempt with orderId failed: ${finalRetryError?.message}`;
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
      console.warn('[결제 취소 API] 최종 오류 상태:', {
        initialError: lastError?.message,
        smartCancelError: smartCancelError
      });

      // 상세 오류 정보 구성 (두 가지 에러 모두 포함)
      const errorDetails = {
        initialAttempt: {
          message: lastError?.message,
          status: lastError?.response?.status,
          data: lastError?.response?.data
        },
        smartCancelAttempt: {
          error: smartCancelError
        }
      };

      const statusCode = lastError?.response?.status || 502;
      const finalMessage = lastError?.response?.status === 401
        ? '포트원 API 인증에 실패했습니다. API 키를 확인해주세요.'
        : '포트원 결제 취소 요청이 실패했습니다.';

      return res.status(statusCode).json({
        success: false,
        message: finalMessage,
        portoneCallSuccess: false,
        error: lastError?.message || '포트원 API 취소 실패',
        details: errorDetails,
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
