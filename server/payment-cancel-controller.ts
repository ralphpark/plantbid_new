import { Request, Response } from 'express';
import { storage } from './storage.js';

/**
 * 결제 취소 요청 처리
 * @param req Express 요청 객체
 * @param res Express 응답 객체
 */
export async function handleCancelPayment(req: Request, res: Response) {
  const { orderId, reason } = req.body;

  if (!orderId) {
    return res.status(400).json({
      success: false,
      error: '주문 ID가 필요합니다.'
    });
  }

  try {
    console.log(`\n===== 결제 취소 요청 처리 (Enhanced Controller) =====`);
    console.log(`주문 ID: ${orderId}`);

    // 1. 주문 ID로 결제 정보 조회
    const payment = await storage.getPaymentByOrderId(orderId);

    if (!payment) {
      console.error(`[결제 취소] 결제 정보를 찾을 수 없음: ${orderId}`);
      return res.status(404).json({
        success: false,
        error: '주문에 대한 결제 정보를 찾을 수 없습니다.'
      });
    }

    // 2. 결제 상태 확인
    if (payment.status === 'CANCELLED') {
      console.log(`[결제 취소] 이미 취소된 결제: ${orderId}`);
      return res.status(200).json({
        success: true,
        message: '이미 취소된 결제입니다.',
        payment
      });
    }

    if (!payment.paymentKey) {
      console.error(`[결제 취소] 결제 키가 없음: ${orderId}`);
      return res.status(400).json({
        success: false,
        error: '결제 키가 없어 취소할 수 없습니다.'
      });
    }

    // 3. 개선된 결제 취소 함수 호출 (재시도 및 상세 에러 처리 포함)
    // 동적 import로 순환 의존성 방지 및 최신 모듈 사용
    const { cancelPaymentWithRetry } = await import('./enhanced-payments.js');

    // cancelPaymentWithRetry가 응답 처리까지 담당함
    return cancelPaymentWithRetry(payment, orderId, reason, storage, res);

  } catch (error: any) {
    console.error('[결제 취소] 오류 발생:', error.message || error);
    // 이미 응답이 전송되었는지 확인
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: `결제 취소 처리 중 오류가 발생했습니다: ${error.message || 'Unknown error'}`
      });
    }
  }
}