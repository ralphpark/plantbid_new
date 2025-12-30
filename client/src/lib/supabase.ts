import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pedvuushezoazgvkgntg.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlZHZ1dXNoZXpvYXpndmtnbnRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NTQ4NDgsImV4cCI6MjA4MjEzMDg0OH0.zWrs_ENyyGvqzJTjAsN4e70u8HcDuogkGaTW_AgI1u4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Direct Chat Realtime 타입
export interface DirectMessagePayload {
  id: number;
  chat_id: number;
  sender_id: number;
  sender_role: 'customer' | 'vendor';
  content: string;
  message_type: string;
  attachments: any;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}
