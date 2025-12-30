import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, DirectMessagePayload } from '@/lib/supabase';
import { apiRequest } from '@/lib/queryClient';

export interface DirectChat {
  id: number;
  customerId: number;
  vendorId: number;
  orderId?: string;
  bidId?: number;
  conversationId?: number;
  status: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  customerUnreadCount: number;
  vendorUnreadCount: number;
  createdAt: string;
  updatedAt: string;
  // JOIN으로 가져온 추가 정보
  customerName?: string;
  vendorName?: string;
  vendorBusinessName?: string;
}

export interface DirectMessage {
  id: number;
  chatId: number;
  senderId: number;
  senderRole: 'customer' | 'vendor';
  content: string;
  messageType: string;
  attachments?: {
    imageUrls?: string[];
    productId?: number;
    productInfo?: {
      name: string;
      price: number;
      imageUrl?: string;
    };
  };
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

interface UseDirectChatOptions {
  chatId: number | null;
  enabled?: boolean;
}

export function useDirectChat({ chatId, enabled = true }: UseDirectChatOptions) {
  const queryClient = useQueryClient();
  const [realtimeMessages, setRealtimeMessages] = useState<DirectMessage[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // 채팅방 정보 조회
  const chatQuery = useQuery<DirectChat>({
    queryKey: ['/api/direct-chats', chatId],
    queryFn: async () => {
      const res = await fetch(`/api/direct-chats/${chatId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch chat');
      return res.json();
    },
    enabled: !!chatId && enabled,
  });

  // 메시지 목록 조회 (초기 로드)
  const messagesQuery = useQuery<DirectMessage[]>({
    queryKey: ['/api/direct-chats', chatId, 'messages'],
    queryFn: async () => {
      const res = await fetch(`/api/direct-chats/${chatId}/messages?limit=50`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      // API가 { messages, hasMore } 형태로 반환
      return data.messages || [];
    },
    enabled: !!chatId && enabled,
  });

  // Supabase Realtime 구독
  useEffect(() => {
    if (!chatId || !enabled) return;

    // 기존 채널 정리
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`direct_messages:chat_id=${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const newMessage = payload.new as DirectMessagePayload;
          // camelCase로 변환
          const formattedMessage: DirectMessage = {
            id: newMessage.id,
            chatId: newMessage.chat_id,
            senderId: newMessage.sender_id,
            senderRole: newMessage.sender_role,
            content: newMessage.content,
            messageType: newMessage.message_type,
            attachments: newMessage.attachments,
            isRead: newMessage.is_read,
            readAt: newMessage.read_at || undefined,
            createdAt: newMessage.created_at,
          };

          // 중복 방지하며 메시지 추가
          setRealtimeMessages(prev => {
            if (prev.some(m => m.id === formattedMessage.id)) return prev;
            return [...prev, formattedMessage];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as DirectMessagePayload;
          // 읽음 상태 업데이트
          setRealtimeMessages(prev =>
            prev.map(m =>
              m.id === updatedMessage.id
                ? { ...m, isRead: updatedMessage.is_read, readAt: updatedMessage.read_at || undefined }
                : m
            )
          );
          // 쿼리 캐시도 업데이트
          queryClient.invalidateQueries({ queryKey: ['/api/direct-chats', chatId, 'messages'] });
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
  }, [chatId, enabled, queryClient]);

  // 메시지 전송
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content: string; messageType?: string; attachments?: any }) => {
      return apiRequest('POST', `/api/direct-chats/${chatId}/messages`, data);
    },
    onSuccess: () => {
      // 채팅 목록 새로고침 (lastMessageAt 업데이트를 위해)
      queryClient.invalidateQueries({ queryKey: ['/api/direct-chats'] });
    },
  });

  // 읽음 처리
  const markAsReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('PATCH', `/api/direct-chats/${chatId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/direct-chats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/direct-chats/unread/count'] });
    },
  });

  // 읽음 처리 자동 호출
  useEffect(() => {
    if (chatId && enabled && chatQuery.data) {
      markAsReadMutation.mutate();
    }
  }, [chatId, enabled, chatQuery.data]);

  // 초기 로드된 메시지 + 실시간 메시지 결합
  const allMessages = useCallback(() => {
    const initialMessages = messagesQuery.data || [];
    // 중복 제거하며 병합
    const combined = [...initialMessages];
    realtimeMessages.forEach(rm => {
      if (!combined.some(m => m.id === rm.id)) {
        combined.push(rm);
      }
    });
    // 시간순 정렬
    return combined.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [messagesQuery.data, realtimeMessages]);

  // 초기 로드 완료 시 realtimeMessages 초기화
  useEffect(() => {
    if (messagesQuery.data) {
      setRealtimeMessages([]);
    }
  }, [messagesQuery.data]);

  return {
    chat: chatQuery.data,
    messages: allMessages(),
    isLoading: chatQuery.isLoading || messagesQuery.isLoading,
    error: chatQuery.error || messagesQuery.error,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
    markAsRead: markAsReadMutation.mutate,
  };
}

// 채팅방 목록 조회 훅
export function useDirectChatList(role: 'customer' | 'vendor') {
  return useQuery<DirectChat[]>({
    queryKey: ['/api/direct-chats', { role }],
    queryFn: async () => {
      const res = await fetch(`/api/direct-chats?role=${role}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch chat list');
      return res.json();
    },
  });
}

// 채팅방 생성/조회 훅
export function useCreateDirectChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { vendorId: number; orderId?: string; bidId?: number; conversationId?: number }): Promise<DirectChat> => {
      const res = await apiRequest('POST', '/api/direct-chats', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/direct-chats'] });
    },
  });
}

// 읽지 않은 메시지 수 조회 훅
export function useUnreadChatCount() {
  return useQuery<{ customerUnreadCount: number; vendorUnreadCount: number }>({
    queryKey: ['/api/direct-chats/unread/count'],
    queryFn: async () => {
      const res = await fetch('/api/direct-chats/unread/count', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch unread count');
      return res.json();
    },
    refetchInterval: 30000, // 30초마다 자동 갱신
  });
}
