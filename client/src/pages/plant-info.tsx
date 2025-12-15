import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Droplets, Sun, Thermometer, Leaf, Shield, Ruler, Star, Store, MessageCircle, Send, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/layout/header";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface Plant {
  id: number;
  name: string;
  scientificName?: string;
  description?: string;
  imageUrl?: string;
  waterNeeds?: string;
  light?: string;
  humidity?: string;
  temperature?: string;
  winterTemperature?: string;
  difficulty?: string;
  size?: string;
  petSafety?: string;
  careInstructions?: string;
  priceRange?: string;
  category?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const PRESET_QUESTIONS = [
  "이 식물 키우기 어려울까요?",
  "물은 얼마나 자주 줘야 하나요?",
  "햇빛이 없는 곳에서도 키울 수 있나요?",
  "반려동물이 있어도 안전한가요?",
  "겨울에 특별히 관리해야 할 점이 있나요?",
  "잎이 누렇게 변하면 어떻게 해야 하나요?",
];

export default function PlantInfoPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  console.log(`[PlantInfo] 페이지 로드됨, ID:`, id);
  const { data: plant, isLoading, error } = useQuery<Plant>({
    queryKey: ['/direct/plants', id],
    queryFn: async () => {
      const response = await fetch(`/direct/plants/${id}`);
      if (!response.ok) throw new Error('Failed to fetch plant');
      return response.json();
    },
    enabled: !!id,
  });
  
  console.log(`[PlantInfo] 쿼리 상태:`, { isLoading, error, plant });

  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await fetch(`/api/plants/${id}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question,
          chatHistory: chatMessages 
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '알 수 없는 오류' }));
        throw new Error(errorData.error || '답변을 가져오는데 실패했습니다');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
    },
    onError: (error: Error) => {
      toast({
        title: "오류 발생",
        description: error.message || "답변을 가져오는데 문제가 발생했습니다.",
        variant: "destructive",
      });
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '죄송합니다. 답변을 생성하는 중 오류가 발생했습니다. 다시 시도해 주세요. 🙏' 
      }]);
    },
  });

  const handleSendMessage = (message: string) => {
    if (!message.trim()) return;
    
    setChatMessages(prev => [...prev, { role: 'user', content: message }]);
    setInputMessage('');
    askMutation.mutate(message);
  };

  const handlePresetClick = (question: string) => {
    handleSendMessage(question);
  };

  const handleOpenChat = () => {
    setIsChatOpen(true);
    if (chatMessages.length === 0) {
      setChatMessages([{
        role: 'assistant',
        content: `안녕하세요! 🌱 ${plant?.name || '이 식물'}에 대해 궁금한 것이 있으시면 무엇이든 물어보세요! 아래 버튼을 누르거나 직접 질문해 주세요.`
      }]);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleStartConsultation = () => {
    if (user) {
      navigate("/ai-consultation");
    } else {
      navigate("/auth");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-green-50">
        <Header />
        <main className="pt-20 pb-12 px-4">
          <div className="container mx-auto max-w-4xl">
            <Skeleton className="h-8 w-24 mb-6" />
            <div className="grid md:grid-cols-2 gap-8">
              <Skeleton className="h-96 rounded-xl" />
              <div className="space-y-4">
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !plant) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-green-50">
        <Header />
        <main className="pt-32 pb-12 px-4">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">식물을 찾을 수 없습니다</h1>
            <Button onClick={() => navigate("/")} data-testid="button-go-home">
              홈으로 돌아가기
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-green-50">
      <Header />
      <main className="pt-28 pb-12 px-4 md:px-8">
        <div className="container mx-auto max-w-6xl">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-8 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            뒤로가기
          </Button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {/* 이미지와 기본 정보 */}
            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <div className="md:col-span-1">
                <div className="relative h-80 bg-gradient-to-br from-green-100 via-green-50 to-emerald-50 rounded-2xl overflow-hidden shadow-lg sticky top-32">
                  {plant.imageUrl ? (
                    <img
                      src={plant.imageUrl}
                      alt={plant.name}
                      className="w-full h-full object-cover"
                      data-testid="img-plant"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-100 to-emerald-50">
                      <div className="text-center">
                        <Leaf className="w-32 h-32 text-green-200 mx-auto mb-2" />
                        <p className="text-green-600 font-medium">이미지 없음</p>
                      </div>
                    </div>
                  )}
                  {plant.category && (
                    <Badge className="absolute top-4 left-4 bg-green-600 text-white shadow-md" data-testid="badge-category">
                      {plant.category}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="md:col-span-2 space-y-6">
                {/* 식물 이름 및 학명 */}
                <div className="border-b border-green-200 pb-6">
                  <h1 className="text-4xl font-bold text-gray-900 mb-2" data-testid="text-plant-name">
                    {plant.name}
                  </h1>
                  {plant.scientificName && (
                    <p className="text-lg text-gray-500 italic" data-testid="text-scientific-name">
                      {plant.scientificName}
                    </p>
                  )}
                </div>

                {/* 설명 */}
                {plant.description && (
                  <div>
                    <p className="text-gray-700 leading-relaxed text-base" data-testid="text-description">
                      {plant.description}
                    </p>
                  </div>
                )}

                {/* 가격대 */}
                {plant.priceRange && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                    <p className="text-sm text-gray-600 mb-1">예상 가격대</p>
                    <p className="text-2xl font-bold text-green-600" data-testid="text-price">
                      {plant.priceRange}
                    </p>
                  </div>
                )}

                {/* 식물 질문 버튼 */}
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 py-6 text-lg font-semibold shadow-md"
                  onClick={handleOpenChat}
                  data-testid="button-ask"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  이 식물에 대해 궁금한것 물어보기
                </Button>
              </div>
            </div>

            {/* 관리 정보 카드 그리드 */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Leaf className="w-6 h-6 text-green-600" />
                식물 관리 정보
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {plant.light && (
                  <Card className="border-green-200 hover:border-green-400 hover:shadow-md transition-all" data-testid="card-light">
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center text-center gap-2">
                        <div className="p-3 bg-yellow-100 rounded-lg">
                          <Sun className="w-6 h-6 text-yellow-600" />
                        </div>
                        <p className="text-xs text-gray-500 font-medium">광량</p>
                        <p className="font-semibold text-gray-900 text-sm">{plant.light}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {plant.waterNeeds && (
                  <Card className="border-blue-200 hover:border-blue-400 hover:shadow-md transition-all" data-testid="card-water">
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center text-center gap-2">
                        <div className="p-3 bg-blue-100 rounded-lg">
                          <Droplets className="w-6 h-6 text-blue-600" />
                        </div>
                        <p className="text-xs text-gray-500 font-medium">물주기</p>
                        <p className="font-semibold text-gray-900 text-sm">{plant.waterNeeds}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {plant.temperature && (
                  <Card className="border-red-200 hover:border-red-400 hover:shadow-md transition-all" data-testid="card-temperature">
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center text-center gap-2">
                        <div className="p-3 bg-red-100 rounded-lg">
                          <Thermometer className="w-6 h-6 text-red-600" />
                        </div>
                        <p className="text-xs text-gray-500 font-medium">온도</p>
                        <p className="font-semibold text-gray-900 text-sm">{plant.temperature}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {plant.difficulty && (
                  <Card className="border-green-200 hover:border-green-400 hover:shadow-md transition-all" data-testid="card-difficulty">
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center text-center gap-2">
                        <div className="p-3 bg-green-100 rounded-lg">
                          <Star className="w-6 h-6 text-green-600" />
                        </div>
                        <p className="text-xs text-gray-500 font-medium">난이도</p>
                        <p className="font-semibold text-gray-900 text-sm">{plant.difficulty}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {plant.size && (
                  <Card className="border-purple-200 hover:border-purple-400 hover:shadow-md transition-all" data-testid="card-size">
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center text-center gap-2">
                        <div className="p-3 bg-purple-100 rounded-lg">
                          <Ruler className="w-6 h-6 text-purple-600" />
                        </div>
                        <p className="text-xs text-gray-500 font-medium">크기</p>
                        <p className="font-semibold text-gray-900 text-sm">{plant.size}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {plant.petSafety && (
                  <Card className="border-pink-200 hover:border-pink-400 hover:shadow-md transition-all" data-testid="card-pet-safety">
                    <CardContent className="p-4">
                      <div className="flex flex-col items-center text-center gap-2">
                        <div className="p-3 bg-pink-100 rounded-lg">
                          <Shield className="w-6 h-6 text-pink-600" />
                        </div>
                        <p className="text-xs text-gray-500 font-medium">반려동물</p>
                        <p className="font-semibold text-gray-900 text-sm">{plant.petSafety}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* 추가 정보 */}
            {(plant.humidity || plant.winterTemperature || plant.careInstructions) && (
              <div className="space-y-6">
                {(plant.humidity || plant.winterTemperature) && (
                  <Card className="border-green-200" data-testid="card-additional-info">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">추가 정보</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {plant.humidity && (
                          <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg p-4 border border-blue-200">
                            <p className="text-sm text-gray-600 font-medium mb-2">습도</p>
                            <p className="text-gray-900">{plant.humidity}</p>
                          </div>
                        )}
                        {plant.winterTemperature && (
                          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-4 border border-orange-200">
                            <p className="text-sm text-gray-600 font-medium mb-2">겨울 온도</p>
                            <p className="text-gray-900">{plant.winterTemperature}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {plant.careInstructions && (
                  <Card className="border-green-200" data-testid="card-care-instructions">
                    <CardContent className="p-6">
                      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Leaf className="w-5 h-5 text-green-600" />
                        상세 관리 방법
                      </h2>
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                        <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                          {plant.careInstructions}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </main>

      {/* 식물 Q&A 대화창 모달 */}
      <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
        <DialogContent className="sm:max-w-[500px] h-[600px] flex flex-col p-0">
          <DialogHeader className="p-4 border-b bg-green-50">
            <DialogTitle className="flex items-center gap-2 text-green-800">
              <Leaf className="w-5 h-5" />
              {plant?.name} 질문하기
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              
              {askMutation.isPending && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-2 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                    <span className="text-sm text-gray-600">답변 작성 중...</span>
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* 프리셋 질문 버튼들 */}
          {chatMessages.length <= 1 && (
            <div className="px-4 pb-2 border-t pt-3">
              <p className="text-xs text-gray-500 mb-2">빠른 질문</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_QUESTIONS.map((q, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-1.5 px-2 border-green-200 text-green-700 hover:bg-green-50"
                    onClick={() => handlePresetClick(q)}
                    disabled={askMutation.isPending}
                  >
                    {q}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* 입력창 */}
          <div className="p-4 border-t bg-gray-50">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputMessage);
              }}
              className="flex gap-2"
            >
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="질문을 입력하세요..."
                className="flex-1"
                disabled={askMutation.isPending}
                data-testid="input-question"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!inputMessage.trim() || askMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-send"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
