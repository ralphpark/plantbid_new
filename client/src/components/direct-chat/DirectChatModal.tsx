import { useEffect, useRef } from 'react';
import { X, Loader2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDirectChat } from '@/hooks/use-direct-chat';
import { useAuth } from '@/hooks/use-auth';
import { DirectChatMessage } from './DirectChatMessage';
import { DirectChatInput } from './DirectChatInput';
import { cn } from '@/lib/utils';

interface DirectChatModalProps {
  chatId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function DirectChatModal({ chatId, isOpen, onClose }: DirectChatModalProps) {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const {
    chat,
    messages,
    isLoading,
    error,
    sendMessage,
    isSending,
  } = useDirectChat({ chatId, enabled: isOpen });

  console.log('[DirectChatModal] 상태 - isLoading:', isLoading, 'error:', error, 'chat:', chat?.id);

  // 새 메시지 시 자동 스크롤
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ESC로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // 모달 오픈 시 body 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // 현재 사용자 역할 결정
  const userRole = chat?.customerId === user?.id ? 'customer' : 'vendor';
  const partnerName = userRole === 'customer'
    ? (chat?.vendorBusinessName || chat?.vendorName || '판매자')
    : (chat?.customerName || '고객');

  return (
    <>
      {/* 오버레이 */}
      <div
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* 모달 */}
      <div
        className={cn(
          'fixed z-[51] bg-white rounded-2xl shadow-2xl',
          'w-full max-w-md h-[600px] max-h-[90vh]',
          'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'flex flex-col overflow-hidden',
          'animate-in zoom-in-95 fade-in duration-200'
        )}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-green-500 to-green-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold">{partnerName}</h2>
              <p className="text-xs text-white/80">
                {userRole === 'customer' ? '판매자와 대화 중' : '고객과 대화 중'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* 메시지 영역 */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 bg-gray-50 relative z-0"
        >
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-green-500" />
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <p className="text-gray-500 mb-2">메시지를 불러올 수 없습니다</p>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                  다시 시도
                </Button>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center">
              <div className="text-gray-400">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">아직 메시지가 없습니다</p>
                <p className="text-xs mt-1">첫 메시지를 보내보세요!</p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => {
                const isOwnMessage = message.senderId === user?.id;
                // 이전 메시지와 발신자가 같으면 아바타 숨김
                const prevMessage = messages[index - 1];
                const showAvatar = !prevMessage || prevMessage.senderId !== message.senderId;

                return (
                  <DirectChatMessage
                    key={message.id}
                    message={message}
                    isOwnMessage={isOwnMessage}
                    showAvatar={showAvatar}
                    senderName={!isOwnMessage ? partnerName : undefined}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* 입력 영역 */}
        <DirectChatInput
          onSend={sendMessage}
          isSending={isSending}
          disabled={isLoading || !!error}
        />
      </div>
    </>
  );
}
