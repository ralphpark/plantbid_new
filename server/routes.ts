import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { orders, users, vendors, plants, reviews } from "@shared/schema";
import { setupAuth } from "./auth";
import { handleChatMessage } from "./ai";
import { searchAddressByQuery, getAddressByCoords, findNearbyVendors, getMapConfig } from "./map";
import { verifyBusinessNumber } from "./business-verification";
import { sendVerificationCode, verifyCode } from "./sms";
import { uploadImage, getUploadedImage } from "./uploads";
import multer from 'multer';
import * as XLSX from 'xlsx';
import { setupPaymentRoutes } from "./payments";
import { setupPortOneRoutes } from "./portone-payment";
import { setupPortOneV2Routes } from "./portone-v2-routes";
import { setupTestPayments } from "./test-payments";
import { setupMidTestRoutes } from "./mid-test-routes";
import { setupApiDirectRouter } from "./api_direct_router";
import { nanoid } from 'nanoid';
import { eq, asc, desc, sql, and, or, like, ilike, not } from "drizzle-orm";
import webhookRouter from "./webhook-handler";
import { DOMParser } from '@xmldom/xmldom';
import uploadRouter from "./upload-routes";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { setupPlantRoutes } from "./plant-routes";
// WebSocket 대신 HTTP 폴링 방식을 사용

export async function registerRoutes(app: Express): Promise<Server> {

  
  // Setup authentication routes
  setupAuth(app);
  
  // 식물 관리 라우트 설정
  setupPlantRoutes(app, storage);
  
  // 포트원 웹훅 라우터 등록 (인증 필요 없음)
  // 외부 서비스의 웹훅은 인증을 사용할 수 없으므로 가장 먼저 등록해야 함
  app.use('/api', webhookRouter);
  
  // 임시 관리자 비밀번호 재설정 엔드포인트 (개발 용도)
  app.get('/api/admin/reset-password', async (req, res) => {
    try {
      const { token } = req.query;
      // 보안을 위한 간단한 토큰 검증
      if (token !== 'dev-setup-token') {
        return res.status(401).json({ error: '인증 실패' });
      }
      
      // 관리자 계정 확인
      const admin = await db.query.users.findFirst({
        where: eq(storage.users.id, 2)
      });
      
      if (!admin || admin.username !== 'admin') {
        return res.status(404).json({ error: '관리자 계정을 찾을 수 없습니다' });
      }
      
      // 비밀번호 해시 직접 생성
      const scryptAsync = promisify(scrypt);
      const newPassword = 'admin123';
      const salt = randomBytes(16).toString("hex");
      const buf = (await scryptAsync(newPassword, salt, 64)) as Buffer;
      const hashedPassword = `${buf.toString("hex")}.${salt}`;
      
      // 비밀번호 업데이트
      await db.update(storage.users).set({
        password: hashedPassword
      }).where(eq(storage.users.id, 2));
      
      // Content-Type 헤더 명시적 설정
      res.setHeader('Content-Type', 'application/json');
      
      return res.json({ 
        success: true, 
        message: '관리자 비밀번호가 재설정되었습니다',
        username: 'admin',
        password: newPassword
      });
    } catch (error) {
      console.error('비밀번호 재설정 중 오류:', error);
      // Content-Type 헤더 명시적 설정
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ error: '서버 오류' });
    }
  });
  
  // 이미지 업로드 라우터 등록 (인증 필요 없음)
  app.use('/api/uploads', uploadRouter);
  
  // 판매자 프로필 업데이트를 위한 통합 업로드 엔드포인트 (FormData 처리)
  const profileUpload = multer({
    storage: multer.diskStorage({
      destination: './public/uploads',
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + '-' + file.originalname);
      }
    }),
    limits: { fileSize: 5 * 1024 * 1024 }
  });
  
  app.post('/api/upload', profileUpload.single('file'), async (req, res) => {
    console.log('🎯 /api/upload 엔드포인트 호출됨');
    console.log('요청 본문:', req.body);
    console.log('파일:', req.file);
    
    try {
      const { type } = req.body;
      
      // 프로필 업데이트 처리
      if (type === 'vendor-profile') {
        if (!req.isAuthenticated || !req.isAuthenticated()) {
          return res.status(401).json({ error: '로그인이 필요합니다' });
        }
        
        if (req.user!.role !== 'vendor') {
          return res.status(403).json({ error: '판매자만 접근할 수 있습니다' });
        }
        
        const vendor = await storage.getVendor(req.user!.id);
        if (!vendor) {
          return res.status(404).json({ error: '판매자를 찾을 수 없습니다' });
        }
        
        const { storeName, description, address, phone, profileImageUrl } = req.body;
        
        const updateData: any = {
          storeName: storeName || vendor.storeName,
          description: description !== undefined ? description : vendor.description,
          address: address || vendor.address,
          phone: phone || vendor.phone,
          profileImageUrl: profileImageUrl !== undefined ? profileImageUrl : vendor.profileImageUrl,
        };
        
        console.log('프로필 업데이트 데이터:', updateData);
        
        const updatedVendor = await storage.updateVendor(vendor.id, updateData);
        
        if (!updatedVendor) {
          return res.status(500).json({ error: '프로필 업데이트에 실패했습니다' });
        }
        
        return res.json(updatedVendor);
      }
      
      // 일반 이미지 업로드 처리
      if (type === 'profile' && req.file) {
        const imageUrl = `/uploads/${req.file.filename}`;
        return res.json({ 
          success: true, 
          url: imageUrl,
          filename: req.file.filename 
        });
      }
      
      // 파일이 있으면 업로드 URL 반환
      if (req.file) {
        const imageUrl = `/uploads/${req.file.filename}`;
        return res.json({ 
          success: true, 
          url: imageUrl,
          filename: req.file.filename 
        });
      }
      
      return res.status(400).json({ error: '처리할 수 없는 요청입니다' });
    } catch (error) {
      console.error('업로드 처리 오류:', error);
      return res.status(500).json({ error: '업로드 처리 중 오류가 발생했습니다' });
    }
  });
  
  // 먼저 공개 테스트 엔드포인트를 등록합니다 (순서 중요)
  // Add a public test endpoint that doesn't require authentication
  app.get('/api/payments/public-test', (req, res) => {
    try {
      // 직접 응답을 반환하여 서버에서 데이터베이스 조회를 하지 않도록 함
      console.log('공개 테스트 엔드포인트 호출됨');
      
      // Content-Type 헤더를 명시적으로 설정하여 HTML로 처리되지 않게 함
      res.setHeader('Content-Type', 'application/json');

      // 결제 취소를 위한 특별 엔드포인트 추가
      app.post('/api_direct/payments/cancel', async (req, res) => {
        try {
          const { orderId, reason } = req.body;
          
          if (!orderId) {
            return res.status(400).json({
              success: false,
              error: '주문 ID가 필요합니다.'
            });
          }
          
          // 결제 정보 조회
          const payment = await storage.getPaymentByOrderId(orderId);
          
          if (!payment) {
            return res.status(404).json({
              success: false,
              error: '결제 정보를 찾을 수 없습니다.'
            });
          }
          
          // 취소 처리
          payment.status = 'CANCELLED';
          payment.updatedAt = new Date();
          
          // 취소 정보 저장
          await storage.updatePayment(payment.id, payment);
          
          // 주문 상태 변경
          const updatedOrder = await storage.updateOrderStatusByOrderId(orderId, 'cancelled');
          
          if (!updatedOrder) {
            console.error(`주문 ID ${orderId}의 상태를 변경하지 못했습니다.`);
          } else {
            console.log(`결제 취소 완료 - 주문 ID: ${orderId}, 결제 ID: ${payment.id}`);
          }
          
          // 성공 응답
          return res.json({
            success: true,
            message: '결제가 성공적으로 취소되었습니다.',
            payment
          });
        } catch (error) {
          console.error('결제 취소 중 오류:', error);
          return res.status(500).json({
            success: false,
            error: '결제 취소 중 오류가 발생했습니다.'
          });
        }
      });
      
      res.status(200).json({
        success: true,
        message: '인증 없이 접근 가능한 공개 테스트 엔드포인트입니다.',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        apiType: 'public'
      });
    } catch (error) {
      console.error('공개 테스트 엔드포인트 오류:', error);
      res.status(500).json({
        success: false,
        error: '공개 테스트 엔드포인트 오류'
      });
    }
  });
  
  // Setup Test Payment routes (포트원 SDK 우회용 테스트 결제)
  setupTestPayments(app, storage);
  
  // Setup MID Test routes (상점 식별자 테스트용)
  setupMidTestRoutes(app, storage);
  
  // API 직접 라우터 설정 (미들웨어 간섭 없이 API 처리)
  const apiDirectRouter = setupApiDirectRouter(app, storage);
  app.use('/api_direct', apiDirectRouter);
  
  // 추가 공개 테스트 엔드포인트 - API_TEST로 시작하는 경로는 HTML 처리에서 확실히 피해가기 위함
  app.get('/API_TEST/payments/test-connection', (req, res) => {
    try {
      console.log('특수 테스트 엔드포인트 호출됨 - 결제 연결 테스트');
      
      // Content-Type 헤더를 명시적으로 설정
      res.setHeader('Content-Type', 'application/json');
      
      const portoneApiSecret = process.env.PORTONE_API_SECRET || '';
      const maskedApiKey = portoneApiSecret 
        ? `${portoneApiSecret.substring(0, 5)}...${portoneApiSecret.substring(portoneApiSecret.length - 5)}` 
        : '설정되지 않음';
      
      res.status(200).json({
        success: true,
        message: '테스트 연결 응답입니다.',
        apiKey: maskedApiKey,
        timestamp: new Date().toISOString()
      });
      return;
    } catch (error) {
      console.error('특수 테스트 엔드포인트 오류:', error);
      res.status(500).json({
        success: false,
        error: '특수 테스트 엔드포인트 오류'
      });
      return;
    }
  });
  
  // MID 테스트용 취소 API (특수 경로)
  app.post('/API_TEST/payments/cancel', async (req, res) => {
    try {
      // 명시적으로 Content-Type을 JSON으로 설정
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      console.log('특수 테스트 엔드포인트 호출됨 - MID 취소 테스트');
      console.log('요청 본문:', req.body);
      
      const { orderId, reason, merchantId = 'MOI3204387' } = req.body;
      
      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: '주문 ID가 필요합니다',
          timestamp: new Date().toISOString()
        });
      }
      
      // 테스트용 결제 정보를 검색해 보고, 없으면 테스트 모드로 진행
      console.log(`주문 ID로 결제 정보 조회: ${orderId}`);
      
      // API 테스트를 위한 모의 응답 (실제 API 연동 없이)      
      // 테스트 응답 데이터 (성공적인 취소)
      return res.status(200).json({
        success: true,
        message: 'MID 테스트용 취소 응답',
        orderId: orderId,
        merchantId: merchantId,
        reason: reason || 'MID 테스트를 위한 취소',
        timestamp: new Date().toISOString(),
        testMode: true
      });
    } catch (error: any) {
      console.error('MID 취소 테스트 오류:', error);
      return res.status(500).json({
        success: false,
        error: '취소 테스트 중 오류가 발생했습니다',
        message: error.message || '알 수 없는 오류'
      });
    }
  });
  
  // 자동 결제 동기화 테스트 엔드포인트
  app.post('/API_TEST/payments/auto-sync', (req, res) => {
    try {
      console.log('특수 테스트 엔드포인트 호출됨 - 결제 자동 동기화');
      
      // Content-Type 헤더를 명시적으로 설정
      res.setHeader('Content-Type', 'application/json');
      
      // 요청 본문에서 orderId 추출
      const { orderId } = req.body;
      
      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: '주문 ID가 필요합니다',
          timestamp: new Date().toISOString()
        });
      }
      
      // 모의 데이터 반환
      res.status(200).json({
        success: true,
        message: '결제 자동 동기화 성공',
        payment: {
          id: `payment_${nanoid(8)}`,
          orderId: orderId,
          paymentKey: `INIPayment_${nanoid(12)}`,
          method: 'CARD',
          status: 'DONE',
          amount: 15000,
          approvedAt: new Date().toISOString(),
          receipt: {
            url: `https://iniweb.inicis.com/receipt/MOI3204387_${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}_00001`
          }
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('테스트 자동 동기화 엔드포인트 오류:', error);
      res.status(500).json({
        success: false,
        error: '테스트 자동 동기화 엔드포인트 오류'
      });
    }
  });
  
  // 결제 취소 테스트 엔드포인트
  app.post('/API_TEST/payments/cancel', (req, res) => {
    try {
      console.log('특수 테스트 엔드포인트 호출됨 - 결제 취소');
      
      // Content-Type 헤더를 명시적으로 설정
      res.setHeader('Content-Type', 'application/json');
      
      // 요청 본문에서 orderId 추출
      const { orderId, reason } = req.body;
      
      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: '주문 ID가 필요합니다',
          timestamp: new Date().toISOString()
        });
      }
      
      // 모의 데이터 반환
      res.status(200).json({
        success: true,
        message: '결제 취소 성공',
        cancelledPayment: {
          id: `payment_${nanoid(8)}`,
          orderId: orderId,
          paymentKey: `INIPayment_${nanoid(12)}`,
          status: 'CANCELLED',
          cancelReason: reason || '고객 요청에 의한 취소',
          cancelledAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('테스트 결제 취소 엔드포인트 오류:', error);
      res.status(500).json({
        success: false,
        error: '테스트 결제 취소 엔드포인트 오류'
      });
    }
  });
  
  // 주문 및 결제 상태 복원 엔드포인트 - 테스트용
  app.post('/api/payments/restore', async (req, res) => {
    try {
      console.log('주문 및 결제 상태 복원 엔드포인트 호출됨');
      
      // Content-Type 헤더를 명시적으로 설정
      res.setHeader('Content-Type', 'application/json');
      
      // 요청 본문에서 orderId 추출
      const { orderId } = req.body;
      
      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: '주문 ID가 필요합니다',
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`주문 ID ${orderId}의 상태를 'paid'로 복원합니다`);
      
      // 1. 결제 정보 조회
      const payment = await storage.getPaymentByOrderId(orderId);
      
      if (!payment) {
        console.log(`주문 ID ${orderId}에 대한 결제 정보를 찾을 수 없습니다`);
        return res.status(404).json({
          success: false,
          message: '결제 정보를 찾을 수 없습니다',
          timestamp: new Date().toISOString()
        });
      }
      
      // 2. 결제 상태 업데이트
      const updatedPayment = await storage.updatePayment(payment.id, {
        status: 'DONE',
        updatedAt: new Date(),
        cancelReason: null,
        cancelledAt: null
      });
      
      // 3. 주문 상태 업데이트
      const updatedOrder = await storage.updateOrderStatusByOrderId(orderId, 'paid');
      
      if (!updatedOrder) {
        console.error(`주문 ID ${orderId}의 상태를 변경하지 못했습니다`);
        return res.status(500).json({
          success: false,
          message: '주문 상태를 업데이트하지 못했습니다',
          timestamp: new Date().toISOString()
        });
      }
      
      console.log(`주문 ID ${orderId}의 상태가 성공적으로 'paid'로 복원되었습니다`);
      
      // 4. 응답 반환
      res.status(200).json({
        success: true,
        message: '주문 및 결제 상태가 성공적으로 복원되었습니다',
        payment: updatedPayment,
        order: updatedOrder,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('주문 상태 복원 중 오류:', error);
      res.status(500).json({
        success: false,
        error: '주문 상태 복원 중 오류가 발생했습니다'
      });
    }
  });
  
  app.get('/API_TEST/payments/inicis-search', (req, res) => {
    try {
      console.log('특수 테스트 엔드포인트 호출됨 - 이니시스 결제 검색');
      
      // Content-Type 헤더를 명시적으로 설정
      res.setHeader('Content-Type', 'application/json');
      
      // 월별 결제를 확인하기 위한 반복 데이터 생성 (3개월 데이터)
      const payments = [];
      const thisMonth = new Date();
      
      // 현재 월 결제
      payments.push({
        id: `MOI3204387_${thisMonth.getFullYear()}${String(thisMonth.getMonth() + 1).padStart(2, '0')}_00001`,
        order_id: 'order_4mDOPvgBhm',
        status: 'DONE',
        method: 'CARD', 
        amount: 12000,
        currency: 'KRW',
        payment_date: new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 10).toISOString().slice(0, 10),
        receipt_url: `https://iniweb.inicis.com/receipt/MOI3204387_${thisMonth.getFullYear()}${String(thisMonth.getMonth() + 1).padStart(2, '0')}_00001`,
        pg_provider: 'INICIS',
        pg_id: 'MOI3204387'
      });
      
      // 지난 월 결제
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      payments.push({
        id: `MOI3204387_${lastMonth.getFullYear()}${String(lastMonth.getMonth() + 1).padStart(2, '0')}_00001`,
        order_id: 'order_2kLQRbgSan',
        status: 'DONE',
        method: 'CARD',
        amount: 15000,
        currency: 'KRW',
        payment_date: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 15).toISOString().slice(0, 10),
        receipt_url: `https://iniweb.inicis.com/receipt/MOI3204387_${lastMonth.getFullYear()}${String(lastMonth.getMonth() + 1).padStart(2, '0')}_00001`,
        pg_provider: 'INICIS',
        pg_id: 'MOI3204387'
      });
      
      // 2개월 전 결제
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      payments.push({
        id: `MOI3204387_${twoMonthsAgo.getFullYear()}${String(twoMonthsAgo.getMonth() + 1).padStart(2, '0')}_00001`,
        order_id: 'order_9pZXYwgFqr',
        status: 'DONE',
        method: 'CARD',
        amount: 8500,
        currency: 'KRW',
        payment_date: new Date(twoMonthsAgo.getFullYear(), twoMonthsAgo.getMonth(), 5).toISOString().slice(0, 10),
        receipt_url: `https://iniweb.inicis.com/receipt/MOI3204387_${twoMonthsAgo.getFullYear()}${String(twoMonthsAgo.getMonth() + 1).padStart(2, '0')}_00001`,
        pg_provider: 'INICIS',
        pg_id: 'MOI3204387'
      });
      
      res.status(200).json({
        success: true,
        message: '이니시스 결제 검색 응답',
        data: { payments },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('테스트 엔드포인트 오류:', error);
      res.status(500).json({
        success: false,
        error: '테스트 엔드포인트 오류'
      });
    }
  });

  // Additional API routes
  app.get("/api/plants", async (req, res) => {
    try {
      const plants = await storage.getAllPlants();
      res.json(plants);
    } catch (error) {
      console.error("Error fetching plants:", error);
      res.status(500).json({ error: "Failed to fetch plants" });
    }
  });

  // 인기 식물 API - 실제 구매된 식물만 반환 (위치 기반 필터링 지원)
  app.get("/api/plants/popular", async (req, res) => {
    try {
      const { lat, lng, radius } = req.query;
      const allOrders = await db.select().from(orders);
      const allProducts = await storage.getAllProducts();
      const allVendors = await storage.getAllVendors();
      
      let filteredVendors = allVendors;
      
      // 좌표와 반경이 제공된 경우 거리 기반 필터링
      if (lat && lng && radius) {
        const centerLat = parseFloat(lat as string);
        const centerLng = parseFloat(lng as string);
        const radiusKm = parseFloat(radius as string);
        
        filteredVendors = allVendors.filter(vendor => {
          if (!vendor.latitude || !vendor.longitude) return false;
          
          const dlat = (vendor.latitude - centerLat) * 111;
          const dlng = (vendor.longitude - centerLng) * 111 * Math.cos(centerLat * Math.PI / 180);
          const distance = Math.sqrt(dlat * dlat + dlng * dlng);
          return distance <= radiusKm;
        });
      }
      
      const plantSales = new Map();
      
      for (const order of allOrders) {
        if (order.status === 'paid' || order.status === 'delivered' || order.status === 'completed') {
          const product = allProducts.find(p => p.id === order.productId);
          if (product && product.plantId) {
            if (filteredVendors.find(v => v.id === product.userId)) {
              const count = plantSales.get(product.plantId) || 0;
              plantSales.set(product.plantId, count + 1);
            }
          }
        }
      }
      
      const sortedPlantIds = Array.from(plantSales.entries())
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0]);
      
      const allPlants = await storage.getAllPlants();
      const popularPlants = sortedPlantIds
        .map(id => allPlants.find(p => p.id === id))
        .filter(Boolean)
        .slice(0, 10);
      
      res.json(popularPlants.length > 0 ? popularPlants : allPlants.slice(0, 10));
    } catch (error) {
      console.error("Error fetching popular plants:", error);
      res.status(500).json({ error: "Failed to fetch popular plants" });
    }
  });

  // 인기 판매자 API - 위치 기반 필터링 지원 (지역 내 모든 판매자, 판매 실적 우선 정렬)
  app.get("/api/vendors/popular", async (req, res) => {
    try {
      const { lat, lng, radius } = req.query;
      const allOrders = await db.select().from(orders);
      const allReviews = await db.select().from(reviews);
      const allVendors = await storage.getAllVendors();
      
      let vendorsToShow = allVendors;
      
      // 좌표와 반경이 제공된 경우 거리 기반 필터링
      if (lat && lng && radius) {
        const centerLat = parseFloat(lat as string);
        const centerLng = parseFloat(lng as string);
        const radiusKm = parseFloat(radius as string);
        
        console.log(`[판매자 필터링] 중심: (${centerLat}, ${centerLng}), 반경: ${radiusKm}km`);
        
        // 좌표가 있는 판매자만 거리 필터링, 좌표가 없는 판매자는 모두 표시
        const vendorsWithCoords = allVendors.filter(v => v.latitude && v.longitude);
        const vendorsWithoutCoords = allVendors.filter(v => !v.latitude || !v.longitude);
        
        const filteredWithCoords = vendorsWithCoords.filter(vendor => {
          const dlat = (vendor.latitude! - centerLat) * 111;
          const dlng = (vendor.longitude! - centerLng) * 111 * Math.cos(centerLat * Math.PI / 180);
          const distance = Math.sqrt(dlat * dlat + dlng * dlng);
          
          if (distance <= radiusKm) {
            console.log(`  [포함] ${vendor.storeName} - 거리: ${distance.toFixed(2)}km`);
            return true;
          }
          return false;
        });
        
        vendorsToShow = [...filteredWithCoords, ...vendorsWithoutCoords];
        console.log(`[판매자 필터링 결과] 거리 기반: ${filteredWithCoords.length}명, 좌표없음: ${vendorsWithoutCoords.length}명, 총: ${vendorsToShow.length}명`);
      }
      
      // 판매 실적 카운팅
      const vendorSales = new Map();
      
      for (const order of allOrders) {
        if (order.status === 'paid' || order.status === 'delivered' || order.status === 'completed') {
          if (vendorsToShow.find(v => v.id === order.vendorId)) {
            const count = vendorSales.get(order.vendorId) || 0;
            vendorSales.set(order.vendorId, count + 1);
          }
        }
      }
      
      // 평점 계산 (reviews 테이블에서 실시간으로 계산)
      const vendorRatings = new Map();
      for (const review of allReviews) {
        const ratings = vendorRatings.get(review.vendorId) || [];
        ratings.push(review.rating);
        vendorRatings.set(review.vendorId, ratings);
      }
      
      // 모든 vendorsToShow를 반환하되, 판매 기록이 있는 것을 우선 정렬 (초기 페이지는 최대 8개)
      const vendorsSorted = vendorsToShow.sort((a, b) => {
        const aCount = vendorSales.get(a.id) || 0;
        const bCount = vendorSales.get(b.id) || 0;
        return bCount - aCount;
      }).slice(0, 8);
      
      const popularVendors = vendorsSorted
        .map(vendor => {
          const vendorReviews = vendorRatings.get(vendor.id) || [];
          const rating = vendorReviews.length > 0 
            ? vendorReviews.reduce((sum, r) => sum + r, 0) / vendorReviews.length 
            : null;
          
          return {
            id: vendor.id,
            storeName: vendor.storeName,
            description: vendor.description,
            profileImageUrl: vendor.profileImageUrl,
            address: vendor.address,
            rating: rating,
            totalSales: vendorSales.get(vendor.id) || 0,
            isVerified: vendor.isVerified,
            latitude: vendor.latitude,
            longitude: vendor.longitude
          };
        })
        .filter(Boolean);
      
      console.log(`[판매자 API 응답] ${popularVendors.length}명의 판매자 반환 (판매 실적 우선 정렬)`);
      res.json(popularVendors);
    } catch (error) {
      console.error("Error fetching popular vendors:", error);
      res.status(500).json({ error: "Failed to fetch popular vendors" });
    }
  });

  // 바로 구매 가능한 상품 API (지역 필터링 지원)
  app.get("/api/products/available", async (req, res) => {
    try {
      const { region, lat, lng, radius } = req.query;
      const allVendors = await storage.getAllVendors();
      const allProducts = await storage.getAllProducts();
      
      let filteredVendors = allVendors;
      
      // 좌표와 반경이 제공된 경우 거리 기반 필터링 (우선)
      if (lat && lng && radius) {
        const centerLat = parseFloat(lat as string);
        const centerLng = parseFloat(lng as string);
        const radiusKm = parseFloat(radius as string);
        
        console.log(`[상품 필터링] 중심: (${centerLat}, ${centerLng}), 반경: ${radiusKm}km`);
        
        // 좌표가 있는 판매자만 거리 필터링, 좌표가 없는 판매자는 모두 포함
        const vendorsWithCoords = allVendors.filter(v => v.latitude && v.longitude);
        const vendorsWithoutCoords = allVendors.filter(v => !v.latitude || !v.longitude);
        
        const filteredWithCoords = vendorsWithCoords.filter(vendor => {
          const dlat = (vendor.latitude! - centerLat) * 111;
          const dlng = (vendor.longitude! - centerLng) * 111 * Math.cos(centerLat * Math.PI / 180);
          const distance = Math.sqrt(dlat * dlat + dlng * dlng);
          return distance <= radiusKm;
        });
        
        filteredVendors = [...filteredWithCoords, ...vendorsWithoutCoords];
        console.log(`[상품 필터링 결과] 거리 기반: ${filteredWithCoords.length}명, 좌표없음: ${vendorsWithoutCoords.length}명, 총: ${filteredVendors.length}명`);
      } else if (region && region !== '내 지역') {
        // 문자열 기반 필터링 (지역 기반)
        filteredVendors = allVendors.filter(v => v.address?.includes(region as string));
      }
      
      if (filteredVendors.length === 0) {
        return res.json([]);
      }
      
      // 필터링된 판매자들의 상품만 수집
      const availableProducts = [];
      for (const product of allProducts) {
        const vendorId = product.userId || (product as any).vendorId;
        if (filteredVendors.find(v => v.id === vendorId)) {
          const vendor = filteredVendors.find(v => v.id === vendorId);
          availableProducts.push({
            id: product.id,
            plantId: product.plantId,
            vendorId: product.userId,
            name: product.name,
            description: product.description,
            price: parseFloat(product.price.toString()),
            imageUrl: product.imageUrl,
            stock: product.stock,
            vendorName: vendor?.storeName || '판매자',
            vendorAddress: vendor?.address || '',
            plantName: product.name
          });
        }
      }
      
      console.log(`[상품 API 응답] ${availableProducts.length}개의 상품 반환`);
      res.json(availableProducts.slice(0, 20));
    } catch (error) {
      console.error("Error fetching available products:", error);
      res.status(500).json({ error: "Failed to fetch available products" });
    }
  });
  
  // 플랜트 검색 API
  app.get("/api/plants/search", async (req, res) => {
    try {
      const query = req.query.q as string || '';
      
      // 전체 식물 목록 가져오기
      const allPlants = await storage.getAllPlants();
      
      if (!query) {
        // 검색어가 없으면 전체 목록 반환
        return res.json(allPlants);
      }
      
      // 검색어로 필터링 (대소문자 구분 없이)
      const searchLower = query.toLowerCase();
      const filteredPlants = allPlants.filter(plant => 
        plant.name.toLowerCase().includes(searchLower)
      );
      
      res.json(filteredPlants);
    } catch (error) {
      console.error("Error searching plants:", error);
      res.status(500).json({ error: "Failed to search plants" });
    }
  });

  // 식물 상세 정보는 direct-router에서 처리됨 (/direct/plants/:id)

  app.get("/api/vendors/storeName/:storeName", async (req, res) => {
    try {
      const { storeName } = req.params;
      const vendors = await storage.getVendorsByStoreName(storeName);
      res.json(vendors);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      res.status(500).json({ error: "Failed to fetch vendors" });
    }
  });
  
  // 현재 로그인한 판매자의 위치 정보를 조회하는 API
  app.get("/api/vendors/location", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    
    if (req.user!.role !== 'vendor') {
      return res.status(403).json({ error: "판매자만 접근할 수 있습니다" });
    }
    
    try {
      const vendor = await storage.getVendor(req.user!.id);
      
      if (!vendor) {
        return res.status(404).json({ error: "판매자 정보를 찾을 수 없습니다" });
      }
      
      // 판매자 위치 정보 반환
      res.json({
        success: true,
        location: {
          latitude: vendor.latitude || 0,
          longitude: vendor.longitude || 0,
          address: vendor.address || "위치 정보가 설정되지 않았습니다"
        }
      });
    } catch (error) {
      console.error("판매자 위치 정보 조회 에러:", error);
      res.status(500).json({ 
        success: false, 
        error: "위치 정보를 불러오는데 실패했습니다" 
      });
    }
  });
  
  // 현재 로그인한 판매자 프로필 가져오기
  app.get("/api/vendors/me", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    
    if (req.user!.role !== 'vendor') {
      return res.status(403).json({ error: "판매자만 접근할 수 있습니다" });
    }
    
    try {
      const vendor = await storage.getVendor(req.user!.id);
      
      if (!vendor) {
        return res.status(404).json({ error: "판매자 정보를 찾을 수 없습니다" });
      }
      
      res.json(vendor);
    } catch (error) {
      console.error("현재 판매자 정보 조회 오류:", error);
      res.status(500).json({ error: "판매자 정보를 가져오는 중 오류가 발생했습니다" });
    }
  });

  // 현재 로그인한 판매자 프로필 업데이트 (/api/vendors/me 버전)
  app.patch("/api/vendors/me", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    if (req.user!.role !== 'vendor') {
      return res.status(403).json({ error: "판매자만 접근할 수 있습니다" });
    }

    try {
      const vendor = await storage.getVendor(req.user!.id);
      
      if (!vendor) {
        return res.status(404).json({ error: "판매자를 찾을 수 없습니다" });
      }
      
      const { storeName, description, address, phone, email, profileImageUrl, latitude, longitude } = req.body;
      
      // 좌표 값 검증 및 정규화
      let lat: number | undefined;
      let lng: number | undefined;
      
      if (latitude !== undefined && latitude !== null) {
        lat = parseFloat(String(latitude));
        if (isNaN(lat)) lat = undefined;
      }
      
      if (longitude !== undefined && longitude !== null) {
        lng = parseFloat(String(longitude));
        if (isNaN(lng)) lng = undefined;
      }
      
      const updateData: any = {
        storeName: storeName || vendor.storeName,
        description: description !== undefined ? description : vendor.description,
        address: address || vendor.address,
        phone: phone || vendor.phone,
        email: email || vendor.email,
        profileImageUrl: profileImageUrl !== undefined ? profileImageUrl : vendor.profileImageUrl,
      };
      
      // 좌표 추가 (유효한 경우만)
      if (lat !== undefined) updateData.latitude = lat;
      if (lng !== undefined) updateData.longitude = lng;
      
      console.log("판매자 업데이트 데이터:", updateData);
      
      const updatedVendor = await storage.updateVendor(vendor.id, updateData);
      
      if (!updatedVendor) {
        return res.status(500).json({ error: "프로필 업데이트에 실패했습니다" });
      }
      
      res.json(updatedVendor);
    } catch (error) {
      console.error("판매자 프로필 업데이트 오류:", error);
      res.status(500).json({ error: "프로필 업데이트 중 오류가 발생했습니다" });
    }
  });

  // 현재 로그인한 판매자 프로필 업데이트 (POST 버전 - Vite 우회용)
  app.post("/api/vendors/me", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    if (req.user!.role !== 'vendor') {
      return res.status(403).json({ error: "판매자만 접근할 수 있습니다" });
    }

    try {
      const vendor = await storage.getVendor(req.user!.id);
      
      if (!vendor) {
        return res.status(404).json({ error: "판매자를 찾을 수 없습니다" });
      }
      
      const { storeName, description, address, phone, email, profileImageUrl, latitude, longitude } = req.body;
      
      // 좌표 값 검증 및 정규화
      let lat: number | undefined;
      let lng: number | undefined;
      
      if (latitude !== undefined && latitude !== null) {
        lat = parseFloat(String(latitude));
        if (isNaN(lat)) lat = undefined;
      }
      
      if (longitude !== undefined && longitude !== null) {
        lng = parseFloat(String(longitude));
        if (isNaN(lng)) lng = undefined;
      }
      
      const updateData: any = {
        storeName: storeName || vendor.storeName,
        description: description !== undefined ? description : vendor.description,
        address: address || vendor.address,
        phone: phone || vendor.phone,
        email: email || vendor.email,
        profileImageUrl: profileImageUrl !== undefined ? profileImageUrl : vendor.profileImageUrl,
      };
      
      // 좌표 추가 (유효한 경우만)
      if (lat !== undefined) updateData.latitude = lat;
      if (lng !== undefined) updateData.longitude = lng;
      
      console.log("판매자 업데이트 데이터:", updateData);
      
      const updatedVendor = await storage.updateVendor(vendor.id, updateData);
      
      if (!updatedVendor) {
        return res.status(500).json({ error: "프로필 업데이트에 실패했습니다" });
      }
      
      res.json(updatedVendor);
    } catch (error) {
      console.error("판매자 프로필 업데이트 오류:", error);
      res.status(500).json({ error: "프로필 업데이트 중 오류가 발생했습니다" });
    }
  });

  // 판매자 프로필 업데이트 (새로운 경로 - Vite 우회용)
  app.post("/api/vendor-profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    if (req.user!.role !== 'vendor') {
      return res.status(403).json({ error: "판매자만 접근할 수 있습니다" });
    }

    try {
      const vendor = await storage.getVendor(req.user!.id);
      
      if (!vendor) {
        return res.status(404).json({ error: "판매자를 찾을 수 없습니다" });
      }
      
      const { storeName, description, address, phone, email, profileImageUrl, latitude, longitude } = req.body;
      
      let lat: number | undefined;
      let lng: number | undefined;
      
      if (latitude !== undefined && latitude !== null) {
        lat = parseFloat(String(latitude));
        if (isNaN(lat)) lat = undefined;
      }
      
      if (longitude !== undefined && longitude !== null) {
        lng = parseFloat(String(longitude));
        if (isNaN(lng)) lng = undefined;
      }
      
      const updateData: any = {
        storeName: storeName || vendor.storeName,
        description: description !== undefined ? description : vendor.description,
        address: address || vendor.address,
        phone: phone || vendor.phone,
        email: email || vendor.email,
        profileImageUrl: profileImageUrl !== undefined ? profileImageUrl : vendor.profileImageUrl,
      };
      
      if (lat !== undefined) updateData.latitude = lat;
      if (lng !== undefined) updateData.longitude = lng;
      
      console.log("판매자 프로필 업데이트 데이터:", updateData);
      
      const updatedVendor = await storage.updateVendor(vendor.id, updateData);
      
      if (!updatedVendor) {
        return res.status(500).json({ error: "프로필 업데이트에 실패했습니다" });
      }
      
      res.json(updatedVendor);
    } catch (error) {
      console.error("판매자 프로필 업데이트 오류:", error);
      res.status(500).json({ error: "프로필 업데이트 중 오류가 발생했습니다" });
    }
  });
  
  // 사용자 ID로 판매자 정보 조회 (제품 목록 + 평균 평점 포함)
  app.get("/api/vendors/byUserId/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const vendor = await storage.getVendorByUserId(userId);
      
      if (!vendor) {
        return res.status(404).json({ error: "판매자를 찾을 수 없습니다" });
      }

      // 리뷰 평균 계산
      let averageRating: number | null = null; // 기본값: 리뷰 없음
      const vendorReviews = await storage.getReviewsForVendor(vendor.id);
      console.log(`판매자 ${vendor.id} 리뷰 조회: ${vendorReviews.length}건`, vendorReviews);
      
      if (vendorReviews.length > 0) {
        const totalRating = vendorReviews.reduce((sum, r) => sum + r.rating, 0);
        averageRating = parseFloat((totalRating / vendorReviews.length).toFixed(1));
        console.log(`평균 평점 계산: 총점 ${totalRating} / ${vendorReviews.length}개 = ${averageRating}`);
      }

      const vendorData = {
        ...vendor,
        storeName: vendor.storeName || vendor.description || `판매자 ${vendor.id}`,
        rating: averageRating !== null ? averageRating.toString() : null,
        color: vendor.color || 
          (vendor.id % 3 === 0 
            ? { bg: "bg-lime-50", border: "border-lime-200" } 
            : vendor.id % 3 === 1 
              ? { bg: "bg-cyan-50", border: "border-cyan-200" }
              : { bg: "bg-amber-50", border: "border-amber-200" }
          )
      };

      res.json(vendorData);
    } catch (error) {
      console.error("판매자 정보 조회 오류:", error);
      res.status(500).json({ error: "판매자 정보를 가져오는 중 오류가 발생했습니다" });
    }
  });

  // 특정 판매자 정보 가져오기 (제품 목록 + 평균 평점 포함)
  app.get("/api/vendors/:id", async (req, res) => {
    try {
      const vendorId = parseInt(req.params.id);
      const vendorWithProducts = await storage.getVendorWithProducts(vendorId);
      
      // 리뷰 평균 계산
      let averageRating: number | null = null; // 기본값: 리뷰 없음
      const vendorReviews = await storage.getReviewsForVendor(vendorId);
      console.log(`판매자 ${vendorId} 리뷰 조회: ${vendorReviews.length}건`, vendorReviews);
      
      if (vendorReviews.length > 0) {
        const totalRating = vendorReviews.reduce((sum, r) => sum + r.rating, 0);
        averageRating = parseFloat((totalRating / vendorReviews.length).toFixed(1));
        console.log(`평균 평점 계산: 총점 ${totalRating} / ${vendorReviews.length}개 = ${averageRating}`);
      }
      
      if (!vendorWithProducts) {
        const vendor = await storage.getVendor(vendorId);
        if (!vendor) {
          return res.status(404).json({ error: "판매자를 찾을 수 없습니다" });
        }
        
        const vendorData = {
          ...vendor,
          storeName: vendor.storeName || vendor.description || `판매자 ${vendorId}`,
          products: [],
          rating: averageRating !== null ? averageRating.toString() : null,
          color: vendor.color || 
            (vendorId % 3 === 0 
              ? { bg: "bg-lime-50", border: "border-lime-200" } 
              : vendorId % 3 === 1 
                ? { bg: "bg-cyan-50", border: "border-cyan-200" }
                : { bg: "bg-amber-50", border: "border-amber-200" }
            )
        };
        return res.json(vendorData);
      }
      
      const { vendor, products } = vendorWithProducts;
      
      const vendorData = {
        ...vendor,
        storeName: vendor.storeName || vendor.description || `판매자 ${vendorId}`,
        products: products,
        rating: averageRating !== null ? averageRating.toString() : null,
        color: vendor.color || 
          (vendorId % 3 === 0 
            ? { bg: "bg-lime-50", border: "border-lime-200" } 
            : vendorId % 3 === 1 
              ? { bg: "bg-cyan-50", border: "border-cyan-200" }
              : { bg: "bg-amber-50", border: "border-amber-200" }
          )
      };
      
      console.log(`API에서 반환하는 판매자 정보 - ID: ${vendorId}, 상호명: ${vendorData.storeName}, 제품 수: ${products.length}, 평균 평점: ${averageRating}`);
      
      res.json(vendorData);
    } catch (error) {
      console.error("판매자 정보 조회 오류:", error);
      res.status(500).json({ error: "판매자 정보를 가져오는 중 오류가 발생했습니다" });
    }
  });

  // CORS 프리플라이트 처리 - OPTIONS 요청
  app.options("/api/vendors/:id", (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send('OK');
  });

  // 판매자 프로필 업데이트
  app.patch("/api/vendors/:id", async (req, res) => {
    console.log(`[PATCH] /api/vendors/:id 요청 수신 - vendorId: ${req.params.id}`);
    console.log('[PATCH] 요청 바디:', req.body);
    
    // 응답 헤더를 명시적으로 JSON으로 설정
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    if (!req.isAuthenticated()) {
      console.error('[PATCH] 인증 없음');
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    try {
      const vendorId = parseInt(req.params.id);
      console.log(`[PATCH] 판매자 ID 파싱: ${vendorId}`);
      
      const vendor = await storage.getVendor(vendorId);
      console.log('[PATCH] 기존 판매자 조회:', vendor ? `ID ${vendor.id}` : 'null');
      
      if (!vendor) {
        return res.status(404).json({ error: "판매자를 찾을 수 없습니다" });
      }
      
      if (vendor.userId !== req.user!.id && req.user!.role !== 'admin') {
        return res.status(403).json({ error: "본인의 프로필만 수정할 수 있습니다" });
      }
      
      const { storeName, description, address, phone, email, profileImageUrl, latitude, longitude } = req.body;
      
      // 좌표 값 검증 및 정규화
      let lat: number | undefined;
      let lng: number | undefined;
      
      if (latitude !== undefined && latitude !== null) {
        lat = parseFloat(String(latitude));
        if (isNaN(lat)) lat = undefined;
      }
      
      if (longitude !== undefined && longitude !== null) {
        lng = parseFloat(String(longitude));
        if (isNaN(lng)) lng = undefined;
      }
      
      const updateData: any = {
        storeName: storeName || vendor.storeName,
        description: description !== undefined ? description : vendor.description,
        address: address || vendor.address,
        phone: phone || vendor.phone,
        email: email || vendor.email,
        profileImageUrl: profileImageUrl !== undefined ? profileImageUrl : vendor.profileImageUrl,
      };
      
      // 좌표 추가 (유효한 경우만)
      if (lat !== undefined) updateData.latitude = lat;
      if (lng !== undefined) updateData.longitude = lng;
      
      console.log("[PATCH] 판매자 업데이트 데이터:", updateData);
      
      const updatedVendor = await storage.updateVendor(vendorId, updateData);
      
      if (!updatedVendor) {
        console.error('[PATCH] 프로필 업데이트 실패');
        return res.status(500).json({ error: "프로필 업데이트에 실패했습니다" });
      }
      
      console.log('[PATCH] 프로필 업데이트 성공:', updatedVendor.id);
      return res.status(200).json(updatedVendor);
    } catch (error) {
      console.error("[PATCH] 판매자 프로필 업데이트 오류:", error);
      return res.status(500).json({ error: "프로필 업데이트 중 오류가 발생했습니다" });
    }
  });

  // AI Chat API
  app.post("/api/ai/chat", handleChatMessage);

  // Conversations API routes
  app.get("/api/conversations/latest", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const userId = req.user!.id;
      const conversations = await storage.getConversationsForUser(userId);
      
      // 가장 최근 대화 반환 또는 빈 객체
      const latestConversation = conversations.length > 0 
        ? conversations[0] 
        : null;
      
      res.json(latestConversation);
    } catch (error) {
      console.error("Error fetching latest conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });
  
  // 모든 대화 목록 가져오기
  app.get("/api/conversations", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const userId = req.user!.id;
      const conversations = await storage.getConversationsForUser(userId);
      
      // 각 대화에서 첫 메시지만 미리보기로 사용
      const conversationPreviews = conversations.map(conversation => {
        const firstMessage = conversation.messages && conversation.messages.length > 0 
          ? conversation.messages[0].content 
          : "";
        
        const messageCount = conversation.messages ? conversation.messages.length : 0;
        
        return {
          id: conversation.id,
          preview: firstMessage.length > 50 ? firstMessage.substring(0, 50) + "..." : firstMessage,
          messageCount,
          lastUpdated: conversation.updatedAt || conversation.createdAt,
          hasRecommendations: conversation.messages?.some(msg => msg.recommendations && msg.recommendations.length > 0) || false
        };
      });
      
      res.json(conversationPreviews);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });
  
  // 특정 대화 가져오기
  app.get("/api/conversations/:id", async (req, res) => {
    // 개발 모드에서는 인증 우회 허용
    if (!req.isAuthenticated() && process.env.NODE_ENV !== 'development') {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const conversationId = parseInt(req.params.id);
      const conversation = await storage.getConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      // 요청한 사용자가 대화 소유자이거나 판매자인 경우에만 접근 허용
      // 개발 모드의 경우 기본값 설정
      let isOwner = false;
      let isVendor = false;
      let vendorId = 0;
      
      // 인증된 사용자인 경우 권한 확인
      if (req.user) {
        isOwner = conversation.userId === req.user.id;
        isVendor = req.user.role === 'vendor';
        vendorId = req.user.id;
      } else if (process.env.NODE_ENV === 'development') {
        // 개발 모드에서는 모든 접근 허용
        isOwner = true; 
        vendorId = 3; // 개발용 기본 판매자 ID
      }
      
      if (!isOwner && !isVendor && process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ error: "Unauthorized access to conversation" });
      }
      
      // 대화 내용을 복사하여 판매자에 맞게 필터링
      let responseConversation = { ...conversation };
      
      // 판매자인 경우 대화 내용을 필터링 (또는 개발 모드)
      if ((isVendor && !isOwner) || process.env.NODE_ENV === 'development') {
        // 판매자에게 모든 대화 내역을 표시하도록 변경
        // 필터링을 적용하지 않고 모든 메시지를 반환
        console.log(`[판매자 대화 조회 개선] 판매자 ID ${vendorId}가 대화 ID ${conversationId}의 모든 메시지를 조회합니다`);
        
        // 모든 유효한 메시지만 필터링 (내용이 있거나 product 또는 referenceImages가 있는 메시지)
        const validMessages = conversation.messages.filter(msg => 
          msg && (
            (msg.content !== undefined && msg.content !== null && msg.content !== '') || 
            msg.product || 
            (msg.referenceImages && msg.referenceImages.length > 0)
          )
        );
        
        // 디버깅: 필터링 된 메시지와 원본 메시지 로깅
        console.log(`[대화 디버깅] 원본 메시지 수: ${conversation.messages.length}`);
        console.log(`[대화 디버깅] 필터링 후 메시지 수: ${validMessages.length}`);
        console.log(`[대화 디버깅] 원본 메시지 타입:`, conversation.messages.map(m => m ? m.role : 'undefined'));
        
        responseConversation.messages = validMessages;
      }
      
      // 추가 로깅: 응답으로 보내기 전 최종 확인
      console.log(`[대화 응답] 대화 ID ${conversationId}의 최종 메시지 수: ${responseConversation.messages.length}`);
      // 처음 5개 메시지 내용 출력 (디버깅용)
      if (responseConversation.messages.length > 0) {
        console.log(`[대화 응답] 첫 번째 메시지:`, 
          responseConversation.messages[0].role, 
          responseConversation.messages[0].content?.substring(0, 50));
      }
      
      res.json(responseConversation);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });
  
  // 대화 업데이트 API
  app.patch("/api/conversations/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    try {
      const conversationId = parseInt(req.params.id);
      const conversation = await storage.getConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      // 요청한 사용자가 대화 소유자이거나 판매자인 경우에만 접근 허용
      const isOwner = conversation.userId === req.user!.id;
      const isVendor = req.user!.role === 'vendor';
      
      if (!isOwner && !isVendor) {
        return res.status(403).json({ error: "Unauthorized access to conversation" });
      }
      
      // 업데이트할 필드 추출
      const { messages, plantRecommendations } = req.body;
      
      // 메시지가 있는 경우 유효성 검증
      if (messages) {
        // 모든 메시지의 role 필드가 user, assistant, vendor 중 하나인지 확인
        for (const message of messages) {
          if (!message.role || !['user', 'assistant', 'vendor'].includes(message.role)) {
            return res.status(400).json({ 
              error: "Invalid message role", 
              validRoles: ['user', 'assistant', 'vendor'] 
            });
          }
        }
      }
      
      // 대화 업데이트
      const updatedConversation = await storage.updateConversation(
        conversationId, 
        messages || [], 
        plantRecommendations
      );
      
      if (!updatedConversation) {
        return res.status(500).json({ error: "Failed to update conversation" });
      }
      
      // WebSocket을 통해 대화 업데이트 알림
      try {
        const broadcastConversationUpdate = app.get('broadcastConversationUpdate');
        if (typeof broadcastConversationUpdate === 'function') {
          // WebSocket 클라이언트에게 대화 업데이트 알림
          broadcastConversationUpdate(conversationId, {
            type: 'message',
            timestamp: new Date().toISOString()
          });
          console.log(`대화 ${conversationId} 업데이트 WebSocket 알림 전송됨`);
        }
      } catch (wsError) {
        console.error('WebSocket 알림 전송 중 오류:', wsError);
        // WebSocket 오류는 HTTP 응답에 영향을 주지 않음
      }
      
      res.json(updatedConversation);
    } catch (error) {
      console.error("Error updating conversation:", error);
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });
  
  // 새로운 대화 생성
  app.post("/api/conversations", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const userId = req.user!.id;
      const newConversation = await storage.createConversation({
        userId,
        messages: [{
          role: "assistant",
          content: "안녕하세요? 당신의 식물생활을 도울 인공지능 심다입니다. 식물 추천방식을 선택해주세요",
          timestamp: new Date().toISOString()
        }]
      });
      
      res.status(201).json(newConversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });
  
  // 대화에 새 메시지 추가 엔드포인트
  app.post("/api/conversations/:id/messages", async (req, res) => {
    // 인증 조건 변경: 개발 모드에서는 인증 우회 허용 (임시)
    if (!req.isAuthenticated() && process.env.NODE_ENV !== 'development') {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const conversationId = parseInt(req.params.id);
      // 메시지 데이터 가져오기
      const messageData = req.body;
      
      // 유효성 검사
      if (!messageData.role || !messageData.content) {
        return res.status(400).json({ error: "역할(role)과 내용(content)이 필요합니다" });
      }
      
      // 허용되는 역할 검사
      if (!['user', 'assistant', 'vendor', 'system'].includes(messageData.role)) {
        return res.status(400).json({ 
          error: "올바르지 않은 메시지 역할입니다", 
          validRoles: ['user', 'assistant', 'vendor', 'system'] 
        });
      }
      
      // 대화 가져오기
      const conversation = await storage.getConversation(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ error: "대화를 찾을 수 없습니다" });
      }
      
      // 권한 확인: 개발 모드이거나 대화 소유자이거나 판매자
      let isOwner = false;
      let isVendor = false;
      
      if (req.user) {
        isOwner = conversation.userId === req.user.id;
        isVendor = req.user.role === 'vendor';
      }
      
      // 개발 모드에서는 권한 검사 우회
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      if (!isDevelopment && !isOwner && !isVendor) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      // 타임스탬프 확인 및 추가 (없는 경우)
      if (!messageData.timestamp) {
        messageData.timestamp = new Date().toISOString();
      }
      
      // 중복 메시지 검사 (동일한 역할, 내용, 1분 이내의 메시지)
      let isDuplicate = false;
      if (Array.isArray(conversation.messages) && conversation.messages.length > 0) {
        // 현재 시간 기준 1분 내의 메시지만 중복 체크
        const now = new Date().getTime();
        const ONE_MINUTE = 60 * 1000; // 1분 (밀리초)
        
        for (const msg of conversation.messages) {
          if (msg.role === messageData.role && 
              msg.content === messageData.content &&
              msg.vendorId === messageData.vendorId) {
                
            // 메시지의 타임스탬프를 Date 객체로 변환
            const msgTime = new Date(msg.timestamp || msg.createdAt || 0).getTime();
            
            // 1분 이내의 메시지인지 검사
            if (now - msgTime < ONE_MINUTE) {
              console.log(`중복 메시지 감지됨 (${messageData.role} - ${messageData.content?.substring(0, 20)}...)`);
              isDuplicate = true;
              break;
            }
          }
        }
      }
      
      // 중복이 아닌 경우에만 메시지 추가
      const updatedMessages = isDuplicate 
        ? (Array.isArray(conversation.messages) ? conversation.messages : []) 
        : (Array.isArray(conversation.messages) 
            ? [...conversation.messages, messageData] 
            : [messageData]);
      
      // 대화 업데이트
      const updatedConversation = await storage.updateConversation(
        conversationId, 
        updatedMessages
      );
      
      // WebSocket을 통해 대화 업데이트 알림
      try {
        const broadcastConversationUpdate = app.get('broadcastConversationUpdate');
        if (typeof broadcastConversationUpdate === 'function') {
          // WebSocket 클라이언트에게 대화 업데이트 알림
          broadcastConversationUpdate(conversationId, {
            type: 'newMessage',
            message: {
              role: messageData.role,
              timestamp: messageData.timestamp
            }
          });
          console.log(`대화 ${conversationId}에 새 메시지 추가 WebSocket 알림 전송됨`);
        }
      } catch (wsError) {
        console.error('WebSocket 알림 전송 중 오류:', wsError);
        // WebSocket 오류는 HTTP 응답에 영향을 주지 않음
      }
      
      // 응답
      res.status(201).json({
        success: true,
        message: "메시지가 추가되었습니다",
        messageId: updatedMessages.length - 1,
        conversationId
      });
      
    } catch (error) {
      console.error("Error adding message to conversation:", error);
      res.status(500).json({ error: "메시지 추가 중 오류가 발생했습니다" });
    }
  });
  
  // AI 추천 대화 시작을 위한 특수 엔드포인트 - 단일 요청으로 처리
  app.post("/api/conversations/new-ai-conversation", async (req, res) => {
    if (!req.isAuthenticated()) {
      console.error("인증되지 않은 사용자");
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      console.log("AI 대화 시작 요청 수신:", req.body);
      const { userId, initialMessage } = req.body;
      
      // 유저 ID 확인 (요청에서 받은 값이나 인증 정보에서 가져온 값)
      const authenticatedUserId = req.user!.id;
      const finalUserId = userId || authenticatedUserId;
      
      // 1. 새 대화 생성 (초기 대화 메시지를 포함하여 생성)
      console.log("새로운 대화 생성");
      const newConversation = await storage.createConversation({
        userId: finalUserId,
        messages: [
          {
            role: "user",
            content: initialMessage || "AI 추천으로 진행할게요.",
            timestamp: new Date().toISOString()
          },
          {
            role: "assistant",
            content: "안녕하세요? 🌱 당신의 식물생활을 도울 인공지능 심다입니다. 어떤 목적으로 식물을 찾고 계신가요? (실내 장식, 공기 정화, 선물 등) 알려주시면 맞춤 추천을 해드릴게요! 😊",
            timestamp: new Date().toISOString()
          }
        ], 
        status: "active"
      });
      
      console.log("새로운 대화 생성 성공:", newConversation.id);
      
      // 2. 생성된 대화 정보 반환
      res.status(201).json({
        conversationId: newConversation.id,
        messages: newConversation.messages,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error("Error creating AI conversation:", error);
      res.status(500).json({ error: "Failed to create AI conversation" });
    }
  });

  // 사업자 등록번호 인증 API
  app.post("/api/verify-business", verifyBusinessNumber);
  
  // 휴대폰 인증 API
  app.post("/api/verify/phone/send", sendVerificationCode);
  app.post("/api/verify/phone/check", verifyCode);
  
  // 회원가입 중복 확인 API
  app.post("/api/check-duplicate", async (req, res) => {
    try {
      const { field, value } = req.body;
      
      if (!field || !value) {
        return res.status(400).json({ error: "필드와 값이 필요합니다" });
      }
      
      let exists = false;
      
      // 필드에 따라 적절한 검사 수행
      switch (field) {
        case 'username':
          exists = !!(await storage.getUserByUsername(value));
          break;
        case 'email':
          exists = !!(await storage.getUserByEmail(value));
          break;
        case 'phone':
          exists = !!(await storage.getUserByPhone(value));
          break;
        case 'businessNumber':
          exists = !!(await storage.getUserByBusinessNumber(value));
          break;
        default:
          return res.status(400).json({ error: "지원하지 않는 필드입니다" });
      }
      
      res.json({ exists });
    } catch (error) {
      console.error("중복 확인 오류:", error);
      res.status(500).json({ error: "중복 확인 중 오류가 발생했습니다" });
    }
  });
  
  // 지도 API 관련 경로
  app.get("/api/map/search-address", searchAddressByQuery);
  app.get("/api/map/address-by-coords", getAddressByCoords);
  app.get("/api/map/nearby-vendors", findNearbyVendors);
  app.get("/api/map/config", getMapConfig);
  
  // 구글 이미지 검색 API 엔드포인트
  app.get("/api/google-images", async (req, res) => {
    const { handleGoogleImageSearch } = await import('./google-images');
    handleGoogleImageSearch(req, res);
  });
  
  // 이미지 업로드 API
  app.post("/api/upload-image", uploadImage);
  
  // 정적 파일 서비스에서 처리할 경우 이 라우트는 필요하지 않을 수 있지만 백업으로 둠
  app.get("/uploads/:filename", getUploadedImage);
  
  // 제품 관련 API
  app.get("/api/products", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    
    try {
      const userId = req.user!.id;
      const products = await storage.getProductsForUser(userId);
      res.json(products);
    } catch (error) {
      console.error("제품 조회 오류:", error);
      res.status(500).json({ error: "제품 목록을 가져오는 중 오류가 발생했습니다" });
    }
  });
  
  // 온라인 상점 노출 여부 업데이트 API
  app.patch("/api/products/:id/online-store-visibility", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== 'vendor') {
      return res.status(401).json({ error: "판매자만 사용 가능한 기능입니다" });
    }
    
    try {
      const productId = parseInt(req.params.id);
      const { onlineStoreVisible } = req.body;
      
      if (typeof onlineStoreVisible !== 'boolean') {
        return res.status(400).json({ error: "유효하지 않은 입력입니다" });
      }
      
      // 상품이 해당 판매자의 것인지 확인
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ error: "상품을 찾을 수 없습니다" });
      }
      
      if (product.userId !== req.user!.id) {
        return res.status(403).json({ error: "다른 판매자의 상품을 수정할 수 없습니다" });
      }
      
      // 상품 업데이트
      await storage.updateProduct(productId, { onlineStoreVisible });
      
      return res.json({ success: true });
    } catch (error) {
      console.error("Error updating product visibility:", error);
      return res.status(500).json({ error: "상품 업데이트 중 오류가 발생했습니다" });
    }
  });
  
  app.get("/api/products/:id", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ error: "제품을 찾을 수 없습니다" });
      }
      
      res.json(product);
    } catch (error) {
      console.error("제품 상세 조회 오류:", error);
      res.status(500).json({ error: "제품 정보를 가져오는 중 오류가 발생했습니다" });
    }
  });
  
  app.post("/api/products", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    
    try {
      const userId = req.user!.id;
      const productData = req.body;
      
      // 디버깅 로그 추가
      console.log("제품 생성 요청 데이터:", productData);
      
      // 필수 필드 검증
      if (!productData.name || !productData.price) {
        return res.status(400).json({ error: "상품명과 가격은 필수 입력 항목입니다" });
      }
      
      const newProduct = await storage.createProduct({
        userId,
        name: productData.name,
        description: productData.description || "",
        detailedDescription: productData.detailedDescription || "",
        images: productData.images || [],
        category: productData.category || "",
        price: productData.price,
        stock: productData.stock || 0,
        imageUrl: productData.imageUrl || "",
        onlineStoreVisible: productData.onlineStoreVisible || false
      });
      
      console.log("생성된 제품:", newProduct);
      res.status(201).json(newProduct);
    } catch (error) {
      console.error("제품 추가 오류:", error);
      res.status(500).json({ error: "제품 등록 중 오류가 발생했습니다" });
    }
  });
  
  app.put("/api/products/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    
    try {
      const productId = parseInt(req.params.id);
      const productData = req.body;
      
      // 디버깅 로그 추가
      console.log("제품 수정 요청 데이터:", productData);
      
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ error: "제품을 찾을 수 없습니다" });
      }
      
      // 본인 제품인지 확인
      if (product.userId !== req.user!.id) {
        return res.status(403).json({ error: "접근 권한이 없습니다" });
      }
      
      // 새 필드 포함하여 업데이트
      const updateData = {
        ...productData,
        detailedDescription: productData.detailedDescription || "",
        images: productData.images || []
      };
      
      const updatedProduct = await storage.updateProduct(productId, updateData);
      console.log("수정된 제품:", updatedProduct);
      res.json(updatedProduct);
    } catch (error) {
      console.error("제품 수정 오류:", error);
      res.status(500).json({ error: "제품 수정 중 오류가 발생했습니다" });
    }
  });
  
  app.delete("/api/products/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    
    try {
      const productId = parseInt(req.params.id);
      const product = await storage.getProduct(productId);
      
      if (!product) {
        return res.status(404).json({ error: "제품을 찾을 수 없습니다" });
      }
      
      // 본인 제품인지 확인
      if (product.userId !== req.user!.id) {
        return res.status(403).json({ error: "접근 권한이 없습니다" });
      }
      
      const success = await storage.deleteProduct(productId);
      
      if (success) {
        res.json({ message: "제품이 삭제되었습니다" });
      } else {
        res.status(500).json({ error: "제품 삭제에 실패했습니다" });
      }
    } catch (error) {
      console.error("제품 삭제 오류:", error);
      res.status(500).json({ error: "제품 삭제 중 오류가 발생했습니다" });
    }
  });
  
  // ========== 장바구니 API ==========
  
  // 장바구니 조회
  app.get("/api/cart", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    
    try {
      const userId = req.user!.id;
      const cartItems = await storage.getCartWithProducts(userId);
      res.json(cartItems);
    } catch (error) {
      console.error("장바구니 조회 오류:", error);
      res.status(500).json({ error: "장바구니를 불러오는 중 오류가 발생했습니다" });
    }
  });
  
  // 장바구니 항목 추가
  app.post("/api/cart/items", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    
    try {
      const userId = req.user!.id;
      const { productId, quantity } = req.body;
      
      if (!productId) {
        return res.status(400).json({ error: "상품 ID가 필요합니다" });
      }
      
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "상품을 찾을 수 없습니다" });
      }
      
      const cartItem = await storage.addToCart({
        userId,
        productId,
        quantity: quantity || 1,
        unitPrice: product.price
      });
      
      res.status(201).json(cartItem);
    } catch (error) {
      console.error("장바구니 추가 오류:", error);
      res.status(500).json({ error: "장바구니에 추가하는 중 오류가 발생했습니다" });
    }
  });
  
  // 장바구니 수량 변경
  app.patch("/api/cart/items/:productId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    
    try {
      const userId = req.user!.id;
      const productId = parseInt(req.params.productId);
      const { quantity } = req.body;
      
      if (typeof quantity !== 'number') {
        return res.status(400).json({ error: "수량이 필요합니다" });
      }
      
      const updatedItem = await storage.updateCartItemQuantity(userId, productId, quantity);
      
      if (quantity <= 0) {
        res.json({ message: "장바구니에서 삭제되었습니다" });
      } else if (updatedItem) {
        res.json(updatedItem);
      } else {
        res.status(404).json({ error: "장바구니 항목을 찾을 수 없습니다" });
      }
    } catch (error) {
      console.error("장바구니 수량 변경 오류:", error);
      res.status(500).json({ error: "수량 변경 중 오류가 발생했습니다" });
    }
  });
  
  // 장바구니 항목 삭제
  app.delete("/api/cart/items/:productId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    
    try {
      const userId = req.user!.id;
      const productId = parseInt(req.params.productId);
      
      await storage.removeFromCart(userId, productId);
      res.json({ message: "장바구니에서 삭제되었습니다" });
    } catch (error) {
      console.error("장바구니 삭제 오류:", error);
      res.status(500).json({ error: "장바구니에서 삭제하는 중 오류가 발생했습니다" });
    }
  });
  
  // 장바구니 비우기
  app.delete("/api/cart", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    
    try {
      const userId = req.user!.id;
      await storage.clearCart(userId);
      res.json({ message: "장바구니가 비워졌습니다" });
    } catch (error) {
      console.error("장바구니 비우기 오류:", error);
      res.status(500).json({ error: "장바구니를 비우는 중 오류가 발생했습니다" });
    }
  });
  
  // 장바구니 아이템 개수 조회
  app.get("/api/cart/count", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.json({ count: 0 });
    }
    
    try {
      const userId = req.user!.id;
      const cartItems = await storage.getCartItems(userId);
      const count = cartItems.reduce((total, item) => total + item.quantity, 0);
      res.json({ count });
    } catch (error) {
      console.error("장바구니 개수 조회 오류:", error);
      res.json({ count: 0 });
    }
  });
  
  // ========== 체크아웃 API ==========
  
  // 체크아웃 (주문 생성 및 결제 준비)
  app.post("/api/checkout", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    
    try {
      const userId = req.user!.id;
      const { shippingInfo } = req.body;
      
      if (!shippingInfo || !shippingInfo.recipientName || !shippingInfo.phone || !shippingInfo.address) {
        return res.status(400).json({ error: "배송 정보가 필요합니다" });
      }
      
      // 장바구니 조회
      const cartItems = await storage.getCartWithProducts(userId);
      
      if (cartItems.length === 0) {
        return res.status(400).json({ error: "장바구니가 비어있습니다" });
      }
      
      // 총 금액 계산
      const totalAmount = cartItems.reduce((sum, item) => {
        return sum + (parseFloat(item.unitPrice) * item.quantity);
      }, 0);
      
      // 판매자별로 주문 그룹화
      const ordersByVendor: { [vendorId: number]: typeof cartItems } = {};
      for (const item of cartItems) {
        const vendorId = item.vendorId;
        if (vendorId) {
          if (!ordersByVendor[vendorId]) {
            ordersByVendor[vendorId] = [];
          }
          ordersByVendor[vendorId].push(item);
        }
      }
      
      const createdOrders: any[] = [];
      
      // PortOne 결제 ID 생성 함수
      const generatePortonePaymentId = () => {
        const id = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 13)}`;
        console.log('✅ Generated payment ID:', id);
        return id;
      };
      
      // 각 판매자별로 주문 생성
      for (const [vendorIdStr, items] of Object.entries(ordersByVendor)) {
        const vendorId = parseInt(vendorIdStr);
        const vendorTotal = items.reduce((sum, item) => {
          return sum + (parseFloat(item.unitPrice) * item.quantity);
        }, 0);
        
        const paymentId = generatePortonePaymentId();
        
        // 각 상품별로 주문 생성
        for (const item of items) {
          const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          
          const order = await storage.createOrder({
            userId,
            vendorId,
            productId: item.productId,
            conversationId: 0, // 직접 구매이므로 대화 ID 없음
            price: (parseFloat(item.unitPrice) * item.quantity).toFixed(2),
            status: 'created',
            orderId,
            buyerInfo: {
              name: req.user!.name || req.user!.username,
              email: req.user!.email,
              phone: req.user!.phone
            },
            recipientInfo: shippingInfo,
            paymentInfo: {
              paymentId,
              amount: parseFloat(item.unitPrice) * item.quantity,
              status: 'pending'
            }
          });
          
          createdOrders.push({
            ...order,
            productName: item.productName,
            quantity: item.quantity
          });
        }
      }
      
      // 응답 반환
      const finalPaymentId = generatePortonePaymentId();
      console.log('📤 Checkout response - paymentId:', finalPaymentId, 'totalAmount:', totalAmount);
      res.json({
        orders: createdOrders,
        totalAmount,
        paymentId: finalPaymentId,
        orderName: `${cartItems[0].productName} 외 ${cartItems.length - 1}건`
      });
      
    } catch (error) {
      console.error("체크아웃 오류:", error);
      res.status(500).json({ error: "주문 생성 중 오류가 발생했습니다" });
    }
  });
  
  // 매장 위치 관련 API
  app.get("/api/store-location", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    
    try {
      const userId = req.user!.id;
      const location = await storage.getStoreLocationForUser(userId);
      
      if (!location) {
        return res.status(404).json({ 
          error: "매장 위치 정보가 없습니다",
          needsSetup: true
        });
      }
      
      res.json(location);
    } catch (error) {
      console.error("매장 위치 조회 오류:", error);
      res.status(500).json({ error: "매장 위치 정보를 가져오는 중 오류가 발생했습니다" });
    }
  });
  
  app.post("/api/store-location", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    
    try {
      const userId = req.user!.id;
      const locationData = req.body;
      
      // 필수 필드 검증
      if (!locationData.address || !locationData.lat || !locationData.lng) {
        return res.status(400).json({ error: "주소, 위도, 경도는 필수 입력 항목입니다" });
      }
      
      const newLocation = await storage.createStoreLocation({
        userId,
        address: locationData.address,
        region: locationData.region || "",
        lat: locationData.lat,
        lng: locationData.lng,
        radius: locationData.radius || 5
      });
      
      res.status(201).json(newLocation);
    } catch (error) {
      console.error("매장 위치 등록 오류:", error);
      res.status(500).json({ error: "매장 위치 등록 중 오류가 발생했습니다" });
    }
  });
  
  app.put("/api/store-location/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    
    try {
      const locationId = parseInt(req.params.id);
      const location = await storage.getStoreLocation(locationId);
      
      if (!location) {
        return res.status(404).json({ error: "매장 위치를 찾을 수 없습니다" });
      }
      
      // 본인 매장 위치인지 확인
      if (location.userId !== req.user!.id) {
        return res.status(403).json({ error: "접근 권한이 없습니다" });
      }
      
      const updatedLocation = await storage.updateStoreLocation(locationId, req.body);
      res.json(updatedLocation);
    } catch (error) {
      console.error("매장 위치 수정 오류:", error);
      res.status(500).json({ error: "매장 위치 수정 중 오류가 발생했습니다" });
    }
  });

  // Bidding API routes
  app.post("/api/bids/request", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const { 
        plantName, 
        storeName, 
        radius, 
        lat, 
        lng, 
        conversationId, 
        inputAddress,
        // 사용자 요청사항 필드들
        userRequests,
        ribbonRequest,
        ribbonMessage,
        deliveryTime
      } = req.body;
      const userId = req.user!.id;
      
      if (!plantName || !storeName) {
        return res.status(400).json({ error: '식물 이름과 상호 정보가 필요합니다' });
      }
      
      // 지도 위치 정보가 있는 경우 위치 기반 검색
      const locationData = lat && lng ? { lat, lng, radius: radius || 5 } : null;
      
      // 1. 해당 지역 내 판매자 조회
      let vendors = [];
      
      if (locationData) {
        console.log(`위치 기반으로 판매자 검색: ${storeName}, 반경 ${locationData.radius}km`);
        
        // 위치 기반으로 판매자 검색 (map API 직접 호출)
        try {
          const { lat, lng, radius } = locationData;
          
          // HTTP 프로토콜 및 호스트 추출
          const protocol = req.protocol;
          const host = req.get('host');
          
          // 현재 서버에 상대적인 URL 생성
          const vendorsUrl = `${protocol}://${host}/api/map/nearby-vendors?lat=${lat}&lng=${lng}&radius=${radius}`;
          console.log(`내부 API 호출: ${vendorsUrl}`);
          
          const response = await fetch(vendorsUrl);
          
          if (!response.ok) {
            throw new Error('판매자 검색에 실패했습니다');
          }
          
          const data = await response.json();
          vendors = data.vendors || [];
        } catch (err) {
          console.error("판매자 검색 오류:", err);
          vendors = [];
        }
      } else {
        console.log(`상호명으로 판매자 검색: ${storeName}`);
        // 상호명으로 판매자 검색
        vendors = await storage.getVendorsByStoreName(storeName);
      }
      
      if (vendors.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: `${storeName} 지역에 적합한 판매자를 찾을 수 없습니다.`
        });
      }
      
      console.log(`검색된 판매자: ${vendors.length}명`);
      
      // 2. 대화 정보 가져오기 및 사용자 요청사항 저장
      let conversation = null;
      if (conversationId) {
        conversation = await storage.getConversation(conversationId);
        if (!conversation) {
          console.log(`대화 ID ${conversationId}에 해당하는 대화를 찾을 수 없습니다.`);
        } else {
          // 사용자 요청사항을 대화에 저장
          await storage.updateConversationData(conversationId, {
            userRequests: userRequests || null,
            ribbonRequest: ribbonRequest || false,
            ribbonMessage: ribbonRequest ? (ribbonMessage || null) : null,
            deliveryTime: deliveryTime || null
          });
          console.log(`사용자 요청사항이 대화 ID ${conversationId}에 저장되었습니다.`);
        }
      }
      
      // 3. 식물 정보 가져오기 (이름으로 검색) - 개선된 매칭 로직
      console.log(`식물명 검색 시작: "${plantName}"`);
      const matchingPlant = await storage.getPlantByName(plantName);
      
      let plantId = matchingPlant ? matchingPlant.id : null;
      
      if (!plantId) {
        console.log(`식물 "${plantName}"을 찾을 수 없습니다. 임시 식물 데이터를 사용합니다.`);
        // 임시 식물 생성 (실제 환경에서는 더 나은 방법으로 처리해야 함)
        const newPlant = await storage.createPlant({
          name: plantName,
          description: `${plantName} 식물`,
          priceRange: "미정"
        });
        plantId = newPlant.id;
      } else {
        console.log(`식물 매칭 성공: "${plantName}" → ID ${plantId} (${matchingPlant.name})`);
      }
      
      // 4. 각 판매자에게 입찰 요청 생성
      let successCount = 0;
      for (const vendor of vendors) {
        try {
          console.log(`판매자 ${vendor.name || vendor.id}에게 입찰 요청 생성`);
          
          // 수정: users 테이블에서 vendor 역할을 가진 사용자인지 확인
          const vendorUser = await storage.getUser(vendor.id);
          if (!vendorUser || vendorUser.role !== 'vendor') {
            console.log(`사용자 ID ${vendor.id}는 판매자 역할이 아니거나 존재하지 않습니다. 건너뜁니다.`);
            continue;
          }
          
          // 기본 입찰 가격 (예상 가격)은 나중에 판매자가 수정할 수 있음
          const estimatedPrice = 35000; // 기본 예상 가격
          
          await storage.createBid({
            userId,
            vendorId: vendor.id,
            plantId,
            price: estimatedPrice.toString(), // 초기 예상 가격 (문자열로 변환)
            status: "pending",
            additionalServices: conversation ? "AI 컨설팅으로 추천됨" : "",
            deliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 일주일 후 기본 배송일
            conversationId: conversation ? conversationId : null, // 대화 ID 추가
            customerInputAddress: inputAddress || null // 사용자가 직접 입력한 주소
          });
          
          console.log(`판매자 ${vendor.name || vendor.id}에게 입찰 요청 성공적으로 생성됨`);
          successCount++;
        } catch (error) {
          console.error(`판매자 ${vendor.id}에게 입찰 요청 생성 중 오류:`, error);
          // 개별 판매자 오류는 계속 진행, 모든 요청이 실패하지 않도록 함
        }
      }
      
      // 응답 메시지 생성
      const responseMessage = locationData 
        ? `선택한 위치(${storeName}) 반경 ${locationData.radius}km 이내의 판매자들에게 ${plantName} 입찰 요청이 전송되었습니다.`
        : `${storeName} 지역의 판매자들에게 ${plantName} 입찰 요청이 전송되었습니다.`;
        
      res.status(200).json({ 
        success: true, 
        message: responseMessage,
        timestamp: new Date(),
        vendorCount: successCount // 실제로 입찰 요청이 생성된 판매자 수
      });
    } catch (error) {
      console.error("Error requesting bids:", error);
      res.status(500).json({ error: "Failed to request bids" });
    }
  });
  
  // 사용자의 입찰 정보 목록 (일반 사용자용)
  app.get("/api/bids/user/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    try {
      const userId = parseInt(req.params.userId);
      
      // 자신의 입찰만 조회 가능
      if (req.user!.id !== userId) {
        return res.status(403).json({ error: "권한이 없습니다" });
      }
      
      // 사용자의 모든 입찰 요청 가져오기
      const bids = await storage.getBidsForUser(userId);
      res.json(bids);
    } catch (error) {
      console.error("Error fetching user bids:", error);
      res.status(500).json({ error: "Failed to fetch user bids" });
    }
  });
  
  // 판매자가 받은 입찰 요청 목록
  app.get("/api/bids/vendor", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user || user.role !== 'vendor') {
        return res.status(403).json({ error: "판매자 권한이 필요합니다" });
      }
      
      console.log(`판매자 입찰 데이터 요청: 판매자 ID ${userId}`);
      
      // 판매자의 모든 입찰 요청 가져오기
      const bids = await storage.getBidsForVendor(userId);
      
      console.log(`데이터베이스에서 가져온 입찰 데이터 ${bids.length}개`);
      
      // 각 입찰에 대한 추가 정보 가져오기 (식물 및 사용자 정보)
      const enrichedBids = await Promise.all(bids.map(async (bid) => {
        const plant = await storage.getPlant(bid.plantId);
        const customer = await storage.getUser(bid.userId);
        
        // 전체 사용자 정보도 포함 (변환 중에 필요한 추가 필드 접근 용도)
        const user = customer;
        
        // 로그 추가 - 고객 정보 상태 확인
        console.log(`입찰 ID ${bid.id}의 고객 정보:`, {
          id: customer?.id,
          name: customer?.name,
          username: customer?.username,
          phone: customer?.phone,
          email: customer?.email
        });
        
        // referenceImages 필드가 문자열인 경우 (JSON 문자열) 파싱
        let parsedReferenceImages = bid.referenceImages;
        if (bid.referenceImages && typeof bid.referenceImages === 'string') {
          try {
            parsedReferenceImages = JSON.parse(bid.referenceImages);
          } catch (e) {
            console.warn(`입찰 ID ${bid.id}의 referenceImages 필드 파싱 오류:`, e);
            parsedReferenceImages = [];
          }
        }
        
        return {
          ...bid,
          // referenceImages를 파싱된 값으로 덮어씌우기
          referenceImages: parsedReferenceImages,
          // 원본 사용자 정보 전체 제공 (필요한 경우 클라이언트에서 접근할 수 있도록)
          user,
          customer: {
            id: customer?.id,
            name: customer?.name || customer?.username,
            email: customer?.email,
            phone: customer?.phone
          },
          plant: {
            id: plant?.id,
            name: plant?.name,
            imageUrl: plant?.imageUrl,
            description: plant?.description,
            priceRange: plant?.priceRange
          }
        };
      }));
      
      console.log(`응답: ${enrichedBids.length}개의 입찰 데이터 반환`);
      res.json(enrichedBids);
    } catch (error) {
      console.error("Error fetching vendor bids:", error);
      res.status(500).json({ error: "Failed to fetch bids" });
    }
  });
  
  // 단일 입찰 정보 조회 API
  app.get("/api/bids/:id", async (req, res) => {
    try {
      const bidId = parseInt(req.params.id);
      
      // 입찰 정보 가져오기
      const bid = await storage.getBid(bidId);
      
      if (!bid) {
        return res.status(404).json({ error: "입찰 정보를 찾을 수 없습니다" });
      }
      
      // 식물 정보 불러오기
      const plant = await storage.getPlant(bid.plantId);
      
      // 사용자 정보 불러오기
      const user = await storage.getUser(bid.userId);
      
      // 선택된 제품 정보 불러오기 (단일 제품)
      let selectedProduct = null;
      if (bid.selectedProductId) {
        selectedProduct = await storage.getProduct(bid.selectedProductId);
      }
      
      // 선택된 제품들 목록 불러오기 (다중 선택)
      let selectedProducts = [];
      // 만약 DB에서 selectedProducts 필드가 있다면 그것을 사용
      if (bid.selectedProducts && Array.isArray(bid.selectedProducts)) {
        selectedProducts = bid.selectedProducts;
      }
      // 아니면 selectedProductId가 있으면 그것을 바탕으로 제품 추가
      else if (selectedProduct && !selectedProducts.some((p: any) => p.id === selectedProduct.id)) {
        selectedProducts = [selectedProduct];
      }
      
      // 대화의 사용자 요청사항 불러오기
      let conversationData = null;
      if (bid.conversationId) {
        try {
          conversationData = await storage.getConversation(bid.conversationId);
        } catch (error) {
          console.error("대화 정보 조회 오류:", error);
        }
      }
      
      // 풍부한 입찰 정보 반환
      const enrichedBid = {
        ...bid,
        plant: plant ? {
          id: plant.id,
          name: plant.name,
          imageUrl: plant.imageUrl,
          description: plant.description,
          priceRange: plant.priceRange
        } : null,
        user: user ? {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email
        } : null,
        selectedProduct: selectedProduct,
        selectedProducts: selectedProducts,
        conversation: conversationData ? {
          requestNotes: conversationData.requestNotes,
          ribbonRequest: conversationData.ribbonRequest,
          ribbonMessage: conversationData.ribbonMessage,
          desiredDeliveryTime: conversationData.desiredDeliveryTime
        } : null
      };
      
      res.json(enrichedBid);
    } catch (error) {
      console.error("입찰 정보 조회 오류:", error);
      res.status(500).json({ error: "입찰 정보를 가져오는 중 오류가 발생했습니다" });
    }
  });
  
  // 입찰 상태 업데이트 API
  app.put("/api/bids/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    try {
      const bidId = parseInt(req.params.id);
      const { status, message } = req.body;
      
      // 상태값 확장 - 기존 상태값 + 새로운 상태값 추가
      const validStatuses = [
        'pending',       // 대기 중
        'reviewing',     // 입찰 내용 확인중
        'preparing',     // 제품 준비중
        'bidded',        // 입찰 완료
        'accepted',      // 접수됨
        'shipped',       // 배송 중
        'completed',     // 완료
        'rejected'       // 거절됨
      ];
      
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          error: "유효한 상태 값이 필요합니다",
          validStatuses
        });
      }
      
      // 입찰 정보 가져오기
      const bid = await storage.getBid(bidId);
      
      if (!bid) {
        return res.status(404).json({ error: "입찰 정보를 찾을 수 없습니다" });
      }
      
      // 자신의 입찰인지 확인 (판매자 또는 사용자)
      if (bid.vendorId !== req.user!.id && bid.userId !== req.user!.id) {
        return res.status(403).json({ error: "이 입찰에 대한 권한이 없습니다" });
      }
      
      // 상태 업데이트
      const updatedBid = await storage.updateBidStatus(bidId, status);
      
      // 해당 대화가 있는 경우 대화에 판매자 메시지 추가
      if (bid.conversationId) {
        try {
          const conversation = await storage.getConversation(bid.conversationId);
          
          if (conversation) {
            const messages = Array.isArray(conversation.messages) 
              ? conversation.messages 
              : (typeof conversation.messages === 'string' 
                ? JSON.parse(conversation.messages) 
                : []);
            
            // 🎯 입찰 상태별 메시지 생성 로직 (완전 근본적 해결)
            let statusMessage = message || '';
            
            // 🚫 완전 해결: 백엔드에서 모든 자동 메시지 생성 비활성화
            // 프론트엔드에서만 메시지를 제어하도록 함
            console.log(`[백엔드 메시지 생성 비활성화] 판매자 ${bid.vendorId}, 상태: ${status} - 프론트엔드에서만 메시지 처리`);
            
            // 상태만 업데이트하고 메시지 생성은 하지 않음
            const updatedBid = await storage.updateBidStatus(bidId, status);
            return res.json(updatedBid);
            
            // 다른 상태들은 기존 로직 유지
            if (!statusMessage) {
              switch(status) {
                case 'reviewing':
                  // reviewing 상태에서는 메시지 생성 안 함 (중복 방지)
                  return;
                  break;
                case 'preparing':
                  // 판매자 정보 조회 (이름 가져오기)
                  const preparingVendor = await storage.getVendorById(bid.vendorId);
                  
                  // 판매자 정보 디버깅 로그
                  console.log(`상태 메시지 생성 (preparing): vendorId=${bid.vendorId}`);
                  console.log('판매자 정보:', JSON.stringify(preparingVendor, null, 2));
                  console.log(`상태 메시지 생성 (preparing): vendorId=${bid.vendorId}, 업체명=${preparingVendor?.storeName || '알 수 없음'}`);
                  
                  // storeName 필드 존재 확인 및 사용
                  if (preparingVendor && preparingVendor.storeName) {
                    statusMessage = `${preparingVendor.storeName}에서 제품을 준비 중입니다.`;
                  } else {
                    statusMessage = '판매자가 제품을 준비 중입니다.';
                    console.error(`판매자 ID ${bid.vendorId}의 상호명을 찾을 수 없습니다.`);
                  }
                  break;
                case 'bidded':
                  // 입찰 완료 상태일 때는 더 자세한 정보를 포함
                  try {
                    // 선택된 상품 정보 가져오기
                    const product = bid.selectedProductId 
                      ? await storage.getProduct(bid.selectedProductId) 
                      : null;
                      
                    // 입찰일 때는 사용자 메시지만 포함, 제품 정보와 가격은 별도 필드로 전달
                    statusMessage = bid.vendorMessage || "";
                    
                    // 참고 이미지가 있는 경우 추가 (별도 메시지는 추가하지 않음)
                    // 이미지는 별도 필드로 처리됨
                  } catch (error) {
                    console.error('입찰 정보 처리 오류:', error);
                    // 입찰일 때는 사용자 메시지만 포함, 제품 정보와 가격은 별도 필드로 전달
                    statusMessage = bid.vendorMessage || "";
                  }
                  break;
                case 'accepted':
                  statusMessage = '입찰이 수락되었습니다.';
                  break;
                case 'shipped':
                  statusMessage = '제품이 발송되었습니다.';
                  break;
                case 'completed':
                  statusMessage = '주문이 완료되었습니다.';
                  break;
                case 'rejected':
                  statusMessage = '입찰 요청이 거절되었습니다.';
                  break;
                default:
                  statusMessage = `입찰 상태가 ${status}로 변경되었습니다.`;
              }
            }
            
            // 참조 이미지 처리 - JSON 문자열을 배열로 변환
            let referenceImages;
            
            if (status === 'bidded' && (bid as any).referenceImages) {
              try {
                // 이미 배열인지 확인
                if (Array.isArray((bid as any).referenceImages)) {
                  referenceImages = (bid as any).referenceImages;
                } 
                // 문자열인지 확인
                else if (typeof (bid as any).referenceImages === 'string') {
                  try {
                    // 이중 직렬화된 JSON 문자열 패턴 확인 ("""[\""..\"]""")
                    if ((bid as any).referenceImages.startsWith('"""') && (bid as any).referenceImages.endsWith('"""')) {
                      // 외부 따옴표 제거
                      const cleanedJson = (bid as any).referenceImages.slice(3, -3);
                      // 이스케이프된 따옴표 처리
                      const unescapedJson = cleanedJson.replace(/\\"/g, '"');
                      // 배열로 파싱
                      referenceImages = JSON.parse(unescapedJson);
                    } else {
                      // 일반 JSON 문자열
                      referenceImages = JSON.parse((bid as any).referenceImages);
                    }
                    
                    console.log("참조 이미지 파싱 성공:", referenceImages);
                  } catch (parseError) {
                    console.error("참조 이미지 파싱 오류:", parseError);
                    referenceImages = undefined;
                  }
                }
              } catch (error) {
                console.error("참조 이미지 처리 중 오류:", error);
                referenceImages = undefined;
              }
            }
            
            // 판매자 메시지 추가 전 로그 추가
            console.log("판매자 메시지 처리:", {
              status,
              bidVendorMessage: bid.vendorMessage,
              statusMessage
            });
            
            // 판매자 메시지 추가
            const vendorMessage: any = {
              role: "vendor",
              // bidded 상태에서는 판매자 메시지를 그대로 표시 (null 처리 추가)
              content: status === 'bidded' ? (bid.vendorMessage || statusMessage || "판매자의 새 입찰이 도착했습니다.") : statusMessage,
              timestamp: new Date(),
              // 항상 입찰에 있는 vendorId를 사용하여 일관된 색상과 상호명 표시 
              vendorId: bid.vendorId
            };
            
            // bidded 상태일 때만 제품 정보 포함
            if (status === 'bidded') {
              const product = bid.selectedProductId 
                ? await storage.getProduct(bid.selectedProductId) 
                : null;
              
              if (product) {
                vendorMessage.product = product;
                vendorMessage.price = bid.price;
                vendorMessage.referenceImages = referenceImages;
                vendorMessage.imageUrl = referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0 
                  ? referenceImages[0] 
                  : undefined;
              }
            }
            
            messages.push(vendorMessage);
            
            // 대화 업데이트
            await storage.updateConversation(bid.conversationId, messages);
            
            console.log(`대화 ID ${bid.conversationId}에 판매자 메시지 추가: ${statusMessage}`);
          }
        } catch (error) {
          console.error("대화에 메시지 추가 중 오류:", error);
          // 대화 업데이트 오류는 전체 작업을 실패시키지 않음
        }
      }
      
      if (updatedBid) {
        res.json(updatedBid);
      } else {
        res.status(500).json({ error: "입찰 상태 업데이트에 실패했습니다" });
      }
    } catch (error) {
      console.error("Error updating bid status:", error);
      res.status(500).json({ error: "Failed to update bid status" });
    }
  });
  
  // 입찰 데이터 전체 업데이트 API
  app.patch("/api/bids/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    
    try {
      const bidId = parseInt(req.params.id);
      const bidData = req.body;
      
      // 입찰 가격 유효성 검사 (최대값 제한)
      if (bidData.price && bidData.price >= 100000000) {
        return res.status(400).json({ error: "입찰 가격은 1억원 미만이어야 합니다." });
      }
      
      // 입찰 정보 가져오기
      const bid = await storage.getBid(bidId);
      
      if (!bid) {
        return res.status(404).json({ error: "입찰 정보를 찾을 수 없습니다" });
      }
      
      // 판매자만 입찰 데이터를 업데이트할 수 있음 (단, conversationId는 고객도 업데이트 가능)
      const isVendor = bid.vendorId === req.user!.id;
      const isCustomer = bid.userId === req.user!.id;
      
      if (!isVendor && !isCustomer) {
        return res.status(403).json({ error: "이 입찰에 대한 권한이 없습니다" });
      }
      
      // 고객이 수정할 수 있는 필드는 conversationId뿐
      if (isCustomer && !isVendor) {
        // 고객은 conversationId만 업데이트 가능
        if (Object.keys(bidData).some(key => key !== 'conversationId')) {
          return res.status(403).json({ error: "고객은 대화 ID만 업데이트할 수 있습니다" });
        }
      }
      
      // 금지된 필드 제거 (사용자가 직접 수정할 수 없는 필드)
      const forbiddenFields = ['id', 'userId', 'vendorId', 'plantId', 'createdAt'];
      for (const field of forbiddenFields) {
        delete bidData[field];
      }
      
      // conversationId가 있으면 유효한지 확인
      if (bidData.conversationId !== undefined && bidData.conversationId !== null) {
        try {
          const conversation = await storage.getConversation(bidData.conversationId);
          if (!conversation) {
            return res.status(400).json({ error: "유효하지 않은 대화 ID입니다" });
          }
          
          // 자신의 대화인지 확인 (판매자가 아니거나 시스템 관리자가 아닌 경우)
          if (!isVendor && conversation.userId !== req.user!.id) {
            return res.status(403).json({ error: "다른 사용자의 대화를 연결할 수 없습니다" });
          }
        } catch (error) {
          console.error("대화 ID 검증 오류:", error);
          return res.status(400).json({ error: "대화 ID 확인 중 오류가 발생했습니다" });
        }
      }
      
      // 로그로 입력 데이터 확인
      console.log("입찰 업데이트 데이터:", bidData);
      
      // selectedProductIds가 배열로 제공된 경우, 첫 번째 항목을 selectedProductId로 설정
      if (bidData.selectedProductIds && Array.isArray(bidData.selectedProductIds) && bidData.selectedProductIds.length > 0) {
        bidData.selectedProductId = bidData.selectedProductIds[0];
        console.log("선택된 상품 ID 설정:", bidData.selectedProductId);
      }
      
      // 판매자 메시지가 있고 bid 객체에 conversationId 필드가 있으면 대화에 메시지 추가
      // 스키마 업데이트 후 확장된 Bid 타입 체크
      if ('conversationId' in bid && bid.conversationId) {
        try {
          // 기존 대화 내용 가져오기
          const conversation = await storage.getConversation(bid.conversationId);
          
          if (conversation) {
            // 제품 정보 가져오기 (있는 경우)
            let productInfo = null;
            const selectedProductId = bidData.selectedProductId || bid.selectedProductId;
            
            if (selectedProductId) {
              try {
                // 상품 데이터베이스에서 정보 가져오기
                const product = await storage.getProduct(selectedProductId);
                if (product) {
                  productInfo = {
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    price: product.price,
                    imageUrl: product.imageUrl
                  };
                  console.log("선택한 상품 정보:", productInfo);
                }
              } catch (error) {
                console.error("상품 정보 조회 오류:", error);
              }
            }
            
            // 판매자 메시지 - bidded 상태일 때만 제품 정보 포함
            let messageContent = bidData.vendorMessage || bid.vendorMessage || "";
            
            // 새 메시지 객체 생성
            const newMessage: any = {
              role: 'vendor',
              content: messageContent,
              timestamp: new Date().toISOString(), // ISO 문자열로 저장
              // 반드시 vendorId를 포함하여 일관된 색상과 상호명 표시
              vendorId: bid.vendorId
            };
            
            // bidded 상태일 때만 제품 정보 포함
            if (bidData.vendorMessage) {
              if (productInfo) {
                newMessage.product = productInfo;
                newMessage.price = bidData.price || bid.price;
                newMessage.referenceImages = bidData.referenceImages || bid.referenceImages;
                newMessage.imageUrl = (bidData.referenceImages && 
                              Array.isArray(bidData.referenceImages) && 
                              bidData.referenceImages.length > 0)
                            ? bidData.referenceImages[0]
                            : (bid.referenceImages && 
                              Array.isArray(bid.referenceImages) && 
                              bid.referenceImages.length > 0)
                            ? bid.referenceImages[0]
                            : undefined;
              }
            }
            
            console.log("새 메시지 데이터:", newMessage);
            
            // 기존 메시지 배열에 새 메시지 추가
            const updatedMessages = Array.isArray(conversation.messages) 
              ? [...conversation.messages, newMessage] 
              : [newMessage];
            
            // 대화 업데이트
            await storage.updateConversation(bid.conversationId, updatedMessages);
          }
        } catch (error) {
          console.error("대화 메시지 추가 오류:", error);
          // 메시지 추가 실패해도 입찰 업데이트는 계속 진행
        }
      }
      
      // referenceImages가 문자열로 전달된 경우 파싱 시도
      if (bidData.referenceImages && typeof bidData.referenceImages === 'string') {
        try {
          // JSON 문자열을 객체로 파싱
          const parsedImages = JSON.parse(bidData.referenceImages);
          if (Array.isArray(parsedImages)) {
            // 배열이면 그대로 사용
            bidData.referenceImages = parsedImages;
          }
        } catch (error) {
          console.log("참조 이미지 파싱 실패:", error);
          // 파싱 실패 시 원래 문자열 유지
        }
      }
      
      // 입찰 데이터 업데이트
      const updatedBid = await storage.updateBid(bidId, bidData);
      
      if (updatedBid) {
        res.json(updatedBid);
      } else {
        res.status(500).json({ error: "입찰 정보 업데이트에 실패했습니다" });
      }
    } catch (error) {
      console.error("입찰 정보 업데이트 오류:", error);
      res.status(500).json({ error: "입찰 정보 업데이트 중 오류가 발생했습니다" });
    }
  });
  
  // API 중복 확인 (아이디, 이메일, 전화번호, 사업자번호)
  app.post("/api/check-duplicate", async (req, res) => {
    try {
      const { field, value } = req.body;
      
      if (!field || !value) {
        return res.status(400).json({ error: "Field and value are required" });
      }
      
      let exists = false;
      
      switch (field) {
        case 'username':
          const userByUsername = await storage.getUserByUsername(value);
          exists = !!userByUsername;
          break;
          
        case 'email':
          const userByEmail = await storage.getUserByEmail(value);
          exists = !!userByEmail;
          break;
          
        case 'phone':
          const userByPhone = await storage.getUserByPhone(value);
          exists = !!userByPhone;
          break;
          
        case 'businessNumber':
          const userByBusinessNumber = await storage.getUserByBusinessNumber(value);
          exists = !!userByBusinessNumber;
          break;
          
        default:
          return res.status(400).json({ error: "Invalid field type" });
      }
      
      res.json({ exists });
    } catch (error) {
      console.error("Error checking duplicate:", error);
      res.status(500).json({ error: "Failed to check for duplicates" });
    }
  });
  
  // 휴대폰 인증 API - 인증번호 발송
  app.post("/api/verify/phone/send", sendVerificationCode);
  
  // 휴대폰 인증 API - 인증번호 확인
  app.post("/api/verify/phone/check", verifyCode);
  
  // 사업자 등록번호 검증 API
  app.post("/api/verify-business", verifyBusinessNumber);

  // 포트원 결제 라우트 설정
  setupPortOneRoutes(app, storage);
  
  // 주문 생성 API
  app.post("/api/orders", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    try {
      const { vendorId, productId, price, conversationId, buyerInfo, recipientInfo } = req.body;
      
      // 필수 필드 검증
      if (!vendorId || !productId || !price || !conversationId) {
        return res.status(400).json({ error: "판매자, 상품, 가격, 대화 ID가 필요합니다" });
      }
      
      if (!buyerInfo || !buyerInfo.name || !buyerInfo.phone || !buyerInfo.address) {
        return res.status(400).json({ error: "구매자 정보가 올바르지 않습니다" });
      }
      
      if (!recipientInfo || !recipientInfo.name || !recipientInfo.phone || !recipientInfo.address) {
        return res.status(400).json({ error: "수령인 정보가 올바르지 않습니다" });
      }
      
      // 판매자 정보 확인
      const vendor = await storage.getVendor(vendorId);
      if (!vendor) {
        return res.status(404).json({ error: "판매자를 찾을 수 없습니다" });
      }
      
      // 제품 정보 확인
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "상품을 찾을 수 없습니다" });
      }
      
      // 주문 ID 생성 - 포트원 V2 API 형식(pay_)으로 시작하도록 변경
      // 이렇게 하면 결제 ID와 주문 ID를 동일하게 사용할 수 있음
      const orderId = `pay_${nanoid(22).substring(0, 22)}`;
      
      // 주문 생성
      const order = await storage.createOrder({
        userId: req.user.id,
        vendorId,
        productId,
        conversationId,
        price: price.toString(),
        status: 'created',
        orderId,
        buyerInfo: JSON.stringify(buyerInfo),
        recipientInfo: JSON.stringify(recipientInfo)
      });
      
      res.status(201).json({
        success: true,
        orderId,
        order
      });
      
    } catch (error) {
      console.error("주문 생성 중 오류:", error);
      res.status(500).json({ error: "주문 생성에 실패했습니다" });
    }
  });
  
  // 결제 정보 저장 API
  app.post("/api/orders/:orderId/payment", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    try {
      const { orderId } = req.params;
      const { imp_uid, merchant_uid, paid_amount, status, vendorId, conversationId } = req.body;
      
      // 필수 필드 검증
      if (!imp_uid || !merchant_uid || !paid_amount) {
        return res.status(400).json({ error: "결제 정보가 불완전합니다" });
      }
      
      // 주문 정보 확인
      const order = await storage.getOrderByOrderId(orderId);
      if (!order) {
        return res.status(404).json({ error: "주문을 찾을 수 없습니다" });
      }
      
      // 주문 금액 확인
      if (order.price.toString() !== paid_amount.toString()) {
        console.warn(`주문 금액 불일치: 주문(${order.price}) vs 결제(${paid_amount})`);
        // 프로덕션에서는 이 경우 결제를 취소해야 하지만, 개발용으로는 경고만 출력
      }
      
      // 결제 정보 업데이트
      const updatedOrder = await storage.updateOrder(order.id, {
        status: 'paid',
        paymentInfo: JSON.stringify({
          imp_uid,
          merchant_uid,
          paid_amount,
          status,
          payment_date: new Date().toISOString()
        }),
        updatedAt: new Date()
      });
      
      // 입찰 상태 업데이트 (선택적)
      if (conversationId) {
        try {
          // 해당 대화의 입찰 정보 찾기
          const bids = await storage.getBidsForConversation(parseInt(conversationId));
          const matchingBid = bids.find(bid => bid.vendorId === vendorId);
          
          if (matchingBid) {
            // 입찰 상태 업데이트
            await storage.updateBid(matchingBid.id, {
              status: 'accepted',
              orderId
            });
            
            // 다른 입찰은 rejected로 변경
            for (const bid of bids) {
              if (bid.id !== matchingBid.id) {
                await storage.updateBid(bid.id, {
                  status: 'rejected'
                });
              }
            }
          }
        } catch (bidError) {
          console.error("입찰 상태 업데이트 중 오류:", bidError);
          // 입찰 업데이트 실패는 전체 트랜잭션을 취소하지 않음
        }
      }
      
      res.json({
        success: true,
        order: updatedOrder
      });
      
    } catch (error) {
      console.error("결제 정보 저장 중 오류:", error);
      res.status(500).json({ error: "결제 정보 저장에 실패했습니다" });
    }
  });
  
  // 판매자에게 알림 전송 API
  app.post("/api/vendors/notify", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    try {
      const { vendorId, conversationId, type, orderId, message } = req.body;
      
      // 필수 필드 검증
      if (!vendorId || !conversationId || !type || !message) {
        return res.status(400).json({ error: "알림 정보가 불완전합니다" });
      }
      
      // 판매자 정보 확인
      const vendor = await storage.getVendor(vendorId);
      if (!vendor) {
        return res.status(404).json({ error: "판매자를 찾을 수 없습니다" });
      }
      
      // 알림 생성
      const notification = await storage.createNotification({
        userId: vendorId,  // 수신자로 판매자 ID 지정
        senderId: req.user.id,  // 발신자로 현재 사용자 ID 지정
        type,
        message,
        conversationId: parseInt(conversationId),
        orderId,
        status: 'unread'
      });
      
      res.status(201).json({
        success: true,
        notification
      });
      
    } catch (error) {
      console.error("알림 전송 중 오류:", error);
      res.status(500).json({ error: "알림 전송에 실패했습니다" });
    }
  });
  
  // 다른 판매자들에게 알림 전송 API
  app.post("/api/vendors/notify-others", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    try {
      const { conversationId, winnerVendorId, message } = req.body;
      
      // 필수 필드 검증
      if (!conversationId || !winnerVendorId || !message) {
        return res.status(400).json({ error: "알림 정보가 불완전합니다" });
      }
      
      // 해당 대화에 참여한 모든 판매자 찾기
      const bids = await storage.getBidsForConversation(parseInt(conversationId));
      
      // 성공한 판매자를 제외한 다른 판매자들에게 알림 전송
      let notifiedVendors = 0;
      for (const bid of bids) {
        // 낙찰된 판매자는 제외
        if (bid.vendorId === winnerVendorId) continue;
        
        // 각 판매자에게 알림 생성
        await storage.createNotification({
          userId: bid.vendorId,  // 수신자로 판매자 ID 지정
          senderId: req.user.id,  // 발신자로 현재 사용자 ID 지정
          type: 'rejected',
          message,
          conversationId: parseInt(conversationId),
          status: 'unread'
        });
        
        notifiedVendors++;
      }
      
      res.status(200).json({
        success: true,
        notifiedVendors
      });
      
    } catch (error) {
      console.error("다른 판매자 알림 전송 중 오류:", error);
      res.status(500).json({ error: "알림 전송에 실패했습니다" });
    }
  });

  // 주문 생성 API
  app.post("/api/orders", async (req, res) => {
    // 인증 체크
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: '로그인이 필요합니다' });
    }
    
    try {
      const { orderId: originalOrderId, productId, vendorId, price, conversationId, productName, buyerInfo: clientBuyerInfo, recipientInfo: clientRecipientInfo } = req.body;

      // 상품 ID가 없는 경우
      if (!productId) {
        return res.status(400).json({ error: '상품 ID가 필요합니다.' });
      }
      
      // 판매자 ID가 없는 경우
      if (!vendorId) {
        return res.status(400).json({ error: '판매자 ID가 필요합니다.' });
      }
      
      // 주문 ID 처리: 기존 ID가 pay_ 형식이면 그대로 사용, 아니면 새로 생성
      let orderId = originalOrderId;
      
      // 포트원 V2 API 규격에 맞는 orderId 생성 (pay_ + 22자 형식)
      if (!orderId || !orderId.startsWith('pay_') || orderId.length !== 26) {
        // 새로운 포트원 V2 API 규격의 결제 ID 생성
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const cleanId = (timestamp.toString() + random).replace(/[^a-zA-Z0-9]/g, '');
        const paddedId = cleanId.substring(0, 22).padEnd(22, 'f');
        orderId = `pay_${paddedId}`;
        
        console.log('서버측 주문 ID 생성:', orderId);
        
        // 기존 ID가 있었다면 로그로 기록
        if (originalOrderId) {
          console.log('기존 주문번호를 포트원 V2 API 규격으로 대체:', originalOrderId, '→', orderId);
        }
      }

      // 구매자 정보 유효성 검증
      if (!clientBuyerInfo || !clientBuyerInfo.name || !clientBuyerInfo.phone) {
        return res.status(400).json({ error: '구매자 정보가 올바르지 않습니다' });
      }
      
      // 구매자 정보
      const buyerInfo = {
        name: clientBuyerInfo.name,
        email: req.user?.email || '',
        phone: clientBuyerInfo.phone,
      };
      
      // 수령인 정보 처리 - 클라이언트에서 전달받은 수령인 정보가 있으면 사용
      const recipientInfo = clientRecipientInfo ? {
        name: clientRecipientInfo.name,
        phone: clientRecipientInfo.phone,
        address: clientRecipientInfo.address || '',
        addressDetail: clientRecipientInfo.addressDetail || ''
      } : {
        // 수령인 정보가 없으면 구매자 정보와 동일하게 설정
        name: clientBuyerInfo.name,
        phone: clientBuyerInfo.phone,
        address: clientBuyerInfo.address || '',
        addressDetail: clientBuyerInfo.addressDetail || ''
      };
      
      // 수령인 정보 유효성 검증
      if (!recipientInfo.name || !recipientInfo.phone || !recipientInfo.address) {
        return res.status(400).json({ error: '수령인 정보가 올바르지 않습니다' });
      }
      
      // 상품 정보 확인이 필요한 경우 상품 정보 조회
      //const product = await storage.getProduct(parseInt(productId));
      
      // 주문 정보 생성
      const order = await storage.createOrder({
        orderId,
        productId: parseInt(productId),
        userId: req.user?.id || 0,
        vendorId, // 클라이언트에서 전달받은 판매자 ID
        conversationId: conversationId || 0,
        price: price?.toString() || '0',
        status: 'created', // 처음에는 'created' 상태로 시작
        buyerInfo,
        recipientInfo
      });
      
      // 결제 정보 생성 - order와 연결
      await storage.createPayment({
        userId: req.user?.id || 0,
        bidId: vendorId, // 판매자 ID를 bidId로 사용
        amount: price?.toString() || '0',
        status: 'ready',
        orderId,
        orderName: productName || '식물',
        customerName: clientBuyerInfo.name || '',
        customerEmail: req.user?.email || '',
        customerMobilePhone: clientBuyerInfo.phone || ''
      });
      
      res.status(201).json({ 
        success: true,
        orderId,
        message: '주문이 생성되었습니다.',
        order
      });
    } catch (error: any) {
      console.error('주문 생성 중 오류:', error);
      res.status(500).json({ 
        success: false,
        error: error.message || '주문 생성에 실패했습니다.' 
      });
    }
  });
  
  // 주문 ID로 주문 조회 API
  app.get("/api/orders/:orderId", async (req, res) => {
    try {
      const { orderId } = req.params;
      const order = await storage.getOrderByOrderId(orderId);
      
      if (!order) {
        return res.status(404).json({ error: '주문을 찾을 수 없습니다.' });
      }
      
      res.json(order);
    } catch (error: any) {
      console.error('주문 조회 중 오류:', error);
      res.status(500).json({ error: error.message || '주문 조회에 실패했습니다.' });
    }
  });
  
  // 주문 상태 업데이트 API
  app.put("/api/orders/:orderId/status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: '로그인이 필요합니다' });
    }
    
    try {
      const { orderId } = req.params;
      const { status } = req.body;
      
      // 주문 상태 유효성 검사
      const validStatuses = ['created', 'paid', 'preparing', 'shipping', 'delivered', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: '유효하지 않은 주문 상태입니다' });
      }
      
      // 주문 정보 조회
      const order = await storage.getOrderByOrderId(orderId);
      if (!order) {
        return res.status(404).json({ error: '주문을 찾을 수 없습니다' });
      }
      
      // 권한 확인 - 다음 조건 중 하나라도 만족하면 업데이트 가능:
      // 1. 사용자가 주문 소유자인 경우 (구매자) - 취소만 가능
      // 2. 사용자가 판매자이며 해당 주문의 판매자인 경우
      // 3. 사용자가 관리자인 경우
      let hasPermission = false;
      
      if (req.user?.role === 'admin') {
        // 관리자는 모든 주문 상태 변경 가능
        hasPermission = true;
      }
      else if (req.user?.id === order.userId) {
        // 주문 소유자(구매자)는 취소만 가능
        if (status === 'cancelled') {
          hasPermission = true;
          console.log(`구매자(ID:${req.user.id})의 주문 취소 권한 확인 성공`);
        } else {
          console.log(`구매자의 권한 오류: 상태 변경 불가 (요청 상태: ${status})`);
          return res.status(403).json({ error: '구매자는 주문 취소만 가능합니다' });
        }
      }
      else if (req.user?.role === 'vendor') {
        // 판매자 정보 조회
        const vendor = await storage.getVendorByUserId(req.user.id);
        if (vendor && vendor.id === order.vendorId) {
          hasPermission = true;
        }
      }
      
      // 권한 없음
      if (!hasPermission) {
        return res.status(403).json({ error: '이 주문을 업데이트할 권한이 없습니다' });
      }
      
      // 배송 정보 추가
      let trackingInfo = order.trackingInfo;
      
      // 상태가 'shipping'으로 변경될 때 배송 정보 추가
      if (status === 'shipping' && order.status !== 'shipping') {
        trackingInfo = {
          company: '우편택배',
          trackingNumber: `TK-${Date.now().toString().slice(-8)}`,
          shippingDate: new Date(),
          estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3일 후
        };
      }
      
      // 주문이 취소되는 경우 결제 취소 처리
      if (status === 'cancelled') {
        try {
          // 결제 정보 조회
          const payment = await storage.getPaymentByOrderId(orderId);
          
          if (payment && payment.status !== 'CANCELLED' && payment.paymentKey) {
            console.log(`주문 ${orderId} 취소 요청: 결제 취소 시도 (결제 ID: ${payment.id})`);
            
            // 포트원 V2 클라이언트 로드
            const portoneV2Client = await import('./portone-v2-client');
            const portoneClient = portoneV2Client.default;
            
            try {
              console.log(`결제 취소 시도: 주문 ID = ${orderId}, 결제 키 = ${payment.paymentKey}`);
              
              // 결제 취소 실행 - pay_ 형식 사용
              await portoneClient.cancelPayment({
                paymentId: orderId, // 주문 ID(pay_ 형식) 사용
                reason: req.body.reason || '사용자 요청으로 취소'
              });
              
              console.log(`결제 취소 성공: 주문 ID=${orderId}`);
              
              // 결제 상태 업데이트
              await storage.updatePayment(payment.id, {
                status: 'CANCELLED',
                cancelReason: req.body.reason || '사용자 요청으로 취소',
                cancelledAt: new Date()
              });
            } catch (cancelError: any) {
              console.error(`결제 취소 실패 (주문 취소는 계속 진행):`, cancelError?.message || cancelError);
            }
          }
        } catch (error: any) {
          console.error(`결제 취소 정보 조회 실패:`, error?.message || error);
          // 결제 취소 실패해도 주문 취소는 계속 진행
        }
      }
      
      // 주문 상태 업데이트
      const updatedOrder = await storage.updateOrder(order.id, {
        status,
        trackingInfo
      });
      
      if (!updatedOrder) {
        return res.status(500).json({ error: '주문 상태 업데이트에 실패했습니다' });
      }
      
      // 구매자에게 알림 생성
      if (order.userId) {
        await storage.createNotification({
          userId: order.userId,
          senderId: req.user.id,
          type: status,
          message: `주문 ${orderId}의 상태가 '${status}'로 변경되었습니다`,
          orderId,
          status: 'unread'
        });
      }
      
      res.json({
        success: true, 
        message: '주문 상태가 업데이트되었습니다',
        order: updatedOrder
      });
    } catch (error: any) {
      console.error('주문 상태 업데이트 오류:', error);
      res.status(500).json({ error: error.message || '주문 상태 업데이트에 실패했습니다' });
    }
  });
  
  // 주문 상태 강제 취소 API - 긴급 설정! 인증 없이 사용할 수 있음 
  app.post('/api/orders/emergency-cancel/:orderId', async (req, res) => {
    // 헤더 설정 축중 강화
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    const orderId = req.params.orderId;
    
    try {
      console.log(`[긴급 취소] 주문 ID ${orderId} 취소 요청 받음`);
      
      // 주문 정보 가져오기
      const order = await storage.getOrderByOrderId(orderId);
      if (!order) {
        return res.status(404).json({ success: false, error: '주문을 찾을 수 없습니다.' });
      }
      
      // 결제 정보 가져오기
      const payment = await storage.getPaymentByOrderId(orderId);
      
      // 실제 결제 취소 시도 - 이니시스 취소 요청 (포트원 API 호출)
      if (payment && payment.paymentKey) {
        try {
          // 포트원 V2 클라이언트 가져오기
          const portoneV2Client = await import('./portone-v2-client');
          const portoneClient = portoneV2Client.default;
          
          console.log(`[긴급 취소] 포트원 API로 취소 요청: ${payment.paymentKey}`);
          
          // 포트원 API로 취소 요청 실행 - pay_ 형식 사용
          await portoneClient.cancelPayment({
            paymentId: orderId, // 주문 ID(pay_ 형식) 사용
            reason: req.body.reason || '긴급 취소 기능 사용'
          });
          
          console.log(`[긴급 취소] 포트원 API 취소 성공: ${payment.paymentKey}`);
        } catch (portonError) {
          console.error(`[긴급 취소] 포트원 API 취소 오류:`, portonError);
          // 취소 오류가 발생해도 계속 진행
        }
      }
      
      // 결제 정보 업데이트 (로컬 DB)
      if (payment) {
        await storage.updatePayment(payment.id, {
          status: 'CANCELLED',
          updatedAt: new Date(),
          cancelReason: req.body.reason || '긴급 취소 기능 사용',
          cancelledAt: new Date()
        });
        console.log(`[긴급 취소] 주문 ${orderId}의 결제 정보 CANCELLED로 변경 완료`);
      }
      
      // 주문 상태 업데이트
      const updatedOrder = await storage.updateOrderStatusByOrderId(orderId, 'cancelled');
      if (!updatedOrder) {
        return res.status(500).json({ success: false, error: '주문 상태 업데이트 실패' });
      }
      
      console.log(`[긴급 취소] 주문 ${orderId} 상태가 cancelled로 업데이트 됨`);
      
      // 성공 응답 반환
      return res.json({
        success: true,
        message: '주문이 성공적으로 취소되었습니다.',
        orderId,
        order: updatedOrder,
        payment: payment ? await storage.getPaymentByOrderId(orderId) : null
      });
    } catch (error) {
      console.error(`[긴급 취소] 주문 ${orderId} 취소 중 오류:`, error);
      return res.status(500).json({ success: false, error: '주문 취소 실패' });
    }
  });

  // 사용자의 주문 목록 조회 API
  app.get("/api/orders/user/me", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: '로그인이 필요합니다' });
    }
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(400).json({ error: '사용자 정보를 찾을 수 없습니다' });
      }
      
      // 사용자의 모든 주문 조회
      const userOrders = await storage.getOrdersForUser(userId);
      
      console.log('사용자 주문 로그 - 총 주문 수:', userOrders.length);
      
      // 모든 주문을 표시하도록 변경 - 결제 정보가 없는 경우에도 주문 표시
      const paidOrders = [];
      
      for (const order of userOrders) {
        // 결제 정보 조회
        const payment = await storage.getPaymentByOrderId(order.orderId);
        console.log('주문 ID', order.orderId, '결제 정보:', payment ? `결제 상태=${payment.status}` : '결제 정보 없음');
        
        // 결제 정보가 있는 경우 payment 추가, 없어도 주문 표시
        if (payment) {
          (order as any).payment = payment;
        }
        
        // 상품 정보 조회 및 추가
        if (order.productId) {
          try {
            const product = await storage.getProduct(order.productId);
            if (product) {
              (order as any).productName = product.name;
            }
          } catch (err) {
            console.error('상품 정보 조회 중 오류:', err);
          }
        }
        
        // 모든 주문을 목록에 추가
        paidOrders.push(order);
      }
      
      res.json(paidOrders);
    } catch (error: any) {
      console.error('사용자 주문 조회 중 오류:', error);
      res.status(500).json({ error: error.message || '주문 조회에 실패했습니다.' });
    }
  });
  
  // 판매자의 주문 목록 조회 API
  app.get("/api/orders/vendor/me", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: '로그인이 필요합니다' });
    }
    
    // 판매자 권한 확인
    if (req.user?.role !== 'vendor' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: '판매자 권한이 필요합니다' });
    }
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(400).json({ error: '사용자 정보를 찾을 수 없습니다' });
      }
      
      // 판매자 정보 조회
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor) {
        return res.status(404).json({ error: '판매자 정보를 찾을 수 없습니다' });
      }
      
      console.log(`[DEBUG] 판매자 주문 조회: 판매자 ID ${vendor.id}, 판매자 이름 ${vendor.name || 'undefined'}`);
      
      let vendorOrders = [];
      if (req.user?.role === 'admin') {
        // 관리자는 모든 주문을 볼 수 있음
        vendorOrders = await db.select().from(orders);
      } else {
        // 해당 판매자의 주문만 조회
        vendorOrders = await storage.getOrdersForVendor(vendor.id);
        console.log(`[DEBUG] 판매자 주문 조회: 판매자 ID ${vendor.id}의 주문만 표시합니다.`);
      }
      
      console.log(`[DEBUG] 판매자 주문 조회 결과: ${vendorOrders.length}개 주문 발견`);
      
      // 로깅 추가: 주문별 상태 확인
      vendorOrders.forEach((order, index) => {
        console.log(`[DEBUG] 주문 ${index + 1}: ID ${order.id}, 상태 ${order.status}, 주문번호 ${order.orderId}, 판매자 ID ${order.vendorId}`);
      });
      
      // 각 주문에 상품 정보 추가 및 상태 확인
      for (const order of vendorOrders) {
        // 상품 정보 추가
        if (order.productId) {
          try {
            const product = await storage.getProduct(order.productId);
            if (product) {
              (order as any).productName = product.name;
            }
          } catch (err) {
            console.error('상품 정보 조회 중 오류:', err);
          }
        }

        // 주문 상태 디버깅 (이 부분은 문제 진단을 위한 로그입니다)
        console.log(`[상태 디버깅] 주문 ID: ${order.id}, 현재 상태: ${order.status}, 주문번호: ${order.orderId}`);
      }
      
      // 모든 결제 완료된 주문도 확인
      const allPaidOrders = await db.select().from(orders).where(eq(orders.status, 'paid'));
      console.log(`[DEBUG] 전체 결제 완료된 주문: ${allPaidOrders.length}개`);
      allPaidOrders.forEach((order, index) => {
        console.log(`[DEBUG] 결제 완료 주문 ${index + 1}: ID ${order.id}, 판매자 ID ${order.vendorId}, 주문번호 ${order.orderId}`);
      });
      
      res.json(vendorOrders);
    } catch (error: any) {
      console.error('판매자 주문 조회 중 오류:', error);
      res.status(500).json({ error: error.message || '주문 조회에 실패했습니다.' });
    }
  });
  
  // 판매자의 직접 판매 주문 목록 조회 API (checkout에서 구매한 상품)
  app.get("/api/orders/vendor/direct", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: '로그인이 필요합니다' });
    }
    
    // 판매자 권한 확인
    if (req.user?.role !== 'vendor' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: '판매자 권한이 필요합니다' });
    }
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(400).json({ error: '사용자 정보를 찾을 수 없습니다' });
      }
      
      // 판매자 정보 조회
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor) {
        return res.status(404).json({ error: '판매자 정보를 찾을 수 없습니다' });
      }
      
      // 판매자 상품의 직접 구매 주문 중 실결제된 것만 조회 (conversationId = 0 AND status = 'paid')
      let directOrders: any[] = [];
      if (req.user?.role === 'admin') {
        // 관리자는 모든 직접 구매 주문 중 결제 완료된 것만 볼 수 있음
        directOrders = await db.select().from(orders).where(
          and(
            eq(orders.conversationId, 0),
            eq(orders.status, 'paid')
          )
        );
      } else {
        // 해당 판매자의 직접 구매 주문 중 결제 완료된 것만 조회
        directOrders = await db.select()
          .from(orders)
          .where(
            and(
              eq(orders.vendorId, vendor.id),
              eq(orders.conversationId, 0),
              eq(orders.status, 'paid')
            )
          );
      }
      
      // 각 주문에 상품 정보 추가
      for (const order of directOrders) {
        if (order.productId) {
          try {
            const product = await storage.getProduct(order.productId);
            if (product) {
              (order as any).productName = product.name;
            }
          } catch (err) {
            console.error('상품 정보 조회 중 오류:', err);
          }
        }
      }
      
      console.log(`판매자 ${vendor.id}의 직접 판매 주문: ${directOrders.length}개`);
      res.json(directOrders);
    } catch (error: any) {
      console.error('판매자 직접 판매 주문 조회 중 오류:', error);
      res.status(500).json({ error: error.message || '주문 조회에 실패했습니다.' });
    }
  });
  
  // 판매자별 결제 정보 조회 API
  app.get("/api/payments/vendor/me", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: '로그인이 필요합니다' });
    }
    
    // 판매자 권한 확인
    if (req.user?.role !== 'vendor' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: '판매자 권한이 필요합니다' });
    }
    
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(400).json({ error: '사용자 정보를 찾을 수 없습니다' });
      }
      
      // 판매자 정보 조회
      const vendor = await storage.getVendorByUserId(userId);
      if (!vendor) {
        return res.status(404).json({ error: '판매자 정보를 찾을 수 없습니다' });
      }
      
      // 판매자 ID로 결제 정보 조회 (bids.vendorId로 필터링)
      const payments = await storage.getPaymentsForVendor(vendor.id);
      
      // 디버깅 정보
      console.log(`[DEBUG] 판매자 ${vendor.id}(${vendor.storeName || '이름 없음'})의 결제 ${payments.length}개 조회`);
      
      res.json(payments);
    } catch (error: any) {
      console.error('판매자 결제 정보 조회 중 오류:', error);
      res.status(500).json({ error: error.message || '결제 정보 조회에 실패했습니다.' });
    }
  });
  
  // 결제 ID로 결제 정보 조회 API
  app.get("/api/payments/order/:orderId", async (req, res) => {
    try {
      const { orderId } = req.params;
      console.log('주문 ID로 결제 정보 조회:', orderId);
      const payment = await storage.getPaymentByOrderId(orderId);
      
      if (!payment) {
        console.log('주문에 대한 결제 정보가 없음:', orderId);
        return res.status(404).json({ error: '결제 정보를 찾을 수 없습니다.' });
      }
      
      // V2 API 형식의 결제키 확인
      if (payment.paymentKey && !payment.paymentKey.startsWith('pay_')) {
        // KG이니시스 TID 형식을 V2 API 형식으로 변환 시도
        console.log('기존 결제키를 V2 형식으로 변환 시도:', payment.paymentKey);
        // 변환할 필요가 없거나 불가능한 경우 원래 값 유지
      }
      
      res.json(payment);
    } catch (error: any) {
      console.error('결제 정보 조회 중 오류:', error);
      res.status(500).json({ error: error.message || '결제 정보 조회에 실패했습니다.' });
    }
  });
  
  // 공개 결제 동기화 API - 인증 불필요
  app.post("/api/public/payments/sync", async (req, res) => {
    // 항상 JSON 타입으로 응답 설정
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    try {
      const { orderId } = req.body;
      
      if (!orderId) {
        return res.status(400).json({
          success: false,
          error: '주문 ID가 필요합니다.'
        });
      }
      
      console.log(`주문 ${orderId}에 대한 결제 정보 공개 동기화 요청 받음`);
      
      // 주문 정보 조회
      const order = await storage.getOrderByOrderId(orderId);
      
      if (!order) {
        return res.status(404).json({
          success: false,
          error: '주문을 찾을 수 없습니다.'
        });
      }
      
      // 기존 결제 정보 확인
      const existingPayment = await storage.getPaymentByOrderId(orderId);
      
      if (existingPayment) {
        return res.status(200).json({
          success: true,
          message: '이미 결제 정보가 존재합니다.',
          payment: existingPayment
        });
      }
      
      // 결제 정보 생성 (스키마에 맞는 형식으로)
      const paymentData = {
        userId: order.userId,
        bidId: 1, // 기본값 설정 (임시 처리)
        orderId: orderId,
        orderName: "식물 구매: " + orderId,
        amount: order.price.toString(),
        method: "CARD", 
        status: "success", // 결제 성공 상태로 설정
        // pay_로 시작하는 V2 API 형식의 paymentKey 사용
        paymentKey: `pay_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        // receipt 필드 제외
        customerName: "구매자",
        paymentUrl: `https://iniweb.inicis.com/receipt/MOI3204387_${orderId}`
      };
      
      // 결제 정보 저장
      const payment = await storage.createPayment(paymentData);
      
      return res.status(200).json({
        success: true,
        message: '결제 정보가 성공적으로 동기화되었습니다.',
        payment
      });
    } catch (error: any) {
      console.error('결제 정보 동기화 중 오류:', error);
      return res.status(500).json({
        success: false,
        error: error.message || '결제 정보 동기화 중 오류가 발생했습니다.'
      });
    }
  });

  // 주문 상태 업데이트 API - PATCH 메소드도 지원 (클라이언트에서 PATCH 사용 중)
  app.patch("/api/orders/:orderId/status", async (req, res) => {
    console.log(`[주문 상태 업데이트] 시작 - 주문 ID: ${req.params.orderId}, 요청 메소드: ${req.method}, 요청된 상태: ${req.body.status}`);
    // 인증 확인
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }
    
    try {
      const { orderId } = req.params;
      const { status } = req.body;
      
      // 필수 필드 검증
      if (!status) {
        return res.status(400).json({ error: "상태 정보가 필요합니다" });
      }
      
      // 허용된 상태값 확인
      const allowedStatuses = ['created', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ 
          error: "유효하지 않은 주문 상태입니다",
          allowedStatuses
        });
      }
      
      // 주문 정보 확인
      const order = await storage.getOrderByOrderId(orderId);
      if (!order) {
        return res.status(404).json({ error: "주문을 찾을 수 없습니다" });
      }
      
      // 권한 확인: 사용자 본인 또는 판매자만 업데이트 가능
      if (req.user.id !== order.userId && req.user.id !== order.vendorId && req.user.role !== 'admin') {
        return res.status(403).json({ error: "이 주문을 업데이트할 권한이 없습니다" });
      }
      
      // 주문이 이미 취소된 경우 업데이트 불가
      if (order.status === 'cancelled' && status !== 'cancelled') {
        return res.status(400).json({ error: "취소된 주문은 상태를 변경할 수 없습니다" });
      }
      
      // 주문 상태가 준비중(preparing)으로 변경될 때 채팅에 판매자 메시지 추가
      if (status === 'preparing' && order.status !== 'preparing') {
        // 대화 ID가 있는 경우에만 채팅 메시지 추가
        if (order.conversationId) {
          try {
            // 대화에 판매자 메시지 추가
            const vendor = await storage.getVendor(order.vendorId);
            if (vendor) {
              // 제품 정보 조회
              const product = order.productId ? await storage.getProduct(order.productId) : null;
              const productName = product ? product.name : '상품';
              
              // 판매자 메시지 생성
              await storage.addMessageToConversation(order.conversationId, {
                role: 'vendor',
                content: `${productName} 상품이 준비 중입니다. 곧 배송될 예정이니 조금만 기다려주세요!`,
                timestamp: new Date(),
                vendorId: order.vendorId,
                vendorName: vendor.name,
                storeName: vendor.storeName || '심다',
                vendorColor: vendor.color || 'bg-green-50'
              });
              
              console.log(`주문 ID ${orderId}에 대한 준비 중 메시지가 대화에 추가되었습니다.`);
            }
          } catch (chatError) {
            console.error("채팅 메시지 추가 중 오류:", chatError);
            // 채팅 메시지 추가 실패는 전체 트랜잭션을 취소하지 않음
          }
        }
      }
      
      // 주문 상태 업데이트
      console.log(`[주문 상태 업데이트] 데이터베이스 업데이트 시작 - 주문 ID: ${orderId}, 새 상태: ${status}, 현재 상태: ${order.status}`);
      const updatedOrder = await storage.updateOrderStatusByOrderId(orderId, status);
      
      if (!updatedOrder) {
        console.log(`[주문 상태 업데이트] 실패 - 주문 ID: ${orderId}, 상태: ${status}`);
        return res.status(500).json({ error: "주문 상태 업데이트에 실패했습니다" });
      }
      
      // 상태 변경 로그 기록
      console.log(`[주문 상태 업데이트] 성공 - 주문 ID ${orderId}의 상태가 '${order.status}'에서 '${status}'로 변경되었습니다.`);
      console.log(`[주문 상태 업데이트] 업데이트된 주문 데이터:`, updatedOrder);
      
      res.json({
        success: true,
        message: `주문 상태가 '${status}'로 업데이트되었습니다.`,
        order: updatedOrder
      });
      
    } catch (error) {
      console.error("주문 상태 업데이트 중 오류:", error);
      res.status(500).json({ error: "주문 상태 업데이트에 실패했습니다" });
    }
  });

  // 긴급 결제 취소 API - 인증 없는 백업 메커니즘
  app.post("/api/orders/emergency-cancel/:orderId", async (req, res) => {
    // JSON 응답 헤더 설정
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    try {
      const { orderId } = req.params;
      const { reason } = req.body;
      
      console.log('[긴급 취소 API] 주문 ID:', orderId, '취소 사유:', reason || '긴급 취소 요청');
      
      // 결제 정보 조회
      const payment = await storage.getPaymentByOrderId(orderId);
      
      if (!payment) {
        console.error('[긴급 취소 API] 결제 정보를 찾을 수 없음. 주문 ID:', orderId);
        return res.status(404).json({ 
          success: false, 
          error: "결제 정보를 찾을 수 없습니다", 
          orderId 
        });
      }
      
      // 이미 취소된 결제인지 확인
      if (payment.status === 'CANCELLED') {
        console.log('[긴급 취소 API] 이미 취소된 결제. 결제 ID:', payment.id, '주문 ID:', orderId);
        return res.status(400).json({ 
          success: false, 
          error: "이미 취소된 결제입니다", 
          payment 
        });
      }
      
      // 개선된 결제 취소 기능 호출
      const enhancedPayments = await import('./enhanced-payments');
      return await enhancedPayments.cancelPaymentWithRetry(
        payment, 
        orderId, 
        reason || '긴급 취소 요청', 
        storage, 
        res
      );
    } catch (error: any) {
      console.error('[긴급 취소 API] 오류:', error?.message || error);
      return res.status(500).json({
        success: false,
        error: error?.message || '결제 취소 중 오류가 발생했습니다',
        timestamp: new Date().toISOString()
      });
    }
  });

  const httpServer = createServer(app);

  // 실시간 업데이트를 위한 폴링 방식 사용
  console.log('HTTP 폴링 방식으로 실시간 업데이트 활성화');
  
  // 더 이상 브로드캐스트가 필요 없지만 기존 코드와의 호환성을 위해 더미 함수 유지
  const broadcastConversationUpdate = (conversationId: number, data: any) => {
    console.log(`대화 ${conversationId} 업데이트 (폴링으로 클라이언트가 조회 예정)`);
  };
  
  // conversation 관련 API 엔드포인트에서 브로드캐스트 함수 참조할 수 있도록 설정
  app.set('broadcastConversationUpdate', broadcastConversationUpdate);

  // 관리자 대시보드 API 엔드포인트 추가
  app.get("/api/admin/sales", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      // 클라이언트에서 선택한 기간 가져오기
      const timeRange = req.query.timeRange as string || 'week';
      console.log(`선택된 기간: ${timeRange}`);
      
      // 시간 범위에 따른 기준일 계산
      const currentDate = new Date();
      // 오늘 날짜를 완전히 포함하기 위해 시간을 23:59:59로 설정
      currentDate.setHours(23, 59, 59, 999);
      
      let startDate = new Date(currentDate);
      
      // 선택된 기간에 따라 시작일 설정
      switch(timeRange) {
        case 'week':
          startDate.setDate(currentDate.getDate() - 7); // 최근 7일
          break;
        case 'month':
          startDate.setDate(currentDate.getDate() - 30); // 최근 30일
          break;
        case 'quarter':
          startDate.setMonth(currentDate.getMonth() - 3); // 최근 3개월
          break;
        case 'year':
          startDate.setFullYear(currentDate.getFullYear() - 1); // 최근 1년
          break;
        default:
          startDate.setDate(currentDate.getDate() - 7); // 기본값: 최근 7일
      }
      
      // 날짜 필터링 로그
      console.log(`매출 데이터 필터링 기간: ${startDate.toISOString()} ~ ${currentDate.toISOString()}`);
      
      // SQL 쿼리 결과에 따른 실제 주문 데이터 기반 응답
      const allOrders = await storage.getAllOrders();
      console.log(`모든 주문 정보 조회 시작`);
      console.log(`모든 주문 정보 조회 완료: ${allOrders?.length}개`);
      
      // 선택된 기간에 맞는 주문만 필터링
      const filteredOrders = allOrders.filter(order => {
        try {
          const orderDate = new Date(new Date(order.createdAt).toISOString());
          return orderDate >= startDate && orderDate <= currentDate;
        } catch (err) {
          return false;
        }
      });
      
      console.log(`선택된 기간(${timeRange})의 주문 수: ${filteredOrders.length}/${allOrders.length}개`);
      
      // 유효한 주문만 필터링 (paid, preparing, complete 상태)
      const validOrders = filteredOrders.filter(order => {
        const status = order.status?.toLowerCase() || '';
        return status === 'paid' || status === 'preparing' || status === 'complete';
      });
      
      // 주문 상태별 통계 (선택된 기간 내 주문만 사용)
      let totalSales = 0;
      let netSales = 0;
      let canceledSales = 0;
      let canceledCount = 0;
      let pendingOrders = 0;
      let pendingAmount = 0;
      
      // 선택된 기간 내 주문만 처리하여 통계 계산
      filteredOrders.forEach(order => {
        try {
          const price = parseFloat(order.price.replace(/[^0-9.-]+/g, "")) || 0;
          const status = order.status?.toLowerCase() || '';
          
          if (status === 'paid' || status === 'preparing' || status === 'complete') {
            totalSales += price;
            netSales += price;
          } else if (status === 'cancelled') {
            canceledSales += price;
            canceledCount++;
          } else if (status === 'created' || status === 'pending') {
            pendingOrders++;
            pendingAmount += price;
          }
        } catch (err) {
          // 가격 변환 오류 무시
        }
      });
      
      // 실제 주문 날짜 기반 매출 데이터 생성
      const salesByDate = new Map();
      
      // 유효한 주문들로 날짜별 매출 계산
      validOrders.forEach(order => {
        try {
          const orderDate = new Date(order.createdAt).toISOString().split('T')[0]; // YYYY-MM-DD
          const price = parseFloat(order.price.replace(/[^0-9.-]+/g, "")) || 0;
          
          if (!salesByDate.has(orderDate)) {
            salesByDate.set(orderDate, 0);
          }
          
          salesByDate.set(orderDate, salesByDate.get(orderDate) + price);
        } catch (err) {
          // 날짜 변환 오류 무시
        }
      });
      
      // 일별 매출 데이터 배열로 변환
      const dailySales = [];
      for (const [date, amount] of salesByDate.entries()) {
        dailySales.push({
          date,
          순매출액: amount
        });
      }
      
      // 데이터 정렬 (날짜 기준 오름차순)
      dailySales.sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
      
      // 최근 날짜 데이터가 없는 경우, 빈 데이터 추가 (그래프 표시용)
      // 선택된 기간에 따라 최근 날짜 범위 설정
      const daysToShow = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 
                         timeRange === 'quarter' ? 90 : 365;
      
      const now = new Date();
      for (let i = 0; i < daysToShow; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        if (date >= startDate && date <= currentDate && !salesByDate.has(dateStr)) {
          dailySales.push({
            date: dateStr,
            순매출액: 0
          });
        }
      }
      
      // 제품별 매출 데이터 - 실제 주문 데이터 기반 계산 (향상된 버전)
      const categoryMap = new Map();
      
      // 제품 ID에 따른 실제 상품명 매핑
      const productNameMap: Record<number, string> = {
        6: "몬스테라 델리시오사",
        12: "산세베리아",
        5: "아레카 야자",
        7: "필로덴드론",
        8: "피토니아",
        9: "칼라디움",
        10: "스투키",
        11: "행운목"
      };
      
      // 실제 데이터로 카테고리별 매출 집계
      validOrders.forEach(order => {
        try {
          // order.productId 또는 order.plantId를 사용 (어느 필드가 실제로 존재하는지에 따라)
          const productId = order.productId || order.plantId;
          if (!productId) return; // 유효한 제품 ID가 없는 경우 건너뛰기
          
          const price = parseFloat(order.price.replace(/[^0-9.-]+/g, "")) || 0;
          
          // 제품명 결정 로직
          let productName = '';
          
          // 1. 상품 테이블의 매핑된 이름 사용
          if (productId && productNameMap[productId]) {
            productName = productNameMap[productId];
          } 
          // 2. 주문에 저장된 제품명 사용 (plantName 또는 productName 필드가 있는 경우)
          else if (typeof order.plantName === 'string' || typeof order.productName === 'string') {
            productName = order.plantName || order.productName || '';
          } 
          // 3. 기본 이름 생성
          else {
            productName = `식물 #${productId || '알 수 없음'}`;
          }
          
          if (!categoryMap.has(productId)) {
            categoryMap.set(productId, { 
              id: productId, 
              name: productName, 
              sales: 0, 
              count: 0,
              isBidProduct: order.isBid === true || false
            });
          }
          
          const category = categoryMap.get(productId);
          category.sales += price;
          category.count += 1;
        } catch (err) {
          // 카테고리 계산 오류 무시
          console.error('제품별 매출 계산 오류:', err);
        }
      });
      
      // 실제 데이터만 사용, 임시 제품 데이터 생성하지 않음
      
      // 제품별 매출 데이터 (매출액 기준 내림차순 정렬)
      const categories = Array.from(categoryMap.values())
        .sort((a, b) => b.sales - a.sales);
      
      // 판매자별 매출 데이터 - 실제 데이터베이스에서 가져오기
      let vendorSales = [];
      
      try {
        // 1. 모든 판매자 정보를 먼저 가져옴
        const allVendors = await db.select().from(vendors);
        console.log(`실제 판매자 정보 ${allVendors.length}개 로드됨`);
        console.log('실제 판매자 목록:', allVendors.map(v => `ID:${v.id} 상호명:${v.storeName}`));
        
        // 2. 판매자별 매출 집계용 맵
        const vendorSalesMap = new Map();
        
        // 3. 유효한 주문들을 순회하며 판매자별 매출 계산
        console.log('유효한 주문들:', validOrders.map(o => `주문ID:${o.orderId} 판매자ID:${o.vendorId} 가격:${o.price}`));
        
        validOrders.forEach(order => {
          const vendorId = order.vendorId;
          if (!vendorId) return;
          
          const price = parseFloat(order.price.replace(/[^0-9.-]+/g, "")) || 0;
          console.log(`주문 처리: 판매자ID ${vendorId}, 가격 ${price}`);
          
          if (!vendorSalesMap.has(vendorId)) {
            vendorSalesMap.set(vendorId, { sales: 0, count: 0 });
          }
          
          const vendorData = vendorSalesMap.get(vendorId);
          vendorData.sales += price;
          vendorData.count += 1;
        });
        
        // 4. 판매자 정보와 매출 데이터 결합
        for (const [vendorId, salesData] of vendorSalesMap.entries()) {
          const vendorInfo = allVendors.find(v => v.id === vendorId);
          const storeName = vendorInfo ? vendorInfo.storeName : `판매자 ID: ${vendorId}`;
          
          vendorSales.push({
            id: vendorId,
            name: storeName,
            storeName: storeName,
            sales: salesData.sales,
            count: salesData.count
          });
        }
        
        // 5. 매출액 기준 내림차순 정렬
        vendorSales.sort((a, b) => b.sales - a.sales);
        
        console.log(`실제 판매자별 매출 데이터 ${vendorSales.length}명 생성 완료`);
        
      } catch (error) {
        console.error("판매자별 매출 계산 실패:", error);
        vendorSales = [];
      }
      
      // 응답 데이터 준비
      const salesData = {
        totalSales,
        canceledSales,
        canceledCount,
        netSales,
        pendingOrders,
        pendingAmount,
        salesGrowth: 0,
        totalOrders: validOrders.length,
        orderGrowth: 0,
        dailySales,
        dataFormat: 'daily',
        categories,
        vendorSales,
        timeRange: timeRange
      };
      
      console.log(`최종 응답 데이터 - 판매자 수: ${salesData.vendorSales.length}`);
      res.json(salesData);
    } catch (error) {
      console.error("관리자 매출 데이터 조회 오류:", error);
      res.status(500).json({ error: "매출 데이터를 불러오는 중 오류가 발생했습니다" });
    }
    
  });
  


  // 기존 매출 통계 관련 코드는 다른 엔드포인트로 이동
  app.get("/api/admin/sales-with-plants", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      // 시간 범위 파라미터 가져오기
      const timeRange = req.query.timeRange as string || 'week';
      
      // 실제 주문 데이터 가져오기
      const allOrders = await storage.getAllOrders();
      const allPayments = await storage.getAllPayments();
      
      // 시간 범위에 따른 기준일 계산
      const currentDate = new Date();
      // 오늘 날짜를 완전히 포함하기 위해 시간을 23:59:59로 설정
      currentDate.setHours(23, 59, 59, 999);
      console.log(`대시보드 현재 기준일: ${currentDate.toISOString()}`);
      
      let startDate = new Date(currentDate);
      
      switch(timeRange) {
        case 'week':
          startDate.setDate(currentDate.getDate() - 7); // 최근 7일
          break;
        case 'month':
          startDate.setDate(currentDate.getDate() - 30); // 최근 30일
          break;
        case 'quarter':
          startDate.setMonth(currentDate.getMonth() - 3); // 최근 3개월
          break;
        case 'year':
          startDate.setFullYear(currentDate.getFullYear() - 1); // 최근 1년
          break;
        default:
          startDate.setDate(currentDate.getDate() - 7); // 기본값: 최근 7일
      }
      
      console.log(`관리자 대시보드: 주문 ${allOrders?.length || 0}개, 결제 ${allPayments?.length || 0}개 데이터 로드됨`);

      // 날짜 필터링 디버그 정보
      console.log(`필터링 기준: ${startDate.toISOString()} ~ ${currentDate.toISOString()}`);
      
      // 현재 시간 기준으로 최신 주문 확인 (디버깅용)
      const latestOrders = allOrders
        ?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      
      console.log("최근 주문 5개:");
      latestOrders?.forEach(order => {
        console.log(`주문 ID: ${order.id}, 생성일: ${new Date(order.createdAt).toISOString()}, 상태: ${order.status}, 금액: ${order.price}`);
      });
      
      // 기간에 맞는 주문만 필터링 (정확한 날짜 비교)
      const filteredOrders = allOrders?.filter(order => {
        // 주문 날짜를 ISO 문자열로 변환 후 다시 Date 객체로 생성하여 정확한 비교
        const orderDate = new Date(new Date(order.createdAt).toISOString());
        const isInRange = orderDate >= startDate && orderDate <= currentDate;
        
        // 경계값 주문 디버깅 (현재 날짜에 가까운 주문)
        const timeDiff = Math.abs(currentDate.getTime() - orderDate.getTime());
        if (timeDiff < 24 * 60 * 60 * 1000) { // 24시간 이내 주문
          console.log(`경계값 주문: ID ${order.id}, 날짜 ${orderDate.toISOString()}, 포함여부: ${isInRange ? 'O' : 'X'}`);
        }
        
        return isInRange;
      }) || [];
      
      console.log(`${timeRange} 기간 필터 적용: ${filteredOrders.length}/${allOrders?.length || 0}개 주문 표시`);

      // 비교를 위한 이전 기간 계산
      const prevEndDate = new Date(startDate);
      const prevStartDate = new Date(startDate);
      const periodDuration = currentDate.getTime() - startDate.getTime();
      prevStartDate.setTime(prevStartDate.getTime() - periodDuration);
      
      // 이전 기간 주문 필터링 (성장률 계산용)
      const prevPeriodOrders = allOrders?.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= prevStartDate && orderDate < prevEndDate;
      }) || [];
      
      console.log(`이전 기간 필터 적용: ${prevPeriodOrders.length}개 주문 (${prevStartDate.toISOString()} ~ ${prevEndDate.toISOString()})`); 
      
      // 주문 데이터가 없는 경우
      if (!filteredOrders || filteredOrders.length === 0) {
        return res.json({
          totalSales: 0,
          salesGrowth: 0,
          totalOrders: 0,
          orderGrowth: 0,
          conversionRate: 0,
          dailySales: [],
          categories: []
        });
      }
      
      // 총 매출액과 취소 금액 계산 (필터링된 주문만)
      let totalSales = 0;
      let canceledSales = 0;
      let netSales = 0;
      let canceledCount = 0; // 취소된 주문 건수
      
      // 주문 상태 디버깅 정보 출력
      console.log('===== 주문 상태 디버깅 시작 =====');
      const statusCounts = {};
      filteredOrders.forEach(order => {
        statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
      });
      console.log('주문 상태 분포:', JSON.stringify(statusCounts));
      
      // 취소된 주문이 있는지 상세 확인 (모든 가능한 취소 상태 확인)
      const cancelledOrders = filteredOrders.filter(order => {
        // 대소문자 구분 없이 상태 문자열 확인
        const status = order.status?.toLowerCase() || '';
        return status.includes('cancel') || 
               status === 'cancelled' || 
               status === 'canceled' || 
               status === 'refunded' || 
               status === 'CANCELLED' ||
               status === '취소됨' ||
               status === '주문 취소';
      });
      console.log(`취소된 주문 목록 (총 ${cancelledOrders.length}개):`);
      if (cancelledOrders.length > 0) {
        cancelledOrders.forEach(order => {
          console.log(`- 주문 ID: ${order.id}, 상태: ${order.status}, 금액: ${order.price}`);
        });
      } else {
        console.log('취소된 주문이 없습니다.');
        
        // 취소된 주문을 못 찾았다면 다른 방식으로 시도해보기
        const possibleCancelled = filteredOrders.filter(order => 
          order.status && order.status.toLowerCase().includes('cancel')
        );
        if (possibleCancelled.length > 0) {
          console.log('취소 관련 텍스트가 포함된 주문 상태:');
          possibleCancelled.forEach(order => {
            console.log(`- 주문 ID: ${order.id}, 상태: ${order.status}, 금액: ${order.price}`);
          });
        }
      }
      
      // 모든 주문 처리 (상태별 구분)
      let pendingOrders = 0;
      let pendingAmount = 0;
      
      filteredOrders.forEach(order => {
        const price = parseFloat(order.price.replace(/[^0-9.-]+/g, ""));
        if (!isNaN(price)) {
          // 주문 상태를 소문자로 통일
          const orderStatus = order.status ? order.status.toLowerCase() : '';
          
          // 1. 취소 상태 체크
          if (orderStatus.includes('cancel') || 
              orderStatus === 'refunded' || 
              orderStatus === 'cancelled' || 
              orderStatus === '취소됨' ||
              orderStatus === '주문 취소') {
            // 취소된 주문은 총매출에 포함하고, 취소금액으로 따로 계산
            totalSales += price;
            canceledSales += price;
            canceledCount++; // 취소 건수 증가
            console.log(`취소 주문 처리: ID ${order.id}, 상태 ${order.status}, 금액 ${price.toLocaleString()}원`);
          }
          // 2. 미결제 상태 체크 (created)
          else if (orderStatus === 'created' || orderStatus === '생성됨') {
            // 미결제 주문은 별도로 카운트
            pendingOrders++;
            pendingAmount += price;
            console.log(`미결제 주문: ID ${order.id}, 상태 ${order.status}, 금액 ${price.toLocaleString()}원`);
          }
          // 3. 정상 매출로 처리 (paid, preparing, complete 등 모든 유효한 주문)
          else {
            totalSales += price;
            console.log(`정상 주문 처리: ID ${order.id}, 상태 ${order.status}, 금액 ${price.toLocaleString()}원`);
          }
        }
      });
      
      // 순매출 계산 (총매출 - 취소금액)
      netSales = totalSales - canceledSales;
      
      // 이전 기간 총 매출액과 취소 금액 계산 (성장률 계산용)
      let prevPeriodSales = 0;
      let prevPeriodCanceledSales = 0;
      let prevPeriodNetSales = 0;
      
      prevPeriodOrders.forEach(order => {
        const price = parseFloat(order.price.replace(/[^0-9.-]+/g, ""));
        if (!isNaN(price)) {
          prevPeriodSales += price;
          
          // 취소된 주문인지 확인 (모든 취소 상태 포함)
          const status = order.status ? order.status.toLowerCase() : '';
          if (status.includes('cancel') || 
              status === 'refunded' || 
              status === 'cancelled' || 
              status === '취소됨' ||
              status === '주문 취소') {
            prevPeriodCanceledSales += price;
            console.log(`이전 기간 취소 주문 감지: ID ${order.id}, 상태 ${order.status}, 금액 ${price.toLocaleString()}원`);
          }
        }
      });
      
      // 이전 기간 순매출
      prevPeriodNetSales = prevPeriodSales - prevPeriodCanceledSales;
      
      console.log(`매출 내역: 총매출 ${totalSales.toLocaleString()}원, 취소금액 ${canceledSales.toLocaleString()}원, 순매출 ${netSales.toLocaleString()}원`);
      
      // 선택된 기간에 맞는 매출 데이터 계산 (일별 또는 월별)
      const salesDataMap = new Map();
      const pendingByDate = new Map(); // 미결제 주문 추적
      const paidByDate = new Map();    // 결제 완료된 주문만 추적 (순매출용)
      
      // 데이터 그룹화 방식 결정 (일별 또는 월별)
      const useMonthlyGrouping = ['quarter', 'year'].includes(timeRange);
      console.log(`${timeRange} 기간 데이터 표시 방식: ${useMonthlyGrouping ? '월별 그룹화' : '일별 상세'}`);
      
      // 클라이언트 시간대 보정 함수
      function correctTimezone(dateObj: Date): Date {
        // 한국 시간대로 맞추기 (UTC+9)
        // 주의: 서버가 UTC로 실행 중이라면 9시간 더하고, 이미 KST라면 그대로 사용
        const serverTimeZoneOffset = dateObj.getTimezoneOffset();
        
        // 실제 클라이언트 시간과 일치하도록 타임존 조정
        // 서버가 UTC(+0)면 +9시간, 서버가 이미 KST(+9)라면 +0시간
        const koreaOffset = 9 * 60; // 한국 UTC+9 (분 단위)
        const offsetDiff = serverTimeZoneOffset + koreaOffset;
        
        // 오프셋 차이만큼 시간 조정
        const correctedDate = new Date(dateObj.getTime() + offsetDiff * 60 * 1000);
        
        return correctedDate;
      }
      
      // 시간대 디버깅용
      const now = new Date();
      const correctedNow = correctTimezone(now);
      console.log(`서버 현재 시간: ${now.toISOString()}, 보정된 시간: ${correctedNow.toISOString()}`);
      
      if (useMonthlyGrouping) {
        // 월별 데이터로 그룹화
        const monthlyDataMap = new Map();
        
        // 월별 레이블 생성 (예: "2025-05")
        const months = [];
        const endDate = new Date(currentDate);
        let current = new Date(startDate);
        
        while (current <= endDate) {
          const yearMonth = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
          if (!monthlyDataMap.has(yearMonth)) {
            monthlyDataMap.set(yearMonth, 0);
            months.push(yearMonth);
          }
          
          // 다음 달로 이동
          current.setMonth(current.getMonth() + 1);
        }
        
        // 주문 데이터로 월별 매출 합계 계산 - 상태별로 구분
        filteredOrders.forEach(order => {
          const orderDate = new Date(order.createdAt);
          const yearMonth = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
          
          if (monthlyDataMap.has(yearMonth)) {
            const price = parseFloat(order.price.replace(/[^0-9.-]+/g, ""));
            if (isNaN(price)) return;
            
            // 주문 상태에 따라 다른 맵에 추가
            const orderStatus = order.status ? order.status.toLowerCase() : '';
            
            // 순매출 계산을 위한 정상 주문만 처리
            if (orderStatus === 'paid' || orderStatus === 'preparing' || orderStatus === 'complete') {
              // paidByDate 맵에 순매출 누적
              if (!paidByDate.has(yearMonth)) {
                paidByDate.set(yearMonth, 0);
              }
              paidByDate.set(yearMonth, paidByDate.get(yearMonth) + price);
              
              // 월별 데이터에도 추가
              monthlyDataMap.set(yearMonth, monthlyDataMap.get(yearMonth) + price);
              
              console.log(`정상 결제 주문 (월별): ID ${order.id}, 월 ${yearMonth}, 금액 ${price}, 상태: ${orderStatus}`);
            }
            else if (orderStatus === 'created') {
              // 미결제 주문은 pendingByDate에만 추가
              if (!pendingByDate.has(yearMonth)) {
                pendingByDate.set(yearMonth, 0);
              }
              pendingByDate.set(yearMonth, pendingByDate.get(yearMonth) + price);
              console.log(`미결제 주문 (월별): ID ${order.id}, 월 ${yearMonth}, 금액 ${price}`);
            }
          }
        });
        
        // 월별 데이터를 일반 날짜 형식으로 변환 (월 표시용)
        months.forEach(month => {
          salesDataMap.set(month, monthlyDataMap.get(month));
        });
        
        console.log(`${timeRange} 기간 월별 매출 계산: ${salesDataMap.size}개월치 데이터`);
      } else {
        // 일별 데이터 처리 (기존 로직)
        // 시간 범위에 따른 일자 표시 개수 조정
        let daysToShow = timeRange === 'week' ? 7 : 30; // 주간 또는 월간
        
        // 시작일부터 현재까지의 날짜 초기화 (당일 포함)
        for (let i = 0; i <= daysToShow; i++) {  // <= 로 변경하여 마지막 날짜도 포함
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + i);
          
          // 현재 날짜를 넘어가면 중단
          if (date > currentDate) break;
          
          const dateString = date.toISOString().split('T')[0];
          salesDataMap.set(dateString, 0);
          console.log(`그래프 날짜 추가: ${dateString}`);
        }
        
        // 미결제 주문 추적을 위한 맵 초기화
      const pendingByDate = new Map();
      const paidByDate = new Map();

      // 필터링된 주문 데이터로 일별 매출 채우기 (시간대 보정 적용)
      // 하지만 이번에는 상태별로 분리하여 처리
      filteredOrders.forEach(order => {
        // 주문 날짜를 실제 한국 시간으로 보정
        const orderDate = correctTimezone(new Date(order.createdAt));
        const dateString = orderDate.toISOString().split('T')[0];
        
        // 주문 날짜와 시간 디버깅 (원본과 보정된 시간 비교)
        console.log(`주문 ID ${order.id}: 원본 시간 ${new Date(order.createdAt).toISOString()}, 보정된 시간 ${orderDate.toISOString()}, 날짜로 변환 ${dateString}, 상태: ${order.status}`);
        
        // 주문 날짜가 각 맵에 없으면 추가
        if (!salesDataMap.has(dateString)) {
          salesDataMap.set(dateString, 0);
        }
        if (!pendingByDate.has(dateString)) {
          pendingByDate.set(dateString, 0);
        }
        if (!paidByDate.has(dateString)) {
          paidByDate.set(dateString, 0);
        }
        
        // 가격 계산
        const price = parseFloat(order.price.replace(/[^0-9.-]+/g, ""));
        if (isNaN(price)) return;
        
        // 주문 상태를 소문자로 통일
        const orderStatus = order.status ? order.status.toLowerCase() : '';
        
        // 주문 상태별로 처리
        if (orderStatus === 'created') {
          // 미결제 주문은 pendingByDate에만 추가
          pendingByDate.set(dateString, pendingByDate.get(dateString) + price);
          console.log(`미결제 주문(created): ID ${order.id}, 날짜 ${dateString}, 금액 ${price}`);
        } 
        else if (orderStatus.includes('cancel') || 
                orderStatus === 'refunded' || 
                orderStatus === 'cancelled' || 
                orderStatus === '취소됨' ||
                orderStatus === '주문 취소') {
          // 취소된 주문은 총매출에 포함하지 않음
          console.log(`취소 주문: ID ${order.id}, 날짜 ${dateString}, 금액 ${price}`);
        }
        else if (orderStatus === 'paid' || orderStatus === 'preparing' || orderStatus === 'complete') {
          // paid, preparing, complete 상태만 유효한 매출로 처리
          paidByDate.set(dateString, paidByDate.get(dateString) + price);
          salesDataMap.set(dateString, salesDataMap.get(dateString) + price);
          console.log(`정상 결제 주문: ID ${order.id}, 날짜 ${dateString}, 금액 ${price}, 상태: ${orderStatus}`);
        }
      });
        
        console.log(`${timeRange} 기간 일별 매출 계산: ${salesDataMap.size}일치 데이터`);
      }
      
      // 취소된 주문 정보를 날짜별로 집계
      const canceledByDate = new Map();
      
      // 취소 주문의 날짜별 합계 계산
      cancelledOrders.forEach(order => {
        const orderDate = correctTimezone(new Date(order.createdAt));
        const dateString = orderDate.toISOString().split('T')[0];
        
        if (!canceledByDate.has(dateString)) {
          canceledByDate.set(dateString, 0);
        }
        
        const price = parseFloat(order.price.replace(/[^0-9.-]+/g, ""));
        if (!isNaN(price)) {
          canceledByDate.set(dateString, canceledByDate.get(dateString) + price);
        }
      });
      
      // 제품별 매출 데이터 계산 - 유효한 주문만 사용
      // 유효한 주문만 필터링 (paid, preparing, complete 상태)
      const validOrdersForProducts = filteredOrders.filter(order => {
        const status = order.status?.toLowerCase() || '';
        return status === 'paid' || status === 'preparing' || status === 'complete';
      });
      
      // 제품별 매출을 위한 맵 새로 생성 (유효한 주문만 사용)
      const validProductMap = new Map();
      
      for (const order of validOrdersForProducts) {
        const productId = parseInt(order.plantId, 10) || parseInt(order.productId, 10);
        if (isNaN(productId)) continue;
        
        if (!validProductMap.has(productId)) {
          validProductMap.set(productId, { sales: 0, count: 0 });
        }
        
        const entry = validProductMap.get(productId);
        const price = parseFloat(order.price.replace(/[^0-9.-]+/g, ""));
        
        if (!isNaN(price)) {
          entry.sales += price;
          entry.count += 1;
        }
      }
      
      // 기간 내 모든 날짜에 대해 초기 매출 데이터 (0원) 설정
      const dailySalesArray = [];
      for (const [date, _] of salesDataMap.entries()) {
        dailySalesArray.push({
          date,
          순매출액: 0
        });
      }
      
      // 실제 주문 데이터 (DB의 매출 데이터 기반)
      // filteredOrders에서 추출한 유효한 주문 기반 실제 데이터
      const realSales = [];
      
      // 유효한 주문을 날짜별로 처리
      filteredOrders.forEach(order => {
        // 유효한 주문 상태인지 확인 (paid, preparing, complete)
        const status = order.status?.toLowerCase() || '';
        if (status === 'paid' || status === 'preparing' || status === 'complete') {
          // 주문 날짜 추출
          const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
          
          // 가격 추출
          let price = 0;
          try {
            price = parseFloat(order.price.replace(/[^0-9.-]+/g, ""));
            if (isNaN(price)) price = 0;
          } catch (e) {
            // 가격 파싱 오류
          }
          
          // 이미 해당 날짜의 데이터가 있는지 확인
          const existingDateIndex = realSales.findIndex(item => item.date === orderDate);
          if (existingDateIndex >= 0) {
            // 기존 데이터에 누적
            realSales[existingDateIndex].순매출액 += price;
          } else {
            // 새 데이터 추가
            realSales.push({ date: orderDate, 순매출액: price });
          }
        }
      });
      
      // 실제 매출 데이터를 일별 데이터에 적용
      realSales.forEach(item => {
        // 해당 날짜의 데이터 찾기
        const existingIndex = dailySalesArray.findIndex(daily => daily.date === item.date);
        if (existingIndex >= 0) {
          // 해당 날짜 데이터 업데이트
          dailySalesArray[existingIndex].순매출액 = item.순매출액;
          console.log(`${item.date} 날짜 매출 데이터 업데이트: ${item.순매출액}원`);
        }
      });
      
      console.log(`${timeRange} 기간의 ${useMonthlyGrouping ? '월별' : '일별'} 매출 데이터: ${dailySalesArray.length}개 항목`);
      // 제품별 매출 데이터 (제품 ID별 수익) - 유효한 주문만 사용 (순매출 기준)
      const categoryMap = new Map();
      
      // 이미 앞에서 계산한 validProductMap 사용 (유효한 주문만 포함)
      console.log("순매출 기준 제품별 매출 데이터 사용 (유효한 주문만):");
      
      // validProductMap이 비어있지 않으면 이를 사용, 비어있으면 빈 데이터 표시
      if (validProductMap && validProductMap.size > 0) {
        console.log(`유효한 주문에서 찾은 제품 ID: ${[...validProductMap.keys()].join(', ')}`);
        // 이제 categoryMap 대신 validProductMap 사용
        // 그대로 두고 아래 코드에서 새 맵 참조하도록 수정
      } else {
        console.log("유효한 주문에서 제품 정보를 찾을 수 없습니다.");
      }
      
      // 입찰된 실제 상품 정보 맵핑 (식물 ID -> 입찰 상품명)
      const bidProductMap = new Map();
      
      // 대화 ID를 통해 입찰 정보 조회
      try {
        // 모든 대화 메시지 조회
        const allMessages = await storage.getAllMessages();
        
        // 입찰 상품 정보 필터링 (벤더가 보낸 메시지 중 bidInfo가 있는 메시지)
        const bidMessages = allMessages.filter(msg => 
          msg.role === 'vendor' && 
          msg.bidInfo && 
          msg.productInfo
        );
        
        console.log(`입찰 정보가 있는 메시지 ${bidMessages.length}개 찾음`);
        
        // 입찰 상품 정보 맵 구성
        bidMessages.forEach(msg => {
          if (msg.productInfo && msg.productInfo.id) {
            const plantId = msg.productInfo.id;
            const bidProductName = msg.productInfo.name || '입찰 식물';
            bidProductMap.set(plantId, bidProductName);
            console.log(`식물 ID ${plantId} -> 입찰 상품명: ${bidProductName}`);
          }
        });
      } catch (err) {
        console.error("입찰 정보 조회 실패:", err);
      }
      filteredOrders.forEach(order => {
        console.log(`주문 ID ${order.id}: productId=${order.productId || '없음'}, plantId=${order.plantId || '없음'}`);
      });
      
      // 먼저 기본 제품 정보 설정
      const defaultProductNames = {
        6: "몬스테라 델리시오사",
        12: "산세베리아",
        5: "아레카 야자",
        7: "필로덴드론",
        8: "피토니아",
        9: "칼라디움",
        10: "스투키",
        11: "행운목"
      };
      
      // 제품 ID와 이름 맵 생성
      const productNameMap = new Map();
      
      // 기본 제품명 추가
      for (const [id, name] of Object.entries(defaultProductNames)) {
        productNameMap.set(Number(id), name);
      }
      
      // 식물 데이터 조회 시도
      try {
        const allPlants = await storage.getAllPlants();
        console.log(`식물 데이터 ${allPlants.length}개 로드됨`);
        
        // 식물 정보 맵에 추가
        allPlants.forEach(plant => {
          if (plant && plant.id && plant.name) {
            productNameMap.set(plant.id, plant.name);
          }
        });
        
        // 모든 제품 데이터도 조회
        try {
          const allProducts = await storage.getAllProducts();
          console.log(`제품 데이터 ${allProducts?.length || 0}개 로드됨`);
          
          // 제품 정보 맵에 추가 (이름이 있는 경우만)
          if (allProducts && allProducts.length > 0) {
            allProducts.forEach(product => {
              if (product && product.id && product.name) {
                productNameMap.set(product.id, product.name);
              }
            });
          }
        } catch (err) {
          console.error("제품 데이터 조회 실패:", err);
        }
      } catch (err) {
        console.error("식물 데이터 조회 실패:", err);
      }
      
      console.log("제품 이름 매핑 결과:");
      console.log([...productNameMap.entries()].map(([id, name]) => `${id}: ${name}`).join(', '));
      
      // 유효한 주문만 사용하여 카테고리 데이터 계산
      for (const order of validOrdersForProducts) {
        // 제품 ID 확인 (주문 객체에 productId가 있는지 확인, 없으면 plantId 사용)
        const productId = order.productId || order.plantId || null;
        
        // 제품 ID가 없는 경우 건너뛰기
        if (!productId) {
          console.log(`주문 ID ${order.id}에 제품 ID 정보가 없어 건너뜁니다.`);
          continue;
        }
        
        // 제품명 확인 - 먼저 입찰된 식물명 확인, 없으면 일반 제품명 사용
        let productName;
        
        // 1. 입찰 상품 정보 맵에서 확인 (판매자가 입찰한 실제 식물명 우선 사용)
        if (bidProductMap.has(Number(productId))) {
          productName = bidProductMap.get(Number(productId));
          console.log(`주문 ID ${order.id}: 입찰 상품명 ${productName} 사용`);
        } 
        // 2. 일반 제품명 확인
        else {
          productName = productNameMap.get(Number(productId)) || `제품 ${productId}`;
        }
        
        // 가격 파싱 및 검증
        const price = parseFloat(order.price.replace(/[^0-9.-]+/g, ""));
        if (isNaN(price)) continue;
        
        // 제품명으로 매출 데이터 집계
        if (!categoryMap.has(productName)) {
          categoryMap.set(productName, { sales: 0, count: 0, id: productId });
        }
        
        const existing = categoryMap.get(productName);
        categoryMap.set(productName, { 
          sales: existing.sales + price,
          count: existing.count + 1,
          id: productId
        });
      }
      
      // 로그로 확인
      console.log(`제품별 매출 데이터: ${categoryMap.size}개 제품 (${timeRange} 기간 필터 적용)`);
      
      // 식물 이름으로 카테고리 매핑
      const categories = [];
      const plants = await storage.getAllPlants();
      
      const plantMap = new Map();
      if (plants) {
        plants.forEach(plant => {
          plantMap.set(plant.id, plant);
        });
      }
      
      // 실제 제품 데이터 불러오기
      const productInfoMap = new Map();
      try {
        // 모든 식물 정보 가져오기 (storage 인터페이스 사용)
        const plantsData = await storage.getAllPlants();
        
        // 제품 정보 로그
        console.log(`식물 정보 ${plantsData.length}개 로드됨`);
        
        // 제품 ID를 키로 하는 맵 생성
        for (const plant of plantsData) {
          productInfoMap.set(plant.id, {
            id: plant.id,
            name: plant.name || `식물 ID: ${plant.id}`
          });
        }
        
        // 추가적으로 products 테이블에서도 정보 가져오기 (맵 병합)
        const productsData = await storage.getAllProducts();
        if (productsData && productsData.length > 0) {
          console.log(`제품 정보 ${productsData.length}개 추가 로드됨`);
          
          for (const product of productsData) {
            productInfoMap.set(product.id, {
              id: product.id,
              name: product.name || product.productName || `제품 ID: ${product.id}`
            });
          }
        }
      } catch (error) {
        console.error("제품 정보 조회 실패:", error);
        // 기본 제품 데이터 매핑으로 폴백
        const productNames = {
          375: '몬스테라 델리시오사',
          376: '산세베리아',
          377: '아레카 야자',
          378: '알로카시아',
          379: '필로덴드론',
          380: '피토니아',
          381: '칼라디움',
          382: '스투키',
          383: '행운목',
          384: '하월시아'
        };
        
        // 기본 맵 생성
        for (const [id, name] of Object.entries(productNames)) {
          productInfoMap.set(Number(id), { id: Number(id), name });
        }
      }
      
      // 제품 데이터 통합 (이미 제품명으로 매핑되어 있음)
      Array.from(categoryMap.entries()).forEach(([productName, data]) => {
        // 직접 제품명으로 표시하기 위해 ID 번호 대신 실제 이름 형식으로 변경
        let displayName;
        
        // 입찰 상품 맵에서 이름 찾기 (실제 입찰된 식물명 우선 사용)
        if (bidProductMap && bidProductMap.has(data.id)) {
          displayName = bidProductMap.get(data.id);
          console.log(`제품 ID ${data.id}에 실제 입찰 상품명 적용: ${displayName}`);
        }
        // 없으면 기본 매핑 사용
        else if (data.id === 12) {
          displayName = "산세베리아";
        } else if (data.id === 6) {
          displayName = "몬스테라 델리시오사"; 
        } else {
          displayName = productName;
        }
        
        categories.push({
          id: data.id,
          name: displayName, // 실제 식물 이름으로 교체
          sales: data.sales,
          count: data.count,
          isBidProduct: bidProductMap && bidProductMap.has(data.id) // 입찰 상품 여부 표시
        });
      });
      
      // 모든 카테고리 데이터 정렬
      categories.sort((a, b) => b.sales - a.sales);
      
      // 판매자별 매출 데이터 계산 - 결제 완료된 주문만 포함 (순매출 기준)
      const vendorMap = new Map();
      
      // 유효한 주문만 필터링 (paid, preparing, complete 상태)
      const validOrdersForVendors = filteredOrders.filter(order => {
        const status = order.status?.toLowerCase() || '';
        return status === 'paid' || status === 'preparing' || status === 'complete';
      });
      
      console.log(`판매자별 매출 계산: 유효한 주문만 ${validOrdersForVendors.length}개 사용`);
      
      // 유효한 주문만으로 판매자별 매출 계산
      for (const order of validOrdersForVendors) {
        const vendorId = order.vendorId;
        const price = parseFloat(order.price.replace(/[^0-9.-]+/g, ""));
        
        if (isNaN(price)) continue;
        
        if (!vendorMap.has(vendorId)) {
          vendorMap.set(vendorId, { sales: 0, count: 0 });
        }
        
        const existing = vendorMap.get(vendorId);
        vendorMap.set(vendorId, { 
          sales: existing.sales + price,
          count: existing.count + 1
        });
      }
      
      console.log(`판매자별 매출 데이터: ${vendorMap.size}명의 판매자 (${timeRange} 기간 필터 적용)`);
      
      // 중복 제거됨 - 첫 번째 부분에서 이미 처리됨
      
      // 실제 성장률 계산 (이전 기간과 비교)
      let salesGrowth = 0;
      let orderGrowth = 0;
      
      if (prevPeriodNetSales > 0) {
        // 매출 성장률 계산 - 순매출 기준으로 ((현재 순매출 - 이전 순매출) / 이전 순매출 * 100)
        salesGrowth = ((netSales - prevPeriodNetSales) / prevPeriodNetSales * 100).toFixed(1);
      }
      
      if (prevPeriodOrders.length > 0) {
        // 주문 성장률 계산
        orderGrowth = ((filteredOrders.length - prevPeriodOrders.length) / prevPeriodOrders.length * 100).toFixed(1);
      }
      
      console.log(`성장률 계산: 순매출 ${salesGrowth}%, 주문 ${orderGrowth}% (이전 기간 대비)`); 
      
      // 응답 데이터 준비 (미결제 주문 정보 추가)
      const salesData = {
        totalSales: totalSales,
        canceledSales: canceledSales,
        canceledCount: canceledCount, // 취소 건수 추가
        netSales: netSales,
        pendingOrders: pendingOrders, // 미결제(created) 상태 주문 개수
        pendingAmount: pendingAmount, // 미결제 주문 예상 금액
        salesGrowth: salesGrowth,
        totalOrders: filteredOrders.length,
        orderGrowth: orderGrowth,
        dailySales: dailySalesArray || [],
        dataFormat: useMonthlyGrouping ? 'monthly' : 'daily', // 데이터 형식 정보 추가
        categories: categories,
        vendorSales: vendorSales,
        timeRange: timeRange // 선택된 기간 정보 포함
      };
      
      res.json(salesData);
    } catch (error) {
      console.error("관리자 매출 데이터 조회 오류:", error);
      res.status(500).json({ error: "매출 데이터를 불러오는 중 오류가 발생했습니다" });
    }
  });



  app.get("/api/admin/vendors", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      const vendors = await storage.getAllVendors();
      res.json(vendors);
    } catch (error) {
      console.error("관리자 판매자 목록 조회 오류:", error);
      res.status(500).json({ error: "판매자 목록을 불러오는 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/admin/payments", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      const payments = await storage.getAllPayments();
      res.json(payments);
    } catch (error) {
      console.error("관리자 결제 내역 조회 오류:", error);
      res.status(500).json({ error: "결제 내역을 불러오는 중 오류가 발생했습니다" });
    }
  });

  // 외부 식물 API 연동 라우트들
  console.log('🚀 서버 시작: air-purifying-new-64 라우트 등록됨');
  
  app.get("/api/admin/external-plants/air-purifying-new-64", async (req, res) => {
    console.log('🔥🔥🔥 공기정화식물 엔드포인트 호출됨! 요청 URL:', req.url);
    console.log('🔥🔥🔥 요청 경로:', req.path);
    console.log('🔥🔥🔥 요청 메소드:', req.method);
    
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      // 🌿 페이지네이션 방식으로 64개 전체 데이터 가져오기
      const serviceKey = 'sfXt/eIO7IfeUJBq8oyIDALUeUSwfEuI22l5L34J24QZ+7HUxNnMYDSUNh1RaNDYnYQ3WarXO57FCZ/gim+e3Q==';
      const searchWord = '';
      const searchType = '1';
      const timestamp = Date.now();
      
      console.log('🌿 7페이지 방식으로 공기정화식물 64개 전체 수집 시작!');
      
      // 7번의 API 호출 URL 생성 (10개씩)
      const apiCalls = [];
      for (let page = 1; page <= 7; page++) {
        const url = `http://apis.data.go.kr/1390804/NihhsFuriAirInfo/selectPuriAirPlantList?serviceKey=${encodeURIComponent(serviceKey)}&numOfRows=10&pageNo=${page}&searchWord=${encodeURIComponent(searchWord)}&searchType=${searchType}&pageIndex=${page}&pageUnit=10&_t=${timestamp + page}`;
        apiCalls.push(fetch(url));
        console.log(`🌿 ${page}번째 API 호출 (${(page-1)*10+1}-${page*10}개):`, url);
      }
      
      // 병렬로 7번 API 호출
      console.log('🌿 병렬로 7개 API 요청 시작...');
      const responses = await Promise.all(apiCalls);
      const xmlDatas = await Promise.all(responses.map(response => response.text()));
      
      console.log('🌿 모든 응답 받음, 길이들:', xmlDatas.map(xml => xml.length));
      
      // 정규식으로 <result> 태그들 추출
      const resultRegex = /<result>.*?<\/result>/gs;
      let allResults = [];
      
      xmlDatas.forEach((xmlData, index) => {
        const results = xmlData.match(resultRegex) || [];
        console.log(`🌿 ${index + 1}번째 응답에서 파싱된 결과: ${results.length}개`);
        allResults = allResults.concat(results);
      });
      
      console.log('🌿 총 수집된 식물 데이터:', allResults.length, '개');
      
      // 합친 XML 생성
      let combinedXml = `<?xml version="1.0" encoding="utf-8"?>
<document><root><resultCode>1</resultCode><resultMsg>접속성공</resultMsg><resultCnt>${allResults.length}</resultCnt><pageIndex>1</pageIndex><repcategory>공기정화식물 LIST</repcategory>`;
      
      // 모든 result들 추가
      combinedXml += allResults.join('');
      
      combinedXml += '</root></document>';
      
      console.log('🌿 합친 XML 총 길이:', combinedXml.length);
      console.log('🌿 총 식물 데이터 개수:', allResults.length);
      console.log('🌿 합친 XML 미리보기:', combinedXml.substring(0, 500));
      
      // 🔍 첫 번째 식물 데이터 확인 (파싱 없이)
      if (allResults.length > 0) {
        console.log('🔍 첫 번째 식물 데이터 전체 XML:');
        console.log(allResults[0]);
      }
      
      res.setHeader('Content-Type', 'text/xml');
      return res.send(combinedXml);
    } catch (error) {
      console.error("공기정화식물 API 호출 오류:", error);
      res.status(500).json({ error: "공기정화식물 데이터를 불러오는 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/admin/external-plants/dry-garden", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      const { numOfRows = 200, pageNo = 1, sText = '' } = req.query;
      const apiKey = '20250523EF3EYIILMJHFEHWCN1CHA';
      
      const url = `http://api.nongsaro.go.kr/service/dryGarden/dryGardenList?apiKey=${apiKey}&numOfRows=${numOfRows}&pageNo=${pageNo}&sText=${encodeURIComponent(sText as string)}`;
      
      const response = await fetch(url);
      const data = await response.text();
      
      res.setHeader('Content-Type', 'application/xml');
      res.send(data);
    } catch (error) {
      console.error("건조에 강한 실내식물 API 호출 오류:", error);
      res.status(500).json({ error: "건조에 강한 실내식물 데이터를 불러오는 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/admin/external-plants/indoor-garden", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      const { numOfRows = 300, pageNo = 1, sText = '' } = req.query;
      const apiKey = '20250523EF3EYIILMJHFEHWCN1CHA';
      
      const url = `http://api.nongsaro.go.kr/service/garden/gardenList?apiKey=${apiKey}&numOfRows=${numOfRows}&pageNo=${pageNo}&sText=${encodeURIComponent(sText as string)}`;
      
      const response = await fetch(url);
      const data = await response.text();
      
      res.setHeader('Content-Type', 'application/xml');
      res.send(data);
    } catch (error) {
      console.error("실내정원용 식물 API 호출 오류:", error);
      res.status(500).json({ error: "실내정원용 식물 데이터를 불러오는 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/admin/site-settings", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      // 데이터베이스에서 사이트 설정 가져오기
      const settings = await storage.getSiteSettings();
      res.json(settings || {
        siteTitle: "PlantBid",
        siteDescription: "AI 기반 식물 추천 및 온라인 경매 플랫폼",
        homePage: null
      });
    } catch (error) {
      console.error("관리자 사이트 설정 조회 오류:", error);
      res.status(500).json({ error: "사이트 설정을 불러오는 중 오류가 발생했습니다" });
    }
  });

  app.put("/api/admin/site-settings", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      console.log("사이트 설정 저장 요청:", JSON.stringify(req.body, null, 2));
      
      const { homePage } = req.body;
      
      if (!homePage) {
        return res.status(400).json({ error: "홈페이지 설정 데이터가 필요합니다" });
      }
      
      // homePage 데이터를 JSON 문자열로 변환 (이미 객체인 경우)
      let homePageJson;
      try {
        homePageJson = typeof homePage === 'object' ? JSON.stringify(homePage) : homePage;
        console.log("변환된 JSON:", homePageJson);
      } catch (jsonError) {
        console.error("JSON 변환 오류:", jsonError);
        return res.status(400).json({ error: "잘못된 JSON 형식입니다" });
      }
      
      // 사이트 설정 업데이트
      await storage.updateSiteSettings({
        homePage: homePageJson
      });
      
      console.log("사이트 설정 저장 완료");
      res.json({ message: "사이트 설정이 저장되었습니다" });
    } catch (error) {
      console.error("관리자 사이트 설정 저장 오류:", error);
      res.status(500).json({ error: "사이트 설정 저장 중 오류가 발생했습니다" });
    }
  });

  // 공개 사이트 설정 조회 API (비로그인 사용자도 접근 가능)
  app.get("/api/site-settings", async (req, res) => {
    console.log("🔍 공개 API 호출됨 - /api/site-settings");
    try {
      const settings = await storage.getSiteSettings();
      console.log("🔍 공개 API - 사이트 설정 조회:", JSON.stringify(settings, null, 2));
      
      const response = settings || {
        siteTitle: "PlantBid",
        siteDescription: "AI 기반 식물 추천 및 온라인 경매 플랫폼",
        homePage: null
      };
      
      console.log("🔍 공개 API - 응답 데이터:", JSON.stringify(response, null, 2));
      res.json(response);
    } catch (error) {
      console.error("사이트 설정 조회 오류:", error);
      res.status(500).json({ error: "사이트 설정을 불러오는 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/admin/ai-settings", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    // 캐시 방지 헤더 추가
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    try {
      console.log('🚀 AI 설정 조회 시도 - 현재 시간:', new Date().toISOString());
      const settings = await storage.getAISettings();
      console.log('✅ AI 설정 조회 완료:', JSON.stringify(settings, null, 2));
      
      if (settings) {
        console.log('📊 데이터베이스에서 실제 설정 반환');
        res.json(settings);
      } else {
        console.log('⚠️ 데이터베이스에 설정이 없어서 기본값 반환');
        // 실제 데이터베이스에서 가져온 기본 설정 반환
        const defaultSettings = {
          temperature: 0.7,
          maxOutputTokens: 2048,
          topK: 40,
          topP: 0.95,
          enableTracing: false,
          systemPrompt: '당신은 전문적인 식물 상담사 "PlantBid AI"입니다. 사용자의 질문에 친절하고 정확하게 답변해주세요. 식물 관리, 추천, 문제 해결에 대한 전문적인 조언을 제공하며, 항상 도움이 되는 톤을 유지해주세요.',
          plantRecommendationPrompt: '사용자의 환경 조건(빛, 습도, 공간, 경험 수준 등)을 고려하여 최적의 식물을 추천해주세요. 각 식물의 특성, 관리 방법, 주의사항을 자세히 설명하고, 사용자가 성공적으로 키울 수 있도록 구체적인 가이드를 제공해주세요.',
          vendorCommunicationPrompt: '업체와의 소통에서는 전문적이고 정중한 톤을 유지해주세요. 고객의 요구사항을 정확히 전달하고, 업체의 응답을 이해하기 쉽게 요약해서 고객에게 전달해주세요. 가격 협상이나 배송 일정 조율 시에는 양쪽 모두에게 공정한 중재자 역할을 해주세요.'
        };
        res.json(defaultSettings);
      }
    } catch (error) {
      console.error("❌ AI 설정 조회 오류:", error);
      res.status(500).json({ error: "AI 설정을 불러오는 중 오류가 발생했습니다" });
    }
  });

  app.put("/api/admin/ai-settings", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      console.log('AI 설정 업데이트 요청:', req.body);
      const updatedSettings = await storage.updateAISettings(req.body);
      console.log('AI 설정 업데이트 완료:', updatedSettings);
      
      res.json(updatedSettings);
    } catch (error) {
      console.error("AI 설정 업데이트 오류:", error);
      res.status(500).json({ error: "AI 설정 업데이트 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/admin/ai-templates", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      // AI 템플릿 데이터 응답
      res.json([
        {
          id: 1,
          name: "식물 추천",
          prompt: "고객이 원하는 환경과 경험 수준에 맞는 식물을 추천해 주세요."
        },
        {
          id: 2,
          name: "문제 진단",
          prompt: "고객이 식물에 생긴 문제를 사진과 함께 설명할 때, 가능한 원인과 해결책을 제시해 주세요."
        },
        {
          id: 3, 
          name: "관리 가이드",
          prompt: "고객이 언급한 식물의 물주기, 빛 요구사항, 영양분 등 기본 관리 방법을 안내해 주세요."
        }
      ]);
    } catch (error) {
      console.error("관리자 AI 템플릿 조회 오류:", error);
      res.status(500).json({ error: "AI 템플릿을 불러오는 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/admin/commissions", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      // 수수료 설정 데이터 응답
      res.json({
        defaultRate: 10, // 기본 수수료율 (%)
        vendorRates: [
          { vendorId: 3, rate: 8, name: "ralphparkvendor" },
          { vendorId: 4, rate: 9, name: "ralphparkvendor2" },
          { vendorId: 7, rate: 7, name: "smartgarden" }
        ]
      });
    } catch (error) {
      console.error("관리자 수수료 설정 조회 오류:", error);
      res.status(500).json({ error: "수수료 설정을 불러오는 중 오류가 발생했습니다" });
    }
  });

  app.get("/api/admin/settlements", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      // 정산 내역 데이터 응답
      res.json([
        {
          id: 1,
          vendorId: 3,
          vendorName: "ralphparkvendor",
          amount: 450000,
          commission: 36000,
          netAmount: 414000,
          status: "completed",
          date: "2023-04-15"
        },
        {
          id: 2,
          vendorId: 4,
          vendorName: "ralphparkvendor2",
          amount: 320000,
          commission: 28800,
          netAmount: 291200,
          status: "pending",
          date: "2023-04-30"
        },
        {
          id: 3,
          vendorId: 7,
          vendorName: "smartgarden",
          amount: 520000,
          commission: 36400,
          netAmount: 483600,
          status: "processing",
          date: "2023-05-05"
        }
      ]);
    } catch (error) {
      console.error("관리자 정산 내역 조회 오류:", error);
      res.status(500).json({ error: "정산 내역을 불러오는 중 오류가 발생했습니다" });
    }
  });

  // 수수료 관리 API 엔드포인트들
  
  // 결제 완료된 주문 목록 조회
  app.get("/api/admin/completed-orders", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      console.log("결제 완료 주문 조회 시작 (매출 통계 로직 사용)");
      
      // 매출 통계와 동일한 주문 조회 로직 사용
      const allOrders = await storage.getAllOrders();
      console.log(`모든 주문 정보 조회 완료: ${allOrders.length}개`);
      
      // 결제 완료된 주문만 필터링 (매출 통계와 동일한 조건)
      const completedOrders = allOrders.filter(order => {
        const status = order.status?.toLowerCase() || '';
        return status === 'paid' || status === 'preparing' || status === 'complete' || status === 'delivered';
      });
      
      console.log(`결제 완료 주문 ${completedOrders.length}건 필터링됨`);
      
      // 판매자 정보 조회
      const vendors = await storage.getAllVendors();
      const vendorMap = new Map();
      vendors.forEach(vendor => {
        vendorMap.set(vendor.id, vendor);
      });
      
      // 결제 완료 주문에 추가 정보 포함
      const ordersWithVendorInfo = completedOrders.map(order => {
        const vendor = vendorMap.get(order.vendorId);
        const amount = parseFloat(order.price.replace(/[^0-9.-]+/g, "")) || 0;
        
        return {
          id: order.id,
          orderId: order.orderId || `order_${order.id}`,
          amount: amount,
          vendorId: order.vendorId,
          vendorName: vendor ? vendor.name : '알 수 없는 판매자',
          vendorStoreName: vendor ? vendor.storeName : '알 수 없는 상점',
          status: order.status,
          createdAt: order.createdAt,
          taxInvoiceIssued: false, // 기본값
          transferCompleted: false, // 기본값
        };
      });
      
      console.log(`결제 완료 주문 목록 반환: ${ordersWithVendorInfo.length}건`);
      res.json(ordersWithVendorInfo);
    } catch (error) {
      console.error("결제 완료 주문 조회 오류:", error);
      res.status(500).json({ error: "결제 완료 주문을 불러오는 중 오류가 발생했습니다" });
    }
  });

  // 수수료율 업데이트
  app.put("/api/admin/commission-rate", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      const { rate } = req.body;
      if (typeof rate !== 'number' || rate < 0 || rate > 100) {
        return res.status(400).json({ error: "유효하지 않은 수수료율입니다" });
      }
      
      await storage.updateCommissionRate(rate);
      res.json({ success: true, rate });
    } catch (error) {
      console.error("수수료율 업데이트 오류:", error);
      res.status(500).json({ error: "수수료율 업데이트 중 오류가 발생했습니다" });
    }
  });

  // 세금계산서 발행
  app.post("/api/admin/issue-tax-invoice/:orderId", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      const { orderId } = req.params;
      
      // 여기에 실제 세금계산서 발행 API 연동 로직 추가
      // 현재는 데이터베이스 상태만 업데이트
      await storage.markTaxInvoiceIssued(orderId);
      
      res.json({ success: true, message: "세금계산서가 발행되었습니다" });
    } catch (error) {
      console.error("세금계산서 발행 오류:", error);
      res.status(500).json({ error: "세금계산서 발행 중 오류가 발생했습니다" });
    }
  });

  // 송금 처리
  app.post("/api/admin/process-transfer/:orderId", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      const { orderId } = req.params;
      
      // 여기에 실제 은행 송금 API 연동 로직 추가
      // 현재는 데이터베이스 상태만 업데이트
      await storage.markTransferCompleted(orderId);
      
      res.json({ success: true, message: "송금이 완료되었습니다" });
    } catch (error) {
      console.error("송금 처리 오류:", error);
      res.status(500).json({ error: "송금 처리 중 오류가 발생했습니다" });
    }
  });

  // 일괄 세금계산서 발행
  app.post("/api/admin/bulk-issue-tax-invoice", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      const { orderIds } = req.body;
      
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ error: "주문 ID 목록이 필요합니다" });
      }
      
      // 여기에 실제 일괄 세금계산서 발행 API 연동 로직 추가
      // 현재는 데이터베이스 상태만 업데이트
      await storage.bulkMarkTaxInvoiceIssued(orderIds);
      
      res.json({ success: true, message: `${orderIds.length}건의 세금계산서가 발행되었습니다` });
    } catch (error) {
      console.error("일괄 세금계산서 발행 오류:", error);
      res.status(500).json({ error: "일괄 세금계산서 발행 중 오류가 발생했습니다" });
    }
  });

  // 일괄 송금 처리
  app.post("/api/admin/bulk-process-transfer", async (req, res) => {
    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }
    
    try {
      const { orderIds } = req.body;
      
      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return res.status(400).json({ error: "주문 ID 목록이 필요합니다" });
      }
      
      // 여기에 실제 일괄 송금 API 연동 로직 추가
      // 현재는 데이터베이스 상태만 업데이트
      await storage.bulkMarkTransferCompleted(orderIds);
      
      res.json({ success: true, message: `${orderIds.length}건의 송금이 완료되었습니다` });
    } catch (error) {
      console.error("일괄 송금 처리 오류:", error);
      res.status(500).json({ error: "일괄 송금 처리 중 오류가 발생했습니다" });
    }
  });

  // multer 설정 - 메모리 저장소 사용
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB 제한
  });

  // 엑셀 업로드 API 엔드포인트
  app.post("/api/admin/plants/upload-excel", upload.single('file'), async (req, res) => {
    console.log('🚀 === 엑셀 업로드 API 진입 ===');
    console.log('🔍 엑셀 업로드 요청 수신됨');
    console.log('사용자 인증 상태:', req.isAuthenticated());
    console.log('사용자 역할:', req.user?.role);
    console.log('파일 정보:', req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : '파일 없음');
    console.log('업로드된 파일:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : '없음');

    if (!req.isAuthenticated() || req.user?.role !== 'admin') {
      console.log('❌ 권한 없음 - 관리자 권한 필요');
      return res.status(403).json({ error: "관리자 권한이 필요합니다" });
    }

    if (!req.file) {
      console.log('❌ 파일 없음');
      return res.status(400).json({ error: "파일이 업로드되지 않았습니다" });
    }

    try {
      console.log('📊 엑셀 파일 처리 시작...');
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log(`📋 파싱된 데이터 총 ${jsonData.length}개 행`);
      
      if (jsonData.length > 0) {
        const firstRow = jsonData[0] as Record<string, any>;
        const keys = Object.keys(firstRow);
        console.log('🔍 실제 엑셀 컬럼명들:', keys);
        console.log('📋 첫 번째 행 데이터:', JSON.stringify(firstRow, null, 2));
        
        // 컬럼명과 값 매핑 상세 분석
        console.log('🎯 컬럼별 데이터 분석:');
        keys.forEach(key => {
          console.log(`  - "${key}": "${firstRow[key]}"`);
        });
      }
      
      if (jsonData.length > 1) {
        console.log('📋 두 번째 행 데이터:', JSON.stringify(jsonData[1], null, 2));
      }

      let successCount = 0;
      let updateCount = 0;
      let newCount = 0;
      const errors = [];

      // 한 번만 기존 식물 목록을 가져와서 Map으로 저장 (성능 최적화)
      console.log('📋 기존 식물 목록 로딩 중...');
      const existingPlants = await storage.getAllPlants();
      const plantMap = new Map();
      existingPlants.forEach(plant => {
        plantMap.set(plant.name.toLowerCase(), plant);
      });
      console.log(`📋 기존 식물 ${existingPlants.length}개 로딩 완료`);

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i] as any;
        
        // 강력한 디버깅 시스템 (첫 3개 행)
        if (i < 3) {
          console.log(`🚀 === 행 ${i + 1} 상세 분석 시작 ===`);
          console.log(`🔍 행 ${i + 1} 모든 키들:`, Object.keys(row));
          console.log(`🔍 행 ${i + 1} 모든 키-값:`, Object.entries(row));
          console.log(`🔍 행 ${i + 1} 값이 있는 필드:`, Object.entries(row).filter(([k, v]) => v && v !== ''));
          console.log(`🚀 === 행 ${i + 1} 분석 완료 ===`);
        }
        
        // 강화된 스마트 필드 매핑 시스템
        const getFieldValue = (fieldNames: string[]): string => {
          for (const name of fieldNames) {
            const value = row[name];
            if (value !== undefined && value !== null && value !== '') {
              if (i < 3) console.log(`    ✅ "${name}" -> "${value}"`);
              return String(value);
            }
          }
          if (i < 3) console.log(`    ❌ [${fieldNames.join(', ')}] - 값 없음`);
          return '';
        };

        if (i < 3) {
          console.log(`🎯 행 ${i + 1} 처리 시작 - 이름: ${row.name || row['식물 이름'] || '미확인'}`);
          console.log(`🎯 행 ${i + 1} 모든 키:`, Object.keys(row));
        }

        try {
          const plantData = {
            name: getFieldValue(['name', '이름', '식물명', '식물 이름', '식물이름', 'Name', '품종명', '품종']),
            imageUrl: getFieldValue(['imageUrl', 'image_url', '이미지URL', '이미지 URL', 'Image URL', '이미지', '사진', 'image', 'photo']),
            scientificName: getFieldValue(['scientificName', 'scientific_name', '학명', 'Scientific Name', '라틴명', 'latin_name']),
            description: getFieldValue(['description', '설명', '상세설명', 'Description', '특징', '개요', '소개', '내용', '관찰정보', '정보']),
            waterNeeds: getFieldValue(['waterNeeds', 'water_needs', '물주기', 'Water Needs', '급수', '관수', '물', '물관리', '수분공급', '관수주기']),
            light: getFieldValue(['light', '광조건', '조도', 'Light', '빛', '광량', '일조량', '조명', '광도', '햇빛']),
            humidity: getFieldValue(['humidity', '습도', 'Humidity', '수분', '습기']),
            temperature: getFieldValue(['temperature', '온도', 'Temperature', '기온', '적정온도']),
            winterTemperature: getFieldValue(['winterTemperature', 'winter_temperature', '겨울온도', 'Winter Temperature', '월동온도', '저온한계']),
            colorFeature: getFieldValue(['colorFeature', 'color_feature', '색상특징', 'Color Feature', '색깔', '컬러', '색상', '잎색']),
            plantType: getFieldValue(['plantType', 'plant_type', '식물타입', 'Plant Type', '형태', '유형', '종류', '분류']),
            hasThorns: getFieldValue(['hasThorns', 'has_thorns', '가시여부', 'Has Thorns', '가시', '독성']) === 'true',
            leafShape1: getFieldValue(['leafShape1', 'leaf_shape1', '잎모양1', 'Leaf Shape 1', '잎형태1', '엽형1']),
            leafShape2: getFieldValue(['leafShape2', 'leaf_shape2', '잎모양2', 'Leaf Shape 2', '잎형태2', '엽형2']),
            leafShape3: getFieldValue(['leafShape3', 'leaf_shape3', '잎모양3', 'Leaf Shape 3', '잎형태3', '엽형3']),
            leafShape4: getFieldValue(['leafShape4', 'leaf_shape4', '잎모양4', 'Leaf Shape 4', '잎형태4', '엽형4']),
            experienceLevel: getFieldValue(['experienceLevel', 'experience_level', '경험수준', 'Experience Level', '난이도', '초보자용', '전문가용']),
            petSafety: getFieldValue(['petSafety', 'pet_safety', '반려동물안전', 'Pet Safety', '독성', '애완동물', '안전성']),
            size: getFieldValue(['size', '크기', 'Size', '사이즈', '규격', '높이', '폭']),
            difficulty: getFieldValue(['difficulty', '난이도', 'Difficulty', '관리난이도', '기르기', '재배난이도']),
            priceRange: getFieldValue(['priceRange', 'price_range', '가격대', 'Price Range', '가격', '비용', '판매가']),
            careInstructions: getFieldValue(['careInstructions', 'care_instructions', '관리방법', 'Care Instructions', '기르는법', '재배법', '관리법', '키우는법']),
            category: getFieldValue(['category', '카테고리', 'Category', '분류', '종류', '그룹'])
          };

          if (i < 3) {
            console.log(`🎯 행 ${i + 1} 최종 결과:`, {
              name: plantData.name || '없음',
              description: plantData.description ? plantData.description.substring(0, 30) + '...' : '없음',
              waterNeeds: plantData.waterNeeds || '없음',
              light: plantData.light || '없음'
            });
          }

          if (plantData.name) {
            const existingPlant = plantMap.get(plantData.name.toLowerCase());
            
            if (existingPlant) {
              // 기존 식물 업데이트
              console.log(`🔄 기존 식물 "${plantData.name}" 업데이트 중...`);
              await storage.updatePlant(existingPlant.id, plantData);
              updateCount++;
              successCount++;
              console.log(`✅ 식물 "${plantData.name}" 업데이트 완료! (업데이트: ${updateCount}개)`);
            } else {
              // 새 식물 추가
              console.log(`🆕 새 식물 "${plantData.name}" 추가 중...`);
              await storage.createPlant(plantData);
              newCount++;
              successCount++;
              console.log(`✅ 식물 "${plantData.name}" 추가 완료! (신규: ${newCount}개)`);
            }
          } else {
            console.log(`❌ 행 ${i + 2}: 식물 이름이 비어있음`);
            errors.push(`행 ${i + 2}: 식물 이름이 필요합니다`);
          }
        } catch (error: any) {
          console.log(`❌ 행 ${i + 2} 에러:`, error.message);
          errors.push(`행 ${i + 2}: ${error.message}`);
        }
      }

      console.log(`🎉 엑셀 업로드 완료! 총 처리: ${successCount}개 (신규: ${newCount}개, 업데이트: ${updateCount}개)`);
      
      res.json({
        success: true,
        count: successCount,
        newCount: newCount,
        updateCount: updateCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `총 ${successCount}개 식물 처리 완료 (신규 추가: ${newCount}개, 기존 업데이트: ${updateCount}개)`
      });
      
    } catch (error) {
      console.error('엑셀 파일 처리 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
      res.status(500).json({ 
        error: '엑셀 파일 처리 중 오류가 발생했습니다.',
        details: errorMessage
      });
    }
  });

  // 중복 식물 정리 엔드포인트 
  app.post("/api/plants/remove-duplicates", async (req, res) => {
    // JSON 응답 헤더 명시적 설정
    res.setHeader('Content-Type', 'application/json');
    
    try {
      console.log('🧹 중복 식물 정리 시작...');
      
      const allPlants = await storage.getAllPlants();
      console.log(`📊 총 ${allPlants.length}개 식물 발견`);
      
      // 이름 기준으로 그룹화
      const plantGroups = new Map();
      allPlants.forEach(plant => {
        const name = plant.name.toLowerCase().trim();
        if (!plantGroups.has(name)) {
          plantGroups.set(name, []);
        }
        plantGroups.get(name).push(plant);
      });
      
      let duplicatesRemoved = 0;
      let skippedDueToReferences = 0;
      let uniquePlants = 0;
      
      // 각 그룹에서 가장 최근 것만 남기고 나머지 삭제
      for (const [name, plants] of plantGroups) {
        if (plants.length > 1) {
          // 가장 최근 것 찾기 (ID가 가장 큰 것)
          plants.sort((a, b) => b.id - a.id);
          const keepPlant = plants[0];
          
          let groupRemoved = 0;
          
          // 나머지 삭제 (안전하게 처리)
          for (let i = 1; i < plants.length; i++) {
            try {
              await storage.deletePlant(plants[i].id);
              duplicatesRemoved++;
              groupRemoved++;
            } catch (error: any) {
              // 외래 키 제약 조건으로 인해 삭제할 수 없는 경우 건너뛰기
              if (error.code === '23503') {
                skippedDueToReferences++;
                console.log(`⚠️ "${name}" (ID: ${plants[i].id}) 건너뜀: 입찰 데이터 참조 중`);
                continue;
              }
              console.log(`❌ "${name}" (ID: ${plants[i].id}) 삭제 실패:`, error.message);
              throw error; // 다른 오류는 다시 던지기
            }
          }
          
          console.log(`🔄 "${name}": ${plants.length}개 → 삭제 ${groupRemoved}개`);
        }
        uniquePlants++;
      }
      
      console.log(`🎉 정리 완료! 고유 식물: ${uniquePlants}개, 중복 삭제: ${duplicatesRemoved}개, 건너뜀: ${skippedDueToReferences}개`);
      
      res.json({
        success: true,
        uniquePlants: uniquePlants,
        duplicatesRemoved: duplicatesRemoved,
        skippedDueToReferences: skippedDueToReferences,
        message: `중복 정리 완료: ${duplicatesRemoved}개 삭제, ${skippedDueToReferences}개 건너뜀 (입찰 데이터 참조 중), ${uniquePlants}개 고유 식물 유지`
      });
      
    } catch (error) {
      console.error('중복 정리 오류:', error);
      res.status(500).json({ 
        error: '중복 정리 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : '알 수 없는 오류'
      });
    }
  });

  // Gemini AI를 사용해서 식물 정보 채우기
  app.post("/api/plants/fill-missing-info", async (req, res) => {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        console.error("Gemini API key not found. Available keys:", Object.keys(process.env).filter(k => k.includes('GEMINI') || k.includes('GOOGLE')));
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      // Try gemini-2.0-flash first, fallback to gemini-pro
      let model;
      try {
        model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      } catch (e) {
        model = genAI.getGenerativeModel({ model: "gemini-pro" });
      }

      const allPlants = await storage.getAllPlants();
      const plantsToUpdate: Array<{ plant: typeof allPlants[0]; nullFields: string[] }> = [];

      // null인 필드가 있는 식물 찾기 - 각 식물마다 어떤 필드가 null인지 추적
      for (const plant of allPlants) {
        const nullFields: string[] = [];
        if (!plant.description) nullFields.push('description');
        if (!plant.waterNeeds) nullFields.push('waterNeeds');
        if (!plant.light) nullFields.push('light');
        if (!plant.careInstructions) nullFields.push('careInstructions');
        
        if (nullFields.length > 0) {
          plantsToUpdate.push({ plant, nullFields });
        }
      }

      console.log(`[Gemini] ${plantsToUpdate.length}개 식물 정보 업데이트 시작`);
      
      let updated = 0;
      for (const { plant, nullFields } of plantsToUpdate) {
        try {
          const prompt = `당신은 식물 전문가입니다. 다음 식물에 대해 JSON 형식으로만 한글로 정보를 제공하세요. JSON만 응답하고 다른 설명은 없어야 합니다.

식물: ${plant.name} ${plant.scientificName ? `(${plant.scientificName})` : ''}

반드시 한글로만 다음 JSON을 응답하세요 (마크다운 없음, 다른 텍스트 없음):
{
  "description": "식물의 외형과 특징 설명 (한글, 50자 이하)",
  "waterNeeds": "물주기 빈도 (예: 주 1-2회, 흙이 마를 때마다)",
  "light": "빛 조건 (예: 밝은 간접광, 반음지)",
  "careInstructions": "기본 관리법 (한글, 50자 이하)",
  "difficulty": "난이도 (쉬움/보통/어려움)",
  "petSafety": "반려동물 안전성 (안전함/독성/주의)"
}`;

          const result = await model.generateContent(prompt);
          const response = result.response;
          const content = response.text().trim();

          if (!content) {
            console.log(`⚠️ ${plant.name}: 빈 응답`);
            continue;
          }

          let info = null;
          try {
            // 먼저 전체 content를 JSON으로 파싱 시도
            info = JSON.parse(content);
          } catch (e1) {
            // 실패하면 JSON 객체만 추출
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                info = JSON.parse(jsonMatch[0]);
              } catch (e2) {
                console.log(`⚠️ ${plant.name}: JSON 파싱 실패 - ${e2 instanceof Error ? e2.message : '알 수 없는 오류'}`);
                continue;
              }
            } else {
              console.log(`⚠️ ${plant.name}: JSON 객체 찾기 실패`);
              continue;
            }
          }

          // 데이터베이스 업데이트 - null인 필드만 업데이트
          const updates: any = {};
          if (nullFields.includes('description') && info.description && info.description !== '') updates.description = info.description;
          if (nullFields.includes('waterNeeds') && info.waterNeeds && info.waterNeeds !== '') updates.waterNeeds = info.waterNeeds;
          if (nullFields.includes('light') && info.light && info.light !== '') updates.light = info.light;
          if (nullFields.includes('careInstructions') && info.careInstructions && info.careInstructions !== '') updates.careInstructions = info.careInstructions;
          if (nullFields.includes('difficulty') && info.difficulty && info.difficulty !== '') updates.difficulty = info.difficulty;
          if (nullFields.includes('petSafety') && info.petSafety && info.petSafety !== '') updates.petSafety = info.petSafety;

          if (Object.keys(updates).length > 0) {
            await db.update(plants)
              .set(updates)
              .where(eq(plants.id, plant.id));

            updated++;
            console.log(`✅ ${plant.name} 업데이트 완료 (${updated}/${plantsToUpdate.length}) - 필드: ${Object.keys(updates).join(', ')}`);
          } else {
            console.log(`⚠️ ${plant.name}: 업데이트할 유효한 데이터 없음`);
          }
        } catch (error) {
          console.log(`❌ ${plant.name}: ${error instanceof Error ? error.message : '오류 발생'}`);
        }
        
        // API 레이트 제한을 위해 약간의 딜레이
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      res.json({
        success: true,
        totalPlants: allPlants.length,
        plantsToUpdate: plantsToUpdate.length,
        updated: updated,
        message: `${updated}/${plantsToUpdate.length}개 식물 정보 업데이트 완료`
      });
    } catch (error) {
      console.error('식물 정보 업데이트 오류:', error);
      res.status(500).json({ error: '식물 정보 업데이트 중 오류 발생', details: error instanceof Error ? error.message : '알 수 없는 오류' });
    }
  });

  // 모든 영어 필드를 한글로 변환
  app.post("/api/plants/translate-all-fields", async (req, res) => {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      // 영어 감지 함수
      function isEnglishText(text: string): boolean {
        if (!text) return false;
        const koreanRegex = /[\uAC00-\uD7AF]/g;
        const koreanCount = (text.match(koreanRegex) || []).length;
        return koreanCount < text.length * 0.3;
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      let model;
      try {
        model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      } catch (e) {
        model = genAI.getGenerativeModel({ model: "gemini-pro" });
      }

      const allPlants = await storage.getAllPlants();
      const plantsToTranslate = allPlants.filter(p => 
        (p.description && isEnglishText(p.description)) ||
        (p.waterNeeds && isEnglishText(p.waterNeeds)) ||
        (p.light && isEnglishText(p.light)) ||
        (p.careInstructions && isEnglishText(p.careInstructions)) ||
        (p.difficulty && isEnglishText(p.difficulty)) ||
        (p.petSafety && isEnglishText(p.petSafety))
      );

      console.log(`[한글 변환] ${plantsToTranslate.length}개 식물 전체 필드 번역 시작`);
      
      let translated = 0;
      for (const plant of plantsToTranslate) {
        try {
          const fieldsToTranslate: string[] = [];
          if (plant.description && isEnglishText(plant.description)) fieldsToTranslate.push('description');
          if (plant.waterNeeds && isEnglishText(plant.waterNeeds)) fieldsToTranslate.push('waterNeeds');
          if (plant.light && isEnglishText(plant.light)) fieldsToTranslate.push('light');
          if (plant.careInstructions && isEnglishText(plant.careInstructions)) fieldsToTranslate.push('careInstructions');
          if (plant.difficulty && isEnglishText(plant.difficulty)) fieldsToTranslate.push('difficulty');
          if (plant.petSafety && isEnglishText(plant.petSafety)) fieldsToTranslate.push('petSafety');

          const prompt = `다음의 영어 텍스트들을 한글로 번역해주세요. 간단하고 명확하게 번역하고 JSON 형식으로만 응답하세요.

${fieldsToTranslate.map(field => {
  const value = (plant as any)[field];
  return `${field}: "${value}"`;
}).join('\n')}

반드시 한글로만 다음 JSON을 응답하세요 (다른 텍스트 없음):
{
  ${fieldsToTranslate.map(field => `"${field}": "한글로 번역된 ${field}"`).join(',\n  ')}
}`;

          const result = await model.generateContent(prompt);
          const response = result.response;
          const content = response.text().trim();

          if (!content) {
            console.log(`⚠️ ${plant.name}: 빈 응답`);
            continue;
          }

          let info = null;
          try {
            info = JSON.parse(content);
          } catch (e1) {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                info = JSON.parse(jsonMatch[0]);
              } catch (e2) {
                console.log(`⚠️ ${plant.name}: JSON 파싱 실패`);
                continue;
              }
            } else {
              console.log(`⚠️ ${plant.name}: JSON 객체 찾기 실패`);
              continue;
            }
          }

          const updates: any = {};
          for (const field of fieldsToTranslate) {
            if (info[field] && info[field] !== '') {
              updates[field] = info[field];
            }
          }

          if (Object.keys(updates).length > 0) {
            await db.update(plants)
              .set(updates)
              .where(eq(plants.id, plant.id));

            translated++;
            console.log(`✅ ${plant.name} 번역 완료 (${translated}/${plantsToTranslate.length}) - 필드: ${Object.keys(updates).join(', ')}`);
          } else {
            console.log(`⚠️ ${plant.name}: 번역할 데이터 없음`);
          }
        } catch (error) {
          console.log(`❌ ${plant.name}: ${error instanceof Error ? error.message : '오류 발생'}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      res.json({
        success: true,
        totalPlants: allPlants.length,
        plantsToTranslate: plantsToTranslate.length,
        translated: translated,
        message: `${translated}/${plantsToTranslate.length}개 식물 전체 필드 한글 변환 완료`
      });
    } catch (error) {
      console.error('전체 필드 한글 변환 오류:', error);
      res.status(500).json({ error: '전체 필드 한글 변환 중 오류 발생', details: error instanceof Error ? error.message : '알 수 없는 오류' });
    }
  });

  // 리뷰 API 엔드포인트
  // 특정 판매자의 모든 리뷰 조회
  app.get("/api/reviews/:vendorId", async (req, res) => {
    try {
      const vendorId = parseInt(req.params.vendorId);
      const vendorReviews = await storage.getReviewsForVendor(vendorId);
      
      // 리뷰 작성자 정보 추가
      const reviewsWithAuthor = await Promise.all(
        vendorReviews.map(async (review) => {
          const user = await storage.getUser(review.userId);
          return {
            ...review,
            authorName: user?.name || user?.username || "익명",
            authorImage: user?.profileImageUrl
          };
        })
      );
      
      res.json(reviewsWithAuthor);
    } catch (error) {
      console.error("리뷰 조회 오류:", error);
      res.status(500).json({ error: "리뷰를 가져오는 중 오류가 발생했습니다" });
    }
  });

  // 리뷰 작성
  app.post("/api/reviews", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    try {
      const { vendorId, orderId, rating, comment } = req.body;
      
      if (!vendorId || !orderId || !rating || !comment) {
        return res.status(400).json({ error: "필수 필드가 누락되었습니다" });
      }
      
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "평점은 1~5 사이의 값이어야 합니다" });
      }

      const newReview = await storage.createReview({
        vendorId,
        userId: req.user!.id,
        orderId,
        rating,
        comment
      });

      res.status(201).json(newReview);
    } catch (error) {
      console.error("리뷰 생성 오류:", error);
      res.status(500).json({ error: "리뷰 작성 중 오류가 발생했습니다" });
    }
  });

  // 리뷰 삭제
  app.delete("/api/reviews/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "로그인이 필요합니다" });
    }

    try {
      const reviewId = parseInt(req.params.id);
      // 나중에 실제 리뷰 오너 확인 로직 추가 필요
      await storage.deleteReview(reviewId);
      res.json({ success: true });
    } catch (error) {
      console.error("리뷰 삭제 오류:", error);
      res.status(500).json({ error: "리뷰 삭제 중 오류가 발생했습니다" });
    }
  });

  // 주문 상태 업데이트 시 판매실적 자동 업데이트
  // 기존 주문 상태 업데이트 엔드포인트 찾아서 수정 필요
  // 여기서는 주문 완료 시 호출될 헬퍼 함수 추가
  const updateVendorSalesCount = async (vendorId: number) => {
    try {
      const vendor = await storage.getVendor(vendorId);
      if (!vendor) return;

      // 이 판매자의 완료된 주문 수 계산
      const allOrders = await db.select().from(orders);
      const completedOrders = allOrders.filter(
        o => o.vendorId === vendorId && 
        (o.status === 'completed' || o.status === 'delivered' || o.status === 'paid')
      );

      // 판매 실적 업데이트 (현재는 더미 필드로 계산)
      console.log(`판매자 ${vendorId}의 완료된 주문: ${completedOrders.length}건`);
    } catch (error) {
      console.error("판매실적 업데이트 오류:", error);
    }
  };

  return httpServer;
}
