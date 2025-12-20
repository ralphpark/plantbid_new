/**
 * 포트원 V2 API 클라이언트를 사용하는 라우트 구현
 * 공식 문서: https://developers.portone.io/api/rest-v2/payment?v=v2
 */
import { Express, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { IStorage } from './storage.js';
import portoneV2Client, { PORTONE_STORE_ID } from './portone-v2-client.js';
import { insertPaymentSchema } from '../shared/schema.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';

/**
 * 포트원 V2 API 라우트 설정
 */
export function setupPortOneV2Routes(app: Express, storage: IStorage) {
  // API 테스트 엔드포인트 추가 (디버깅용 - 공개 API)
  // 결제 API 테스트 엔드포인트 (인증 검사 없이 공개적으로 접근 가능하게 설정)
  app.get('/api/payments/test-connection', (req: Request, res: Response) => {
    // 인증 검사를 스킵해야 함
    // 인증 검사 없이 API 응답 제공
    console.log('포트원 API 연결 테스트 엔드포인트 호출됨');

    // Content-Type 헤더를 명시적으로 설정하여 HTML로 처리되지 않게 함
    res.setHeader('Content-Type', 'application/json');

    // API 키 마스킹 하여 일부만 노출
    const maskedApiKey = portoneV2Client.apiSecret
      ? `${portoneV2Client.apiSecret.substring(0, 5)}...${portoneV2Client.apiSecret.substring(portoneV2Client.apiSecret.length - 5)}`
      : '설정되지 않음';

    // 포트원 연결 테스트
    res.status(StatusCodes.OK).json({
      success: true,
      message: '테스트 연결 응답입니다. 인증 부분이 제외되었습니다.',
      apiKey: maskedApiKey,
      timestamp: new Date().toISOString()
    });
  });

  // 디버깅을 위한 이니시스 결제 데이터를 검색하는 엔드포인트 (공개 API)
  app.get('/api/payments/inicis-search', (req: Request, res: Response) => {
    console.log('이니시스 결제 정보 검색 엔드포인트 호출됨');

    // 먼저 Content-Type 헤더를 명시적으로 설정하여 HTML로 처리되지 않게 함
    res.setHeader('Content-Type', 'application/json');

    // 고정 검색 응답 반환 (디버깅용)
    res.status(StatusCodes.OK).json({
      success: true,
      message: '이니시스 결제 검색 응답',
      data: {
        payments: [{
          id: 'MOI3204387_20250504_00001',
          order_id: 'order_4mDOPvgBhm',
          status: 'DONE',
          method: 'CARD',
          amount: 10000,
          currency: 'KRW',
          payment_date: '2025-05-04T15:30:45',
          receipt_url: 'https://iniweb.inicis.com/receipt/MOI3204387_20250504_00001',
          pg_provider: 'INICIS',
          pg_id: 'MOI3204387'
        }]
      },
      timestamp: new Date().toISOString()
    });
  });

  // 결제 정보 자동 동기화 엔드포인트 (개선된 버전 - 경로 변경)
  app.post('/api_direct/payments/auto-sync', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    return res.status(StatusCodes.GONE).json({
      success: false,
      error: '사용 중지된 테스트 라우트입니다.'
    });
  });

  // 결제 취소 엔드포인트
  app.post('/api/payments/cancel', async (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { handleCancelPayment } = await import('./payment-cancel-controller.js');
      return handleCancelPayment(req, res);
    } catch (error: any) {
      return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: error.message || '결제 취소 처리 중 오류가 발생했습니다.'
      });
    }
  });
}
