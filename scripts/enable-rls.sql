-- Supabase RLS(Row Level Security) 활성화 스크립트
-- 모든 테이블에 RLS를 활성화하고 service_role은 모든 작업 가능하도록 설정

-- 1. 모든 테이블에 RLS 활성화
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- 2. Service Role 정책 (백엔드 서버용 - 모든 작업 허용)
-- users 테이블
CREATE POLICY "Service role full access on users" ON public.users
  FOR ALL USING (auth.role() = 'service_role');

-- vendors 테이블
CREATE POLICY "Service role full access on vendors" ON public.vendors
  FOR ALL USING (auth.role() = 'service_role');

-- plants 테이블
CREATE POLICY "Service role full access on plants" ON public.plants
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Public read access on plants" ON public.plants
  FOR SELECT USING (true);

-- products 테이블
CREATE POLICY "Service role full access on products" ON public.products
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Public read access on products" ON public.products
  FOR SELECT USING (true);

-- bids 테이블
CREATE POLICY "Service role full access on bids" ON public.bids
  FOR ALL USING (auth.role() = 'service_role');

-- orders 테이블
CREATE POLICY "Service role full access on orders" ON public.orders
  FOR ALL USING (auth.role() = 'service_role');

-- payments 테이블
CREATE POLICY "Service role full access on payments" ON public.payments
  FOR ALL USING (auth.role() = 'service_role');

-- conversations 테이블
CREATE POLICY "Service role full access on conversations" ON public.conversations
  FOR ALL USING (auth.role() = 'service_role');

-- reviews 테이블
CREATE POLICY "Service role full access on reviews" ON public.reviews
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Public read access on reviews" ON public.reviews
  FOR SELECT USING (true);

-- cart_items 테이블
CREATE POLICY "Service role full access on cart_items" ON public.cart_items
  FOR ALL USING (auth.role() = 'service_role');

-- notifications 테이블
CREATE POLICY "Service role full access on notifications" ON public.notifications
  FOR ALL USING (auth.role() = 'service_role');

-- store_locations 테이블
CREATE POLICY "Service role full access on store_locations" ON public.store_locations
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Public read access on store_locations" ON public.store_locations
  FOR SELECT USING (true);

-- site_settings 테이블
CREATE POLICY "Service role full access on site_settings" ON public.site_settings
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Public read access on site_settings" ON public.site_settings
  FOR SELECT USING (true);

-- ai_settings 테이블
CREATE POLICY "Service role full access on ai_settings" ON public.ai_settings
  FOR ALL USING (auth.role() = 'service_role');

-- session 테이블
CREATE POLICY "Service role full access on session" ON public.session
  FOR ALL USING (auth.role() = 'service_role');

-- password_reset_tokens 테이블
CREATE POLICY "Service role full access on password_reset_tokens" ON public.password_reset_tokens
  FOR ALL USING (auth.role() = 'service_role');

-- 완료 메시지
SELECT 'RLS 활성화 및 정책 설정 완료' as message;
