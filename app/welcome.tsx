import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { Button } from '@/src/shared/ui/Button';
import { useRegistrationStore } from '@/src/entities/user/model/store';
import { supabase } from '@/src/shared/api/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function WelcomeScreen() {
  const router = useRouter();
  const { setAccount, reset } = useRegistrationStore();

  const [isLoading, setIsLoading] = useState(false);
  const isNavigatingRef = useRef(false);
  const isUserInitiatedRef = useRef(false);

  // 온보딩 여부 체크 및 라우팅 함수
  const checkOnboardingAndRedirect = useCallback(
    async (userId: string, userEmail: string, provider: 'email' | 'google', source = 'unknown') => {
      if (isNavigatingRef.current) return;

      isNavigatingRef.current = true;
      setIsLoading(true);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
        const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
        const url = `${base}/rest/v1/health_profiles?select=id&user_id=eq.${userId}`;

        const res = await fetch(url, {
          method: 'GET',
          headers: {
            apikey: anon,
            Authorization: `Bearer ${anon}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) throw new Error('서버 응답이 올바르지 않습니다.');

        const restBody = await res.json();
        const hasProfile = Array.isArray(restBody) && restBody.length > 0;

        // 계정 정보 저장
        setAccount({ email: userEmail, authProvider: provider });
        setIsLoading(false);

        if (hasProfile) {
          router.replace('/(main)');
        } else {
          router.replace('/onboarding');
        }
      } catch (err: any) {
        clearTimeout(timeout);
        console.error('[ERROR] Redirect Logic Failed', err);
        Alert.alert('로그인 처리 오류', '사용자 정보를 확인하는 중 문제가 발생했습니다.');
        setIsLoading(false);
      } finally {
        isNavigatingRef.current = false;
        isUserInitiatedRef.current = false;
      }
    },
    [router, setAccount]
  );

  // Supabase 세션 리스너
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user && isUserInitiatedRef.current) {
        await checkOnboardingAndRedirect(
          session.user.id,
          session.user.email || '',
          'google',
          'onAuthStateChange'
        );
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, [checkOnboardingAndRedirect]);

  // 구글 소셜 로그인
  const handleGoogleStart = async () => {
    if (isLoading || isNavigatingRef.current) return;

    setIsLoading(true);
    reset();
    isNavigatingRef.current = false;
    isUserInitiatedRef.current = true;

    try {
      if (Platform.OS === 'web') {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
        if (error) throw error;
      } else {
        let redirectUrl = Linking.createURL('');
        if (redirectUrl.startsWith('http')) {
          redirectUrl = redirectUrl.replace(/^https?/, 'exp');
        }

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
          },
        });

        if (error) throw error;

        if (data?.url) {
          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

          if (result.type === 'success' && result.url) {
            setIsLoading(true);

            const urlStr = result.url.replace('#', '?');
            const parsedUrl = Linking.parse(urlStr);
            const accessToken = parsedUrl.queryParams?.access_token as string;
            const refreshToken = parsedUrl.queryParams?.refresh_token as string;

            if (accessToken && refreshToken) {
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
            } else {
              throw new Error('인증 정보를 가져오지 못했습니다.');
            }
          } else {
            setIsLoading(false);
            isUserInitiatedRef.current = false;
          }
        }
      }
    } catch (error: any) {
      Alert.alert('구글 로그인 실패', error.message);
      setIsLoading(false);
      isUserInitiatedRef.current = false;
    }
  };

  const handleRegisterStart = () => {
    reset();
    router.push('/register');
  };

  return (
    <View className="flex-1 bg-white px-6">
      <StatusBar style="dark" />

      {isLoading && (
        <View className="absolute inset-0 z-[9999] items-center justify-center bg-white">
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="mt-4 px-10 text-center font-medium text-gray-500">
            사용자 정보를 확인하고 있어요...{'\n'}잠시만 기다려 주세요.
          </Text>
        </View>
      )}

      <View className="flex-1 items-start justify-center">
        <View className="mb-6">
          <Text className="text-6xl font-bold text-blue-600">FitMate AI</Text>
        </View>

        <Text className="mb-4 text-left text-3xl font-bold leading-tight text-gray-900">
          다치지 않고 건강하게,{'\n'}나만의 AI 트레이너
        </Text>

        <Text className="text-left text-base leading-relaxed text-gray-500">
          맞춤형 건강 플랜부터 실시간 자세 교정까지{'\n'}지금 바로 시작하세요.
        </Text>
      </View>

      <View className="mb-20 flex items-center justify-center">
        <Button
          label={isLoading ? '연결 중...' : '구글로 시작하기'}
          variant="secondary"
          onPress={handleGoogleStart}
          isLoading={isLoading}
          disabled={isLoading}
        />

        <View className="my-4 flex-row items-center">
          <View className="h-[1px] flex-1 bg-gray-200" />
          <Text className="mx-4 text-sm text-gray-400">또는</Text>
          <View className="h-[1px] flex-1 bg-gray-200" />
        </View>

        <Button
          label="이메일로 로그인하기"
          variant="outline"
          onPress={() => router.push('/login')}
          disabled={isLoading}
        />

        <View className="mt-6 flex-row justify-center">
          <Text className="text-sm text-gray-500">아직 회원이 아니신가요? </Text>
          <TouchableOpacity onPress={handleRegisterStart} disabled={isLoading}>
            <Text className="text-sm font-bold text-blue-600">가입하기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
