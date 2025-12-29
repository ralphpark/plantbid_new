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
import { ArrowLeft, MapPin, Star, Store } from "lucide-react";

interface Vendor {
  id: number;
  storeName: string;
  description?: string;
  profileImageUrl?: string;
  address?: string;
  rating?: number;
  isVerified?: boolean;
}

export default function PopularVendorsPage() {
  const [, navigate] = useLocation();
  const [userLocation, setUserLocation] = useState<string>("내 지역");

  useEffect(() => {
    document.title = "지역 인기 판매자 - PlantBid";
    window.scrollTo(0, 0);

    const saved = localStorage.getItem('searchLocation');
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
    const unsubscribe = subscribeToLocationChange((locations: { gpsLocation: string; searchLocation: string }) => {
      setUserLocation(locations.searchLocation);
    });
    return () => { unsubscribe(); };
  }, []);

  const { data: vendors, isLoading } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors/popular", userLocation],
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
            지역 인기 판매자
          </h1>
          <p className="text-gray-600 flex items-center">
            <MapPin className="w-4 h-4 mr-1" />
            내 주변에서 인기 있는 식물 판매자
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isLoading ? (
            Array(8).fill(0).map((_, i) => (
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
          ) : vendors && vendors.length > 0 ? (
            vendors.map((vendor) => (
              <motion.div
                key={vendor.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
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
                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                              인증
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {vendor.rating && (
                            <span className="flex items-center text-sm text-yellow-600">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 mr-0.5" />
                              {vendor.rating.toFixed(1)}
                            </span>
                          )}
                          {vendor.address && (
                            <span className="text-sm text-gray-500 truncate flex items-center">
                              <MapPin className="w-3 h-3 mr-0.5" />
                              {vendor.address.split(" ").slice(0, 2).join(" ")}
                            </span>
                          )}
                        </div>
                        {vendor.description && (
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                            {vendor.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full text-center py-16 text-gray-500">
              <Store className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>등록된 판매자가 없습니다</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
