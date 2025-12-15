import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ShoppingCart, Trash2, Minus, Plus, ArrowRight, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CartItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: string;
  productName: string;
  productDescription?: string;
  productImageUrl?: string;
  productStock: number;
  vendorId: number;
  vendorName: string;
}

export default function CartPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: cartItems = [], isLoading, error } = useQuery<CartItem[]>({
    queryKey: ['/api/cart'],
    enabled: !!user,
  });

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: number; quantity: number }) => {
      return apiRequest('PATCH', `/api/cart/items/${productId}`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cart/count'] });
    },
    onError: () => {
      toast({
        title: "오류가 발생했습니다",
        description: "수량 변경 중 문제가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: async (productId: number) => {
      return apiRequest('DELETE', `/api/cart/items/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cart/count'] });
      toast({
        title: "삭제되었습니다",
        description: "상품이 장바구니에서 삭제되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "오류가 발생했습니다",
        description: "상품 삭제 중 문제가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const clearCartMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', '/api/cart');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cart/count'] });
      toast({
        title: "장바구니가 비워졌습니다",
      });
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 pt-28 py-16">
          <div className="text-center">
            <ShoppingCart className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h2>
            <p className="text-gray-600 mb-6">장바구니를 이용하려면 먼저 로그인해주세요.</p>
            <Button onClick={() => navigate("/auth")} data-testid="button-login">
              로그인하기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 pt-28 py-8">
          <Skeleton className="h-10 w-48 mb-6" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 pt-28 py-16">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">오류가 발생했습니다</h2>
            <p className="text-gray-600 mb-6">장바구니를 불러오는 중 문제가 발생했습니다.</p>
            <Button onClick={() => window.location.reload()} data-testid="button-retry">
              다시 시도
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const totalAmount = cartItems.reduce((sum, item) => {
    return sum + parseFloat(item.unitPrice) * item.quantity;
  }, 0);

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 pt-28 py-16">
          <div className="text-center">
            <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">장바구니가 비어있습니다</h2>
            <p className="text-gray-600 mb-6">마음에 드는 식물을 장바구니에 담아보세요!</p>
            <Button onClick={() => navigate("/")} data-testid="button-shop-now">
              쇼핑하러 가기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 pt-28 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" />
            장바구니
            <span className="text-gray-500 text-lg font-normal">({totalItems}개)</span>
          </h1>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => clearCartMutation.mutate()}
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
            data-testid="button-clear-cart"
          >
            전체 삭제
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card data-testid={`card-cart-item-${item.productId}`}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div 
                        className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 cursor-pointer flex-shrink-0"
                        onClick={() => navigate(`/products/${item.productId}`)}
                      >
                        {item.productImageUrl ? (
                          <img 
                            src={item.productImageUrl} 
                            alt={item.productName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-100 to-green-200">
                            <span className="text-3xl">🌿</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 
                              className="font-semibold text-gray-900 cursor-pointer hover:text-primary"
                              onClick={() => navigate(`/products/${item.productId}`)}
                              data-testid={`text-product-name-${item.productId}`}
                            >
                              {item.productName}
                            </h3>
                            <p className="text-sm text-gray-500">{item.vendorName}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItemMutation.mutate(item.productId)}
                            className="text-gray-400 hover:text-red-500"
                            data-testid={`button-remove-${item.productId}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantityMutation.mutate({ 
                                productId: item.productId, 
                                quantity: item.quantity - 1 
                              })}
                              disabled={item.quantity <= 1}
                              data-testid={`button-minus-${item.productId}`}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center font-medium" data-testid={`text-quantity-${item.productId}`}>
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => updateQuantityMutation.mutate({ 
                                productId: item.productId, 
                                quantity: item.quantity + 1 
                              })}
                              disabled={item.quantity >= item.productStock}
                              data-testid={`button-plus-${item.productId}`}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          <span className="font-bold text-lg text-primary" data-testid={`text-item-total-${item.productId}`}>
                            ₩{(parseFloat(item.unitPrice) * item.quantity).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardContent className="p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">주문 요약</h2>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>상품 금액</span>
                    <span data-testid="text-subtotal">₩{totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>총 결제 금액</span>
                      <span className="text-primary" data-testid="text-total">
                        ₩{totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-200">
                  <p className="text-xs text-gray-600">
                    ℹ️ 배송비는 판매자가 상품 특성과 배송 지역에 따라 별도로 안내할 예정입니다.
                  </p>
                </div>

                <Button 
                  className="w-full mt-6 h-12 text-lg"
                  onClick={() => navigate("/checkout")}
                  data-testid="button-checkout"
                >
                  주문하기
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
