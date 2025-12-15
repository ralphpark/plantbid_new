import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { UserDropdownMenu, UserDropdownProps } from "@/components/ui/simple-dropdown";
import { motion, useScroll, useTransform } from "framer-motion";
import { ShoppingCart, MapPin, Search } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const handleSetGpsLocation = (newLocation: string, data?: LocationData) => {
    setGpsLocation(newLocation);
    if (data) {
      setGpsLocationData(data);
    }
  };

  // 검색 위치 업데이트 (판매자/상품 필터링에 사용)
  const handleSetSearchLocation = (newLocation: string, data?: LocationData) => {
    setSearchLocation(newLocation);
    if (data) {
      setSearchLocationData(data);
      localStorage.setItem('searchLocation', JSON.stringify(data));
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
  
  // 현재 경로가 홈인지 확인
  const isHomePage = location === "/";
  
  useEffect(() => {
    // GPS 위치 감지
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            const response = await fetch(`/api/map/address-by-coords?lat=${lat}&lng=${lng}`);
            const data = await response.json();
            
            if (data.success && data.results && data.results.length > 0) {
              const address = data.results[0].formatted_address;
              handleSetGpsLocation(address, { address, lat, lng });
            }
          } catch (error) {
            console.error('GPS 감지 실패:', error);
          }
        },
        (error) => {
          console.error('GPS 오류:', error);
        }
      );
    }

    // 검색 위치 로드
    const saved = localStorage.getItem('searchLocation');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.address) {
          setSearchLocation(parsed.address);
          setSearchLocationData(parsed);
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
    
    // GPS 위치 기반으로 판매자/상품 필터링
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // 백엔드 API를 통해 역지오코딩 수행
            const response = await fetch(`/api/map/address-by-coords?lat=${lat}&lng=${lng}`);
            const data = await response.json();
            
            if (data.success && data.results && data.results.length > 0) {
              const address = data.results[0].formatted_address;
              // GPS 위치로 필터링 설정
              handleSetSearchLocation(address, { address, lat, lng });
            }
          } catch (error) {
            console.error('위치 정보 조회 실패:', error);
          }
        },
        (error) => {
          console.error('GPS 감지 오류:', error);
        }
      );
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
  const headerStyles = isHomePage 
    ? {
        backgroundColor: scrolled ? "rgba(0, 94, 67, 0.98)" : "rgba(0, 94, 67, 0.7)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: scrolled ? "0 4px 20px rgba(0, 0, 0, 0.15)" : "0 1px 10px rgba(0, 0, 0, 0.1)",
        color: "white",
        transition: "all 0.3s ease",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
      }
    : {
        backgroundColor: "white",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
        color: "rgb(31, 41, 55)",
      };
      
  // 홈 페이지와 다른 페이지의 로고 스타일 구분
  const logoColor = isHomePage ? "white" : "primary";
  
  // 홈 페이지와 다른 페이지의 링크 스타일 구분
  const linkStyles = isHomePage
    ? "font-sans text-sm font-medium text-white/90 hover:text-white transition-colors duration-300"
    : "font-sans text-sm font-medium text-gray-700 hover:text-primary transition-colors duration-300";
    
  // 홈 페이지와 다른 페이지의 모바일 메뉴 토글 버튼 스타일 구분
  const toggleButtonColor = isHomePage ? "text-white" : "text-gray-800";
  
  // 홈 페이지와 다른 페이지의 모바일 메뉴 스타일 구분
  const mobileMenuStyles = isHomePage
    ? "bg-[#005E43] text-white border-[#004835]"
    : "bg-white text-gray-700 border-gray-100";
    
  // 홈 페이지와 다른 페이지의 모바일 링크 스타일 구분
  const mobileLinkStyles = isHomePage
    ? "block py-2 font-sans text-sm font-medium text-white/90 hover:text-white"
    : "block py-2 font-sans text-sm font-medium text-gray-700 hover:text-primary";

  // 드롭다운 메뉴 props
  const dropdownTheme = isHomePage ? 'dark' as const : 'light' as const;

  return (
    <motion.header 
      className="py-5 px-4 sm:px-6 lg:px-8 fixed top-0 left-0 w-full z-50"
      style={headerStyles}
      initial={isHomePage ? { backgroundColor: "rgba(0, 94, 67, 0.7)" } : undefined}
    >
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="flex items-center">
          <Logo className="h-10" color={isHomePage ? "white" : "primary"} variant="horizontal" />
        </Link>
        
        <nav className="hidden md:flex space-x-6 items-center">
          {/* 현재 위치 버튼 및 주소 표시 */}
          <div className="flex flex-col items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGetCurrentLocation}
              className={`flex items-center gap-1 ${isHomePage ? "text-white/90 hover:text-white hover:bg-white/10" : "text-gray-700 hover:text-primary hover:bg-gray-100"}`}
              data-testid="button-current-location"
              title="현재 위치 감지"
            >
              <MapPin className="w-4 h-4" />
              <span className="text-xs">현재위치</span>
            </Button>
            {gpsLocation && gpsLocation !== "내 지역" && (
              <span className={`text-xs max-w-xs truncate ${isHomePage ? "text-white/70" : "text-gray-600"}`}>
                {gpsLocation}
              </span>
            )}
          </div>

          {/* 위치 검색 */}
          <div className="relative">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${isHomePage ? "bg-white/10 text-white" : "bg-gray-100 text-gray-700"}`}>
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
                className={`text-sm bg-transparent border-none outline-none w-32 placeholder-${isHomePage ? "white/50" : "gray-500"}`}
                data-testid="input-location-search"
              />
            </div>
            {showSearchResults && searchResults.length > 0 && (
              <div className={`absolute top-full left-0 w-64 mt-2 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto ${isHomePage ? "bg-gray-900 text-white" : "bg-white text-gray-700"}`}>
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectAddress(result)}
                    className={`w-full text-left px-4 py-2 text-sm hover:${isHomePage ? "bg-gray-800" : "bg-gray-100"}`}
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
            <a href="/features#process" className="flex items-center space-x-2">
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
          

          
          {/* Cart button */}
          <Link href="/cart">
            <Button 
              variant="ghost" 
              size="icon"
              className={`relative ${isHomePage ? "text-white hover:bg-white/10" : "text-gray-700 hover:bg-gray-100"}`}
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
                variant={isHomePage ? "secondary" : "default"}
                className={isHomePage ? "text-[#005E43] bg-white hover:bg-white/90" : ""}
              >
                로그인
              </Button>
            )}
          </div>
        </nav>
        
        <div className="flex items-center md:hidden">
          {/* Cart button for mobile */}
          <Link href="/cart">
            <Button 
              variant="ghost" 
              size="icon"
              className={`relative mr-2 ${isHomePage ? "text-white hover:bg-white/10" : "text-gray-700 hover:bg-gray-100"}`}
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
              variant={isHomePage ? "secondary" : "outline"} 
              size="sm" 
              className={`mr-2 ${isHomePage ? "text-blue-600 bg-white hover:bg-white/90" : ""}`}
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
        <a href="/features#process" className={mobileLinkStyles}>이용방법</a>
      </div>
    </motion.header>
  );
}
