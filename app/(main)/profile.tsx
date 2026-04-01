import React, { useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Settings,
  CreditCard,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  Mail,
  UserCircle,
} from 'lucide-react-native';

import { supabase } from '@/src/shared/api/supabase';
import { useRegistrationStore } from '@/src/entities/user/model/store';

// 마이페이지 (정보 관리 및 로그아웃)
export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { account, profile, setAccount, setProfile, reset } = useRegistrationStore();

  // 인증 상태 리스너 및 정보 동기화
  useEffect(() => {
    // 세션 동기화 함수
    const syncSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          if (!account.email) {
            setAccount({
              email: session.user.email || '',
              authProvider: session.user.app_metadata.provider === 'google' ? 'google' : 'email',
            });
          }

          if (!profile.name) {
            const { data } = await supabase
              .from('health_profiles')
              .select('name')
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (data?.name) {
              setProfile({ name: data.name });
            }
          }
        }
      } catch (error) {
        console.error('Session sync failed:', error);
      }
    };

    syncSession();
  }, [account.email, profile.name, setAccount, setProfile]);

  // 로그아웃
  const handleSignOut = async () => {
    try {
      reset();

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // 로그아웃 시 웰컴스크린으로 직접 이동
      router.replace('/welcome');
    } catch (error: any) {
      console.error('Sign out failed:', error);
      Alert.alert('로그아웃 오류', '로그아웃 도중 문제가 발생했습니다.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      {/* 상단 헤더 */}
      <View className="flex-row items-center justify-between border-b border-gray-50 px-6 py-4">
        <Text className="text-2xl font-bold text-gray-900">마이페이지</Text>
        <TouchableOpacity activeOpacity={0.7} className="p-2">
          <Settings size={24} color="#4B5563" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: 120 + insets.bottom,
        }}>
        {/* 프로필 섹션 */}
        <View className="mt-6 items-center rounded-[32px] border border-gray-100 bg-gray-50 p-8 shadow-sm">
          <View className="mb-6 h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-blue-100 shadow-sm">
            <UserCircle size={56} color="#2563EB" strokeWidth={1.5} />
          </View>

          <View className="items-center">
            <Text className="mb-2 text-center text-2xl font-bold text-gray-900">
              {profile.name || '사용자'}
            </Text>

            <View className="mb-4 flex-row items-center rounded-full border border-gray-200 bg-white px-4 py-1.5">
              <Mail size={14} color="#6B7280" />
              <Text className="ml-2 text-sm font-medium text-gray-600">
                {account.email || '이메일 정보 없음'}
              </Text>
            </View>

            <View className="rounded-full border border-blue-50 bg-white px-5 py-2 shadow-sm">
              <Text className="text-xs font-bold text-blue-600">
                {account.authProvider === 'google'
                  ? '🟢 Google 계정 연결됨'
                  : '👤 이메일 계정 로그인'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            className="mt-8 rounded-2xl bg-blue-600 px-10 py-3.5 shadow-lg shadow-blue-200 active:opacity-90"
            activeOpacity={0.8}>
            <Text className="text-sm font-bold text-white">프로필 수정하기</Text>
          </TouchableOpacity>
        </View>

        {/* 메뉴 리스트 */}
        <View className="mt-10">
          <Text className="mb-4 ml-2 text-[11px] font-bold uppercase tracking-[2px] text-gray-400">
            설정 및 보안
          </Text>

          <MenuLink icon={<CreditCard size={20} color="#4B5563" />} title="구독 및 결제 관리" />
          <MenuLink icon={<Shield size={20} color="#4B5563" />} title="개인정보 처리방침" />
          <MenuLink icon={<HelpCircle size={20} color="#4B5563" />} title="고객 센터 / FAQ" />

          {/* 로그아웃 버튼 */}
          <TouchableOpacity
            onPress={handleSignOut}
            className="mt-10 flex-row items-center rounded-3xl border border-red-100 bg-red-50 p-5 active:opacity-70">
            <LogOut size={20} color="#EF4444" />
            <Text className="ml-3 text-base font-bold text-red-500">로그아웃</Text>
          </TouchableOpacity>
        </View>

        <Text className="mt-20 text-center text-[10px] font-medium uppercase tracking-widest text-gray-300">
          FitMate AI • Stable 1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const MenuLink = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
  <TouchableOpacity
    className="mb-2 flex-row items-center rounded-2xl border border-gray-50 bg-white px-5 py-4 shadow-sm shadow-black/[0.02] active:opacity-60"
    activeOpacity={0.6}>
    <View className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-gray-50">
      {icon}
    </View>
    <Text className="flex-1 text-base font-medium text-gray-700">{title}</Text>
    <ChevronRight size={18} color="#D1D5DB" />
  </TouchableOpacity>
);
