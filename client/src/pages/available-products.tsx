import { useEffect, useState } from "react";
import { Header, subscribeToLocationChange } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Leaf, MapPin, Store, ShoppingCart } from "lucide-react";

interface Product {
  id: number;
  name: string;
  price: number;
  imageUrl?: string;
  stock?: number;
  vendorName?: string;
}

export default function AvailableProductsPage() {
  const [, navigate] = useLocation();
  const [userLocation, setUserLocation] = useState<string>("내 지역");

  useEffect(() => {
    document.title = "바로 구매 가능 상품 - PlantBid";
    window.scrollTo(0, 0);
    
    const saved = localStorage.getItem('selectedLocation');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.address) {
          setUserLocation(parsed.address);
        } else {
          setUserLocation(saved);
        }
      } catch {
        setUserLocation(saved);
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToLocationChange((newLocation: string) => {
      setUserLocation(newLocation);
    });
    return unsubscribe;
  }, []);

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products/available", userLocation],
    queryFn: async () => {
      const saved = localStorage.getItem('selectedLocation');
      let query = '';
      
      if (saved && saved.startsWith('{')) {
        try {
          const data = JSON.parse(saved);
          query = `lat=${data.lat}&lng=${data.lng}&radius=10`;
        } catch {
          query = `region=${encodeURIComponent(userLocation)}`;
        }
      } else {
        query = `region=${encodeURIComponent(userLocation)}`;
      }
      
      const response = await fetch(`/api/products/available?${query}`);
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
  });

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
          돌아가기
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            바로 구매 가능한 상품
          </h1>
          <p className="text-gray-600 flex items-center">
            <MapPin className="w-4 h-4 mr-1" />
            지금 바로 주문할 수 있는 식물들
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {isLoading ? (
            Array(12).fill(0).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardContent className="p-3">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2 mb-2" />
                  <Skeleton className="h-5 w-1/3" />
                </CardContent>
              </Card>
            ))
          ) : products && products.length > 0 ? (
            products.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
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
                      <Badge className="absolute top-2 left-2 bg-red-500">
                        품절 임박
                      </Badge>
                    )}
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
            <div className="col-span-full text-center py-16 text-gray-500">
              <Leaf className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>현재 이용 가능한 상품이 없습니다</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
