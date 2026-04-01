import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, TouchableOpacity, Text, Alert } from 'react-native';
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

  const handleDevReset = async () => {
    Alert.alert('세션 초기화', '정말 로그아웃하고 초기 상태로 돌아가시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '초기화',
        style: 'destructive',
        onPress: async () => {
          setIsReady(false);
          await supabase.auth.signOut();
          clearAuth();
          reset();
          setIsReady(true);
          router.replace('/welcome');
        },
      },
    ]);
  };

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

      {/* 💡 화면 덮어씌우기(Overlay) 방식의 로딩 스피너: 깜빡임과 언매치 라우트를 완벽 차단! */}
      {(!isReady || isProfileLoading || isAuthProcessing) && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#ffffff', // 뒷배경 깜빡임을 숨기기 위해 불투명한 흰색 사용
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

      {__DEV__ && (
        <TouchableOpacity
          onPress={handleDevReset}
          style={{
            position: 'absolute',
            bottom: 40,
            right: 20,
            backgroundColor: 'rgba(239, 68, 68, 0.9)',
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 20,
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            zIndex: 9999,
          }}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>DEV: 세션 초기화</Text>
        </TouchableOpacity>
      )}
    </SafeAreaProvider>
  );
}
