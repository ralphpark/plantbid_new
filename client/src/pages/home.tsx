import { useEffect, useState } from "react";
import { Header, subscribeToLocationChange } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DirectPurchaseModal } from "@/components/product/direct-purchase-modal";
import { 
  Leaf, 
  MapPin, 
  Star, 
  ShoppingCart, 
  ArrowRight, 
  Sparkles,
  Store,
  TrendingUp,
  Heart,
  MessageCircle,
  AlertCircle
} from "lucide-react";

interface Plant {
  id: number;
  name: string;
  scientificName?: string;
  description?: string;
  imageUrl?: string;
  category?: string;
  difficulty?: string;
  light?: string;
  water?: string;
  minPrice?: number;
  maxPrice?: number;
}

interface Vendor {
  id: number;
  storeName: string;
  description?: string;
  profileImageUrl?: string;
  address?: string;
  rating?: string;
  totalSales?: number;
  isVerified?: boolean;
}

interface Product {
  id: number;
  plantId: number;
  vendorId: number;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  stock?: number;
  vendorName?: string;
  plantName?: string;
}

export default function Home() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [userLocation, setUserLocation] = useState<string>("내 지역");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(() => {
    const hideUntil = localStorage.getItem('hideMaintenancePopup');
    if (hideUntil) {
      const today = new Date().toDateString();
      return hideUntil !== today;
    }
    return true;
  });

  const handleHideForToday = () => {
    const today = new Date().toDateString();
    localStorage.setItem('hideMaintenancePopup', today);
    setIsMaintenanceOpen(false);
  };

  useEffect(() => {
    document.title = "PlantBid - 식물 마켓플레이스 | AI 추천 & 지역 판매자 연결";
    window.scrollTo(0, 0);
    
    // 홈 페이지 로드 시 항상 이전 위치 정보 삭제 (새로 감지하도록 강제)
    localStorage.removeItem('selectedLocation');
    
    // 홈페이지에서는 항상 GPS로 현재 위치 감지
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // 백엔드 API를 통해 역지오코딩 수행
            const response = await fetch(`/api/map/address-by-coords?lat=${lat}&lng=${lng}`);
            const data = await response.json();
            
            if (data.success && data.results && data.results.length > 0) {
              const address = data.results[0].formatted_address;
              setUserLocation(address);
              // 현재 위치를 localStorage에 저장
              localStorage.setItem('selectedLocation', JSON.stringify({ address, lat, lng }));
            } else {
              setUserLocation("내 지역");
            }
          } catch (error) {
            console.error('위치 정보 조회 실패:', error);
            setUserLocation("내 지역");
          }
        },
        (error) => {
          console.error('GPS 감지 오류:', error);
          setUserLocation("내 지역");
          localStorage.removeItem('selectedLocation');
        }
      );
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToLocationChange((locations: { gpsLocation: string; searchLocation: string }) => {
      setUserLocation(locations.searchLocation);
    });
    return unsubscribe;
  }, []);

  const { data: popularPlants, isLoading: plantsLoading } = useQuery<Plant[]>({
    queryKey: ['/api/plants/popular'],
  });

  const { data: popularVendors, isLoading: vendorsLoading } = useQuery<Vendor[]>({
    queryKey: ['/api/vendors/popular', userLocation],
    queryFn: async () => {
      const saved = localStorage.getItem('searchLocation');
      let query = '';
      
      if (saved && saved.startsWith('{')) {
        try {
          const data = JSON.parse(saved);
          query = `?lat=${data.lat}&lng=${data.lng}&radius=10`;
        } catch {
          query = '';
        }
      }
      
      const response = await fetch(`/api/vendors/popular${query}`);
      if (!response.ok) throw new Error('Failed to fetch vendors');
      return response.json();
    },
  });

  const { data: availableProducts, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ['/api/products/available', userLocation],
    queryFn: async () => {
      const saved = localStorage.getItem('searchLocation');
      let query = '';
      
      if (saved && saved.startsWith('{')) {
        try {
          const data = JSON.parse(saved);
          query = `?lat=${data.lat}&lng=${data.lng}&radius=10`;
        } catch {
          query = `?region=${encodeURIComponent(userLocation)}`;
        }
      } else {
        query = `?region=${encodeURIComponent(userLocation)}`;
      }
      
      const response = await fetch(`/api/products/available${query}`);
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
  });

  const handleStartConsultation = () => {
    if (user) {
      navigate("/ai-consultation");
    } else {
      navigate("/auth");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-green-50">
      {/* 유지보수 안내 팝업 */}
      <AlertDialog open={isMaintenanceOpen} onOpenChange={setIsMaintenanceOpen}>
        <AlertDialogContent className="border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-yellow-400 rounded-full p-2">
              <AlertCircle className="w-6 h-6 text-yellow-900" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-gray-800">
              개발 테스트 중입니다
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base text-gray-700 leading-relaxed">
            현재 홈페이지는 개발 테스트 중으로 정상작동하지 않습니다.
            <br />
            <br />
            불편을 드려 죄송합니다. 더 나은 서비스로 돌아오겠습니다.
          </AlertDialogDescription>
          <div className="flex flex-col gap-3 mt-6">
            <AlertDialogAction 
              onClick={() => setIsMaintenanceOpen(false)}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold"
            >
              확인했습니다
            </AlertDialogAction>
            <button
              onClick={handleHideForToday}
              className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
              data-testid="button-hide-for-today"
            >
              오늘 하루 보지 않기
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <Header />
      
      <main className="pt-16">
        {/* 히어로 섹션 */}
        <section className="relative bg-gradient-to-br from-[#005E43] via-[#007055] to-[#004835] text-white py-16 md:py-24 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full blur-3xl"></div>
            <div className="absolute bottom-10 right-10 w-48 h-48 bg-green-300 rounded-full blur-3xl"></div>
          </div>
          
          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <Badge className="bg-white/20 text-white border-white/30 mb-4" data-testid="badge-ai">
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI 기반 식물 추천
                </Badge>
                <h1 className="text-3xl md:text-5xl font-bold mb-4 leading-tight" data-testid="text-hero-title">
                  나에게 딱 맞는 식물,<br />
                  <span className="text-green-300">AI가 찾아드립니다</span>
                </h1>
                <p className="text-lg md:text-xl text-white/80 mb-8" data-testid="text-hero-subtitle">
                  환경과 취향을 분석하고, 가까운 판매자의 실시간 제안까지 한 번에
                </p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex justify-center"
              >
                <Button 
                  size="lg"
                  className="bg-white text-[#005E43] hover:bg-white/90 font-semibold px-8 py-6 text-lg ml-[1px] mr-[1px] mt-[1px] mb-[1px]"
                  onClick={handleStartConsultation}
                  data-testid="button-start-consultation"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  AI 상담 시작하기
                </Button>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 인기 식물 섹션 */}
        <section className="py-12 md:py-16 px-4" data-testid="section-popular-plants">
          <div className="container mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2" data-testid="text-popular-plants-title">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                  인기 식물
                </h2>
                <p className="text-gray-600 mt-1">지금 가장 많이 찾는 식물들</p>
              </div>
              <Button 
                variant="ghost" 
                className="text-green-600 hover:text-green-700" 
                data-testid="link-view-all-plants"
                onClick={() => navigate("/popular-plants")}
              >
                인기 식물 더보기 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {plantsLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="h-40 w-full" />
                    <CardContent className="p-3">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-1/2" />
                    </CardContent>
                  </Card>
                ))
              ) : popularPlants && popularPlants.length > 0 ? (
                popularPlants.slice(0, 5).map((plant) => (
                  <motion.div
                    key={plant.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    viewport={{ once: true }}
                  >
                    <Card 
                      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                      onClick={() => navigate(`/plants/${plant.id}`)}
                      data-testid={`card-plant-${plant.id}`}
                    >
                      <div className="relative h-40 bg-gradient-to-br from-green-100 to-green-50 overflow-hidden">
                        {plant.imageUrl ? (
                          <img 
                            src={plant.imageUrl} 
                            alt={plant.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Leaf className="w-12 h-12 text-green-300" />
                          </div>
                        )}
                        <button 
                          className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-full hover:bg-white"
                          onClick={(e) => { e.stopPropagation(); }}
                          data-testid={`button-like-plant-${plant.id}`}
                        >
                          <Heart className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-semibold text-gray-900 truncate" data-testid={`text-plant-name-${plant.id}`}>{plant.name}</h3>
                        <p className="text-sm text-gray-500 truncate">{plant.scientificName}</p>
                        {plant.minPrice && (
                          <p className="text-green-600 font-medium mt-1">
                            {plant.minPrice.toLocaleString()}원~
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <Leaf className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>등록된 식물이 없습니다</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={handleStartConsultation}
                  >
                    AI에게 추천받기
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 지역 인기 판매자 섹션 */}
        <section className="py-12 md:py-16 px-4 bg-white" data-testid="section-popular-vendors">
          <div className="container mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2" data-testid="text-popular-vendors-title">
                  <Store className="w-6 h-6 text-green-600" />
                  {userLocation} 인기 판매자
                </h2>
                <p className="text-gray-600 mt-1 flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  내 주변에서 인기 있는 식물 판매자
                </p>
              </div>
              <Button 
                variant="ghost" 
                className="text-green-600 hover:text-green-700" 
                data-testid="link-view-all-vendors"
                onClick={() => navigate("/popular-vendors")}
              >
                지역 인기 판매자 더보기 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {vendorsLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="w-16 h-16 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-5 w-3/4 mb-2" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : popularVendors && popularVendors.length > 0 ? (
                popularVendors.slice(0, 4).map((vendor) => (
                  <motion.div
                    key={vendor.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    viewport={{ once: true }}
                  >
                    <Card 
                      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => navigate(`/vendors/${vendor.id}`)}
                      data-testid={`card-vendor-${vendor.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {vendor.profileImageUrl ? (
                              <img 
                                src={vendor.profileImageUrl} 
                                alt={vendor.storeName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Store className="w-8 h-8 text-green-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900 truncate" data-testid={`text-vendor-name-${vendor.id}`}>
                                {vendor.storeName}
                              </h3>
                              {vendor.isVerified && (
                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">인증</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {vendor.rating ? (
                                <span className="flex items-center text-sm text-yellow-600">
                                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-0.5" />
                                  {parseFloat(vendor.rating).toFixed(1)}
                                </span>
                              ) : null}
                              {vendor.address && (
                                <span className="text-sm text-gray-500 truncate flex items-center">
                                  <MapPin className="w-3 h-3 mr-0.5" />
                                  {vendor.address.split(' ').slice(0, 2).join(' ')}
                                </span>
                              )}
                            </div>
                            {vendor.description && (
                              <p className="text-sm text-gray-600 mt-2 line-clamp-2">{vendor.description}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <Store className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>등록된 판매자가 없습니다</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 바로 구매 가능한 상품 섹션 */}
        <section className="py-12 md:py-16 px-4" data-testid="section-available-products">
          <div className="container mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2" data-testid="text-available-products-title">
                  <ShoppingCart className="w-6 h-6 text-green-600" />
                  {userLocation !== "내 지역" ? `${userLocation} 지역` : ""} 바로 구매 가능
                </h2>
                <p className="text-gray-600 mt-1 flex items-center">
                  <MapPin className="w-4 h-4 mr-1" />
                  {userLocation !== "내 지역" ? `${userLocation} 판매자의 ` : ""}지금 바로 주문할 수 있는 식물들
                </p>
              </div>
              <Button 
                variant="ghost" 
                className="text-green-600 hover:text-green-700" 
                data-testid="link-view-all-products"
                onClick={() => navigate("/available-products")}
              >
                바로 구매 가능 상품 더보기 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {productsLoading ? (
                Array(8).fill(0).map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <Skeleton className="h-48 w-full" />
                    <CardContent className="p-3">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-1/2 mb-2" />
                      <Skeleton className="h-5 w-1/3" />
                    </CardContent>
                  </Card>
                ))
              ) : availableProducts && availableProducts.length > 0 ? (
                availableProducts.slice(0, 8).map((product) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    viewport={{ once: true }}
                  >
                    <Card 
                      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                      onClick={() => navigate(`/products/${product.id}`)}
                      data-testid={`card-product-${product.id}`}
                    >
                      <div className="relative h-48 bg-gradient-to-br from-green-100 to-green-50 overflow-hidden">
                        {product.imageUrl ? (
                          <img 
                            src={product.imageUrl} 
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Leaf className="w-16 h-16 text-green-300" />
                          </div>
                        )}
                        {product.stock && product.stock < 5 && (
                          <Badge className="absolute top-2 left-2 bg-red-500">품절 임박</Badge>
                        )}
                        <button 
                          className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-full hover:bg-white"
                          onClick={(e) => { e.stopPropagation(); }}
                          data-testid={`button-like-product-${product.id}`}
                        >
                          <Heart className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-semibold text-gray-900 truncate" data-testid={`text-product-name-${product.id}`}>
                          {product.name}
                        </h3>
                        {product.vendorName && (
                          <p className="text-sm text-gray-500 truncate flex items-center">
                            <Store className="w-3 h-3 mr-1" />
                            {product.vendorName}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-lg font-bold text-green-600" data-testid={`text-product-price-${product.id}`}>
                            {product.price.toLocaleString()}원
                          </p>
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              navigate(`/products/${product.id}`);
                            }}
                            data-testid={`button-buy-product-${product.id}`}
                          >
                            <ShoppingCart className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium text-gray-700">
                    {userLocation !== "내 지역" 
                      ? `현재 ${userLocation} 지역에는 등록된 판매자가 없습니다`
                      : "현재 지역에 등록된 판매자가 없습니다"}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    AI 상담을 통해 다른 지역 판매자와 연결해 드릴 수 있어요
                  </p>
                  <Button 
                    className="mt-4 bg-green-600 hover:bg-green-700"
                    onClick={handleStartConsultation}
                    data-testid="button-consult-no-vendors"
                  >
                    AI 상담으로 식물 찾기
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* AI 상담 CTA 섹션 */}
        <section className="py-16 px-4 bg-gradient-to-br from-[#005E43] to-[#004835] text-white">
          <div className="container mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-green-300" />
              <h2 className="text-2xl md:text-4xl font-bold mb-4" data-testid="text-cta-title">
                어떤 식물을 키워야 할지 모르겠다면?
              </h2>
              <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
                AI가 당신의 환경과 생활 패턴을 분석하여 
                가장 잘 맞는 식물을 추천해드립니다.
                주변 판매자의 실시간 제안까지 한 번에!
              </p>
              <Button 
                size="lg"
                className="bg-white text-[#005E43] hover:bg-white/90 font-semibold px-10 py-6 text-lg"
                onClick={handleStartConsultation}
                data-testid="button-cta-consultation"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                무료 AI 상담 시작하기
              </Button>
            </motion.div>
          </div>
        </section>

        {/* 서비스 특징 간단 소개 */}
        <section className="py-12 md:py-16 px-4 bg-gray-50">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">AI 맞춤 추천</h3>
                <p className="text-gray-600">
                  환경, 경험, 취향을 분석해 딱 맞는 식물을 찾아드려요
                </p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">지역 판매자 연결</h3>
                <p className="text-gray-600">
                  가까운 판매자로부터 실시간 맞춤 제안을 받아보세요
                </p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShoppingCart className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold mb-2">안전한 거래</h3>
                <p className="text-gray-600">
                  검증된 판매자와 안전한 결제 시스템으로 믿고 거래하세요
                </p>
              </motion.div>
            </div>
            
            <div className="text-center mt-10">
              <Link href="/features">
                <Button variant="outline" className="border-green-600 text-green-600 hover:bg-green-50" data-testid="button-view-features">
                  서비스 특징 더 알아보기
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
      
      <DirectPurchaseModal
        product={selectedProduct}
        isOpen={isPurchaseModalOpen}
        onClose={() => {
          setIsPurchaseModalOpen(false);
          setSelectedProduct(null);
        }}
        onSuccess={(orderId) => {
          navigate(`/order-detail/${orderId}`);
        }}
      />
    </div>
  );
}
