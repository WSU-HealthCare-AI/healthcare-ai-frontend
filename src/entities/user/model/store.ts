import { create } from 'zustand';
import { OnboardingFormValues } from './onboarding';

interface UserRegistrationState {
  account: {
    email: string;
    password?: string;
    authProvider: 'email' | 'google';
  };
  profile: Partial<OnboardingFormValues>;

  setAccount: (account: UserRegistrationState['account']) => void;
  setProfile: (profile: Partial<OnboardingFormValues>) => void;
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
