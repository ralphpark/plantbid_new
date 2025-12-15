import { useEffect, useState } from "react";
import { Header, subscribeToLocationChange } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Leaf } from "lucide-react";

interface Plant {
  id: number;
  name: string;
  scientificName?: string;
  imageUrl?: string;
  minPrice?: number;
}

export default function PopularPlantsPage() {
  const [, navigate] = useLocation();
  const [userLocation, setUserLocation] = useState<string>("내 지역");

  useEffect(() => {
    document.title = "인기 식물 - PlantBid";
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

  const { data: plants, isLoading } = useQuery<Plant[]>({
    queryKey: ["/api/plants/popular", userLocation],
    queryFn: async () => {
      const saved = localStorage.getItem('selectedLocation');
      let query = '';
      
      if (saved && saved.startsWith('{')) {
        try {
          const data = JSON.parse(saved);
          query = `?lat=${data.lat}&lng=${data.lng}&radius=10`;
        } catch {
          query = '';
        }
      }
      
      const response = await fetch(`/api/plants/popular${query}`);
      if (!response.ok) throw new Error('Failed to fetch plants');
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
            인기 식물
          </h1>
          <p className="text-gray-600">지금 가장 많이 찾는 식물들</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {isLoading ? (
            Array(10).fill(0).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-40 w-full" />
                <CardContent className="p-3">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))
          ) : plants && plants.length > 0 ? (
            plants.map((plant) => (
              <motion.div
                key={plant.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
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
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-semibold text-gray-900 truncate" data-testid={`text-plant-name-${plant.id}`}>
                      {plant.name}
                    </h3>
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
            <div className="col-span-full text-center py-16 text-gray-500">
              <Leaf className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>등록된 식물이 없습니다</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
