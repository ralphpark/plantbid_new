import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useDirectChatList, type DirectChat } from '@/hooks/use-direct-chat';
import { cn } from '@/lib/utils';

interface DirectChatListProps {
  role: 'customer' | 'vendor';
  onSelectChat: (chatId: number) => void;
  selectedChatId?: number;
}

export function DirectChatList({ role, onSelectChat, selectedChatId }: DirectChatListProps) {
  const { data: chats, isLoading, error } = useDirectChatList(role);

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) {
      return format(date, 'a h:mm', { locale: ko });
    } else if (diffInDays < 7) {
      return formatDistanceToNow(date, { addSuffix: true, locale: ko });
    } else {
      return format(date, 'M/d', { locale: ko });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-green-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>채팅 목록을 불러올 수 없습니다</p>
      </div>
    );
  }

  if (!chats || chats.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">아직 채팅 내역이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="divide-y">
      {chats.map((chat) => {
        const unreadCount = role === 'customer' ? chat.customerUnreadCount : chat.vendorUnreadCount;
        const partnerName = role === 'customer'
          ? (chat.vendorBusinessName || chat.vendorName || '판매자')
          : (chat.customerName || '고객');
        const isSelected = chat.id === selectedChatId;

        return (
          <button
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={cn(
              'w-full flex items-start gap-3 p-4 text-left transition-colors',
              isSelected ? 'bg-green-50' : 'hover:bg-gray-50'
            )}
          >
            {/* 아바타 */}
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
              'bg-gradient-to-br from-green-400 to-green-600'
            )}>
              <span className="text-white font-medium">
                {partnerName.charAt(0)}
              </span>
            </div>

            {/* 채팅 정보 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium text-gray-900 truncate">{partnerName}</h3>
                {chat.lastMessageAt && (
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                    {formatTime(chat.lastMessageAt)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 truncate">
                  {chat.lastMessagePreview || '새로운 대화를 시작하세요'}
                </p>
                {unreadCount > 0 && (
                  <span className="flex-shrink-0 ml-2 min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
