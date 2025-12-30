import React, { useEffect, useState, useRef } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { motion, useScroll, useTransform } from "framer-motion";
import { InteractiveDotGrid } from "@/components/ui/interactive-dot-grid";
import { FloatingButton } from "@/components/ui/floating-button";
import { CustomCursor } from "@/components/ui/custom-cursor";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, MapPin, Leaf, CheckCircle2, ArrowRight, Sprout, ShieldCheck } from "lucide-react";

// 타이핑 효과 컴포넌트 (기존 유지)
const TypingText = ({ phrases }: { phrases: string[] }) => {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [fontSize, setFontSize] = useState("text-3xl");
  const [showCursor, setShowCursor] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const adjustFontSize = () => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.offsetWidth;
    const currentPhrase = phrases[currentPhraseIndex];
    if (containerWidth < 400) {
      if (currentPhrase.length > 25) setFontSize("text-lg");
      else if (currentPhrase.length > 15) setFontSize("text-xl");
      else setFontSize("text-2xl");
    } else if (containerWidth < 640) {
      if (currentPhrase.length > 25) setFontSize("text-xl");
      else if (currentPhrase.length > 15) setFontSize("text-2xl");
      else setFontSize("text-3xl");
    } else {
      if (currentPhrase.length > 30) setFontSize("text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl");
      else if (currentPhrase.length > 20) setFontSize("text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl");
      else setFontSize("text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl");
    }
  };

  useEffect(() => {
    const handleResize = () => adjustFontSize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentPhraseIndex]);

  const moveToNextPhrase = () => {
    setIsTyping(true);
    setDisplayedText("");
    setCurrentPhraseIndex((prevIndex) => (prevIndex + 1) % phrases.length);
  };

  useEffect(() => {
    adjustFontSize();
    if (!phrases || phrases.length === 0) return;
    const currentPhrase = phrases[currentPhraseIndex];
    if (isTyping) {
      if (displayedText.length < currentPhrase.length) {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setDisplayedText(currentPhrase.substring(0, displayedText.length + 1));
        }, 30);
      } else {
        setIsTyping(false);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          moveToNextPhrase();
        }, 2000);
      }
    }
  }, [displayedText, currentPhraseIndex, isTyping, phrases]);

  useEffect(() => {
    const cursorTimer = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 500);
    return () => clearInterval(cursorTimer);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full text-center ${fontSize} text-green-300 font-bold min-h-[4rem] flex items-center justify-center overflow-hidden whitespace-nowrap`}
    >
      {displayedText}
      <span className={`${showCursor ? 'opacity-100' : 'opacity-0'} ml-1 w-2 h-8 bg-green-300 transition-opacity duration-200`}></span>
    </div>
  );
};

export default function FeaturesPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { scrollYProgress } = useScroll();

  // 사이트 설정 데이터
  const { data: siteSettings } = useQuery({
    queryKey: ['site-settings', Date.now()],
    queryFn: async () => {
      try {
        const response = await fetch('/api/site-settings');
        if (!response.ok) return null;
        const data = await response.json();
        if (!data.homePage) return null;
        let homePageData = data.homePage;
        if (typeof homePageData === 'string') homePageData = JSON.parse(homePageData);
        if (typeof homePageData === 'string') homePageData = JSON.parse(homePageData);
        return homePageData;
      } catch { return null; }
    },
  });

  const scrollOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const scrollY = useTransform(scrollYProgress, [0, 0.2], [0, -50]);

  useEffect(() => {
    document.title = "PlanB - 특징 및 기능 소개";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-[#0E1210] font-sans selection:bg-green-500/30 text-white">
      <CustomCursor />

      {/* Background - Fixed */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0E1210] via-[#13201a] to-[#0E1210]" />
        <InteractiveDotGrid spacing={40} dotSize={1.5} color="rgba(74, 222, 128, 0.15)" />
      </div>

      <Header />

      {/* Main Content Area */}
      <main className="flex-grow pt-24 relative z-10 w-full overflow-hidden">

        {/* HERO SECTION */}
        <motion.section
          className="min-h-[90vh] flex flex-col items-center justify-center px-4 relative max-w-7xl mx-auto"
          style={{ opacity: scrollOpacity, y: scrollY }}
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center w-full max-w-5xl space-y-8"
          >
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-tight">
              <span className="block text-white/90 mb-2">{siteSettings?.title || "식물 거래의"}</span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-emerald-500 pb-2">
                새로운 기준
              </span>
            </h1>

            <div className="h-24 sm:h-32 flex items-center justify-center w-full">
              <TypingText phrases={siteSettings?.typingPhrases || [
                "AI가 제안하는 맞춤형 반려식물",
                "지역 판매자와의 투명한 직거래",
                "전문가가 알려주는 식물 관리법",
                "가장 가까운 곳에서 만나는 자연"
              ]} />
            </div>

            <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
              PlanB는 단순한 마켓플레이스가 아닙니다.<br className="hidden sm:block" />
              AI 기술과 로컬 커뮤니티를 연결하여 당신에게 가장 완벽한 식물 경험을 선사합니다.
            </p>

            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              <FloatingButton
                onClick={() => user ? navigate("/ai-consultation") : navigate("/auth")}
                className="bg-green-500 hover:bg-green-400 text-black font-bold px-10 py-4 text-lg rounded-full flex items-center gap-2 shadow-[0_0_30px_rgba(74,222,128,0.3)] transition-all"
              >
                <Sparkles className="w-5 h-5" />
                AI 상담 시작하기
              </FloatingButton>

              <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-white/70 hover:text-white font-medium px-8 py-4 text-lg flex items-center gap-2 transition-colors"
              >
                더 알아보기 <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        </motion.section>

        {/* FEATURES GRID */}
        <section id="features" className="py-32 px-4 relative">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="text-center mb-20"
            >
              <h2 className="text-sm font-semibold text-green-400 tracking-widest uppercase mb-4">Core Features</h2>
              <p className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                왜 PlanB인가요?
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <FeatureCard
                icon={<Sparkles className="w-10 h-10 text-green-300" />}
                title="AI 환경 분석 & 추천"
                description="주거 환경, 관리 난이도, 선호도를 분석하여 실패 없는 식물 선택을 도와드립니다. 더 이상 식물 킬러가 되지 마세요."
                delay={0}
              />
              <FeatureCard
                icon={<MapPin className="w-10 h-10 text-emerald-300" />}
                title="하이퍼 로컬 입찰"
                description="내 주변 검증된 판매자들로부터 제안을 받아보세요. 배송비와 이동 스트레스 없이 건강한 식물을 만날 수 있습니다."
                delay={0.1}
              />
              <FeatureCard
                icon={<Leaf className="w-10 h-10 text-teal-300" />}
                title="전문 케어 가이드"
                description="구매한 식물의 상세 관리법부터 문제 발생 시 진단까지. PlanB가 당신의 플랜테리어 라이프를 끝까지 책임집니다."
                delay={0.2}
              />
            </div>
          </div>
        </section>

        {/* PROCESS STEPS */}
        <section className="py-32 px-4 bg-gradient-to-b from-transparent to-[#080a09]/50">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-20"
            >
              <h2 className="text-sm font-semibold text-emerald-400 tracking-widest uppercase mb-4">How it works</h2>
              <p className="text-4xl md:text-5xl font-bold text-white">
                간단한 3단계 프로세스
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
              {/* Connecting Line (Desktop) */}
              <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-green-500/0 via-green-500/30 to-green-500/0 z-0"></div>

              <StepCard
                number="01"
                title="상담 신청"
                desc="AI에게 원하는 식물의 조건이나 현재 환경을 편하게 이야기해주세요."
                icon={<Sprout className="w-6 h-6" />}
              />
              <StepCard
                number="02"
                title="입찰 확인"
                desc="주변 판매자들이 보낸 가격과 식물 사진을 실시간으로 비교해보세요."
                icon={<ShieldCheck className="w-6 h-6" />}
              />
              <StepCard
                number="03"
                title="선택 및 결제"
                desc="가장 마음에 드는 제안을 선택하고 안전하게 결제하면 완료됩니다."
                icon={<CheckCircle2 className="w-6 h-6" />}
              />
            </div>
          </div>
        </section>

        {/* CTA BOTTOM */}
        <section className="py-32 px-4 text-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="relative max-w-4xl mx-auto bg-gradient-to-br from-green-900/30 to-emerald-900/30 p-12 sm:p-20 rounded-3xl border border-white/10 backdrop-blur-xl overflow-hidden"
          >
            {/* Decorative glows */}
            <div className="absolute top-0 left-0 w-full h-full bg-green-500/10 blur-[100px] pointer-events-none"></div>

            <h2 className="text-3xl sm:text-5xl font-bold mb-8 relative z-10">
              지금 바로 <span className="text-green-400">나만의 반려식물</span>을<br />찾아보세요.
            </h2>
            <p className="text-xl text-white/70 mb-10 max-w-xl mx-auto relative z-10">
              가입 즉시 AI 식물 상담 서비스를 무료로 이용하실 수 있습니다.
            </p>
            <div className="relative z-10">
              <FloatingButton
                onClick={() => user ? navigate("/ai-consultation") : navigate("/auth")}
                className="bg-white text-green-900 hover:bg-gray-100 font-bold px-12 py-5 text-xl rounded-full shadow-lg transition-all transform hover:scale-105"
              >
                무료 상담 시작하기
              </FloatingButton>
            </div>
          </motion.div>
        </section>

      </main>

      <Footer />
    </div>
  );
}

// Sub-components for better readability
function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      viewport={{ once: true, margin: "-50px" }}
      className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-all duration-300 group backdrop-blur-sm"
    >
      <div className="mb-6 p-4 bg-white/5 rounded-xl inline-block group-hover:scale-110 transition-transform duration-300 ring-1 ring-white/10">
        {icon}
      </div>
      <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-green-300 transition-colors">{title}</h3>
      <p className="text-white/60 leading-relaxed text-lg">
        {description}
      </p>
    </motion.div>
  );
}

function StepCard({ number, title, desc, icon }: { number: string, title: string, desc: string, icon: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative z-10 flex flex-col items-center text-center"
    >
      <div className="w-24 h-24 bg-[#0E1210] border-2 border-green-500/30 rounded-full flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(74,222,128,0.1)] group hover:border-green-400 transition-colors">
        <span className="text-3xl font-bold text-green-500/50 group-hover:text-green-400 transition-colors">{number}</span>
      </div>
      <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
        {title}
      </h3>
      <p className="text-white/60 text-lg max-w-xs">{desc}</p>
    </motion.div>
  );
}
