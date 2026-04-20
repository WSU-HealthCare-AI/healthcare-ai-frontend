import { create } from 'zustand';
import type { InbodyRecord } from '@/src/entities/inbody/model/types';

export interface RegistrationProfile {
  name?: string;
  gender?: string;
  birthDate?: string;
  height?: string | number;
  weight?: string | number;
  purposes?: string[];
  exerciseFrequency?: string;
  diseases?: string[];
  allergies?: string | null;
  surgeryHistory?: string | null;
  painPoints?: string[];

  inbodyData?: InbodyRecord | null;
}

interface UserRegistrationState {
  account: {
    email: string;
    password?: string;
    authProvider: 'email' | 'google';
  };
  profile: RegistrationProfile;

  setAccount: (account: UserRegistrationState['account']) => void;
  setProfile: (profile: Partial<RegistrationProfile>) => void;
  reset: () => void;
}

export const useRegistrationStore = create<UserRegistrationState>((set) => ({
  account: {
    email: '',
    authProvider: 'email',
  },
  profile: {},

  setAccount: (account) =>
    set((state) => ({
      account: { ...state.account, ...account },
    })),

  setProfile: (newProfile) =>
    set((state) => ({
      profile: { ...state.profile, ...newProfile },
    })),

  reset: () =>
    set({
      account: { email: '', authProvider: 'email' },
      profile: {},
    }),
}));
