import { useState, useEffect, useMemo } from "react";
import { Redirect, Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Store, Bell, Settings, ShoppingBag, Package, MapPin,
  ChevronRight, MessageSquare, Filter, Search, PlusCircle,
  Edit, Trash, MessageCircle, CheckCircle, Clock, LogOut,
  ImagePlus, Truck, AlertCircle, Send, User, Phone,
  Loader2, Globe2, MapPinOff, X, XCircle, CreditCard, Plus, Pencil, DollarSign,
  Calendar, ArrowRight, ListFilter, RefreshCw, Image, CircleDollarSign,
  ChevronDown
} from "lucide-react";
import LocationSettings from "@/components/location/location-settings";
import ProductDialog from "@/components/product/product-dialog";
import { OrderDetailsDialog, OrderStatusBadge } from "@/components/ui/vendorDashboardDialog";
import { BidDetailsSidePanel } from "@/components/ui/BidDetailsSidePanel";
import { SendPlantPhotoDialog } from "@/components/ui/sendPlantPhotoDialog";
import { ConversationView } from "@/components/ui/ConversationView";
import { DirectChatModal, DirectChatList } from "@/components/direct-chat";
import { useCreateDirectChat, useDirectChatList } from "@/hooks/use-direct-chat";


// 판매자 대시보드 메인 컴포넌트
export default function VendorDashboard() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [bids, setBids] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [directOrders, setDirectOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedBid, setSelectedBid] = useState<any | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [location, setLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
    isExact: boolean;
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [userName, setUserName] = useState<string>('판매자');
  const [sendPhotoDialogOpen, setSendPhotoDialogOpen] = useState(false);
  const [preparingOrder, setPreparingOrder] = useState<any>(null);

  // 판매자 프로필 상태
  const [vendorProfile, setVendorProfile] = useState<{
    id: number;
    storeName: string;
    description: string;
    profileImageUrl: string;
    address: string;
    region: string;
    phone: string;
  } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);

  // 알림 요약
  const [notifications, setNotifications] = useState<any[]>([]);

  const [conversations, setConversations] = useState<Record<number, any>>({});

  // 직접 채팅 상태
  const [directChatId, setDirectChatId] = useState<number | null>(null);
  const [isDirectChatOpen, setIsDirectChatOpen] = useState(false);
  const createDirectChatMutation = useCreateDirectChat();

  // 데이터 로드 - 컴포넌트 마운트 시 실행
  useEffect(() => {
    // 인증되지 않은 사용자 리디렉션
    if (!user) {
      navigate('/login');
      return;
    }

    // 사용자가 판매자 역할이 아닌 경우 리디렉션
    if (user.role !== 'vendor') {
      toast({
        title: "접근 권한 없음",
        description: "판매자 계정으로만 접근할 수 있습니다.",
        variant: "destructive",
      });
      navigate('/');
      return;
    }

    // 이름 설정
    setUserName(user.username || user.email || '판매자');

    // 데이터 로드
    const loadData = async () => {
      setLoading(true);
      try {
        // 판매자 입찰 데이터 로드
        const bidsResponse = await fetch('/api/bids/vendor');
        if (bidsResponse.ok) {
          const bidsData = await bidsResponse.json();
          setBids(bidsData || []);
        }

        // 판매자 주문 데이터 로드
        const ordersResponse = await fetch('/api/orders/vendor/me');
        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json();
          setOrders(ordersData || []);
        }

        // 판매자 직접 판매 주문 데이터 로드
        const directOrdersResponse = await fetch('/api/orders/vendor/direct');
        if (directOrdersResponse.ok) {
          const directOrdersData = await directOrdersResponse.json();
          setDirectOrders(directOrdersData || []);
        }

        // 판매자 제품 데이터 로드
        const productsResponse = await fetch('/api/products');
        if (productsResponse.ok) {
          const productsData = await productsResponse.json();
          setProducts(productsData || []);
        }

        // 판매자 결제 데이터 로드
        const paymentsResponse = await fetch('/api/payments/vendor/me');
        if (paymentsResponse.ok) {
          const paymentsData = await paymentsResponse.json();
          setPayments(paymentsData || []);
          console.log('판매자 결제 데이터 로드:', paymentsData.length, '개 항목');
        }

        // 판매자 위치 정보 로드
        const locationResponse = await fetch('/api/vendors/location');
        if (locationResponse.ok) {
          const locationData = await locationResponse.json();
          if (locationData.success && locationData.location) {
            setLocation({
              lat: locationData.location.latitude,
              lng: locationData.location.longitude,
              address: locationData.location.address || '위치 정보 없음',
              isExact: true
            });
          }
        }

        // 판매자 프로필 정보 로드
        const vendorResponse = await fetch('/api/vendors/me');
        if (vendorResponse.ok) {
          const vendorData = await vendorResponse.json();
          setVendorProfile({
            id: vendorData.id,
            storeName: vendorData.storeName || '',
            description: vendorData.description || '',
            profileImageUrl: vendorData.profileImageUrl || '',
            address: vendorData.address || '',
            region: vendorData.region || '',
            phone: vendorData.phone || '',
          });
          setProfileImagePreview(vendorData.profileImageUrl || null);
        }
      } catch (error) {
        console.error("데이터 로드 오류:", error);
        toast({
          title: "데이터 로드 실패",
          description: "판매자 데이터를 불러오는데 실패했습니다.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, navigate, toast]);

  // 로그아웃 처리
  const handleLogout = () => {
    setLoading(true); // 로딩 표시 시작

    // 직접 API 요청으로 로그아웃 처리
    fetch('/api/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
      .then(() => {
        // 캐시와 상태 초기화
        setBids([]);
        setOrders([]);
        setProducts([]);
        setConversations({});

        // 성공 메시지 표시
        toast({
          title: "로그아웃 성공",
          description: "성공적으로 로그아웃되었습니다."
        });

        // 전체 페이지 새로고침 (모든 React Query 캐시 및 상태 초기화)
        setTimeout(() => {
          window.location.href = '/auth'; // 로그아웃 후 인증 페이지로 강제 이동 (navigate 대신 location 사용)
        }, 500);
      })
      .catch(error => {
        console.error("로그아웃 오류:", error);
        setLoading(false);
        toast({
          title: "로그아웃 실패",
          description: "로그아웃 처리 중 오류가 발생했습니다.",
          variant: "destructive"
        });
      });
  };

  // 주문 클릭 처리
  const handleOrderClick = (order: any) => {
    setSelectedOrder(order);
    setSelectedBid(null);
    setShowConversation(false);
  };

  // 입찰 클릭 처리
  const handleBidClick = (bid: any) => {
    if (selectedBid && selectedBid.id === bid.id) {
      setSelectedBid(null); // 같은 입찰을 다시 클릭하면 닫기
    } else {
      setSelectedBid(bid);
      setSelectedOrder(null);
      setShowConversation(false);
    }
  };

  // 입찰 업데이트 처리
  const handleUpdateBid = async (bidId: string, bidData: any, closePanel = true) => {
    try {
      console.log("입찰 업데이트 시작:", { bidId, status: bidData.status, data: bidData });

      const response = await fetch(`/api/bids/${bidId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bidData)
      });

      if (!response.ok) throw new Error("입찰 업데이트에 실패했습니다");

      const updatedBid = await response.json();
      console.log("서버에서 업데이트된 입찰 데이터:", updatedBid);

      // 로컬 상태 업데이트 - 새로운 상태를 확실히 반영
      setBids(prev => {
        const updatedBids = prev.map(b =>
          b.id.toString() === bidId ? { ...b, ...updatedBid, status: bidData.status || updatedBid.status } : b
        );
        console.log("업데이트 된 입찰 목록:", updatedBids);
        return updatedBids;
      });

      // 선택된 입찰이 현재 업데이트 중인 입찰이면 업데이트
      if (selectedBid && selectedBid.id.toString() === bidId) {
        setSelectedBid({ ...selectedBid, ...updatedBid, status: bidData.status || updatedBid.status });
      }

      // 자동 메시지 전송
      if ((bidData.status === 'bidded' || bidData.status === 'reviewing') && updatedBid.conversationId) {
        // 판매자 정보 조회
        let vendorInfo = null;
        try {
          const vendorResponse = await fetch(`/api/vendors/${updatedBid.vendorId}`);
          if (vendorResponse.ok) {
            vendorInfo = await vendorResponse.json();
            console.log("판매자 정보:", vendorInfo);
          }
        } catch (error) {
          console.error("판매자 정보 조회 오류:", error);
        }

        // 현재 대화 내용 가져오기 - 중복 확인용
        const convResponse = await fetch(`/api/conversations/${updatedBid.conversationId}`);
        const conversation = await convResponse.json();
        const existingMessages = conversation.messages || [];

        // 🚫 검토 상태에서는 메시지를 생성하지 않음 (근본적 해결)
        if (bidData.status === 'reviewing') {
          console.log("입찰 검토 상태에서는 메시지를 생성하지 않습니다 (중복 방지)");
          return;
        }

        // 입찰 상세 정보 메시지 먼저 생성 (상품 정보, 참고 이미지 포함)
        const detailsMessage = {
          role: "vendor",
          content: bidData.vendorMessage || "", // 메시지 내용
          timestamp: new Date(), // 현재 시간
          price: bidData.price, // 입찰 가격
          products: bidData.selectedProducts, // 상품 정보
          referenceImages: bidData.referenceImages || [], // 참고 이미지
          imageUrl: bidData.referenceImages && bidData.referenceImages.length > 0 ? bidData.referenceImages[0] : null,
          vendorId: updatedBid.vendorId, // 판매자 ID
          vendorName: vendorInfo?.name || "판매자", // 판매자 이름
          vendorColor: "bg-slate-50", // 판매자 색상
          storeName: vendorInfo?.storeName || "식물 가게", // 상점 이름
        };

        // 먼저 상세 정보 메시지 추가 (bidded 상태일 때만)
        let updatedMessages = [...existingMessages];

        // 1. bidded 상태인 경우 - 두 메시지 모두 추가 (상세 메시지 + 완료 메시지)
        if (bidData.status === 'bidded') {
          // 선택된 상품 정보와 메시지가 있는 경우만 상세 메시지 추가
          if (bidData.vendorMessage && bidData.vendorMessage.trim() !== '') {
            updatedMessages = [...updatedMessages, detailsMessage];
          }

          // 입찰 완료 메시지 추가 - 모든 판매자에게 일관되게 표시
          const completedMessage = {
            role: "vendor",
            content: "입찰이 완료되었습니다. 확인해 주세요.",
            timestamp: new Date(new Date().getTime() + 500), // 0.5초 후 타임스탬프
            bidStatus: "completed",
            vendorId: updatedBid.vendorId,
            vendorName: vendorInfo?.name || "판매자",
            vendorColor: "bg-slate-50",
            storeName: vendorInfo?.storeName || "식물 가게",
          };

          // 메시지 추가
          updatedMessages.push(completedMessage);
        }
        // 2. reviewing 상태인 경우 - 검토 중 메시지만 추가
        else if (bidData.status === 'reviewing') {
          // 검토 중 메시지 추가
          const reviewingMessage = {
            role: "vendor",
            content: "입찰내용을 검토중입니다",
            timestamp: new Date(),
            bidStatus: "sent",
            vendorId: updatedBid.vendorId,
            vendorName: vendorInfo?.name || "판매자",
            vendorColor: "bg-slate-50",
            storeName: vendorInfo?.storeName || "식물 가게",
          };

          // 메시지 추가 
          updatedMessages.push(reviewingMessage);
        }

        // 최종 메시지 전송
        console.log("[handleUpdateBid] 메시지 전송 시작:", {
          conversationId: updatedBid.conversationId,
          vendorId: updatedBid.vendorId,
          messageCount: updatedMessages.length,
          status: bidData.status
        });

        const patchResult = await fetch(`/api/conversations/${updatedBid.conversationId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: updatedMessages
          })
        });

        if (!patchResult.ok) {
          const errorData = await patchResult.json().catch(() => ({}));
          console.error("[handleUpdateBid] 메시지 전송 실패:", {
            status: patchResult.status,
            statusText: patchResult.statusText,
            error: errorData
          });
        } else {
          console.log("[handleUpdateBid] 메시지 전송 성공 - 메시지 개수:", updatedMessages.length);
        }
      }

      toast({
        title: "입찰 정보 업데이트 완료",
        description: bidData.status === 'bidded' ? "고객에게 입찰 내용이 전송되었습니다." : "입찰 정보가 업데이트되었습니다.",
      });

      // 이미지만 업데이트할 경우 패널 닫지 않음
      if (closePanel) {
        setSelectedBid(null);
      } else if (selectedBid) {
        // 선택된 입찰 정보 업데이트
        setSelectedBid({ ...selectedBid, ...updatedBid });
      }
    } catch (error) {
      console.error("입찰 업데이트 오류:", error);
      toast({
        title: "입찰 업데이트 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다",
        variant: "destructive"
      });
    }
  };



  // 주문 상태 업데이트 처리
  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      const orderIdNum = parseInt(orderId);
      // 주문 정보 찾기
      const orderToUpdate = orders.find(o => o.id === orderIdNum);

      if (!orderToUpdate) {
        throw new Error("주문 정보를 찾을 수 없습니다");
      }

      // API 호출 (서버는 PUT 메서드만 지원함)
      const response = await fetch(`/api/orders/${orderToUpdate.orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) throw new Error("주문 상태 업데이트에 실패했습니다");

      // 'preparing' 상태로 변경하는 경우 자동 메시지 전송만 처리
      if (status === 'preparing') {
        // 상품 준비중 메시지 자동 전송
        if (orderToUpdate.conversationId) {
          const prepareMessage = {
            role: "vendor",
            content: "안녕하세요! 주문하신 상품 준비를 시작했습니다. 궁금한 점이 있으시면 알려주세요.",
            timestamp: new Date(),
          };

          await fetch(`/api/conversations/${orderToUpdate.conversationId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: [...(conversations[orderToUpdate.conversationId]?.messages || []), prepareMessage]
            })
          });
        }

        // 다이얼로그는 표시하지 않음 - 준비중 탭에서 바로 조작 가능
      } else if (status === 'shipped' && orderToUpdate.conversationId) {
        // 배송 시작 메시지 자동 전송
        const shippingMessage = {
          role: "vendor",
          content: "🚚 안녕하세요! 주문하신 상품이 배송을 시작했습니다. 배송이 완료되면 다시 안내드리겠습니다.",
          timestamp: new Date(),
        };

        await fetch(`/api/conversations/${orderToUpdate.conversationId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [...(conversations[orderToUpdate.conversationId]?.messages || []), shippingMessage]
          })
        });
      } else if (status === 'completed' && orderToUpdate.conversationId) {
        // 주문 완료 메시지 자동 전송
        const completeMessage = {
          role: "vendor",
          content: "안녕하세요! 주문하신 상품이 배송 완료되었습니다. 상품에 문제가 있거나 궁금한 점이 있으시면 언제든지 문의해주세요.",
          timestamp: new Date(),
        };

        await fetch(`/api/conversations/${orderToUpdate.conversationId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [...(conversations[orderToUpdate.conversationId]?.messages || []), completeMessage]
          })
        });
      } else if (status === 'cancelled' && orderToUpdate.conversationId) {
        // 주문 취소 메시지 자동 전송
        const cancelMessage = {
          role: "vendor",
          content: "안녕하세요. 주문이 취소되었습니다. 문의사항이 있으시면 언제든지 알려주세요.",
          timestamp: new Date(),
        };

        await fetch(`/api/conversations/${orderToUpdate.conversationId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [...(conversations[orderToUpdate.conversationId]?.messages || []), cancelMessage]
          })
        });
      }

      // 로컬 상태 업데이트
      setOrders(prev => prev.map(o =>
        o.id === orderIdNum ? { ...o, status } : o
      ));

      if (selectedOrder?.id === orderIdNum) {
        setSelectedOrder((prev: any) => prev ? { ...prev, status } : null);
      }

      let statusText = '';
      switch (status) {
        case 'preparing':
          statusText = '준비 중';
          break;
        case 'shipped':
          statusText = '배송중';
          break;
        case 'completed':
          statusText = '완료됨';
          break;
        case 'cancelled':
          statusText = '취소됨';
          break;
        default:
          statusText = status;
      }

      toast({
        title: "주문 상태 업데이트 완료",
        description: `주문이 ${statusText} 상태로 변경되었습니다.`,
      });
    } catch (error) {
      console.error("주문 상태 업데이트 오류:", error);
      toast({
        title: "주문 상태 업데이트 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다",
        variant: "destructive"
      });
    }
  };

  // 식물 사진 및 메시지 전송 처리
  const handleSendPlantPhoto = async (data: { message: string; imageUrl?: string }) => {
    if (!preparingOrder || !preparingOrder.conversationId) {
      toast({
        title: "메시지 전송 실패",
        description: "대화가 존재하지 않습니다",
        variant: "destructive"
      });
      return;
    }

    try {
      // 메시지 객체 생성
      const photoMessage = {
        role: "vendor" as const,
        content: data.message,
        timestamp: new Date(),
        imageUrl: data.imageUrl // 이미지 URL이 있을 경우 포함
      };

      // API 호출
      const response = await fetch(`/api/conversations/${preparingOrder.conversationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...(conversations[preparingOrder.conversationId]?.messages || []), photoMessage]
        })
      });

      if (!response.ok) {
        throw new Error("메시지 전송에 실패했습니다");
      }

      // 상태 업데이트
      if (conversations[preparingOrder.conversationId]) {
        setConversations(prev => ({
          ...prev,
          [preparingOrder.conversationId]: {
            ...prev[preparingOrder.conversationId],
            messages: [...prev[preparingOrder.conversationId].messages, photoMessage]
          }
        }));
      }

      toast({
        title: "메시지 전송 완료",
        description: "식물 사진과 메시지가 성공적으로 전송되었습니다.",
      });

      // 다이얼로그 닫기
      setSendPhotoDialogOpen(false);
    } catch (error) {
      console.error("식물 사진 전송 오류:", error);
      toast({
        title: "메시지 전송 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다",
        variant: "destructive"
      });
    }
  };

  // 결제 취소 처리 함수
  const handleCancelPayment = async (order: any) => {
    if (!window.confirm("정말로 이 주문의 결제를 취소하시겠습니까?")) {
      return;
    }

    try {
      // 결제 취소 API 호출
      const response = await fetch(`/api/payments/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: order.orderId,
          reason: "판매자에 의한 취소"
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "결제 취소에 실패했습니다");
      }

      // 결제 취소 성공 시 로컬 상태 업데이트

      // 1. 주문 목록 상태 업데이트
      if (orders.length > 0) {
        setOrders(prev => prev.map(o =>
          o.orderId === order.orderId ? { ...o, status: 'cancelled' } : o
        ));
      }

      // 2. 결제 목록 상태 업데이트
      if (payments.length > 0) {
        setPayments(prev => prev.map(p =>
          p.orderId === order.orderId ? { ...p, status: 'CANCELLED' } : p
        ));
      }

      // 3. 선택된 주문이 있다면 그 상태도 업데이트
      if (selectedOrder && selectedOrder.orderId === order.orderId) {
        setSelectedOrder((prev: any) => prev ? { ...prev, status: 'cancelled' } : null);
      }

      toast({
        title: "결제 취소 완료",
        description: "결제가 성공적으로 취소되었습니다.",
      });
    } catch (error) {
      console.error("결제 취소 오류:", error);
      toast({
        title: "결제 취소 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다",
        variant: "destructive"
      });
    }
  };

  // 제품 추가 다이얼로그 열기
  const handleAddProduct = () => {
    setEditingProduct(null);
    setProductDialogOpen(true);
  };

  // 제품 수정 다이얼로그 열기
  const handleEditProduct = (product: any) => {
    setEditingProduct(product);
    setProductDialogOpen(true);
  };

  // 제품 저장 처리
  const handleSaveProduct = async (productData: any) => {
    try {
      const isNewProduct = !editingProduct;
      const method = isNewProduct ? 'POST' : 'PUT';
      const url = isNewProduct ? '/api/products' : `/api/products/${editingProduct?.id}`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData)
      });

      if (!response.ok) {
        throw new Error("제품 저장에 실패했습니다");
      }

      const savedProduct = await response.json();

      // 로컬 상태 업데이트
      if (isNewProduct) {
        setProducts(prev => [...prev, savedProduct]);
      } else {
        setProducts(prev => prev.map(p =>
          p.id === editingProduct?.id ? { ...p, ...savedProduct } : p
        ));
      }

      // 대화상자 닫기 및 상태 초기화
      setProductDialogOpen(false);
      setEditingProduct(null);

      toast({
        title: `제품 ${isNewProduct ? '추가' : '업데이트'} 완료`,
        description: `${savedProduct.name} 제품이 성공적으로 ${isNewProduct ? '추가' : '업데이트'}되었습니다.`,
      });
    } catch (error) {
      console.error("제품 저장 오류:", error);
      toast({
        title: "제품 저장 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다",
        variant: "destructive"
      });
    }
  };

  // 제품 삭제 처리
  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("정말로 이 제품을 삭제하시겠습니까?")) {
      return;
    }

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error("제품 삭제에 실패했습니다");
      }

      // 로컬 상태 업데이트
      setProducts(prev => prev.filter(p => p.id !== productId));

      toast({
        title: "제품 삭제 완료",
        description: "제품이 성공적으로 삭제되었습니다.",
      });
    } catch (error) {
      console.error("제품 삭제 오류:", error);
      toast({
        title: "제품 삭제 실패",
        description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다",
        variant: "destructive"
      });
    }
  };

  // 판매자 주문 데이터 필터링
  const filteredOrders = useMemo(() => {
    if (!orders || orders.length === 0) return [];

    return orders.filter((order: any) => {
      // 검색어가 없으면 모든 주문 표시
      if (!searchTerm.trim()) return true;

      // 소문자로 변환하여 비교
      const term = searchTerm.toLowerCase();

      // 주문 ID, 고객 정보, 상태 등으로 검색
      return (
        (order.orderId && order.orderId.toLowerCase().includes(term)) ||
        (order.buyerInfo && JSON.stringify(order.buyerInfo).toLowerCase().includes(term)) ||
        (order.status && order.status.toLowerCase().includes(term)) ||
        (order.price && order.price.toString().includes(term))
      );
    });
  }, [orders, searchTerm]);

  // 결제 내역을 결제 완료 목록에 통합
  const ordersWithPayments = useMemo(() => {
    const result = [...filteredOrders];

    // 결제 내역 추가 (orders에 없는 결제만)
    if (payments && payments.length > 0) {
      // 성공/완료 상태의 결제만 필터링
      const completedPayments = payments.filter(payment =>
        payment.status === 'success' ||
        payment.status === 'COMPLETED' ||
        payment.status === 'paid'
      );

      console.log('결제완료 탭에 표시할 결제 데이터:', completedPayments);

      // 특정 케이스 확인 - 판매자 ID 5의 결제 정보
      // 해당 연결 정보 확인
      const vendorSpecificMappings: Record<string, any> = {
        // 결제 orderId를 키로, 올바른 식물 정보 매핑
        'pay_eXApXwysi7dSoK4_EwjlJS': {
          plantName: '몬스테라',
          price: '1000',
          customerName: '박근수',
          customerPhone: '01077274374',
          shippingAddress: '서울특별시 강남구 테헤란로 427 위워크 타워 10층'
        }
      };

      // 입찰 정보 모음
      const bidInfoMap = bids.reduce((acc, bid) => {
        acc[bid.id] = bid;
        return acc;
      }, {} as Record<number, any>);

      // 결제 내역과 연결된 입찰 ID 및 상세 정보 로깅
      completedPayments.forEach(payment => {
        const specificMapping = vendorSpecificMappings[payment.orderId];

        if (specificMapping) {
          console.log(`결제 ID ${payment.id}에 대한 특정 매핑 정보 발견:`, specificMapping);
        }

        if (payment.bidId) {
          const bidInfo = bidInfoMap[payment.bidId];
          console.log(`결제 ID ${payment.id}와 연결된 입찰 정보:`, {
            bidId: payment.bidId,
            plantName: bidInfo?.plant?.name || '식물 정보 없음',
            customerName: bidInfo?.user?.name || '고객 정보 없음',
            customerPhone: bidInfo?.user?.phone || '연락처 없음'
          });
        }
      });

      // 각 결제 데이터를 orders 형식으로 변환
      completedPayments.forEach(payment => {
        // 이미 주문 목록에 있는지 확인
        const exists = result.some(order =>
          order.orderId === payment.orderId ||
          order.id === payment.orderId
        );

        // 주문 목록에 없는 결제만 추가
        if (!exists) {
          // 특정 결제에 대한 매핑 정보 확인
          const specificMapping = vendorSpecificMappings[payment.orderId];

          // 연관된 입찰 정보 가져오기
          const relatedBid = payment.bidId ? bidInfoMap[payment.bidId] : null;

          // 연결된 사용자 정보 가져오기
          const userInfo = relatedBid?.user || null;

          // 결제 데이터를 주문 형식으로 변환 (핵심 정보 직접 연결)
          // 기존 주문 목록에서 현재 결제와 일치하는 주문 검색 (ID로 찾기)
          const existingOrder = filteredOrders.find(
            order => order.id.toString() === payment.id.toString() ||
              order.orderId === payment.orderId
          );

          result.push({
            id: payment.id,
            orderId: payment.orderId,
            bidId: payment.bidId, // 중요: bidId 추가
            // 이미 있는 주문의 상태를 유지하거나 없으면 'paid'로 설정
            status: existingOrder ? existingOrder.status : 'paid',
            createdAt: payment.createdAt || payment.approvedAt || new Date(),
            // 특정 매핑 정보가 있으면 해당 정보 사용, 없으면 기존 로직 유지
            price: specificMapping ?
              parseInt(specificMapping.price) :
              (payment.amount || (relatedBid?.price) || 0),
            productName: specificMapping ?
              specificMapping.plantName :
              (payment.orderName || payment.productName || (relatedBid?.plant?.name) || '상품 정보 없음'),
            buyerInfo: {
              name: specificMapping ?
                specificMapping.customerName :
                (payment.customerName || (userInfo?.name) || '고객 정보 없음'),
              phone: specificMapping ?
                specificMapping.customerPhone :
                (payment.customerPhone || (userInfo?.phone) || '연락처 정보 없음'),
              address: specificMapping ?
                specificMapping.shippingAddress :
                (payment.shippingAddress || '배송 정보 없음'),
              email: payment.customerEmail || (userInfo?.email) || '이메일 정보 없음'
            },
            shippingInfo: {
              address: specificMapping ?
                specificMapping.shippingAddress :
                (payment.shippingAddress || '배송지 정보 없음'),
              message: payment.shippingMessage || '배송 메시지 없음'
            },
            vendorId: payment.vendorId,
            conversationId: payment.conversationId || (relatedBid?.conversationId) || null,
            paymentId: payment.paymentKey || payment.id,
            // 결제 관련 추가 정보
            paymentInfo: {
              method: payment.method || '결제 수단 정보 없음',
              approvedAt: payment.approvedAt || payment.createdAt,
              receipt: payment.receipt || null
            },
            // 입찰 관련 정보 추가
            bidInfo: relatedBid ? {
              id: relatedBid.id,
              plant: relatedBid.plant,
              price: specificMapping ?
                parseInt(specificMapping.price) :
                relatedBid.price,
              status: relatedBid.status,
              userId: relatedBid.userId,
              user: relatedBid.user
            } : null,
            // 결제 데이터임을 표시하는 플래그
            isFromPayment: true
          });
        }
      });
    }

    return result;
  }, [filteredOrders, payments, bids]);

  // 판매자 입찰 데이터 필터링
  const filteredBids = useMemo(() => {
    if (!bids || bids.length === 0) return [];

    return bids.filter((bid: any) => {
      // 검색어가 없으면 모든 입찰 표시
      if (!searchTerm.trim()) return true;

      // 소문자로 변환하여 비교
      const term = searchTerm.toLowerCase();

      // 입찰 ID, 고객 정보, 상태 등으로 검색
      return (
        (bid.id && bid.id.toString().includes(term)) ||
        (bid.user && JSON.stringify(bid.user).toLowerCase().includes(term)) ||
        (bid.status && bid.status.toLowerCase().includes(term)) ||
        (bid.price && bid.price.toString().includes(term))
      );
    });
  }, [bids, searchTerm]);

  // 대화 보기 전환
  const handleToggleConversation = (value: boolean) => {
    setShowConversation(value);
  };

  // 인증되지 않은 사용자 리디렉션
  if (!user) {
    return <Redirect to="/auth" />;
  }

  // 사용자가 판매자 역할이 아닌 경우 리디렉션
  if (user.role !== 'vendor') {
    return <Redirect to="/" />;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="py-4 px-6 border-b bg-background sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary">
            <Store className="h-5 w-5" />
            판매자 대시보드
          </Link>
          {location && (
            <div className="ml-6 flex items-center text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mr-1" />
              {location.address || '위치 정보 없음'}
              {location.isExact ? '' : ' (주변 지역)'}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            안녕하세요, {userName}님
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="gap-1"
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </Button>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        <Tabs defaultValue="bids" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="bids">입찰 요청 <span className="ml-2 px-1.5 py-0.5 text-xs bg-muted rounded">{bids.filter(bid => bid.status === 'pending').length}</span></TabsTrigger>
              <TabsTrigger value="direct">직접 판매 <span className="ml-2 px-1.5 py-0.5 text-xs bg-muted rounded">{directOrders.length}</span></TabsTrigger>
              <TabsTrigger value="paid">결제 완료 <span className="ml-2 px-1.5 py-0.5 text-xs bg-muted rounded">{ordersWithPayments.filter(order => order.status === 'paid').length}</span></TabsTrigger>
              <TabsTrigger value="preparing">상품 준비 중 <span className="ml-2 px-1.5 py-0.5 text-xs bg-muted rounded">{orders.filter(order => order.status === 'preparing').length}</span></TabsTrigger>
              <TabsTrigger value="shipped">배송중 <span className="ml-2 px-1.5 py-0.5 text-xs bg-muted rounded">{orders.filter(order => order.status === 'shipped').length}</span></TabsTrigger>
              <TabsTrigger value="completed">완료 <span className="ml-2 px-1.5 py-0.5 text-xs bg-muted rounded">{orders.filter(order => order.status === 'completed').length}</span></TabsTrigger>
              <TabsTrigger value="payments">결제 내역 <span className="ml-2 px-1.5 py-0.5 text-xs bg-muted rounded">{payments.length}</span></TabsTrigger>
              <TabsTrigger value="products">상품 관리</TabsTrigger>
              <TabsTrigger value="settings">설정</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="검색..."
                  className="w-[200px] pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-[1.2rem] w-[1.2rem]" />
              </Button>
            </div>
          </div>

          {showFilters && (
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="mb-2 block">상태 필터</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="모든 상태" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">모든 상태</SelectItem>
                        <SelectItem value="pending">대기 중</SelectItem>
                        <SelectItem value="paid">결제 완료</SelectItem>
                        <SelectItem value="preparing">준비 중</SelectItem>
                        <SelectItem value="completed">완료</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-2 block">정렬 기준</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="최신순" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">최신순</SelectItem>
                        <SelectItem value="oldest">오래된순</SelectItem>
                        <SelectItem value="price_high">가격 높은순</SelectItem>
                        <SelectItem value="price_low">가격 낮은순</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-2 block">기간</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="모든 기간" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">모든 기간</SelectItem>
                        <SelectItem value="today">오늘</SelectItem>
                        <SelectItem value="week">이번 주</SelectItem>
                        <SelectItem value="month">이번 달</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 입찰 요청 탭 */}
          <TabsContent value="bids" className="space-y-4">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredBids.filter(bid => bid.status === 'pending' || bid.status === 'reviewing' || bid.status === 'bidded').length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-3 mb-4">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-lg mb-2">입찰 요청 없음</h3>
                  <p className="text-muted-foreground max-w-md">
                    현재 처리할 입찰 요청이 없습니다. 새로운 입찰 요청이 들어오면 이곳에 표시됩니다.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredBids
                  .filter(bid => bid.status === 'pending' || bid.status === 'reviewing' || bid.status === 'bidded')
                  .map(bid => (
                    <div key={bid.id}>
                      <Card
                        className={`
                          ${selectedBid?.id === bid.id ? "border-primary" : ""}
                          ${bid.status === 'completed' || bid.status === 'bidded' ? "bg-green-50 border-green-200" :
                            bid.status === 'reviewing' ? "bg-yellow-50 border-yellow-200" :
                              "bg-card"}
                          cursor-pointer hover:bg-muted/50 transition-colors
                        `}
                        onClick={() => handleBidClick(bid)}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">
                                  {bid.plant?.name || "식물 이름 정보 없음"}
                                </span>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${bid.status === 'completed' || bid.status === 'bidded' ? 'bg-green-50 text-green-600 border-green-200' :
                                    bid.status === 'reviewing' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : ''}`}
                                >
                                  {bid.status === 'completed' ? '완료됨' :
                                    bid.status === 'bidded' ? '입찰 완료' :
                                      bid.status === 'reviewing' ? '검토 중' :
                                        `입찰 #${bid.id}`}
                                </Badge>
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {bid.user?.name || "사용자 정보 없음"}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(bid.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* 입찰 상태 표시 Badge */}
                              <div className="flex items-center mr-2">
                                <Badge variant={
                                  bid.status === 'completed' ? 'outline' :
                                    bid.status === 'reviewing' ? 'secondary' : 'default'
                                } className="px-2 py-1">
                                  {bid.status === 'completed' ? '완료' :
                                    bid.status === 'reviewing' ? '검토중' : '검토 필요'}
                                </Badge>
                              </div>

                              <div>
                                <ChevronRight className={`h-5 w-5 transition-transform ${selectedBid?.id === bid.id ? "rotate-90" : ""}`} />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* 확장 패널 */}
                      {selectedBid?.id === bid.id && (
                        <Card className="mt-1 border-t-0 rounded-t-none p-4 border-primary bg-primary/5 shadow-sm">
                          <CardContent className="p-0">
                            <BidDetailsSidePanel
                              bid={selectedBid}
                              onUpdateBid={handleUpdateBid}
                              products={products}
                            />
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>

          {/* 직접 판매 탭 */}
          <TabsContent value="direct" className="space-y-4">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : directOrders.filter(order => order.status === 'paid').length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-3 mb-4">
                    <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-lg mb-2">실결제된 주문 없음</h3>
                  <p className="text-muted-foreground max-w-md">
                    현재 실결제가 완료된 직접 판매 주문이 없습니다. 고객이 결제를 완료하면 이곳에 표시됩니다.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {directOrders.filter(order => order.status === 'paid').map(order => (
                  <Card key={order.id} className={selectedOrder?.id === order.id ? "border-primary" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            주문 #{order.orderId || order.id}
                            <Badge variant="default" className="bg-blue-600 text-white font-medium">
                              <OrderStatusBadge status={order.status} />
                            </Badge>
                          </CardTitle>
                          <CardDescription className="text-sm mt-1">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleOrderClick(order)}
                            className="h-7 w-7"
                          >
                            <PlusCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3 text-sm">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            <span>고객:</span>
                          </div>
                          <span className="font-medium">
                            {order.buyerInfo?.name || "이름 정보 없음"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            <span>연락처:</span>
                          </div>
                          <span className="font-medium">
                            {order.buyerInfo?.phone || "연락처 정보 없음"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <DollarSign className="h-3.5 w-3.5" />
                            <span>금액:</span>
                          </div>
                          <span className="font-medium">
                            {order.price ? Number(order.price).toLocaleString() + '원' : "가격 정보 없음"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Package className="h-3.5 w-3.5" />
                            <span>상품:</span>
                          </div>
                          <span className="font-medium">
                            {order.productName || "상품 정보 없음"}
                          </span>
                        </div>

                        {(order.buyerInfo?.address || order.recipientInfo?.address) && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>배송지:</span>
                            </div>
                            <span className="font-medium truncate max-w-[180px]">
                              {order.recipientInfo?.address || order.buyerInfo?.address}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-dashed flex justify-between items-center">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleUpdateOrderStatus(order.id.toString(), 'preparing')}
                            className="gap-1 h-8"
                            disabled={order.status === 'preparing' || order.status === 'shipping' || order.status === 'delivered'}
                          >
                            <Truck className="h-3.5 w-3.5" />
                            준비
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOrderClick(order)}
                          className="h-8 text-xs"
                        >
                          <MessageSquare className="h-3.5 w-3.5 mr-1" />
                          상세
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 결제 완료 탭 */}
          <TabsContent value="paid" className="space-y-4">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : ordersWithPayments.filter(order => order.status === 'paid').length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-3 mb-4">
                    <DollarSign className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-lg mb-2">결제 완료된 주문 없음</h3>
                  <p className="text-muted-foreground max-w-md">
                    현재 결제가 완료된 주문이 없습니다. 고객이 결제를 완료하면 이곳에 표시됩니다.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ordersWithPayments
                  .filter(order => order.status === 'paid')
                  .map(order => (
                    <Card key={order.id} className={selectedOrder?.id === order.id ? "border-primary" : ""}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              주문 #{order.orderId || order.id}
                              <Badge variant="default" className="bg-primary text-white font-medium">
                                <OrderStatusBadge status={order.status} />
                              </Badge>
                            </CardTitle>
                            <CardDescription className="text-sm mt-1">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleOrderClick(order)}
                              className="h-7 w-7"
                            >
                              <PlusCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-3 text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <User className="h-3.5 w-3.5" />
                              <span>고객:</span>
                            </div>
                            <span className="font-medium">
                              {order.buyerInfo?.name ||
                                (order.isFromPayment && order.bidInfo?.userId ?
                                  bids.find(b => b.id === order.bidInfo.id)?.user?.name :
                                  "이름 정보 없음")}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              <span>연락처:</span>
                            </div>
                            <span className="font-medium">
                              {order.buyerInfo?.phone ||
                                (order.isFromPayment && order.bidInfo?.userId ?
                                  bids.find(b => b.id === order.bidInfo.id)?.user?.phone :
                                  "연락처 정보 없음")}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <DollarSign className="h-3.5 w-3.5" />
                              <span>금액:</span>
                            </div>
                            <span className="font-medium">
                              {order.price ?
                                Number(order.price).toLocaleString() + '원' :
                                (order.bidInfo?.price ?
                                  Number(order.bidInfo.price).toLocaleString() + '원' :
                                  "가격 정보 없음")}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Package className="h-3.5 w-3.5" />
                              <span>상품:</span>
                            </div>
                            <span className="font-medium">
                              {order.productName ||
                                (order.bidInfo?.plant?.name) ||
                                "상품 정보 없음"}
                            </span>
                          </div>

                          {(order.buyerInfo?.address || order.shippingInfo?.address) && (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5" />
                                <span>배송지:</span>
                              </div>
                              <span className="font-medium truncate max-w-[180px]">
                                {order.recipientInfo?.address || order.buyerInfo?.address}
                              </span>
                            </div>
                          )}

                          {order.paymentId && (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <CreditCard className="h-3.5 w-3.5" />
                                <span>결제 ID:</span>
                              </div>
                              <span className="font-medium text-xs truncate max-w-[180px]">
                                {order.paymentId}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-dashed flex justify-between items-center">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleUpdateOrderStatus(order.id.toString(), 'preparing')}
                              className="gap-1 h-8"
                            >
                              <Package className="h-3.5 w-3.5" />
                              상품 준비 시작
                            </Button>

                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleCancelPayment(order)}
                              className="gap-1 h-8"
                              // 상품 준비 중이면 취소 버튼 비활성화
                              disabled={order.status === 'preparing'}
                            >
                              <X className="h-3.5 w-3.5" />
                              결제 취소
                            </Button>
                          </div>

                          {order.conversationId && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                handleOrderClick(order);
                                setShowConversation(true);
                              }}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>

          {/* 상품 준비 중 탭 */}
          <TabsContent value="preparing" className="space-y-4">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredOrders.filter(order => order.status === 'preparing').length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-3 mb-4">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-lg mb-2">준비 중인 주문 없음</h3>
                  <p className="text-muted-foreground max-w-md">
                    현재 준비 중인 주문이 없습니다. 상품 준비가 시작되면 이곳에 표시됩니다.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders
                  .filter(order => order.status === 'preparing')
                  .map(order => (
                    <Card key={order.id} className={selectedOrder?.id === order.id ? "border-primary" : ""}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              주문 #{order.orderId || order.id}
                              <Badge variant="default" className="bg-primary text-white font-medium">
                                <OrderStatusBadge status={order.status} />
                              </Badge>
                            </CardTitle>
                            <CardDescription className="text-sm mt-1">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleOrderClick(order)}
                              className="h-7 w-7"
                            >
                              <PlusCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-3 text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <User className="h-3.5 w-3.5" />
                              <span>고객:</span>
                            </div>
                            <span className="font-medium">{order.buyerInfo?.name || "이름 정보 없음"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>배송지:</span>
                            </div>
                            <span className="font-medium truncate max-w-[150px]" title={order.shippingInfo?.address || "주소 정보 없음"}>
                              {order.shippingInfo?.address || "주소 정보 없음"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              <span>연락처:</span>
                            </div>
                            <span className="font-medium">
                              {order.buyerInfo?.phone || "연락처 정보 없음"}
                            </span>
                          </div>
                        </div>

                        {/* 고객 대화 버튼 */}
                        {order.conversationId && (
                          <div className="mt-4 pt-3 border-t border-dashed">
                            <div className="flex justify-center gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                className="gap-1"
                                onClick={() => {
                                  // 사진과 메시지 전송 다이얼로그 열기
                                  setPreparingOrder(order);
                                  setSendPhotoDialogOpen(true);
                                }}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                고객에게 메시지 보내기
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                onClick={async () => {
                                  try {
                                    const result = await createDirectChatMutation.mutateAsync({
                                      vendorId: vendorProfile?.id || 0,
                                      customerId: order.userId,
                                      orderId: order.orderId,
                                      conversationId: order.conversationId,
                                    });
                                    setDirectChatId(result.id);
                                    setIsDirectChatOpen(true);
                                  } catch (error) {
                                    toast({
                                      title: "채팅방 생성 실패",
                                      description: "잠시 후 다시 시도해주세요.",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                disabled={createDirectChatMutation.isPending}
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                직접 대화
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="mt-4 pt-3 border-t border-dashed flex justify-between items-center">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleUpdateOrderStatus(order.id.toString(), 'shipped')}
                            className="gap-1 h-8"
                          >
                            <Truck className="h-3.5 w-3.5" />
                            배송 시작
                          </Button>

                          {order.conversationId && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                handleOrderClick(order);
                                setShowConversation(true);
                              }}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>

          {/* 배송중 탭 */}
          <TabsContent value="shipped" className="space-y-4">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredOrders.filter(order => order.status === 'shipped').length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-3 mb-4">
                    <Truck className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-lg mb-2">배송중인 주문 없음</h3>
                  <p className="text-muted-foreground max-w-md">
                    현재 배송중인 주문이 없습니다. 배송이 시작되면 이곳에 표시됩니다.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders
                  .filter(order => order.status === 'shipped')
                  .map(order => (
                    <Card key={order.id} className={selectedOrder?.id === order.id ? "border-primary" : ""}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              주문 #{order.orderId || order.id}
                              <Badge variant="default" className="bg-blue-500 text-white font-medium">
                                🚚 배송중
                              </Badge>
                            </CardTitle>
                            <CardDescription className="text-sm mt-1">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleOrderClick(order)}
                              className="h-7 w-7"
                            >
                              <PlusCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-3 text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <User className="h-3.5 w-3.5" />
                              <span>고객:</span>
                            </div>
                            <span className="font-medium">{order.buyerInfo?.name || "이름 정보 없음"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              <span>배송지:</span>
                            </div>
                            <span className="font-medium truncate max-w-[150px]" title={order.shippingInfo?.address || "주소 정보 없음"}>
                              {order.shippingInfo?.address || "주소 정보 없음"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="h-3.5 w-3.5" />
                              <span>연락처:</span>
                            </div>
                            <span className="font-medium">
                              {order.buyerInfo?.phone || "연락처 정보 없음"}
                            </span>
                          </div>
                        </div>

                        {/* 고객 대화 버튼 */}
                        {order.conversationId && (
                          <div className="mt-4 pt-3 border-t border-dashed">
                            <div className="flex justify-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                onClick={() => {
                                  setPreparingOrder(order);
                                  setSendPhotoDialogOpen(true);
                                }}
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                고객에게 메시지 보내기
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                onClick={async () => {
                                  try {
                                    const result = await createDirectChatMutation.mutateAsync({
                                      vendorId: vendorProfile?.id || 0,
                                      customerId: order.userId,
                                      orderId: order.orderId,
                                      conversationId: order.conversationId,
                                    });
                                    setDirectChatId(result.id);
                                    setIsDirectChatOpen(true);
                                  } catch (error) {
                                    toast({
                                      title: "채팅방 생성 실패",
                                      description: "잠시 후 다시 시도해주세요.",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                disabled={createDirectChatMutation.isPending}
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                직접 대화
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="mt-4 pt-3 border-t border-dashed flex justify-between items-center">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleUpdateOrderStatus(order.id.toString(), 'completed')}
                            className="gap-1 h-8 bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            배송 완료
                          </Button>

                          {order.conversationId && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                handleOrderClick(order);
                                setShowConversation(true);
                              }}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>

          {/* 완료 탭 */}
          <TabsContent value="completed" className="space-y-4">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredOrders.filter(order => order.status === 'completed').length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-3 mb-4">
                    <CheckCircle className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-lg mb-2">완료된 주문 없음</h3>
                  <p className="text-muted-foreground max-w-md">
                    현재 완료된 주문이 없습니다. 주문이 완료되면 이곳에 표시됩니다.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders
                  .filter(order => order.status === 'completed')
                  .map(order => (
                    <Card key={order.id} className={selectedOrder?.id === order.id ? "border-primary" : ""}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              주문 #{order.orderId || order.id}
                              <Badge variant="default" className="bg-primary text-white font-medium">
                                <OrderStatusBadge status={order.status} />
                              </Badge>
                            </CardTitle>
                            <CardDescription className="text-sm mt-1">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </CardDescription>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleOrderClick(order)}
                              className="h-7 w-7"
                            >
                              <PlusCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-3 text-sm">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <User className="h-3.5 w-3.5" />
                              <span>고객:</span>
                            </div>
                            <span className="font-medium">{order.buyerInfo?.name || "이름 정보 없음"}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <DollarSign className="h-3.5 w-3.5" />
                              <span>금액:</span>
                            </div>
                            <span className="font-medium">{Number(order.price).toLocaleString()}원</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              <span>완료일:</span>
                            </div>
                            <span className="font-medium">
                              {order.trackingInfo?.completedAt
                                ? new Date(order.trackingInfo.completedAt).toLocaleDateString()
                                : (order.updatedAt ? new Date(order.updatedAt).toLocaleDateString() : "완료일 정보 없음")}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-dashed flex justify-end items-center">
                          {order.conversationId && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => {
                                handleOrderClick(order);
                                setShowConversation(true);
                              }}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </TabsContent>

          {/* 결제 내역 탭 */}
          <TabsContent value="payments" className="space-y-4">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : payments.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-3 mb-4">
                    <CircleDollarSign className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-lg mb-2">결제 내역 없음</h3>
                  <p className="text-muted-foreground max-w-md">
                    현재 조회 가능한 결제 내역이 없습니다. 고객이 결제를 완료하면 이곳에 표시됩니다.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">결제 내역</CardTitle>
                    <CardDescription>
                      고객들의 결제 내역을 확인하고 관리하세요
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="py-3 px-4 text-left font-medium">주문번호</th>
                            <th className="py-3 px-4 text-left font-medium">결제일</th>
                            <th className="py-3 px-4 text-left font-medium">고객</th>
                            <th className="py-3 px-4 text-right font-medium">금액</th>
                            <th className="py-3 px-4 text-center font-medium">상태</th>
                            <th className="py-3 px-4 text-center font-medium">취소</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map((payment) => (
                            <tr key={payment.id} className="border-b hover:bg-muted/30">
                              <td className="py-3 px-4 font-mono text-xs">
                                {payment.orderId ? payment.orderId.substring(0, 12) + '...' : '번호 없음'}
                              </td>
                              <td className="py-3 px-4 text-muted-foreground">
                                {payment.approvedAt ?
                                  new Date(payment.approvedAt).toLocaleDateString() + ' ' +
                                  new Date(payment.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  :
                                  new Date(payment.createdAt).toLocaleDateString()
                                }
                              </td>
                              <td className="py-3 px-4">
                                {payment.customerName || '이름 없음'}
                              </td>
                              <td className="py-3 px-4 text-right font-medium">
                                {Number(payment.amount).toLocaleString()}원
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Badge
                                  variant={
                                    payment.status === 'success' || payment.status === 'paid' || payment.status === 'COMPLETED' ? 'default' :
                                      payment.status === 'cancel' || payment.status === 'CANCELLED' || payment.status === 'CANCELED' ? 'destructive' :
                                        payment.status === 'ready' || payment.status === 'pending' || payment.status === 'READY' ? 'secondary' :
                                          'outline'
                                  }
                                >
                                  {payment.status === 'success' || payment.status === 'paid' || payment.status === 'COMPLETED' ? '결제완료' :
                                    payment.status === 'cancel' || payment.status === 'CANCELLED' || payment.status === 'CANCELED' ? '취소됨' :
                                      payment.status === 'ready' || payment.status === 'READY' ? '준비중' :
                                        payment.status === 'pending' ? '처리중' :
                                          payment.status}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {(payment.status === 'success' || payment.status === 'paid' || payment.status === 'COMPLETED') && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-destructive"
                                    onClick={() => handleCancelPayment({ orderId: payment.orderId })}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* 프로필 관리 탭 */}
          <TabsContent value="profile" className="space-y-4">
            <Card className="border-0 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-green-600" />
                  프로필 정보
                </CardTitle>
                <CardDescription>
                  고객에게 표시되는 프로필 정보를 관리합니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="storeName" className="font-semibold">상호명</Label>
                    <Input
                      id="storeName"
                      placeholder="가게 이름을 입력하세요"
                      value={vendorProfile?.storeName || ''}
                      onChange={(e) => setVendorProfile(prev => prev ? { ...prev, storeName: e.target.value } : null)}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className="font-semibold">소개글</Label>
                    <Textarea
                      id="description"
                      placeholder="판매자 소개를 입력하세요 (고객들이 볼 내용)"
                      className="min-h-[120px] resize-none"
                      value={vendorProfile?.description || ''}
                      onChange={(e) => setVendorProfile(prev => prev ? { ...prev, description: e.target.value } : null)}
                    />
                    <p className="text-xs text-gray-500">최대 500자까지 입력 가능합니다</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="font-semibold">연락처</Label>
                      <Input
                        id="phone"
                        placeholder="010-XXXX-XXXX"
                        value={vendorProfile?.phone || ''}
                        onChange={(e) => setVendorProfile(prev => prev ? { ...prev, phone: e.target.value } : null)}
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address" className="font-semibold">위치</Label>
                      <Input
                        id="address"
                        placeholder="서울시 강남구..."
                        value={vendorProfile?.address || ''}
                        onChange={(e) => setVendorProfile(prev => prev ? { ...prev, address: e.target.value } : null)}
                        className="h-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profileImage" className="font-semibold">프로필 사진</Label>
                    <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                      <div className="w-20 h-20 rounded-full bg-white border-2 border-green-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {profileImagePreview ? (
                          <img
                            src={profileImagePreview}
                            alt="프로필"
                            className="w-full h-full object-cover"
                          />
                        ) : vendorProfile?.profileImageUrl ? (
                          <img
                            src={vendorProfile.profileImageUrl}
                            alt="프로필"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Store className="w-10 h-10 text-green-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id="profile-image-upload"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setProfileImageFile(file);
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setProfileImagePreview(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('profile-image-upload')?.click()}
                          className="w-full"
                        >
                          <ImagePlus className="w-4 h-4 mr-2" />
                          사진 변경
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setProfileImageFile(null);
                      setProfileImagePreview(null);
                    }}
                  >
                    취소
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={async () => {
                      if (!vendorProfile) return;
                      try {
                        const formData = new FormData();
                        formData.append('storeName', vendorProfile.storeName);
                        formData.append('description', vendorProfile.description);
                        formData.append('phone', vendorProfile.phone);
                        formData.append('address', vendorProfile.address);
                        if (profileImageFile) {
                          formData.append('profileImage', profileImageFile);
                        }
                        const response = await fetch('/api/vendors/profile', {
                          method: 'PATCH',
                          body: formData
                        });
                        if (response.ok) {
                          toast({
                            title: "성공",
                            description: "프로필이 업데이트되었습니다",
                          });
                          setProfileImageFile(null);
                          setProfileImagePreview(null);
                        } else {
                          toast({
                            title: "오류",
                            description: "프로필 업데이트 중 오류가 발생했습니다",
                            variant: "destructive",
                          });
                        }
                      } catch (error) {
                        toast({
                          title: "오류",
                          description: "프로필 업데이트 중 오류가 발생했습니다",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    저장하기
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 상품 관리 탭 */}
          <TabsContent value="products" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium">상품 관리</h2>
              <Button onClick={handleAddProduct} className="gap-1">
                <Plus className="h-4 w-4" />
                상품 추가
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : products.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-3 mb-4">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-lg mb-2">등록된 상품 없음</h3>
                  <p className="text-muted-foreground max-w-md mb-6">
                    현재 등록된 상품이 없습니다. '상품 추가' 버튼을 클릭하여 새 상품을 등록해보세요.
                  </p>
                  <Button onClick={handleAddProduct} className="gap-1">
                    <Plus className="h-4 w-4" />
                    상품 추가
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map(product => (
                  <Card key={product.id}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">
                          {product.name}
                        </CardTitle>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditProduct(product)}
                            className="h-7 w-7"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteProduct(product.id)}
                            className="h-7 w-7 text-destructive"
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {product.imageUrl && (
                      <CardContent className="pt-0 pb-2">
                        <div className="overflow-hidden rounded-md aspect-video">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="object-cover w-full h-full"
                          />
                        </div>
                      </CardContent>
                    )}
                    <CardContent className="py-2 text-sm">
                      <p className="text-muted-foreground line-clamp-2">
                        {product.description || "상품 설명 없음"}
                      </p>
                      <div className="mt-2 font-medium">
                        {Number(product.price).toLocaleString()}원
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 설정 탭 */}
          <TabsContent value="settings" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium">설정</h2>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>프로필 사진</CardTitle>
                <CardDescription>
                  고객에게 표시되는 프로필 사진을 설정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center overflow-hidden border-2 border-green-200">
                      {profileImagePreview ? (
                        <img
                          src={profileImagePreview}
                          alt="프로필"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Store className="w-10 h-10 text-green-300" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="profile-image-upload"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setProfileImageFile(file);
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setProfileImagePreview(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      data-testid="input-profile-image"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('profile-image-upload')?.click()}
                      data-testid="button-upload-profile-image"
                    >
                      <ImagePlus className="w-4 h-4 mr-2" />
                      사진 변경
                    </Button>
                    {profileImagePreview && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => {
                          setProfileImageFile(null);
                          setProfileImagePreview(null);
                        }}
                        data-testid="button-remove-profile-image"
                      >
                        <X className="w-4 h-4 mr-1" />
                        삭제
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>판매자 정보</CardTitle>
                <CardDescription>
                  고객에게 표시되는 정보를 관리합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vendorStoreName">상호명</Label>
                  <Input
                    id="vendorStoreName"
                    placeholder="상호명을 입력하세요"
                    value={vendorProfile?.storeName || ''}
                    onChange={(e) => setVendorProfile(prev => prev ? { ...prev, storeName: e.target.value } : null)}
                    data-testid="input-vendor-store-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendorDescription">소개</Label>
                  <Textarea
                    id="vendorDescription"
                    placeholder="판매자 소개를 입력하세요"
                    className="min-h-[100px]"
                    value={vendorProfile?.description || ''}
                    onChange={(e) => setVendorProfile(prev => prev ? { ...prev, description: e.target.value } : null)}
                    data-testid="input-vendor-description"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vendorPhone">연락처</Label>
                    <Input
                      id="vendorPhone"
                      placeholder="연락처를 입력하세요"
                      value={vendorProfile?.phone || ''}
                      onChange={(e) => setVendorProfile(prev => prev ? { ...prev, phone: e.target.value } : null)}
                      data-testid="input-vendor-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vendorRegion">지역</Label>
                    <Input
                      id="vendorRegion"
                      placeholder="지역 (예: 서울, 경기)"
                      value={vendorProfile?.region || ''}
                      onChange={(e) => setVendorProfile(prev => prev ? { ...prev, region: e.target.value } : null)}
                      data-testid="input-vendor-region"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendorAddress">주소</Label>
                  <Input
                    id="vendorAddress"
                    placeholder="상세 주소를 입력하세요"
                    value={vendorProfile?.address || ''}
                    onChange={(e) => setVendorProfile(prev => prev ? { ...prev, address: e.target.value } : null)}
                    data-testid="input-vendor-address"
                  />
                </div>
                <div className="pt-4">
                  <Button
                    className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
                    disabled={profileLoading}
                    onClick={async () => {
                      if (!vendorProfile) return;

                      setProfileLoading(true);
                      try {
                        let imageUrl = vendorProfile.profileImageUrl;

                        if (profileImageFile) {
                          const formData = new FormData();
                          formData.append('file', profileImageFile);
                          formData.append('type', 'profile');

                          const uploadRes = await fetch('/api/upload', {
                            method: 'POST',
                            body: formData,
                          });

                          if (!uploadRes.ok) {
                            throw new Error(`이미지 업로드 실패: ${uploadRes.status}`);
                          }

                          const uploadData = await uploadRes.json();
                          if (!uploadData.url) {
                            throw new Error('이미지 URL을 받지 못했습니다');
                          }
                          imageUrl = uploadData.url;
                        }

                        const profileFormData = new FormData();
                        profileFormData.append('storeName', vendorProfile.storeName || '');
                        profileFormData.append('description', vendorProfile.description || '');
                        profileFormData.append('address', vendorProfile.address || '');
                        profileFormData.append('phone', vendorProfile.phone || '');
                        profileFormData.append('profileImageUrl', imageUrl || '');
                        profileFormData.append('type', 'vendor-profile');

                        const response = await fetch('/api/upload', {
                          method: 'POST',
                          body: profileFormData,
                        });

                        if (!response.ok) {
                          const errorText = await response.text();
                          console.error('프로필 저장 응답 오류:', response.status, errorText);
                          throw new Error(`프로필 저장 실패: ${response.status}`);
                        }

                        const updatedVendor = await response.json();
                        setVendorProfile({
                          ...vendorProfile,
                          profileImageUrl: updatedVendor.profileImageUrl || '',
                        });
                        setProfileImageFile(null);
                        setProfileImagePreview(updatedVendor.profileImageUrl || null);
                        toast({
                          title: "저장 완료",
                          description: "프로필이 성공적으로 업데이트되었습니다.",
                        });
                      } catch (error) {
                        console.error('프로필 저장 오류:', error);
                        toast({
                          title: "저장 실패",
                          description: error instanceof Error ? error.message : "프로필 저장 중 오류가 발생했습니다.",
                          variant: "destructive",
                        });
                      } finally {
                        setProfileLoading(false);
                      }
                    }}
                    data-testid="button-save-profile"
                  >
                    {profileLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        저장 중...
                      </>
                    ) : (
                      '정보 저장'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>위치 설정</CardTitle>
                <CardDescription>
                  판매자 위치 정보를 설정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LocationSettings
                  initialLocation={location}
                  onSave={(loc: any) => setLocation(loc)}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 주문 상세 다이얼로그 */}
      <OrderDetailsDialog
        order={selectedOrder}
        isOpen={!!selectedOrder && !showConversation}
        onClose={() => setSelectedOrder(null)}
        onUpdateStatus={handleUpdateOrderStatus}
        onShowChat={() => setShowConversation(true)}
      />

      {/* 대화 내역 다이얼로그 */}
      {selectedOrder && showConversation && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="bg-background border w-full max-w-4xl h-[90vh] rounded-lg shadow-lg flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-medium text-lg">
                  대화 내역 - 주문 #{selectedOrder.orderId || selectedOrder.id}
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowConversation(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 p-0 h-[600px]">
                <ConversationView
                  conversationId={selectedOrder.conversationId}
                  user={{ role: "vendor" }}
                  className="h-full"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 제품 다이얼로그 */}
      <ProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        onSave={handleSaveProduct}
        product={editingProduct}
      />

      {/* 식물 사진 및 메시지 전송 다이얼로그 */}
      <SendPlantPhotoDialog
        open={sendPhotoDialogOpen}
        onOpenChange={setSendPhotoDialogOpen}
        onSend={handleSendPlantPhoto}
        conversationId={preparingOrder?.conversationId || null}
        orderId={preparingOrder?.id || ''}
      />

      {/* 고객과 직접 채팅 모달 */}
      {directChatId && (
        <DirectChatModal
          chatId={directChatId}
          isOpen={isDirectChatOpen}
          onClose={() => {
            setIsDirectChatOpen(false);
            setDirectChatId(null);
          }}
        />
      )}
    </div>
  );
}