// Global window interface extensions for payment providers and other third-party libraries

/**
 * 포트원 SDK 타입 정의
 */

// 결제 요청 파라미터
interface IMPRequestPayParams {
  pg?: string;                // PG사 코드 (e.g. 'inicis' 또는 'inicis.INIpayTest')
  pay_method?: string;        // 결제 수단 ('card', 'trans', 'vbank', 'phone' 등)
  merchant_uid: string;       // 주문번호
  name?: string;              // 상품명
  amount: number;             // 금액
  buyer_email?: string;       // 구매자 이메일
  buyer_name?: string;        // 구매자 이름
  buyer_tel?: string;         // 구매자 전화번호
  buyer_addr?: string;        // 구매자 주소
  buyer_postcode?: string;    // 구매자 우편번호
  confirm_url?: string;       // 동의 처리를 위한 URL
  m_redirect_url?: string;    // 모바일 리다이렉트 URL
  app_scheme?: string;        // 앱 스키마
  biz_num?: string;           // 사업자번호
  tax_free?: number;          // 면세금액
  vat?: number;               // 부가세
  language?: string;          // 언어 설정 ('ko', 'en')
  currency?: string;          // 통화 ('KRW', 'USD' 등)
  notice_url?: string | string[];
  digital?: boolean;          // 전자상품 여부
  escrow?: boolean;           // 에스크로 여부
  vbank_due?: string;         // 가상계좌 유효기간
  display?: IMPDisplayOptions;
  customer_uid?: string;      // 회원 고유 ID
  bypass?: Record<string, string>; // PG사별 추가 파라미터
  custom_data?: any;          // 추가 데이터
}

// 화면 표시 옵션
interface IMPDisplayOptions {
  card_quota?: number[];
}

// 결제 응답 시 받는 데이터 타입
interface IMPResponseBase {
  success: boolean;
  error_code?: string;
  error_msg?: string;
  imp_uid?: string;         // 포트원 고유 ID
  merchant_uid?: string;    // 주문번호
  pay_method?: string;      // 결제 수단
  paid_amount?: number;     // 결제 금액
  status?: string;          // 결제 상태
  name?: string;            // 상품명
  pg_provider?: string;     // PG사
  pg_tid?: string;          // PG사 고유 결제번호
  buyer_name?: string;      // 구매자 이름
  buyer_email?: string;     // 구매자 이메일
  buyer_tel?: string;       // 구매자 전화번호
  buyer_addr?: string;      // 구매자 주소
  buyer_postcode?: string;  // 구매자 우편번호
  custom_data?: any;        // 추가 데이터
  paid_at?: number;         // 결제 시간
  receipt_url?: string;     // 영수증 URL
}

type IMPSuccessResponse = IMPResponseBase & {
  success: true;
};

type IMPFailResponse = IMPResponseBase & {
  success: false;
};

type IMPResponse = IMPSuccessResponse | IMPFailResponse;

type IMPRequestPayCallback = (response: IMPResponse) => void;

// 포트원 메인 객체 타입
interface IMP {
  init: (merchantID: string) => void;
  request_pay: (params: IMPRequestPayParams, callback?: IMPRequestPayCallback) => void;
  // 추가 속성
  agency?: string;
  pg?: any;
  agent?: any;
  // 추가 확장 속성 (타입스크립트 오류 해결용)
  [key: string]: any;
}

// 포트원 V2 SDK 타입 (PortOne 객체)
interface PortOne {
  requestPayment: (params: any) => Promise<any>;
  getIMP?: () => any;
  setGlobalConfiguration?: (config: any) => void;
  loadUI?: (config: string) => void;
  [key: string]: any;
}

declare global {
  interface Window {
    // 포트원 V2 SDK
    PortOne?: PortOne;

    // 포트원 V1 (iamport 레거시)
    IMP?: IMP;

    // 포트원 관련 콜백
    __PortOneSDKLoaded?: () => void;

    // 토스페이먼츠 결제 위젯 관련 타입 (레거시)
    PaymentWidget?: any;
    tossPaymentsScriptLoaded?: boolean;
    TossPayments?: any;
    TossPaymentsReady?: boolean;

    // 카카오 API 관련 타입 (다음 도로명 주소 검색 API)
    daum?: {
      Postcode?: any;
      maps?: any;
    };
  }
}

export {};
