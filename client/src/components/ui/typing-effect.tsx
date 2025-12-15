import { useState, useEffect, useRef, useMemo } from "react";

interface TypingEffectProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
}

export function TypingEffect({ text, speed = 30, onComplete }: TypingEffectProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // 줄바꿈 코드 처리
  const processedText = useMemo(() => {
    return text.replace(/\\n\\n|\n\n|\\n/g, '\n');
  }, [text]);

  useEffect(() => {
    // 새로운 텍스트를 받으면 타이핑 상태 초기화
    setDisplayedText("");
    setCurrentIndex(0);
  }, [processedText]);

  useEffect(() => {
    // 이미 완료된 경우 리턴
    if (currentIndex >= processedText.length) {
      if (onComplete) onComplete();
      return;
    }

    // 타이핑 효과 인터벌 설정
    intervalRef.current = setInterval(() => {
      const nextChar = processedText[currentIndex];
      setDisplayedText(prev => prev + nextChar);
      setCurrentIndex(prev => prev + 1);

      // 모든 텍스트를 표시했으면 인터벌 클리어
      if (currentIndex + 1 >= processedText.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (onComplete) onComplete();
      }
    }, speed);

    // 컴포넌트 언마운트 시 인터벌 클리어
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentIndex, processedText, speed, onComplete]);

  return (
    <div className="typing-effect whitespace-pre-wrap">
      {displayedText}
      {currentIndex < processedText.length && (
        <span className="typing-cursor animate-pulse">|</span>
      )}
    </div>
  );
}