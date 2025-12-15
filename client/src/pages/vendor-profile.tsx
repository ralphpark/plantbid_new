import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Phone, Mail, Star, Store, CheckCircle, Leaf, Award, TrendingUp, Heart, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface Product {
  id: number;
  name: string;
  description?: string;
  price: string;
  imageUrl?: string;
  stock?: number;
}

interface Review {
  id: number;
  vendorId: number;
  userId: number;
  orderId: string;
  rating: number;
  comment: string;
  authorName: string;
  authorImage?: string;
  createdAt: string;
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
  totalSales?: number;
  products: Product[];
}

export default function VendorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const { data: vendor, isLoading, error } = useQuery<Vendor>({
    queryKey: [`/api/vendors/${id}`],
    enabled: !!id,
  });

  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: [`/api/reviews/${id}`],
    enabled: !!id,
  });

  const createReviewMutation = useMutation({
    mutationFn: async (reviewData: any) => {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewData),
      });
      if (!response.ok) throw new Error("리뷰 작성 실패");
      return response.json();
    },
    onSuccess: () => {
      toast({ description: "리뷰가 작성되었습니다!" });
      setShowReviewForm(false);
      setComment("");
      setRating(5);
      queryClient.invalidateQueries({ queryKey: [`/api/reviews/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/vendors/${id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/vendors/popular`] });
    },
    onError: () => {
      toast({ variant: "destructive", description: "리뷰 작성 중 오류가 발생했습니다" });
    },
  });

  const handleProductClick = (productId: number) => {
    navigate(`/products/${productId}`);
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      toast({ variant: "destructive", description: "리뷰 내용을 입력해주세요" });
      return;
    }
    
    createReviewMutation.mutate({
      vendorId: parseInt(id!),
      orderId: "order-" + Date.now(),
      rating,
      comment,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-green-50">
        <Header />
        <main className="pt-28 pb-12 px-4">
          <div className="container mx-auto max-w-6xl">
            <Skeleton className="h-8 w-24 mb-6" />
            <div className="flex items-start gap-6 mb-8">
              <Skeleton className="w-32 h-32 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-green-50">
        <Header />
        <main className="pt-32 pb-12 px-4">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">판매자를 찾을 수 없습니다</h1>
            <p className="text-gray-600 mb-6">요청하신 판매자 정보가 없거나 삭제되었습니다.</p>
            <Button onClick={() => navigate("/")} data-testid="button-go-home" className="bg-green-600 hover:bg-green-700">
              홈으로 돌아가기
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-green-50 to-white">
      <Header />
      <main className="pt-20 pb-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-8 text-gray-600 hover:text-gray-900"
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            뒤로가기
          </Button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            {/* 판매자 상단 소개 */}
            <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 overflow-hidden" data-testid="card-vendor-profile">
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <div className="flex flex-col items-center md:items-start">
                    <div className="w-32 h-32 rounded-full bg-white border-4 border-green-200 flex items-center justify-center overflow-hidden shadow-lg mb-6">
                      {vendor.profileImageUrl ? (
                        <img
                          src={vendor.profileImageUrl}
                          alt={vendor.storeName}
                          className="w-full h-full object-cover"
                          data-testid="img-vendor-profile"
                        />
                      ) : (
                        <Store className="w-16 h-16 text-green-400" />
                      )}
                    </div>
                    <div className="text-center md:text-left">
                      <div className="flex items-center gap-3 mb-2 justify-center md:justify-start">
                        <h1 className="text-3xl font-bold text-gray-900" data-testid="text-vendor-name">
                          {vendor.storeName}
                        </h1>
                        {vendor.isVerified && (
                          <Badge className="bg-blue-500 text-white flex items-center gap-1" data-testid="badge-verified">
                            <CheckCircle className="w-3 h-3" />
                            인증됨
                          </Badge>
                        )}
                      </div>
                      {vendor.description && (
                        <p className="text-gray-600 text-sm mb-4 max-w-lg" data-testid="text-description">
                          {vendor.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 justify-center md:justify-start flex-wrap">
                        {vendor.rating && (
                          <div className="flex items-center gap-1 bg-white px-3 py-2 rounded-lg shadow">
                            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                            <span className="font-semibold text-gray-900" data-testid="text-rating">
                              {parseFloat(vendor.rating).toFixed(1)}
                            </span>
                          </div>
                        )}
                        {vendor.totalSales && (
                          <div className="flex items-center gap-1 bg-white px-3 py-2 rounded-lg shadow">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                            <span className="font-semibold text-gray-900">
                              {vendor.totalSales}건 판매
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-green-100">
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500 font-medium">위치</p>
                          <p className="text-gray-900 font-medium" data-testid="text-address">{vendor.address}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-green-100">
                      <div className="flex items-start gap-3">
                        <Phone className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500 font-medium">연락처</p>
                          <p className="text-gray-900 font-medium" data-testid="text-phone">{vendor.phone}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm border border-green-100">
                      <div className="flex items-start gap-3">
                        <Mail className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500 font-medium">이메일</p>
                          <p className="text-gray-900 font-medium text-sm" data-testid="text-email">{vendor.email}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </CardContent>
            </Card>

            {/* 통계 섹션 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm font-medium mb-1">판매 식물 수</p>
                      <p className="text-3xl font-bold text-gray-900">
                        {vendor.products?.length || 0}
                      </p>
                    </div>
                    <div className="bg-green-100 rounded-full p-3">
                      <Leaf className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm font-medium mb-1">평점</p>
                      <p className="text-3xl font-bold text-yellow-600">
                        {vendor.rating ? parseFloat(vendor.rating).toFixed(1) : "-"}
                      </p>
                    </div>
                    <div className="bg-yellow-100 rounded-full p-3">
                      <Star className="w-6 h-6 text-yellow-600 fill-yellow-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm font-medium mb-1">판매 실적</p>
                      <p className="text-3xl font-bold text-emerald-600">
                        {vendor.totalSales || 0}건
                      </p>
                    </div>
                    <div className="bg-emerald-100 rounded-full p-3">
                      <Award className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 판매 중인 식물 */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Leaf className="w-6 h-6 text-green-600" />
                <h2 className="text-2xl font-bold text-gray-900">판매 중인 식물</h2>
                <Badge variant="secondary" className="text-base">
                  {vendor.products?.length || 0}개
                </Badge>
              </div>

              {vendor.products && vendor.products.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {vendor.products.map((product, idx) => (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                      viewport={{ once: true }}
                    >
                      <Card
                        className="overflow-hidden border-0 shadow-md hover:shadow-xl hover:scale-105 transition-all cursor-pointer group"
                        onClick={() => handleProductClick(product.id)}
                        data-testid={`card-product-${product.id}`}
                      >
                        <div className="relative h-48 bg-gradient-to-br from-green-100 to-emerald-50 overflow-hidden">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Leaf className="w-12 h-12 text-green-300 opacity-50" />
                            </div>
                          )}
                          {product.stock && product.stock < 5 && (
                            <Badge className="absolute top-3 right-3 bg-red-500 text-white font-semibold">
                              {product.stock}개 남음
                            </Badge>
                          )}
                          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Heart className="w-5 h-5 text-red-500" />
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-gray-900 truncate text-sm">
                            {product.name}
                          </h3>
                          <p className="text-xs text-gray-500 line-clamp-1 mt-1">
                            {product.description || "상세 설명 없음"}
                          </p>
                          <p className="text-lg font-bold text-green-600 mt-3">
                            {parseFloat(product.price).toLocaleString()}원
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="border-0 shadow-md bg-gradient-to-br from-gray-50 to-gray-100">
                  <CardContent className="py-16 px-6 text-center">
                    <Store className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">등록된 판매 식물이 없습니다</h3>
                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                      현재 판매 중인 식물이 없습니다.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* 리뷰 섹션 */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Star className="w-6 h-6 text-yellow-600 fill-yellow-600" />
                <h2 className="text-2xl font-bold text-gray-900">고객 리뷰</h2>
                <Badge variant="secondary" className="text-base">
                  {reviews.length}개
                </Badge>
              </div>

              {/* 리뷰 작성 폼 */}
              {user && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-8"
                >
                  <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-cyan-50">
                    <CardContent className="p-6">
                      {!showReviewForm ? (
                        <Button
                          onClick={() => setShowReviewForm(true)}
                          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold"
                        >
                          <Star className="w-4 h-4 mr-2" />
                          리뷰 작성하기
                        </Button>
                      ) : (
                        <form onSubmit={handleReviewSubmit} className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">평점</label>
                            <div className="flex gap-2">
                              {[1, 2, 3, 4, 5].map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => setRating(r)}
                                  className="transition-transform hover:scale-110"
                                >
                                  <Star
                                    className={`w-8 h-8 ${
                                      r <= rating
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-gray-300"
                                    }`}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">리뷰</label>
                            <textarea
                              value={comment}
                              onChange={(e) => setComment(e.target.value)}
                              placeholder="이 판매자와의 거래 경험을 공유해주세요..."
                              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                              rows={4}
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button
                              type="submit"
                              disabled={createReviewMutation.isPending}
                              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <Send className="w-4 h-4 mr-2" />
                              {createReviewMutation.isPending ? "작성 중..." : "리뷰 작성"}
                            </Button>
                            <Button
                              type="button"
                              onClick={() => {
                                setShowReviewForm(false);
                                setComment("");
                              }}
                              variant="outline"
                              className="flex-1"
                            >
                              취소
                            </Button>
                          </div>
                        </form>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* 리뷰 목록 */}
              {reviews.length > 0 ? (
                <div className="space-y-4">
                  {reviews.map((review, idx) => (
                    <motion.div
                      key={review.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                      viewport={{ once: true }}
                    >
                      <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-semibold text-gray-900">{review.authorName}</h4>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {new Date(review.createdAt).toLocaleDateString("ko-KR")}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((r) => (
                                <Star
                                  key={r}
                                  className={`w-4 h-4 ${
                                    r <= review.rating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-gray-300"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <p className="text-gray-700 text-sm leading-relaxed">{review.comment}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="border-0 shadow-md bg-gradient-to-br from-gray-50 to-gray-100">
                  <CardContent className="py-12 px-6 text-center">
                    <Star className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">아직 리뷰가 없습니다</h3>
                    <p className="text-gray-600">첫 번째 리뷰를 작성해보세요!</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
