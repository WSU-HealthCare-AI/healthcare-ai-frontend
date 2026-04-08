import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '@/src/shared/api/supabase';
import { useRegistrationStore } from '@/src/entities/user/model/store';
import { useAuthStore } from '@/src/entities/user/model/authStore';
import '@/global.css';

WebBrowser.maybeCompleteAuthSession();

// 앱이 처음 켜질 때 네이티브 스플래시 화면이 멋대로 사라지는 것을 강제로 막음
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const { reset } = useRegistrationStore();

  const { session, profile, isProfileLoading, setSession, checkAndFetchProfile, clearAuth } =
    useAuthStore();

  const [isReady, setIsReady] = useState(false);
  const [isAuthProcessing, setIsAuthProcessing] = useState(false);

  // 하얀색 오버레이 렌더링을 제어할 상태
  const [showOverlay, setShowOverlay] = useState(true);

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
        console.error('[RootLayout] 초기 세션 로드 실패:', err);
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
            console.error('[RootLayout] 프로필 조회 에러:', e);
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

  // 현재 유저가 '올바른 화면'에 도착했는지 확인하는 논리
  const currentSegment = segments[0];
  const inAuthGroup =
    currentSegment === 'welcome' || currentSegment === 'login' || currentSegment === 'register';
  const inOnboardingGroup = currentSegment === 'onboarding';
  const inMainGroup = currentSegment === '(main)';

  const isCorrectScreen =
    (!session && inAuthGroup) ||
    (session && !profile && inOnboardingGroup) ||
    (session && profile && inMainGroup);

  const isFullyReady =
    isReady &&
    !isProfileLoading &&
    !isAuthProcessing &&
    isCorrectScreen &&
    rootNavigationState?.key;

  // 라우팅 결정 및 오버레이 제거 로직
  useEffect(() => {
    if (!isReady || isProfileLoading || isAuthProcessing || !rootNavigationState?.key) return;

    if (!session) {
      if (!inAuthGroup) {
        router.replace('/welcome');
        return;
      }
    } else if (session && !profile) {
      if (!inOnboardingGroup) {
        router.replace('/onboarding');
        return;
      }
    } else if (session && profile) {
      if (!inMainGroup) {
        router.replace('/(main)');
        return;
      }
    }

    // 올바른 경로에 도착했다면, 전환 애니메이션이 끝날 때까지 300ms 대기 후 오버레이를 치움
    if (isFullyReady) {
      const timer = setTimeout(() => {
        setShowOverlay(false);
        SplashScreen.hideAsync().catch(() => {});
      }, 300);

      return () => clearTimeout(timer);
    } else {
      setShowOverlay(true);
    }
  }, [
    session,
    profile,
    segments,
    isReady,
    isProfileLoading,
    isAuthProcessing,
    rootNavigationState?.key,
    isFullyReady,
    router,
    inAuthGroup,
    inMainGroup,
    inOnboardingGroup,
  ]);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(main)" />
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="onboarding/inbody" />
        <Stack.Screen name="onboarding/complete" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack>

      {/* 로딩 오버레이 */}
      {showOverlay && (
        <View className="absolute inset-0 z-[9999] items-center justify-center bg-white">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="mt-4 font-medium text-gray-500">
            {isAuthProcessing ? '로그인 처리 중...' : '동기화 중...'}
          </Text>
        </View>
      )}
    </SafeAreaProvider>
  );
}
