import React, { useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { InteractiveDotGrid } from "@/components/ui/interactive-dot-grid";
import { FloatingButton } from "@/components/ui/floating-button";
import { CustomCursor } from "@/components/ui/custom-cursor";
import {
    Sparkles,
    MessageSquare,
    Search,
    ShoppingBag,
    CreditCard,
    Package,
    ArrowRight,
    CheckCircle2,
    MapPin,
    Leaf,
    Users,
    Star
} from "lucide-react";

export default function HowToUsePage() {
    const { user } = useAuth();
    const [, navigate] = useLocation();

    useEffect(() => {
        document.title = "PlanB - 이용방법";
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
                    className="py-20 px-4 text-center max-w-7xl mx-auto"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
                        <span className="block text-white/90 mb-2">PlanB</span>
                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-emerald-500">
                            이용방법
                        </span>
                    </h1>
                    <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed">
                        AI 상담부터 결제까지, 간단한 단계로 완벽한 식물을 만나보세요.
                    </p>
                </motion.section>

                {/* STEP BY STEP GUIDE */}
                <section className="py-16 px-4">
                    <div className="max-w-6xl mx-auto">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-center mb-16"
                        >
                            <h2 className="text-sm font-semibold text-green-400 tracking-widest uppercase mb-4">Step by Step</h2>
                            <p className="text-3xl md:text-4xl font-bold text-white">
                                쉽고 빠른 5단계 이용 가이드
                            </p>
                        </motion.div>

                        <div className="space-y-8">
                            <StepItem
                                number="01"
                                title="회원가입 & 로그인"
                                description="간단한 정보 입력으로 가입 후 서비스를 이용할 수 있습니다. 로그인하면 AI 상담과 주문 내역 확인이 가능합니다."
                                icon={<Users className="w-8 h-8" />}
                                delay={0}
                            />

                            <StepItem
                                number="02"
                                title="AI 식물 상담 시작"
                                description="AI에게 원하는 식물의 조건을 편하게 이야기해주세요. 집 환경, 관리 난이도, 예산 등을 고려한 맞춤 추천을 받을 수 있습니다."
                                icon={<MessageSquare className="w-8 h-8" />}
                                delay={0.1}
                            />

                            <StepItem
                                number="03"
                                title="주변 판매자 제안 확인"
                                description="AI 상담을 통해 추천받은 식물을 판매하는 주변 판매자들의 제안을 실시간으로 확인하세요. 가격, 사진, 거리 정보를 한눈에 비교할 수 있습니다."
                                icon={<Search className="w-8 h-8" />}
                                delay={0.2}
                            />

                            <StepItem
                                number="04"
                                title="마음에 드는 상품 선택 & 결제"
                                description="가장 마음에 드는 제안을 선택하고 안전하게 결제하세요. 다양한 결제 수단을 지원합니다."
                                icon={<CreditCard className="w-8 h-8" />}
                                delay={0.3}
                            />

                            <StepItem
                                number="05"
                                title="직접 수령 또는 배송"
                                description="가까운 판매자에게서 직접 수령하거나 배송을 받아 건강한 반려식물을 만나보세요!"
                                icon={<Package className="w-8 h-8" />}
                                delay={0.4}
                            />
                        </div>
                    </div>
                </section>

                {/* USER TYPES SECTION */}
                <section className="py-20 px-4 bg-gradient-to-b from-transparent to-[#080a09]/50">
                    <div className="max-w-6xl mx-auto">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-center mb-16"
                        >
                            <h2 className="text-sm font-semibold text-emerald-400 tracking-widest uppercase mb-4">For Everyone</h2>
                            <p className="text-3xl md:text-4xl font-bold text-white">
                                구매자와 판매자 모두를 위한 플랫폼
                            </p>
                        </motion.div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <UserTypeCard
                                title="구매자라면"
                                features={[
                                    "AI가 추천하는 맞춤 식물 상담",
                                    "주변 판매자 실시간 비교",
                                    "안전한 결제 시스템",
                                    "주문 내역 관리",
                                    "식물 관리 가이드 제공"
                                ]}
                                icon={<ShoppingBag className="w-10 h-10 text-green-300" />}
                                buttonText="AI 상담 시작하기"
                                onClick={() => user ? navigate("/ai-consultation") : navigate("/auth")}
                            />

                            <UserTypeCard
                                title="판매자라면"
                                features={[
                                    "무료 입점 및 상품 등록",
                                    "AI 매칭으로 고객 연결",
                                    "실시간 입찰 알림",
                                    "판매 현황 대시보드",
                                    "정산 내역 확인"
                                ]}
                                icon={<Leaf className="w-10 h-10 text-emerald-300" />}
                                buttonText="판매자 등록하기"
                                onClick={() => user ? navigate("/vendor-dashboard") : navigate("/auth")}
                            />
                        </div>
                    </div>
                </section>

                {/* FAQ SECTION */}
                <section className="py-20 px-4">
                    <div className="max-w-4xl mx-auto">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="text-center mb-16"
                        >
                            <h2 className="text-sm font-semibold text-green-400 tracking-widest uppercase mb-4">FAQ</h2>
                            <p className="text-3xl md:text-4xl font-bold text-white">
                                자주 묻는 질문
                            </p>
                        </motion.div>

                        <div className="space-y-4">
                            <FAQItem
                                question="서비스 이용료가 있나요?"
                                answer="구매자는 무료로 AI 상담과 구매 서비스를 이용할 수 있습니다. 판매자는 거래 성사 시에만 소정의 수수료가 부과됩니다."
                            />
                            <FAQItem
                                question="배송은 어떻게 진행되나요?"
                                answer="판매자와 구매자가 직접 거래 방식을 결정합니다. 가까운 거리의 경우 직접 수령이 가능하고, 배송이 필요한 경우 판매자가 안전하게 포장하여 발송합니다."
                            />
                            <FAQItem
                                question="환불/교환 정책은 어떻게 되나요?"
                                answer="식물의 상태에 문제가 있는 경우, 수령 후 24시간 이내에 고객센터로 문의해 주시면 환불 또는 교환 처리를 도와드립니다."
                            />
                            <FAQItem
                                question="AI 상담은 어떤 방식으로 진행되나요?"
                                answer="채팅 형태로 진행됩니다. 원하는 식물 종류, 집 환경(조명, 습도 등), 관리 가능 시간 등을 입력하면 AI가 최적의 식물을 추천해 드립니다."
                            />
                        </div>
                    </div>
                </section>

                {/* CTA BOTTOM */}
                <section className="py-20 px-4 text-center">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        whileInView={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.8 }}
                        className="relative max-w-4xl mx-auto bg-gradient-to-br from-green-900/30 to-emerald-900/30 p-12 sm:p-16 rounded-3xl border border-white/10 backdrop-blur-xl overflow-hidden"
                    >
                        {/* Decorative glows */}
                        <div className="absolute top-0 left-0 w-full h-full bg-green-500/10 blur-[100px] pointer-events-none"></div>

                        <h2 className="text-3xl sm:text-4xl font-bold mb-6 relative z-10">
                            지금 바로 <span className="text-green-400">시작</span>해보세요
                        </h2>
                        <p className="text-lg text-white/70 mb-8 max-w-xl mx-auto relative z-10">
                            가입 즉시 AI 식물 상담 서비스를 무료로 이용하실 수 있습니다.
                        </p>
                        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                            <FloatingButton
                                onClick={() => user ? navigate("/ai-consultation") : navigate("/auth")}
                                className="bg-white text-green-900 hover:bg-gray-100 font-bold px-10 py-4 text-lg rounded-full shadow-lg transition-all transform hover:scale-105"
                            >
                                <Sparkles className="w-5 h-5 mr-2" />
                                AI 상담 시작하기
                            </FloatingButton>

                            <button
                                onClick={() => navigate("/features")}
                                className="text-white/70 hover:text-white font-medium px-6 py-4 text-lg flex items-center gap-2 transition-colors"
                            >
                                서비스 특징 보기 <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </motion.div>
                </section>

            </main>

            <Footer />
        </div>
    );
}

// Sub-components
function StepItem({ number, title, description, icon, delay }: {
    number: string,
    title: string,
    description: string,
    icon: React.ReactNode,
    delay: number
}) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay }}
            viewport={{ once: true }}
            className="flex gap-6 items-start bg-white/5 border border-white/10 p-6 sm:p-8 rounded-2xl hover:bg-white/10 transition-all duration-300 group"
        >
            <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl flex items-center justify-center text-green-400 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-green-500/50 font-bold text-sm">{number}</span>
                    <h3 className="text-xl sm:text-2xl font-bold text-white group-hover:text-green-300 transition-colors">
                        {title}
                    </h3>
                </div>
                <p className="text-white/60 text-base sm:text-lg leading-relaxed">
                    {description}
                </p>
            </div>
        </motion.div>
    );
}

function UserTypeCard({ title, features, icon, buttonText, onClick }: {
    title: string,
    features: string[],
    icon: React.ReactNode,
    buttonText: string,
    onClick: () => void
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:bg-white/10 transition-all duration-300 group"
        >
            <div className="mb-6 p-4 bg-white/5 rounded-xl inline-block group-hover:scale-110 transition-transform duration-300 ring-1 ring-white/10">
                {icon}
            </div>
            <h3 className="text-2xl font-bold mb-6 text-white group-hover:text-green-300 transition-colors">{title}</h3>
            <ul className="space-y-3 mb-8">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3 text-white/70">
                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>
            <button
                onClick={onClick}
                className="w-full py-3 px-6 bg-green-500/20 hover:bg-green-500/30 text-green-300 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
            >
                {buttonText}
                <ArrowRight className="w-4 h-4" />
            </button>
        </motion.div>
    );
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white/5 border border-white/10 rounded-xl overflow-hidden"
        >
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full p-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
            >
                <span className="text-lg font-semibold text-white">{question}</span>
                <motion.span
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-green-400"
                >
                    <ArrowRight className="w-5 h-5 rotate-90" />
                </motion.span>
            </button>
            <motion.div
                initial={false}
                animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
            >
                <p className="px-5 pb-5 text-white/60 leading-relaxed">
                    {answer}
                </p>
            </motion.div>
        </motion.div>
    );
}
