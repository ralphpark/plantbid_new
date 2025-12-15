import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Package, Truck, CreditCard, MessageSquare, MessageCircle, CheckCircle, X 
} from "lucide-react";

// 주문 상태 배지 컴포넌트
import { Badge } from "@/components/ui/badge";

export function OrderStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <span>대기 중</span>;
    case 'paid':
      return <span>결제 완료</span>;
    case 'preparing':
      return <span>상품 준비 중</span>;
    case 'shipped':
      return <span>배송 중</span>;
    case 'completed':
      return <span>배송 완료</span>;
    case 'cancelled':
      return <span>취소됨</span>;
    case 'canceled':
      return <span>취소됨</span>;
    case 'bidded':
      return <span>입찰 완료</span>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// 주문 상세 정보 다이얼로그 컴포넌트
export function OrderDetailsDialog({ 
  order, 
  isOpen, 
  onClose, 
  onUpdateStatus, 
  onShowChat 
}: { 
  order: any; 
  isOpen: boolean; 
  onClose: () => void; 
  onUpdateStatus: (orderId: string, status: string) => void;
  onShowChat: () => void;
}) {
  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>주문 상세 정보</span>
            <div className="text-sm font-normal">
              <OrderStatusBadge status={order.status} />
            </div>
          </DialogTitle>
          <DialogDescription>
            주문 ID: #{order.id || order.orderId}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-6 mt-4">
          {/* 배송 정보 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Truck className="mr-2 h-4 w-4" />
                배송 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-2">
                <div className="text-sm font-medium">받는 사람:</div>
                <div className="text-sm">
                  {order.buyerInfo 
                    ? (typeof order.buyerInfo === 'string' 
                      ? JSON.parse(order.buyerInfo).name 
                      : order.buyerInfo.name) 
                    : '이름 정보 없음'}
                </div>
                
                <div className="text-sm font-medium">연락처:</div>
                <div className="text-sm">
                  {order.buyerInfo 
                    ? (typeof order.buyerInfo === 'string' 
                      ? JSON.parse(order.buyerInfo).phone 
                      : order.buyerInfo.phone) 
                    : '연락처 정보 없음'}
                </div>
                
                <div className="text-sm font-medium align-top">배송지 주소:</div>
                <div className="text-sm break-all">
                  {order.buyerInfo 
                    ? (typeof order.buyerInfo === 'string' 
                      ? JSON.parse(order.buyerInfo).address 
                      : order.buyerInfo.address) 
                    : '주소 정보 없음'}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* 결제 정보 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <CreditCard className="mr-2 h-4 w-4" />
                결제 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-2">
                <div className="text-sm font-medium">결제 시간:</div>
                <div className="text-sm">
                  {order.createdAt 
                    ? new Date(order.createdAt).toLocaleString('ko-KR') 
                    : '시간 정보 없음'}
                </div>
                
                <div className="text-sm font-medium">결제 금액:</div>
                <div className="text-sm">
                  {order.price 
                    ? (typeof order.price === 'number' 
                       ? order.price.toLocaleString() 
                       : parseInt(String(order.price)).toLocaleString()) + '원' 
                    : '금액 정보 없음'}
                </div>
                
                <div className="text-sm font-medium">주문 상태:</div>
                <div className="text-sm">
                  <OrderStatusBadge status={order.status} />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* 상품 정보 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Package className="mr-2 h-4 w-4" />
                상품 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.plant && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-1">{order.plant.name || '식물명 정보 없음'}</h4>
                  {order.plant.description && (
                    <p className="text-sm text-muted-foreground">{order.plant.description}</p>
                  )}
                </div>
              )}
              
              {order.selectedProducts && order.selectedProducts.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">선택된 상품:</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    {order.selectedProducts.map((product: any, index: number) => (
                      <li key={index} className="text-sm">
                        {product.name} - {product.price}원 x {product.quantity}개
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* 요청사항 */}
          {order.vendorMessage && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  구매자 요청사항
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-1">
                <div className="p-3 bg-muted rounded-md text-sm">
                  {order.vendorMessage}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        
        <DialogFooter className="mt-6 flex items-center justify-between">
          <div className="flex space-x-2">
            {order.status === 'paid' && (
              <Button
                variant="default"
                className="w-full max-w-xs"
                onClick={() => onUpdateStatus(order.id, 'preparing')}
              >
                <Package className="mr-2 h-4 w-4" />
                상품 준비 중으로 변경
              </Button>
            )}
            
            {order.status === 'preparing' && (
              <Button
                variant="default"
                className="w-full max-w-xs"
                onClick={() => onUpdateStatus(order.id, 'shipped')}
              >
                <Truck className="mr-2 h-4 w-4" />
                배송 시작으로 변경
              </Button>
            )}
            
            {order.status === 'shipped' && (
              <Button
                variant="default"
                className="w-full max-w-xs"
                onClick={() => onUpdateStatus(order.id, 'completed')}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                완료로 변경
              </Button>
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onShowChat}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              대화 내역 보기
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
            >
              <X className="h-4 w-4 mr-1" />
              닫기
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}