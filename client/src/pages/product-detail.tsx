import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ShoppingCart, Store, Minus, Plus, Truck, Shield, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Product {
  id: number;
  name: string;
  description?: string;
  detailedDescription?: string;
  images?: string[];
  price: string;
  stock: number;
  imageUrl?: string;
  category?: string;
  userId: number;
}

interface Vendor {
  id: number;
  name: string;
  storeName: string;
  description?: string;
  address: string;
  phone: string;
  email: string;
  profileImageUrl?: string;
  isVerified?: boolean;
  rating?: string;
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);

  const { data: product, isLoading: productLoading, error: productError } = useQuery<Product>({
    queryKey: [`/api/products/${id}`],
    enabled: !!id,
  });

  const { data: vendor } = useQuery<Vendor>({
    queryKey: [`/api/vendors/byUserId/${product?.userId}`],
    enabled: !!product?.userId,
  });

  const addToCartMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/cart/items', { productId: parseInt(id!), quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cart/count'] });
      toast({
        title: "장바구니에 추가되었습니다",
        description: `${product?.name} ${quantity}개가 장바구니에 담겼습니다.`,
      });
    },
    onError: (error: any) => {
      if (error.message?.includes('401') || error.message?.includes('로그인')) {
        toast({
          title: "로그인이 필요합니다",
          description: "장바구니에 담으려면 먼저 로그인해주세요.",
          variant: "destructive",
        });
        navigate("/auth");
      } else {
        toast({
          title: "오류가 발생했습니다",
          description: "장바구니에 추가하는 중 문제가 발생했습니다.",
          variant: "destructive",
        });
      }
    },
  });

  const handleAddToCart = () => {
    if (!user) {
      toast({
        title: "로그인이 필요합니다",
        description: "장바구니에 담으려면 먼저 로그인해주세요.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    addToCartMutation.mutate();
  };

  const handleBuyNow = async () => {
    if (!user) {
      toast({
        title: "로그인이 필요합니다",
        description: "구매하려면 먼저 로그인해주세요.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    await addToCartMutation.mutateAsync();
    navigate("/cart");
  };

  if (productLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="aspect-square rounded-xl" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (productError || !product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">상품을 찾을 수 없습니다</h2>
            <p className="text-gray-600 mb-6">요청하신 상품이 존재하지 않거나 삭제되었습니다.</p>
            <Button onClick={() => navigate("/")} data-testid="button-go-home">
              홈으로 돌아가기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const price = parseFloat(product.price);
  const totalPrice = price * quantity;
  const isOutOfStock = product.stock <= 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 text-gray-600 hover:text-gray-900"
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로 가기
        </Button>

        {/* 상품 정보 영역 - 좌우 배치 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid md:grid-cols-2 gap-8 mb-12"
        >
          <div className="aspect-square bg-white rounded-xl overflow-hidden shadow-sm">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-100 to-green-200">
                <span className="text-8xl">🌿</span>
              </div>
            )}
          </div>

          <div className="space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                {product.category && (
                  <Badge variant="secondary" className="mb-2" data-testid="badge-category">
                    {product.category}
                  </Badge>
                )}
                <h1 className="text-3xl font-bold text-gray-900" data-testid="text-product-name">
                  {product.name}
                </h1>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-primary" data-testid="text-product-price">
                  ₩{price.toLocaleString()}
                </span>
                {!isOutOfStock && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    재고 {product.stock}개
                  </Badge>
                )}
                {isOutOfStock && (
                  <Badge variant="destructive">
                    품절
                  </Badge>
                )}
              </div>

              {product.description && (
                <p className="text-gray-600 leading-relaxed" data-testid="text-product-description">
                  {product.description}
                </p>
              )}
            </div>

            <div className="space-y-4">
              {!isOutOfStock && (
                <div className="flex items-center gap-4 bg-gray-100 p-4 rounded-xl">
                  <span className="text-gray-600">수량</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      data-testid="button-quantity-minus"
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="w-12 text-center font-semibold" data-testid="text-quantity">
                      {quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      disabled={quantity >= product.stock}
                      data-testid="button-quantity-plus"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  <span className="ml-auto text-xl font-bold text-primary" data-testid="text-total-price">
                    ₩{totalPrice.toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  variant="outline"
                  className="flex-1 h-14 text-lg"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock || addToCartMutation.isPending}
                  data-testid="button-add-to-cart"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {addToCartMutation.isPending ? "추가 중..." : "장바구니 담기"}
                </Button>
                <Button
                  className="flex-1 h-14 text-lg"
                  onClick={handleBuyNow}
                  disabled={isOutOfStock || addToCartMutation.isPending}
                  data-testid="button-buy-now"
                >
                  바로 구매하기
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="flex items-center gap-3 text-gray-600">
                  <Truck className="w-5 h-5" />
                  <div>
                    <p className="font-medium">무료 배송</p>
                    <p className="text-sm">3만원 이상 구매시</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <Shield className="w-5 h-5" />
                  <div>
                    <p className="font-medium">안전 결제</p>
                    <p className="text-sm">포트원 결제 시스템</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 판매자 정보 섹션 */}
        {vendor && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-4">판매 정보</h2>
            <Card
              className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/vendors/${vendor.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {vendor.profileImageUrl ? (
                      <img
                        src={vendor.profileImageUrl}
                        alt={vendor.storeName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Store className="w-10 h-10 text-green-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-gray-900">{vendor.storeName}</h3>
                      {vendor.isVerified && (
                        <CheckCircle className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mb-2">{vendor.description}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {vendor.rating && (
                          <>
                            <span className="font-semibold text-gray-900">{parseFloat(vendor.rating).toFixed(1)}</span>
                            <span className="text-yellow-400">★</span>
                          </>
                        )}
                      </div>
                      <span className="text-gray-500 text-sm">{vendor.address}</span>
                    </div>
                  </div>
                  <div className="text-right text-gray-400">
                    <p className="text-sm">판매자 상세정보</p>
                    <p className="text-xs">→</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 추가 이미지 갤러리 - 전체 폭 */}
        {product.images && product.images.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">상품 이미지</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {product.images.map((img, idx) => (
                <div key={idx} className="aspect-square overflow-hidden rounded-lg bg-gray-100 shadow-sm">
                  <img src={img} alt={`상품 이미지 ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 상세 설명 - 전체 폭 */}
        {product.detailedDescription && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">상품 설명</h2>
            <div className="bg-white p-8 rounded-lg border">
              <div
                className="prose prose-sm max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: product.detailedDescription }}
                data-testid="text-detailed-description"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
