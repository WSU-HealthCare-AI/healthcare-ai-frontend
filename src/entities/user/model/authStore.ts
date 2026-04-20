import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/src/shared/api/supabase';
import type { InbodyRecord } from '../../inbody/model/types';

export interface UserProfile {
  idx: number;
  id: string;
  user_id: string;
  name: string;
  gender: string;
  height: number;
  weight: number;
  bmi: number;
  purposes: string[];
  diseases: string[];
  allergies: string | null;
  surgery_history: string | null;
  pain_points: string[];
  birth_date: string;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  session: Session | null;
  profile: UserProfile | null;
  latestInbody: InbodyRecord | null;
  isProfileLoading: boolean;

  setSession: (session: Session | null) => void;
  checkAndFetchProfile: (userId: string) => Promise<void>;
  fetchLatestInbody: (userId: string) => Promise<void>;
  clearAuth: () => void;
}
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  latestInbody: null,
  isProfileLoading: false,

  setSession: (session) => set({ session }),

  checkAndFetchProfile: async (userId) => {
    set({ isProfileLoading: true });
    try {
      const { data, error } = await supabase
        .from('health_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        set({ profile: null });
        return;
      }

      set({ profile: data ?? null });
    } catch (err) {
      console.error('프로필 조회 실패:', err);
      set({ profile: null });
    } finally {
      set({ isProfileLoading: false });
    }
  },

  fetchLatestInbody: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('inbody_records')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('인바디 조회 실패:', error);
        set({ latestInbody: null });
        return;
      }

      set({ latestInbody: data ?? null });
    } catch (err) {
      console.error('인바디 조회 실패:', err);
      set({ latestInbody: null });
    }
  },

  clearAuth: () => set({ session: null, profile: null, latestInbody: null }),
}));
