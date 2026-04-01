import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { Button } from '@/src/shared/ui/Button';
import { supabase } from '@/src/shared/api/supabase';
import { useRegistrationStore } from '@/src/entities/user/model/store';
import { useAuthStore } from '@/src/entities/user/model/authStore';

WebBrowser.maybeCompleteAuthSession();

export default function WelcomeScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { setAccount } = useRegistrationStore();
  const { setSession, checkAndFetchProfile } = useAuthStore();

  const handleGoogleStart = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const redirectUrl = Linking.createURL('/welcome');

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
          let authSession = null;

          // URL 파싱 및 세션 획득
          const codeMatch = result.url.match(/code=([^&]+)/);
          if (codeMatch && codeMatch[1]) {
            const { data: exchangeData, error: exchangeError } =
              await supabase.auth.exchangeCodeForSession(codeMatch[1]);
            if (exchangeError) throw exchangeError;
            authSession = exchangeData.session;
          } else {
            const accMatch = result.url.match(/access_token=([^&#]+)/);
            const refMatch = result.url.match(/refresh_token=([^&#]+)/);
            if (accMatch && refMatch) {
              const { data: setData, error: setError } = await supabase.auth.setSession({
                access_token: accMatch[1],
                refresh_token: refMatch[1],
              });
              if (setError) throw setError;
              authSession = setData.session;
            }
          }

          // 동기화 및 강제 라우팅
          if (authSession) {
            setAccount({ email: authSession.user.email || '', authProvider: 'google' });
            setSession(authSession);

            // 프로필 정보 획득
            await checkAndFetchProfile(authSession.user.id);

            setTimeout(() => {
              const currentProfile = useAuthStore.getState().profile;
              if (currentProfile) {
                router.replace('/(main)');
              } else {
                router.replace('/onboarding');
              }
            }, 150);

            return;
          }
        }
      }
    } catch (error: any) {
      console.error('Google Login Error:', error);
      Alert.alert('로그인 실패', error.message || '구글 로그인 중 문제가 발생했습니다.');
    }

    // 에러 발생 또는 사용자 수동 취소 시에만 스피너 해제
    setIsLoading(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="auto" />

      <View className="flex-1 px-6 pt-20">
        <View className="flex-1 justify-center">
          <View className="mb-8">
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
          <View className="w-full pb-8">
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
          </View>

          <View className="mt-8 flex-row justify-center pb-8">
            <Text className="text-gray-500">계정이 없으신가요? </Text>
            <TouchableOpacity onPress={() => router.push('/register')} disabled={isLoading}>
              <Text className="font-semibold text-blue-600">가입하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
