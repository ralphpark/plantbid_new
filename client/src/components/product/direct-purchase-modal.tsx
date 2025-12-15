import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, CreditCard, Package, Store, MapPin, Minus, Plus, ShoppingCart, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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

interface DirectPurchaseModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (orderId: string) => void;
}

export function DirectPurchaseModal({ product, isOpen, onClose, onSuccess }: DirectPurchaseModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'confirm' | 'processing' | 'success' | 'error'>('confirm');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const totalPrice = (product?.price || 0) * quantity;

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta;
    if (newQuantity >= 1 && newQuantity <= (product?.stock || 10)) {
      setQuantity(newQuantity);
    }
  };

  const handlePurchase = async () => {
    if (!product || !user) {
      toast({
        title: '로그인 필요',
        description: '구매하려면 먼저 로그인해주세요.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setPaymentStep('processing');

    try {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);
      const cleanId = (timestamp.toString() + random).replace(/[^a-zA-Z0-9]/g, '');
      const paddedId = cleanId.substring(0, 22).padEnd(22, 'f');
      const paymentId = `pay_${paddedId}`;

      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: paymentId,
          productId: product.id,
          vendorId: product.vendorId,
          quantity: quantity,
          totalAmount: totalPrice,
          productName: product.name,
          type: 'direct_purchase',
        }),
      });

      if (!orderResponse.ok) {
        throw new Error('주문 생성에 실패했습니다');
      }

      const orderData = await orderResponse.json();
      setOrderId(paymentId);

      const PortOne = (await import('@portone/browser-sdk/v2')).default;

      const response = await PortOne.requestPayment({
        storeId: "store-c2335caa-ad5c-4d3a-802b-568328aab2bc",
        channelKey: "channel-key-5cdfe609-e895-41ae-9efd-d6a7d3148e79",
        paymentId: paymentId,
        orderName: product.name,
        totalAmount: totalPrice,
        currency: "KRW" as any,
        payMethod: "CARD",
        redirectUrl: window.location.origin + `/order-detail/${paymentId}`,
        customer: {
          customerId: user.id.toString(),
          fullName: user.username || "guest",
          phoneNumber: "010-0000-0000",
          email: user.email || "test@example.com"
        }
      });

      if (!response) {
        throw new Error('결제 응답을 받지 못했습니다');
      }

      if (response.code === 'FAILURE_TYPE_PG' || response.code?.includes('FAILURE')) {
        throw new Error(response.message || '결제에 실패했습니다');
      }

      if (response.paymentId) {
        const verifyResponse = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentId: response.paymentId,
            orderId: paymentId,
          }),
        });

        if (verifyResponse.ok) {
          setPaymentStep('success');
          toast({
            title: '결제 완료',
            description: '주문이 성공적으로 완료되었습니다.',
          });
          onSuccess?.(paymentId);
        } else {
          throw new Error('결제 검증에 실패했습니다');
        }
      }
    } catch (error) {
      console.error('결제 오류:', error);
      setPaymentStep('error');
      setErrorMessage(error instanceof Error ? error.message : '결제 중 오류가 발생했습니다');
      toast({
        title: '결제 실패',
        description: error instanceof Error ? error.message : '결제 중 오류가 발생했습니다',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setQuantity(1);
    setPaymentStep('confirm');
    setOrderId(null);
    setErrorMessage('');
    onClose();
  };

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-direct-purchase">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-green-600" />
            {paymentStep === 'success' ? '주문 완료' : paymentStep === 'error' ? '결제 오류' : '상품 구매'}
          </DialogTitle>
          <DialogDescription>
            {paymentStep === 'confirm' && '주문 정보를 확인하고 결제를 진행해주세요.'}
            {paymentStep === 'processing' && '결제를 처리하고 있습니다...'}
            {paymentStep === 'success' && '주문이 성공적으로 완료되었습니다!'}
            {paymentStep === 'error' && '결제 처리 중 문제가 발생했습니다.'}
          </DialogDescription>
        </DialogHeader>

        {paymentStep === 'confirm' && (
          <>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-green-50 rounded-lg overflow-hidden flex-shrink-0">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-8 h-8 text-green-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg" data-testid="text-product-name">{product.name}</h3>
                  {product.vendorName && (
                    <p className="text-sm text-gray-500 flex items-center mt-1">
                      <Store className="w-3 h-3 mr-1" />
                      {product.vendorName}
                    </p>
                  )}
                  <p className="text-lg font-bold text-green-600 mt-2" data-testid="text-product-price">
                    {product.price.toLocaleString()}원
                  </p>
                </div>
              </div>

              {product.description && (
                <p className="text-sm text-gray-600">{product.description}</p>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <span className="font-medium">수량</span>
                <div className="flex items-center gap-3">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={quantity <= 1}
                    data-testid="button-decrease-quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="w-8 text-center font-medium" data-testid="text-quantity">{quantity}</span>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => handleQuantityChange(1)}
                    disabled={quantity >= (product.stock || 10)}
                    data-testid="button-increase-quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {product.stock && product.stock < 10 && (
                <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                  재고 {product.stock}개 남음
                </Badge>
              )}

              <Separator />

              <div className="flex items-center justify-between text-lg">
                <span className="font-medium">총 결제금액</span>
                <span className="font-bold text-green-600" data-testid="text-total-price">
                  {totalPrice.toLocaleString()}원
                </span>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleClose} data-testid="button-cancel-purchase">
                취소
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={handlePurchase}
                disabled={isLoading}
                data-testid="button-confirm-purchase"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                결제하기
              </Button>
            </DialogFooter>
          </>
        )}

        {paymentStep === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-green-600 animate-spin mb-4" />
            <p className="text-lg font-medium">결제 처리 중...</p>
            <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요.</p>
          </div>
        )}

        {paymentStep === 'success' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <p className="text-lg font-medium text-center">주문이 완료되었습니다!</p>
            <p className="text-sm text-gray-500 mt-2 text-center">
              주문번호: {orderId}
            </p>
            <Button 
              className="mt-6 bg-green-600 hover:bg-green-700"
              onClick={handleClose}
              data-testid="button-close-success"
            >
              확인
            </Button>
          </div>
        )}

        {paymentStep === 'error' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <p className="text-lg font-medium text-center">결제에 실패했습니다</p>
            <p className="text-sm text-gray-500 mt-2 text-center">{errorMessage}</p>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={handleClose} data-testid="button-close-error">
                닫기
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setPaymentStep('confirm')}
                data-testid="button-retry-payment"
              >
                다시 시도
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
