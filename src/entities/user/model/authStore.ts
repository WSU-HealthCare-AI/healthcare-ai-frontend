import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/src/shared/api/supabase';

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
  muscle_mass: number | null;
  fat_percentage: number | null;
  birth_date: string;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  session: Session | null;
  profile: UserProfile | null;
  isProfileLoading: boolean;

  setSession: (session: Session | null) => void;
  checkAndFetchProfile: (userId: string) => Promise<void>;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  isProfileLoading: false,

  setSession: (session) => set({ session }),

  checkAndFetchProfile: async (userId) => {
    set({ isProfileLoading: true });
    try {
      // maybeSingle()을 사용하여 데이터가 없을 때 에러를 던지지 않고 null을 반환
      const { data, error } = await supabase
        .from('health_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        set({ profile: null });
        return;
      }

      if (data) {
        set({ profile: data });
      } else {
        // data가 null인 경우
        set({ profile: null });
      }
    } catch (err) {
      console.error('프로필 조회 실패:', err);
      set({ profile: null });
    } finally {
      set({ isProfileLoading: false });
    }
  },

  clearAuth: () => set({ session: null, profile: null }),
}));
