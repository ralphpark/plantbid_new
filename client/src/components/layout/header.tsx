import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { UserDropdownMenu, UserDropdownProps } from "@/components/ui/simple-dropdown";
import { motion, useScroll, useTransform } from "framer-motion";
import { ShoppingCart, MapPin, Search, MessageCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DirectChatModal, DirectChatList } from "@/components/direct-chat";
import { useUnreadChatCount } from "@/hooks/use-direct-chat";

interface LocationChangeListener {
  (location: { gpsLocation: string; searchLocation: string }): void;
}

const locationListeners: Set<LocationChangeListener> = new Set();

export function notifyLocationChange(locations: { gpsLocation: string; searchLocation: string }) {
  locationListeners.forEach(listener => listener(locations));
}

export function subscribeToLocationChange(listener: LocationChangeListener) {
  locationListeners.add(listener);
  return () => locationListeners.delete(listener);
}

interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

export function Header({ onLocationChange }: { onLocationChange?: (location: string) => void }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [gpsLocation, setGpsLocation] = useState<string>("내 지역");
  const [searchLocation, setSearchLocation] = useState<string>("내 지역");
  const [gpsLocationData, setGpsLocationData] = useState<LocationData | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchLocationData, setSearchLocationData] = useState<LocationData | null>(null);
  const [addressSearch, setAddressSearch] = useState<string>("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  const queryClient = useQueryClient();

  // GPS 위치 업데이트 (검색에 영향 없음)
  const handleSetGpsLocation = (newLocation: string, data?: LocationData & { timestamp?: number }) => {
    setGpsLocation(newLocation);
    if (data) {
      setGpsLocationData(data);
      // GPS 위치도 로컬 스토리지에 저장하여 재방문 시 즉시 표시
      localStorage.setItem('gpsLocation', JSON.stringify({
        ...data,
        address: newLocation.replace(' (GPS)', '').replace(' (캐시)', ''), // 표시용 텍스트 제거
        timestamp: data.timestamp || Date.now()
      }));
    }
  };

  // 검색 위치 업데이트 (판매자/상품 필터링에 사용)
  const handleSetSearchLocation = (newLocation: string, data?: LocationData & { timestamp?: number }) => {
    setSearchLocation(newLocation);
    if (data) {
      setSearchLocationData(data);
      localStorage.setItem('searchLocation', JSON.stringify({
        ...data,
        timestamp: data.timestamp || Date.now()
      }));
    }
    // 검색 결과에 따라 필터링 갱신
    notifyLocationChange({ gpsLocation, searchLocation: newLocation });
  };

  const handleAddressSearch = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await fetch(`/api/map/search-address?query=${encodeURIComponent(query)}`);
      const data = await response.json();
      if (data.success && data.results) {
        setSearchResults(data.results);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Address search error:', error);
      setSearchResults([]);
    }
  };

  const handleSelectAddress = (result: any) => {
    const { formatted_address, geometry } = result;
    const { lat, lng } = geometry.location;
    handleSetSearchLocation(formatted_address, { address: formatted_address, lat, lng });
    setShowSearchResults(false);
    setAddressSearch("");
  };

  const { data: cartCountData } = useQuery<{ count: number }>({
    queryKey: ['/api/cart/count'],
  });

  const cartCount = cartCountData?.count || 0;

  // 채팅 관련 상태
  const [isChatListOpen, setIsChatListOpen] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const { data: unreadData } = useUnreadChatCount();
  const chatUnreadCount = user?.role === 'vendor'
    ? (unreadData?.vendorUnreadCount || 0)
    : (unreadData?.customerUnreadCount || 0);

  // 현재 경로가 홈 또는 features 페이지인지 확인 (투명/어두운 배경 헤더 적용)
  // 위치 정규화: 쿼리 파라미터 및 트레일링 슬래시 제거
  const normalizedPath = location.split('?')[0].replace(/\/$/, '') || '/';
  const isTransparentPage = normalizedPath === "/" || normalizedPath === "/features" || normalizedPath === "/how-to-use";

  // 상태 표시는 홈페이지인지 여부로 계속 구분할 수도 있지만, 
  // 디자인 일관성을 위해 투명 헤더 페이지들은 동일한 스타일(흰색 텍스트 등)을 공유하도록 함
  const isDarkThemePage = isTransparentPage;

  useEffect(() => {
    // 1. 저장된 GPS 위치 먼저 로드 (즉시 표시용) - 1시간 TTL 적용
    const savedGps = localStorage.getItem('gpsLocation');
    if (savedGps) {
      try {
        const parsed = JSON.parse(savedGps);
        const savedTime = parsed?.timestamp || 0;
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        // 1시간 이내의 캐시만 사용
        if (parsed?.address && (now - savedTime < oneHour)) {
          setGpsLocation(parsed.address + ' (캐시)');
          setGpsLocationData(parsed);
        } else {
          // 만료된 캐시 제거
          localStorage.removeItem('gpsLocation');
        }
      } catch {
        // ignore parsing error
      }
    }

    // 2. 실제 GPS 위치 감지 (최신화) - 높은 정확도로 5초 시도
    if (navigator.geolocation) {
      setIsLoadingLocation(true);

      const successCallback = async (position: GeolocationPosition) => {
        try {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;

          console.log(`GPS 감지 성공 - 좌표: ${lat}, ${lng}, 정확도: ${accuracy}m`);

          const response = await fetch(`/api/map/address-by-coords?lat=${lat}&lng=${lng}`);
          const data = await response.json();

          if (data.success && data.results && data.results.length > 0) {
            // '대한민국' 제거하고 주소 간소화
            let address = data.results[0].formatted_address;
            address = address.replace('대한민국 ', '');

            handleSetGpsLocation(address + ' (GPS)', { address, lat, lng, timestamp: Date.now() });
            setLocationError(null);

            // 캐시된 검색 위치가 없으면 GPS 위치를 검색 위치로도 설정
            // (바로구매 상품 등 위치 기반 데이터가 초기 로딩 시 표시되도록)
            const savedSearchLocation = localStorage.getItem('searchLocation');
            if (!savedSearchLocation) {
              handleSetSearchLocation(address, { address, lat, lng, timestamp: Date.now() });
            } else {
              // 캐시된 검색 위치가 있어도 리스너에 알림 (초기 로딩 시 상품 표시용)
              try {
                const parsed = JSON.parse(savedSearchLocation);
                const savedTime = parsed?.timestamp || 0;
                const now = Date.now();
                const oneHour = 60 * 60 * 1000;
                if (parsed?.address && (now - savedTime < oneHour)) {
                  notifyLocationChange({ gpsLocation: address + ' (GPS)', searchLocation: parsed.address });
                } else {
                  // 만료된 캐시는 GPS 위치로 대체
                  handleSetSearchLocation(address, { address, lat, lng, timestamp: Date.now() });
                }
              } catch {
                handleSetSearchLocation(address, { address, lat, lng, timestamp: Date.now() });
              }
            }
          } else {
            console.warn('주소를 찾을 수 없음:', data);
            setLocationError("주소 확인 불가");
          }
        } catch (error) {
          console.error('GPS 감지 실패:', error);
          setLocationError("위치 확인 오류");
        } finally {
          setIsLoadingLocation(false);
        }
      };

      const errorCallback = (error: GeolocationPositionError) => {
        console.error('GPS 오류 (높은 정확도):', error);

        // 첫 번째 시도 실패 시, 낮은 정확도로 재시도
        console.log('낮은 정확도 모드로 재시도...');
        navigator.geolocation.getCurrentPosition(
          successCallback,
          (retryError) => {
            console.error('GPS 재시도 실패:', retryError);
            let errorMsg = "위치 권한 필요";
            if (retryError.code === retryError.TIMEOUT) errorMsg = "GPS 시간 초과";
            if (retryError.code === retryError.POSITION_UNAVAILABLE) errorMsg = "GPS 신호 없음";
            if (retryError.code === retryError.PERMISSION_DENIED) errorMsg = "위치 권한 거부됨";

            setLocationError(errorMsg);
            setIsLoadingLocation(false);
          },
          { timeout: 8000, enableHighAccuracy: false, maximumAge: 0 }
        );
      };

      // 첫 번째 시도: 높은 정확도, 5초 제한
      navigator.geolocation.getCurrentPosition(
        successCallback,
        errorCallback,
        { timeout: 5000, enableHighAccuracy: true, maximumAge: 0 }
      );
    } else {
      setLocationError("GPS 미지원");
    }

    // 검색 위치 로드 - 1시간 TTL 적용
    const saved = localStorage.getItem('searchLocation');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const savedTime = parsed?.timestamp || 0;
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;

        // 1시간 이내의 캐시만 사용
        if (parsed?.address && (now - savedTime < oneHour)) {
          setSearchLocation(parsed.address);
          setSearchLocationData(parsed);
        } else {
          // 만료된 캐시 제거
          localStorage.removeItem('searchLocation');
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const handleGetCurrentLocation = () => {
    // 검색 위치를 GPS 위치로 리셋
    localStorage.removeItem('searchLocation');
    handleSetSearchLocation("내 지역");  // 검색 필터만 리셋
    setLocationError(null);
    setIsLoadingLocation(true); // 로딩 상태 즉시 시작

    // GPS 위치 기반으로 판매자/상품 필터링
    if (navigator.geolocation) {
      const successCallback = async (position: GeolocationPosition) => {
        try {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;

          console.log(`GPS 버튼 클릭 - 좌표: ${lat}, ${lng}, 정확도: ${accuracy}m`);

          // 백엔드 API를 통해 역지오코딩 수행
          const response = await fetch(`/api/map/address-by-coords?lat=${lat}&lng=${lng}`);
          const data = await response.json();

          if (data.success && data.results && data.results.length > 0) {
            // '대한민국' 제거하고 주소 간소화
            let address = data.results[0].formatted_address;
            address = address.replace('대한민국 ', '');

            // GPS 위치로 필터링 설정
            handleSetSearchLocation(address, { address, lat, lng, timestamp: Date.now() });
            // 상단 표시용 GPS 위치도 업데이트
            handleSetGpsLocation(address + ' (GPS)', { address, lat, lng, timestamp: Date.now() });
            setLocationError(null);
          } else {
            setLocationError("주소 확인 불가");
          }
        } catch (error) {
          console.error('위치 정보 조회 실패:', error);
          setLocationError("위치 확인 오류");
        } finally {
          setIsLoadingLocation(false);
        }
      };

      const errorCallback = (error: GeolocationPositionError) => {
        console.error('GPS 버튼 오류 (높은 정확도):', error);

        // 첫 번째 시도 실패 시, 낮은 정확도로 재시도
        console.log('낮은 정확도 모드로 재시도...');
        navigator.geolocation.getCurrentPosition(
          successCallback,
          (retryError) => {
            console.error('GPS 버튼 재시도 실패:', retryError);
            let errorMsg = "위치 권한 필요";
            if (retryError.code === retryError.TIMEOUT) errorMsg = "GPS 시간 초과 - 직접 검색하세요";
            if (retryError.code === retryError.POSITION_UNAVAILABLE) errorMsg = "GPS 신호 없음 - 직접 검색하세요";
            if (retryError.code === retryError.PERMISSION_DENIED) errorMsg = "위치 권한 거부됨";

            setLocationError(errorMsg);
            setIsLoadingLocation(false);
          },
          { timeout: 8000, enableHighAccuracy: false, maximumAge: 0 }
        );
      };

      // 1차 시도: 높은 정확도, 5초 제한
      navigator.geolocation.getCurrentPosition(
        successCallback,
        errorCallback,
        { timeout: 5000, enableHighAccuracy: true, maximumAge: 0 }
      );
    } else {
      setLocationError("GPS 미지원");
      setIsLoadingLocation(false);
    }
  };

  // 스크롤 감지
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleLogout = () => {
    // 로그아웃 요청
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        // 로그아웃 후 추가 처리 - 페이지 리디렉션 보장
        setTimeout(() => {
          window.location.href = '/'; // 홈 페이지로 강제 이동
        }, 300);
      }
    });
  };

  const navigateToAuth = () => {
    setLocation("/auth");
  };

  // 홈 페이지와 다른 페이지의 스타일을 구분
  const headerStyles = isTransparentPage
    ? {
      color: "white",
      transition: "color 0.3s ease",
    }
    : {
      color: "rgb(31, 41, 55)", // 배경색은 animate로 제어
      transition: "color 0.3s ease",
    };

  // 홈 페이지와 다른 페이지의 로고 스타일 구분
  const logoColor = isDarkThemePage ? "white" : "primary";

  // 홈 페이지와 다른 페이지의 링크 스타일 구분
  const linkStyles = isDarkThemePage
    ? "font-sans text-sm font-medium text-white/90 hover:text-white transition-colors duration-300"
    : "font-sans text-sm font-medium text-gray-700 hover:text-primary transition-colors duration-300";

  // 홈 페이지와 다른 페이지의 모바일 메뉴 토글 버튼 스타일 구분
  const toggleButtonColor = isDarkThemePage ? "text-white" : "text-gray-800";

  // 홈 페이지와 다른 페이지의 모바일 메뉴 스타일 구분
  const mobileMenuStyles = isDarkThemePage
    ? "bg-[#005E43] text-white border-[#004835]"
    : "bg-white text-gray-700 border-gray-100";

  // 홈 페이지와 다른 페이지의 모바일 링크 스타일 구분
  const mobileLinkStyles = isDarkThemePage
    ? "block py-2 font-sans text-sm font-medium text-white/90 hover:text-white"
    : "block py-2 font-sans text-sm font-medium text-gray-700 hover:text-primary";

  // 드롭다운 메뉴 props
  const dropdownTheme = isDarkThemePage ? 'dark' as const : 'light' as const;

  // 헤더 배경 클래스 결정 (Framer Motion 충돌 방지를 위해 Tailwind 클래스 사용)
  // 스크롤 0일 때도 초록색 배경을 사용하여 흰색 글자가 보이도록 함
  const headerBgClass = (isTransparentPage && !scrolled)
    ? 'bg-[#005E43]' // 스크롤 0일 때도 초록색 배경 (글자 가시성 확보)
    : (isTransparentPage && scrolled)
      ? 'bg-[#005E43]/[0.98] backdrop-blur-md shadow-lg border-b border-white/10'
      : 'bg-white shadow-sm';

  return (
    <header
      className={`py-5 px-4 sm:px-6 lg:px-8 fixed top-0 left-0 w-full z-50 transition-all duration-300 ${headerBgClass}`}
      style={headerStyles}
    >
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="flex items-center">
          <Logo className="h-10" color={isDarkThemePage ? "white" : "primary"} variant="horizontal" />
        </Link>

        <nav className="hidden md:flex space-x-6 items-center">
          {/* 현재 위치 버튼 및 주소 표시 */}
          <div className="flex flex-col items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGetCurrentLocation}
              className={`flex items-center gap-1 ${isDarkThemePage ? "text-white/90 hover:text-white hover:bg-white/10" : "text-gray-700 hover:text-primary hover:bg-gray-100"}`}
              data-testid="button-current-location"
              title="현재 위치 감지"
            >
              <MapPin className="w-4 h-4" />
              <span className="text-xs">현재위치</span>
            </Button>
            {isLoadingLocation ? (
              <span className={`text-xs ${isDarkThemePage ? "text-white/70" : "text-gray-500"} animate-pulse`}>
                위치 확인 중...
              </span>
            ) : locationError ? (
              <span className={`text-xs ${isDarkThemePage ? "text-red-300" : "text-red-500"}`} title={locationError}>
                {locationError}
              </span>
            ) : gpsLocation && gpsLocation !== "내 지역" ? (
              <span className={`text-xs max-w-xs truncate ${isDarkThemePage ? "text-white/70" : "text-gray-600"}`}>
                {gpsLocation}
              </span>
            ) : null}
          </div>

          {/* 위치 검색 */}
          <div className="relative">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${isDarkThemePage ? "bg-white/10 text-white" : "bg-gray-100 text-gray-700"}`}>
              <Search className="w-4 h-4" />
              <input
                type="text"
                placeholder="지역 검색..."
                value={addressSearch}
                onChange={(e) => {
                  setAddressSearch(e.target.value);
                  handleAddressSearch(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                className={`text-sm bg-transparent border-none outline-none w-32 placeholder-${isDarkThemePage ? "white/50" : "gray-500"}`}
                data-testid="input-location-search"
              />
            </div>
            {showSearchResults && searchResults.length > 0 && (
              <div className={`absolute top-full left-0 w-64 mt-2 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto ${isDarkThemePage ? "bg-gray-900 text-white" : "bg-white text-gray-700"}`}>
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectAddress(result)}
                    className={`w-full text-left px-4 py-2 text-sm hover:${isDarkThemePage ? "bg-gray-800" : "bg-gray-100"}`}
                    data-testid={`location-search-result-${idx}`}
                  >
                    {result.formatted_address}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative group">
            <Link href="/features" className="flex items-center space-x-2">
              <motion.div
                initial={{ x: 0 }}
                whileHover={{ x: 5 }}
                transition={{ duration: 0.2 }}
                className="text-green-300 pointer-events-none"
              >
                →
              </motion.div>
              <span className={`${linkStyles} hover:translate-x-1 transition-transform`}>
                특징
              </span>
            </Link>
            <motion.div
              className="h-[1px] bg-green-300 w-0 group-hover:w-full transition-all duration-300 pointer-events-none"
              initial={{ width: 0 }}
              whileHover={{ width: "100%" }}
            />
          </div>

          <div className="relative group">
            <a href="/how-to-use" className="flex items-center space-x-2">
              <motion.div
                initial={{ x: 0 }}
                whileHover={{ x: 5 }}
                transition={{ duration: 0.2 }}
                className="text-green-300 pointer-events-none"
              >
                →
              </motion.div>
              <span className={`${linkStyles} hover:translate-x-1 transition-transform`}>
                이용방법
              </span>
            </a>
            <motion.div
              className="h-[1px] bg-green-300 w-0 group-hover:w-full transition-all duration-300 pointer-events-none"
              initial={{ width: 0 }}
              whileHover={{ width: "100%" }}
            />
          </div>



          {/* Chat button - 로그인한 사용자만 표시 */}
          {user && (
            <DropdownMenu open={isChatListOpen} onOpenChange={setIsChatListOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`relative ${isDarkThemePage ? "text-white hover:bg-white/10" : "text-gray-700 hover:bg-gray-100"}`}
                  data-testid="button-chat"
                >
                  <MessageCircle className="h-5 w-5" />
                  {chatUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                      {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0 max-h-[400px] overflow-auto">
                <div className="p-3 border-b bg-gray-50">
                  <h3 className="font-semibold text-sm">내 채팅</h3>
                </div>
                <DirectChatList
                  role={user.role === 'vendor' ? 'vendor' : 'customer'}
                  onSelectChat={(chatId) => {
                    setSelectedChatId(chatId);
                    setIsChatModalOpen(true);
                    setIsChatListOpen(false);
                  }}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Cart button */}
          <Link href="/cart">
            <Button
              variant="ghost"
              size="icon"
              className={`relative ${isDarkThemePage ? "text-white hover:bg-white/10" : "text-gray-700 hover:bg-gray-100"}`}
              data-testid="button-cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Button>
          </Link>

          {/* Auth buttons */}
          <div className="ml-4">
            {user ? (
              <UserDropdownMenu
                username={user.username}
                role={user.role}
                onLogout={handleLogout}
                theme={dropdownTheme}
              />
            ) : (
              <Button
                onClick={navigateToAuth}
                variant={isDarkThemePage ? "secondary" : "default"}
                className={isDarkThemePage ? "text-[#005E43] bg-white hover:bg-white/90" : ""}
              >
                로그인
              </Button>
            )}
          </div>
        </nav>

        <div className="flex items-center md:hidden">
          {/* Chat button for mobile - 로그인한 사용자만 표시 */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`relative mr-2 ${isDarkThemePage ? "text-white hover:bg-white/10" : "text-gray-700 hover:bg-gray-100"}`}
                  data-testid="button-chat-mobile"
                >
                  <MessageCircle className="h-5 w-5" />
                  {chatUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center text-[10px]">
                      {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72 p-0 max-h-[350px] overflow-auto">
                <div className="p-2 border-b bg-gray-50">
                  <h3 className="font-semibold text-sm">내 채팅</h3>
                </div>
                <DirectChatList
                  role={user.role === 'vendor' ? 'vendor' : 'customer'}
                  onSelectChat={(chatId) => {
                    setSelectedChatId(chatId);
                    setIsChatModalOpen(true);
                  }}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Cart button for mobile */}
          <Link href="/cart">
            <Button
              variant="ghost"
              size="icon"
              className={`relative mr-2 ${isDarkThemePage ? "text-white hover:bg-white/10" : "text-gray-700 hover:bg-gray-100"}`}
              data-testid="button-cart-mobile"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center text-[10px]">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Button>
          </Link>

          {/* Auth button for mobile */}
          {user ? (
            <UserDropdownMenu
              username={user.username}
              role={user.role}
              onLogout={handleLogout}
              size="sm"
              className="mr-2"
              theme={dropdownTheme}
            />
          ) : (
            <Button
              variant={isDarkThemePage ? "secondary" : "outline"}
              size="sm"
              className={`mr-2 ${isDarkThemePage ? "text-blue-600 bg-white hover:bg-white/90" : ""}`}
              onClick={navigateToAuth}
            >
              로그인
            </Button>
          )}

          <button
            onClick={toggleMobileMenu}
            className={toggleButtonColor}
            aria-label="Toggle mobile menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden ${isMobileMenuOpen ? 'block' : 'hidden'} ${mobileMenuStyles} absolute w-full left-0 top-full py-2 px-4 border-t`}
      >
        <Link href="/features" className={mobileLinkStyles}>특징</Link>
        <a href="/how-to-use" className={mobileLinkStyles}>이용방법</a>
      </div>

      {/* 직접 채팅 모달 */}
      {selectedChatId && (
        <DirectChatModal
          chatId={selectedChatId}
          isOpen={isChatModalOpen}
          onClose={() => {
            setIsChatModalOpen(false);
            setSelectedChatId(null);
          }}
        />
      )}
    </header>
  );
}
