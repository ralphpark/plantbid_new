import React, { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import SalesStats from '../admin/components/SalesStats';
import PlantsList from '../admin/components/PlantsList';
import VendorPayments from '../admin/components/VendorPayments';
import { Loader2 } from 'lucide-react';

import VendorCommission from '../admin/components/VendorCommission';

// 관리자 대시보드 메인 컴포넌트
export default function AdminDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState('sales-stats');
  const { toast } = useToast();
  const [isUpdatingPlants, setIsUpdatingPlants] = useState(false);
  const [plantUpdateResult, setPlantUpdateResult] = useState<any>(null);
  const [isTranslatingFields, setIsTranslatingFields] = useState(false);
  const [translateResult, setTranslateResult] = useState<any>(null);

  const handleUpdatePlantInfo = async () => {
    try {
      setIsUpdatingPlants(true);
      setPlantUpdateResult(null);
      
      const response = await fetch('/api/plants/fill-missing-info', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '업데이트 실패');
      }
      
      setPlantUpdateResult(data);
      toast({
        title: "✅ 완료!",
        description: `${data.updated}/${data.plantsToUpdate}개 식물 정보 업데이트됨`,
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "❌ 오류 발생",
        description: error instanceof Error ? error.message : '알 수 없는 오류',
        variant: "destructive"
      });
    } finally {
      setIsUpdatingPlants(false);
    }
  };

  const handleTranslateFields = async () => {
    try {
      setIsTranslatingFields(true);
      setTranslateResult(null);
      
      const response = await fetch('/api/plants/translate-all-fields', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '번역 실패');
      }
      
      setTranslateResult(data);
      toast({
        title: "✅ 번역 완료!",
        description: `${data.translated}/${data.plantsToTranslate}개 식물 필드 한글 변환됨`,
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "❌ 오류 발생",
        description: error instanceof Error ? error.message : '알 수 없는 오류',
        variant: "destructive"
      });
    } finally {
      setIsTranslatingFields(false);
    }
  };

  // 사용자가 관리자가 아니면 홈으로 리디렉션
  if (!user || user.role !== 'admin') {
    navigate('/');
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">관리자 대시보드</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">관리자: {user.username}</span>
            <a href="/" className="text-sm text-blue-500 hover:text-blue-700">사이트로 돌아가기</a>
          </div>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-8">
          <TabsTrigger value="sales-stats">매출 통계</TabsTrigger>
          <TabsTrigger value="plants-list">식물 관리</TabsTrigger>
          <TabsTrigger value="vendor-payments">판매자별 결제</TabsTrigger>
          <TabsTrigger value="vendor-commission">수수료 설정</TabsTrigger>
          <TabsTrigger value="plant-update">정보 업데이트</TabsTrigger>
        </TabsList>

        <div className="p-4 bg-white rounded-lg shadow">
          <TabsContent value="sales-stats">
            <Card>
              <CardHeader>
                <CardTitle>매출 및 결제 통계</CardTitle>
                <CardDescription>전체 매출, 결제 현황 및 통계를 확인합니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <SalesStats />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plants-list">
            <Card>
              <CardHeader>
                <CardTitle>식물 목록 관리</CardTitle>
                <CardDescription>전체 식물 목록을 관리하고 정보를 수정합니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <PlantsList />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vendor-payments">
            <Card>
              <CardHeader>
                <CardTitle>판매자별 결제 내역</CardTitle>
                <CardDescription>판매자별 결제 및 주문 내역을 조회합니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <VendorPayments />
              </CardContent>
            </Card>
          </TabsContent>



          <TabsContent value="vendor-commission">
            <Card>
              <CardHeader>
                <CardTitle>수수료 설정</CardTitle>
                <CardDescription>판매자별 수수료 설정 및 정산 관리</CardDescription>
              </CardHeader>
              <CardContent>
                <VendorCommission />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plant-update">
            <Card>
              <CardHeader>
                <CardTitle>식물 정보 AI 업데이트</CardTitle>
                <CardDescription>Perplexity AI를 사용해 식물 정보 자동 채우기</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    데이터베이스에 등록된 식물 중 설명, 물주기, 빛 조건 등의 정보가 없는 식물들을 Perplexity AI로 찾아서 자동으로 채웁니다.
                  </p>
                </div>
                
                <Button 
                  onClick={handleUpdatePlantInfo}
                  disabled={isUpdatingPlants}
                  className="w-full"
                >
                  {isUpdatingPlants ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      업데이트 중... (1-2분 소요)
                    </>
                  ) : (
                    "🌱 식물 정보 업데이트 시작"
                  )}
                </Button>

                {plantUpdateResult && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h3 className="font-semibold text-green-900 mb-2">✅ 업데이트 완료!</h3>
                    <ul className="text-sm text-green-800 space-y-1">
                      <li>• 전체 식물: {plantUpdateResult.totalPlants}개</li>
                      <li>• 업데이트 필요: {plantUpdateResult.plantsToUpdate}개</li>
                      <li>• 업데이트됨: {plantUpdateResult.updated}개</li>
                      <li>• 메시지: {plantUpdateResult.message}</li>
                    </ul>
                  </div>
                )}

                <div className="border-t pt-6 mt-6">
                  <h3 className="font-semibold mb-3">📝 영어→한글 필드 변환</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    설명, 물주기, 빛 조건, 관리법, 난이도, 반려동물 안전성 등 모든 영어로 된 필드를 한글로 자동 변환합니다.
                  </p>
                  
                  <Button 
                    onClick={handleTranslateFields}
                    disabled={isTranslatingFields}
                    variant="outline"
                    className="w-full"
                  >
                    {isTranslatingFields ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        변환 중... (1-2분 소요)
                      </>
                    ) : (
                      "📝 영어 필드 한글 변환 시작"
                    )}
                  </Button>

                  {translateResult && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-4">
                      <h3 className="font-semibold text-blue-900 mb-2">✅ 한글 변환 완료!</h3>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• 전체 식물: {translateResult.totalPlants}개</li>
                        <li>• 변환 필요: {translateResult.plantsToTranslate}개</li>
                        <li>• 변환됨: {translateResult.translated}개</li>
                        <li>• 메시지: {translateResult.message}</li>
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}