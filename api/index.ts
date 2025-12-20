import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes.js";
import { syncVendorsTable } from "../server/sync-vendors.js";
import directRouter from "../server/direct-router.js";

const app = express();

function log(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [express] ${message}`);
}

// 모든 POST 요청에 대한 디버깅 로그 추가
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log(`🔥 POST 요청 감지: ${req.url}`);
    console.log('요청 헤더:', req.headers);
    if (req.url.includes('upload-excel')) {
      console.log('🎯 엑셀 업로드 요청 확인됨!');
    }
  }
  next();
});

// Create a utility middleware to allow public API access for specific endpoints
const allowPublicAccess = (req: Request, res: Response, next: NextFunction) => {
  const publicRoutes = [
    '/api/payments/public-test',
    '/api/payments/test-connection',
    '/api/payments/inicis-search',
    '/api/payments/public/cancel',
    '/api/payments/cancel',
    '/api/payments/v2/cancel',
    '/api/orders/emergency-cancel/:orderId',
    '/api_direct/payment/create-test',
    '/api_direct/payments/cancel',
    '/api/site-settings',
    '/api/plants/remove-duplicates',
    '/api/plants/upload-excel',
    '/api/map/config',
    '/api/map/nearby-vendors',
    '/api/map/search-address',
    '/api/vendors/popular',
    '/api/plants/popular',
    '/api/plants/search',
    '/api/products/available'
  ];

  const isPublicRoute = publicRoutes.some(route => {
    if (route.includes(':')) {
      const pattern = route.replace(/:[^/]+/g, '[^/]+');
      return new RegExp(`^${pattern}$`).test(req.path);
    }
    return route === req.path;
  });

  if (isPublicRoute) {
    console.log(`Public access allowed for ${req.path}`);
    (req as any).isAuthenticated = () => true;
    (req as any).user = { id: 1, username: 'ralphpark', role: 'user', email: 'ralphpark@example.com' };
  }

  next();
};

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(allowPublicAccess);

// 항상 JSON Content-Type 헤더 설정 미들웨어
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/api_direct/') || req.path.startsWith('/__direct/')) {
    console.log('API 요청 감지, JSON 응답 설정:', req.path);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.type('json');
    (req as any).isApiRequest = true;
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Vite 미들웨어를 등록하기 전에 직접 API 라우터 등록
app.use('/direct', directRouter);
app.use('/direct/plants', directRouter);
app.use('/__direct', directRouter);

// Setup function for cold start
let isReady = false;
async function setup() {
  if (isReady) return;

  await registerRoutes(app);

  // 에러 미들웨어
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.type('json');

    res.status(status).json({
      errorCode: err.code || 'INTERNAL_ERROR',
      message: message
    });
  });

  try {
    // Note: This might be slow on cold start
    syncVendorsTable().catch(e => console.error("판매자 테이블 동기화 실패:", e));
  } catch (error) {
    console.error("판매자 테이블 동기화 실패:", error);
  }

  isReady = true;
}

export default async function handler(req: Request, res: Response) {
  await setup();
  app(req, res);
}
