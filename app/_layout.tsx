import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { supabase } from '@/src/shared/api/supabase';
import { useRegistrationStore } from '@/src/entities/user/model/store';
import '../global.css';

// 최상위 레이아웃: 인증 상태에 따른 라우팅 제어 및 세션 관리
export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const { reset } = useRegistrationStore();

  const [isReady, setIsReady] = useState(false);
  const [session, setSession] = useState<any>(null);

  // 초기 세션 로드 및 인증 리스너 등록
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();
        setSession(initialSession);
      } catch (err) {
        console.error('[RootLayout] 초기 세션 로드 실패:', err);
      } finally {
        setIsReady(true);
      }
    };

    initializeAuth();

    // 전역 인증 상태 변화 감시
    const { data: authListener } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);

      if (event === 'SIGNED_OUT') {
        reset();
      }
    });

    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, [reset]);

  // 인증 상태 기반 물리적 리다이렉션 제어
  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = ['welcome', 'login', 'register', 'onboarding'].includes(segments[0] || '');

    // [가드 1] 로그인 상태인데 웰컴/로그인 등 인증 파트에 머물러 있는 경우 대시보드로 자동 이동
    if (session && inAuthGroup) {
      router.replace('/(main)');
    }
    // [가드 2] 로그아웃 상태인데 보호된 경로(메인 그룹 등)에 머물러 있는 경우 웰컴 스크린으로 이동
    else if (!session && !inAuthGroup) {
      router.replace('/welcome');
    }
  }, [session, segments, isReady, router]);
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="(main)" options={{ gestureEnabled: false }} />

        {/* 온보딩 및 기타 인증 경로 */}
        <Stack.Screen name="register" />
        <Stack.Screen name="login" />
        <Stack.Screen name="onboarding/index" />
        <Stack.Screen name="onboarding/inbody" />
        <Stack.Screen name="onboarding/complete" />
      </Stack>
    </SafeAreaProvider>
  );
}
