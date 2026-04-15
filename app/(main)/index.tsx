import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Bell, Flame, Trophy, Dumbbell, Utensils, Calendar } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { useRegistrationStore } from '@/src/entities/user/model/store';
import { supabase } from '@/src/shared/api/supabase';

// 대시 보드
export default function DashboardScreen() {
  const { profile, setProfile } = useRegistrationStore();
  const [userName, setUserName] = useState(profile.name ? `${profile.name}님` : '');
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      if (profile.name) return;

      try {
        setLoading(true);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data, error } = await supabase
            .from('health_profiles')
            .select('name')
            .eq('user_id', user.id)
            .maybeSingle();

          if (error) throw error;
          if (data?.name) {
            setUserName(`${data.name}님`);
            setProfile({ name: data.name });
          }
        }
      } catch (err) {
        console.error('프로필 불러오기 실패:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [profile.name, setProfile]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />

      {/* 상단 헤더 */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <View className="flex-row items-center">
          <View>
            <Text className="text-sm font-medium text-gray-400">오늘도 힘차게 시작해볼까요?</Text>
            <View className="flex-row items-center">
              <Text className="text-2xl font-bold text-gray-900">{userName}</Text>
              {loading && <ActivityIndicator size="small" color="#2563EB" className="ml-2" />}
            </View>
          </View>
        </View>
        <TouchableOpacity className="rounded-full bg-gray-50 p-2 active:opacity-60">
          <Bell size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}>
        {/* 오늘의 운동 플랜 */}
        <View className="mt-6 rounded-3xl bg-blue-600 p-6 shadow-lg shadow-blue-200">
          <View className="mb-4 flex-row items-center">
            <Calendar size={17} color="white" />
            <Text className="ml-2 px-1 text-base font-bold text-white">오늘의 운동 플랜</Text>
          </View>

          <View className="mb-4 rounded-2xl bg-white/10 p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <Dumbbell size={20} color="white" />
                <Text className="ml-3 text-lg font-bold text-white">전신 근력 강화 루틴</Text>
              </View>
              <Text className="text-sm font-medium text-blue-100">약 45분</Text>
            </View>
            <View className="mt-3 flex-row space-x-2">
              <View className="rounded-full bg-white/20 px-3 py-1">
                <Text className="text-xs text-white">스쿼트</Text>
              </View>
              <View className="rounded-full bg-white/20 px-3 py-1">
                <Text className="text-xs text-white">푸쉬업</Text>
              </View>
              <View className="rounded-full bg-white/20 px-3 py-1">
                <Text className="text-xs text-white">플랭크</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            className="items-center rounded-2xl bg-white py-3 active:opacity-90"
            onPress={() => router.push('/workout')}>
            <Text className="font-bold text-blue-600">운동 시작하기</Text>
          </TouchableOpacity>
        </View>

        {/* 오늘의 식단 */}
        <View className="mt-4 rounded-3xl bg-gray-900 p-6">
          <View className="mb-4 flex-row items-center">
            <Utensils size={17} color="#93C5FD" />
            <Text className="ml-2 px-1 text-base font-bold text-blue-300">오늘의 식단</Text>
          </View>

          <View className="space-y-3">
            <MealItem label="아침" desc="닭가슴살 샐러드 & 통밀빵" />
            <MealItem label="점심" desc="현미밥 & 고등어구이 & 나물" />
            <MealItem label="저녁" desc="두부 소고기 볶음 & 채소" />
          </View>

          <View className="mt-4 flex-row justify-between border-t border-white/10 pt-4">
            <Text className="text-xs text-gray-400">일일 권장 칼로리</Text>
            <Text className="text-xs font-bold text-white">1,850 kcal</Text>
          </View>
        </View>

        {/* 활동 지표 요약 */}
        <View className="mt-8 flex-row gap-x-4">
          <View className="flex-1 rounded-3xl border border-gray-100 bg-gray-50 p-5">
            <View className="mb-3 h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <Flame size={20} color="#EF4444" />
            </View>
            <Text className="mb-1 text-xs font-medium text-gray-400">소모 칼로리</Text>
            <Text className="text-xl font-bold text-gray-900">
              420 <Text className="text-xs">kcal</Text>
            </Text>
          </View>
          <View className="flex-1 rounded-3xl border border-gray-100 bg-gray-50 p-5">
            <View className="mb-3 h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
              <Trophy size={20} color="#F59E0B" />
            </View>
            <Text className="mb-1 text-xs font-medium text-gray-400">연속 운동일</Text>
            <Text className="text-xl font-bold text-gray-900">
              5 <Text className="text-xs">일째</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const MealItem = ({ label, desc }: { label: string; desc: string }) => (
  <View className="flex-row items-center justify-between py-1">
    <Text className="w-12 text-sm font-bold text-blue-300">{label}</Text>
    <Text className="ml-2 flex-1 text-sm text-white" numberOfLines={1}>
      {desc}
    </Text>
  </View>
);
