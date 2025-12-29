import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { CreditCard, Truck, ArrowLeft, ShoppingBag, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// 전역 타입 선언은 client/src/types/window.d.ts에서 관리

const shippingFormSchema = z.object({
  recipientName: z.string().min(2, "수령인 이름을 입력해주세요"),
  phone: z.string().min(10, "올바른 전화번호를 입력해주세요"),
  address: z.string().min(5, "주소를 입력해주세요"),
  addressDetail: z.string().optional(),
  postalCode: z.string().min(5, "우편번호를 입력해주세요"),
  deliveryMemo: z.string().optional(),
});

type ShippingFormData = z.infer<typeof shippingFormSchema>;

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

interface MapConfig {
  googleMapsApiKey: string;
  channelKey: string;
  storeId: string;
}

export default function CheckoutPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const form = useForm<ShippingFormData>({
    resolver: zodResolver(shippingFormSchema),
    defaultValues: {
      recipientName: user?.name || "",
      phone: user?.phone || "",
      address: "",
      addressDetail: "",
      postalCode: "",
      deliveryMemo: "",
    },
  });

  const { data: cartItems = [], isLoading: cartLoading } = useQuery<CartItem[]>({
    queryKey: ['/api/cart'],
    enabled: !!user,
  });

  const { data: mapConfig } = useQuery<MapConfig>({
    queryKey: ['/api/map/config'],
  });

  useEffect(() => {
    if (user) {
      form.setValue('recipientName', user.name || user.username || '');
      form.setValue('phone', user.phone || '');
    }
  }, [user, form]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.portone.io/v2/browser-sdk.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const checkoutMutation = useMutation({
    mutationFn: async (shippingInfo: ShippingFormData) => {
      const res = await apiRequest('POST', '/api/checkout', { shippingInfo });
      return await res.json();
    },
    onError: (error: any) => {
      toast({
        title: "주문 생성 실패",
        description: error.message || "주문 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  const handlePayment = async (data: ShippingFormData) => {
    if (!window.PortOne) {
      toast({
        title: "결제 시스템 로딩 중",
        description: "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!mapConfig) {
      toast({
        title: "결제 설정 로딩 중",
        description: "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const checkoutResult = await checkoutMutation.mutateAsync(data);
      console.log('Checkout result:', checkoutResult);
      
      const { paymentId, totalAmount, orderName } = checkoutResult;
      console.log('Payment details - paymentId:', paymentId, 'totalAmount:', totalAmount, 'orderName:', orderName);

      if (!paymentId) {
        throw new Error('결제 ID가 생성되지 않았습니다.');
      }

      const response = await (window.PortOne as any).requestPayment({
        storeId: mapConfig.storeId,
        channelKey: mapConfig.channelKey,
        paymentId: paymentId,
        orderName: orderName,
        totalAmount: Math.round(totalAmount),
        currency: "KRW",
        payMethod: "CARD",
        customer: {
          fullName: data.recipientName,
          phoneNumber: data.phone,
          email: user?.email,
        },
        redirectUrl: `${window.location.origin}/checkout/complete`,
      });

      if (response.code) {
        toast({
          title: "결제 실패",
          description: response.message || "결제 처리 중 오류가 발생했습니다.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // 결제 완료 후 장바구니 비우기
      try {
        await apiRequest('DELETE', '/api/cart');
      } catch (clearError) {
        console.error('장바구니 비우기 실패:', clearError);
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/cart'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/cart/count'] });
      
      setPaymentSuccess(true);
      
      toast({
        title: "결제가 완료되었습니다!",
        description: "주문이 정상적으로 처리되었습니다.",
      });

    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: "결제 오류",
        description: error.message || "결제 처리 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="text-center">
            <CreditCard className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h2>
            <p className="text-gray-600 mb-6">결제를 진행하려면 먼저 로그인해주세요.</p>
            <Button onClick={() => navigate("/auth")} data-testid="button-login">
              로그인하기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">결제가 완료되었습니다!</h2>
            <p className="text-gray-600 mb-8">주문이 정상적으로 처리되었습니다. 빠르게 배송해드리겠습니다.</p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" onClick={() => navigate("/order-history")} data-testid="button-view-orders">
                주문 내역 보기
              </Button>
              <Button onClick={() => navigate("/")} data-testid="button-continue-shopping">
                쇼핑 계속하기
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (cartLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Skeleton className="h-10 w-48 mb-6" />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Skeleton className="h-64 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="text-center">
            <ShoppingBag className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">장바구니가 비어있습니다</h2>
            <p className="text-gray-600 mb-6">결제할 상품이 없습니다. 먼저 상품을 장바구니에 담아주세요.</p>
            <Button onClick={() => navigate("/")} data-testid="button-shop-now">
              쇼핑하러 가기
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const totalAmount = cartItems.reduce((sum, item) => {
    return sum + parseFloat(item.unitPrice) * item.quantity;
  }, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate("/cart")}
          className="mb-6 text-gray-600 hover:text-gray-900"
          data-testid="button-back-to-cart"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          장바구니로 돌아가기
        </Button>

        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <CreditCard className="w-6 h-6" />
          주문/결제
        </h1>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handlePayment)}>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="w-5 h-5" />
                      배송 정보
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="recipientName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>수령인 이름 *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="홍길동" 
                                {...field}
                                data-testid="input-recipient-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>연락처 *</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="010-1234-5678" 
                                {...field}
                                data-testid="input-phone"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="postalCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>우편번호 *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="12345" 
                              {...field}
                              data-testid="input-postal-code"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>주소 *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="서울특별시 강남구 테헤란로 123" 
                              {...field}
                              data-testid="input-address"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="addressDetail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>상세 주소</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="아파트 동/호수" 
                              {...field}
                              data-testid="input-address-detail"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="deliveryMemo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>배송 메모</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="배송 시 요청사항을 입력해주세요" 
                              {...field}
                              data-testid="input-delivery-memo"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5" />
                      주문 상품 ({cartItems.length}개)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="divide-y">
                      {cartItems.map((item) => (
                        <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex gap-4">
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            {item.productImageUrl ? (
                              <img 
                                src={item.productImageUrl} 
                                alt={item.productName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-100 to-green-200">
                                <span className="text-2xl">🌿</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900" data-testid={`text-checkout-product-${item.productId}`}>
                              {item.productName}
                            </h4>
                            <p className="text-sm text-gray-500">{item.vendorName}</p>
                            <div className="flex justify-between mt-1">
                              <span className="text-sm text-gray-600">수량: {item.quantity}개</span>
                              <span className="font-medium">
                                ₩{(parseFloat(item.unitPrice) * item.quantity).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <Card className="sticky top-4">
                  <CardContent className="p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">결제 금액</h2>
                    
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between text-gray-600">
                        <span>상품 금액</span>
                        <span data-testid="text-checkout-subtotal">₩{totalAmount.toLocaleString()}</span>
                      </div>
                      <div className="border-t pt-3">
                        <div className="flex justify-between text-lg font-bold">
                          <span>총 결제 금액</span>
                          <span className="text-primary" data-testid="text-checkout-total">
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
                      type="submit"
                      className="w-full mt-6 h-12 text-lg"
                      disabled={isProcessing}
                      data-testid="button-pay"
                    >
                      {isProcessing ? (
                        <>처리 중...</>
                      ) : (
                        <>
                          <CreditCard className="w-5 h-5 mr-2" />
                          ₩{totalAmount.toLocaleString()} 결제하기
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-center text-gray-500 mt-4">
                      주문 내용을 확인하였으며, 결제에 동의합니다.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}
