import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DirectMessage } from '@/hooks/use-direct-chat';

interface DirectChatMessageProps {
  message: DirectMessage;
  isOwnMessage: boolean;
  showAvatar?: boolean;
  senderName?: string;
}

export function DirectChatMessage({
  message,
  isOwnMessage,
  showAvatar = true,
  senderName,
}: DirectChatMessageProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'a h:mm', { locale: ko });
  };

  // 이미지 첨부 렌더링
  const renderAttachments = () => {
    if (!message.attachments) return null;

    // 이미지 첨부
    if (message.attachments.imageUrls && message.attachments.imageUrls.length > 0) {
      return (
        <div className="mt-2 space-y-2">
          {message.attachments.imageUrls.map((url, idx) => (
            <img
              key={idx}
              src={url}
              alt={`첨부 이미지 ${idx + 1}`}
              className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(url, '_blank')}
            />
          ))}
        </div>
      );
    }

    // 상품 정보 첨부
    if (message.attachments.productInfo) {
      const { name, price, imageUrl } = message.attachments.productInfo;
      return (
        <div className="mt-2 p-3 bg-white/50 rounded-lg border">
          <div className="flex gap-3">
            {imageUrl && (
              <img src={imageUrl} alt={name} className="w-16 h-16 rounded object-cover" />
            )}
            <div>
              <p className="font-medium text-sm">{name}</p>
              <p className="text-primary font-semibold">₩{price.toLocaleString()}</p>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className={cn(
        'flex gap-2 mb-3',
        isOwnMessage ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* 아바타 (상대방 메시지만) */}
      {!isOwnMessage && showAvatar && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-medium">
            {senderName?.charAt(0) || (message.senderRole === 'vendor' ? '판' : '고')}
          </span>
        </div>
      )}

      <div
        className={cn(
          'max-w-[70%] flex flex-col',
          isOwnMessage ? 'items-end' : 'items-start'
        )}
      >
        {/* 발신자 이름 (상대방 메시지만) */}
        {!isOwnMessage && senderName && (
          <span className="text-xs text-gray-500 mb-1 ml-1">{senderName}</span>
        )}

        {/* 메시지 버블 */}
        <div
          className={cn(
            'px-4 py-2 rounded-2xl',
            isOwnMessage
              ? 'bg-primary text-white rounded-tr-sm'
              : 'bg-gray-100 text-gray-900 rounded-tl-sm'
          )}
        >
          {/* 텍스트 내용 */}
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

          {/* 첨부 파일 */}
          {renderAttachments()}
        </div>

        {/* 시간 + 읽음 표시 */}
        <div
          className={cn(
            'flex items-center gap-1 mt-1 px-1',
            isOwnMessage ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          <span className="text-[10px] text-gray-400">{formatTime(message.createdAt)}</span>
          {isOwnMessage && (
            message.isRead ? (
              <CheckCheck className="w-3 h-3 text-blue-500" />
            ) : (
              <Check className="w-3 h-3 text-gray-400" />
            )
          )}
        </div>
      </div>
    </div>
  );
}
