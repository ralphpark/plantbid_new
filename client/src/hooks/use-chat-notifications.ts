import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase, DirectMessagePayload } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { useUnreadChatCount } from '@/hooks/use-direct-chat';

interface UseChatNotificationsOptions {
  enabled?: boolean;
  onNewMessage?: (message: DirectMessagePayload) => void;
}

export function useChatNotifications({
  enabled = true,
  onNewMessage,
}: UseChatNotificationsOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // 읽지 않은 메시지 수
  const { data: unreadData, refetch: refetchUnread } = useUnreadChatCount();

  const isVendorUser = user?.role === 'vendor';
  const totalUnreadCount = isVendorUser
    ? unreadData?.vendorUnreadCount ?? 0
    : unreadData?.customerUnreadCount ?? 0;

  // 전역 알림 구독 (내 채팅방들의 새 메시지)
  useEffect(() => {
    if (!enabled || !user) return;

    // 기존 채널 정리
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // 전역 direct_messages 채널 구독
    const channel = supabase
      .channel('direct_messages_global')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
        },
        (payload) => {
          const newMessage = payload.new as DirectMessagePayload;

          // 내가 보낸 메시지가 아닌 경우만 알림
          if (newMessage.sender_id !== user.id) {
            // 캐시 갱신
            queryClient.invalidateQueries({ queryKey: ['/api/direct-chats/unread/count'] });
            queryClient.invalidateQueries({ queryKey: ['/api/direct-chats'] });

            // 콜백 호출
            onNewMessage?.(newMessage);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, user, queryClient, onNewMessage]);

  // 브라우저 알림 권한 요청
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;

    if (Notification.permission === 'granted') return true;

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }, []);

  // 브라우저 알림 보내기
  const showNotification = useCallback(
    async (title: string, body: string, onClick?: () => void) => {
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) return;

      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'plantbid-chat',
      });

      if (onClick) {
        notification.onclick = () => {
          window.focus();
          onClick();
          notification.close();
        };
      }

      // 5초 후 자동 닫기
      setTimeout(() => notification.close(), 5000);
    },
    [requestNotificationPermission]
  );

  return {
    totalUnreadCount,
    refetchUnread,
    requestNotificationPermission,
    showNotification,
  };
}
