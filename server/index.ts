import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { syncVendorsTable } from "./sync-vendors";

const app = express();

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
    '/api/payments/public/cancel', // 추가된 결제 취소 용 공개 API
    '/api/payments/cancel',
    '/api/payments/v2/cancel',
    '/api/orders/emergency-cancel/:orderId', // 연결 모든 API를 사용할 수 없을 때 사용하는 긴급 취소 API
    '/api_direct/payment/create-test', // MID 테스트를 위한 라우트
    '/api_direct/payments/cancel', // MID 취소 테스트를 위한 라우트
    '/api/site-settings', // 사이트 설정 공개 API
    '/api/plants/remove-duplicates', // 중복 정리 API
    '/api/plants/upload-excel' // 엑셀 업로드 API
  ];
  
  // 정확한 경로 매칭 또는 패턴 매칭 (경로에 매개변수가 있는 경우)
  const isPublicRoute = publicRoutes.some(route => {
    // 경로에 ':' 문자가 있으면 패턴 매칭 수행
    if (route.includes(':')) {
      // ':' 이후의 매개변수 부분을 정규 표현식으로 변환
      const pattern = route.replace(/:[^/]+/g, '[^/]+');
      // 정규 표현식으로 경로 검사
      return new RegExp(`^${pattern}$`).test(req.path);
    }
    // 정확한 경로 매칭
    return route === req.path;
  });
  
  if (isPublicRoute) {
    console.log(`Public access allowed for ${req.path}`);
    // Create a dummy user for the request if needed
    (req as any).isAuthenticated = () => true;
    (req as any).user = { id: 1, username: 'ralphpark', role: 'user', email: 'ralphpark@example.com' };
  }
  
  next();
};
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add our public access middleware before any other middleware
app.use(allowPublicAccess);

// 항상 JSON Content-Type 헤더 설정 미들웨어 - 정교한 설정
app.use((req, res, next) => {
  // API 경로 패턴을 명확하게 정의
  if (req.path.startsWith('/api/') || req.path.startsWith('/api_direct/') || req.path.startsWith('/__direct/')) {
    // API 경로에 대한 응답은 항상 JSON으로 설정
    console.log('API 요청 감지, JSON 응답 설정:', req.path);
    // 가이드에 따라 강화된 헤더 설정
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.type('json'); // Content-Type 강제 설정
    
    // Vite Dev Server 미들웨어를 건너뛰도록 플래그 설정
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

// Vite 미들웨어를 우회하는 직접 API 라우터 임포트
import directRouter from './direct-router';

// Vite 미들웨어를 등록하기 전에 직접 API 라우터 등록
app.use('/direct', directRouter);
app.use('/direct/plants', directRouter);

// 기존 경로도 호환성을 위해 유지
app.use('/__direct', directRouter);

(async () => {
  // API 라우트를 먼저 등록 (Vite 미들웨어보다 우선)
  const server = await registerRoutes(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // 가이드에 따른 에러 미들웨어 표준화 (마지막에 등록)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // 명시적으로 JSON 형식 및 Content-Type 강제 설정
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.type('json');
    
    // 가이드에 따른 표준화된 에러 응답 구조
    res.status(status).json({
      errorCode: err.code || 'INTERNAL_ERROR',
      message: message
    });
    
    throw err;
  });

  // 판매자 테이블 데이터 동기화
  try {
    await syncVendorsTable();
  } catch (error) {
    console.error("판매자 테이블 동기화 실패:", error);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT ? Number(process.env.PORT) : 5000;
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
// Force restart 2025년 12월 17일 수요일 02시 18분 10초 KST
