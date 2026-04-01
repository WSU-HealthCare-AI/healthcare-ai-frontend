import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/src/shared/api/supabase';
import { useRegistrationStore } from '@/src/entities/user/model/store';
import { useAuthStore } from '@/src/entities/user/model/authStore';
import '../global.css';

WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const { reset } = useRegistrationStore();

  const { session, profile, isProfileLoading, setSession, checkAndFetchProfile, clearAuth } =
    useAuthStore();

  const [isReady, setIsReady] = useState(false);
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);

  const isBootingRef = useRef(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();
        setSession(initialSession);

        if (initialSession) {
          await checkAndFetchProfile(initialSession.user.id);
        }
      } catch (err) {
        console.error('초기 세션 로드 실패:', err);
      } finally {
        isBootingRef.current = false;
        setIsReady(true);
      }
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);

      if (isBootingRef.current) return;

      if (event === 'SIGNED_IN' && currentSession) {
        setIsAuthProcessing(true);

        setTimeout(async () => {
          try {
            await checkAndFetchProfile(currentSession.user.id);
          } catch (e) {
            console.error('프로필 조회 에러:', e);
          } finally {
            setIsAuthProcessing(false);
          }
        }, 500);
      } else if (event === 'SIGNED_OUT') {
        reset();
        clearAuth();
      }
    });

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [setSession, checkAndFetchProfile, reset, clearAuth]);

  useEffect(() => {
    if (!isReady || isProfileLoading || isAuthProcessing || !rootNavigationState?.key) return;

    const currentSegment = segments[0];
    const inAuthGroup =
      currentSegment === 'welcome' || currentSegment === 'login' || currentSegment === 'register';
    const inOnboardingGroup = currentSegment === 'onboarding';
    const inMainGroup = currentSegment === '(main)';

    if (!session) {
      if (!inAuthGroup) router.replace('/welcome');
    } else if (session && !profile) {
      if (!inOnboardingGroup) router.replace('/onboarding');
    } else if (session && profile) {
      if (!inMainGroup) router.replace('/(main)');
    }
  }, [
    session,
    profile,
    segments,
    isReady,
    isProfileLoading,
    isAuthProcessing,
    rootNavigationState?.key,
    router,
  ]);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(main)" />
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="onboarding/inbody" />
        <Stack.Screen name="onboarding/complete" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>

      {(!isReady || isProfileLoading || isAuthProcessing) && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#ffffff',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
          }}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={{ marginTop: 16, color: '#6b7280', fontWeight: '500' }}>
            {isAuthProcessing ? '처리 중...' : '데이터 동기화 중...'}
          </Text>
        </View>
      )}
    </SafeAreaProvider>
  );
}
