import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Play,
  Clock,
  Zap,
  Coffee,
  AlertTriangle,
  ChevronRight,
  X,
  Info,
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { RoutineDay, Exercise } from '@/src/entities/recommendation/model/schema';
import { useCurrentUserProfile } from '@/src/entities/user/api/useCurrentUserProfile';
import { useRecommendationPlan } from '@/src/features/recommendation/api/useRecommendationPlan';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function WorkoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { userId } = useCurrentUserProfile();

  // 1. 추천 엔진 실시간 동기화 데이터 획득
  const { plan, currentDay, status } = useRecommendationPlan(userId);

  // 2. 기획안 최적화 다차원 모달 상태 제어 구조
  const [isWeeklyModalOpen, setIsWeeklyModalOpen] = useState(false); // 주간 루틴 전체 조회용 모달
  const [showRoutineList, setShowRoutineList] = useState(false); // 오늘자 운동 종목 리스트 모달 (바텀시트)
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  // 대시보드에서 '주간 플랜 확인하기' 플래그를 실어 보내면, 운동 탭이 켜짐과 동시에 주간 루틴 모달을 자동 팝업
  useEffect(() => {
    if (params.showWeekly === 'true') {
      // 동기식 상태 트리거에 의한 Cascading Rendering 경고를 우회하기 위해,
      // setTimeout을 사용하여 다음 이벤트 루프 틱에서 비동기적으로 상태 전환을 예약
      const timer = setTimeout(() => {
        setIsWeeklyModalOpen(true);
        router.setParams({ showWeekly: undefined }); // 다중 팝업 방지를 위해 파라미터 소거
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [params.showWeekly, router]); // 의존성 배열에 router 객체 주입

  // 요일 한글 텍스트 포맷터
  const getDayNameKo = (dayNum: number): string => {
    const days = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];
    return days[dayNum - 1] || `${dayNum}일차`;
  };

  // 3. 오늘 날짜에 지정된 트레이닝 루틴 찾기
  const todayPlan: RoutineDay | undefined = plan?.workout_plan?.weekly_routine?.find(
    (r) => r.day === currentDay
  );

  const isRestDay = !todayPlan || todayPlan.is_rest_day;

  // 초기 파이프라인 동기화 로딩 처리
  if (!plan && (status === 'syncing' || status === 'generating')) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="mt-4 text-sm font-semibold text-gray-500">
          AI 추천 루틴을 분석 및 동기화하고 있습니다...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* 4. 세련된 상단 타이틀 바 */}
      <View className="flex-row items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
        <View className="flex-1">
          <Text className="text-2xl font-bold text-gray-900">오늘의 운동</Text>
          <Text className="mt-0.5 text-xs text-gray-400">
            {todayPlan ? `${getDayNameKo(todayPlan.day)} 운동 루틴` : '스케줄 분석 중'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setIsWeeklyModalOpen(true)}
          className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2">
          <Text className="text-xs font-bold text-blue-600">주간 일정 보기</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* 휴식일 레이아웃과 수행일 레이아웃 이원화 */}
        {isRestDay ? (
          <View className="m-6 items-center rounded-3xl border border-amber-100 bg-amber-50/70 p-6">
            <View className="mb-3 h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <Coffee size={24} color="#D97706" />
            </View>
            <Text className="text-lg font-bold text-gray-800">오늘은 근육 회복일입니다</Text>
            <Text className="mt-2 text-center text-sm leading-5 text-gray-500">
              지속 가능한 부상 예방과 안전한 건강 관리를 위해 오늘은 충분한 영양 섭취와 편안한
              휴식을 취해 주세요.
            </Text>

            <TouchableOpacity
              onPress={() => setIsWeeklyModalOpen(true)}
              className="mt-6 rounded-2xl border border-gray-200 bg-white px-6 py-3 shadow-sm active:bg-gray-50">
              <Text className="text-sm font-bold text-gray-700">전체 주간 일정 조회하기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View className="p-6">
            {/* 당일 전용 타겟 포커스 대시카드 */}
            <View className="relative mb-6 overflow-hidden rounded-3xl bg-slate-900 p-6 shadow-xl">
              <View className="absolute -bottom-8 -right-8 opacity-10">
                <Zap size={140} color="white" />
              </View>
              <Text className="text-xs font-extrabold uppercase tracking-widest text-blue-400">
                Today Workout Focus
              </Text>
              <Text className="mt-2 text-xl font-bold leading-7 text-white">
                {todayPlan?.daily_target}
              </Text>
              <View className="mt-4 flex-row items-center gap-4">
                <View className="flex-row items-center gap-1">
                  <Clock size={14} color="#94A3B8" />
                  <Text className="text-xs text-slate-300">
                    약 {todayPlan?.exercises?.length ? todayPlan.exercises.length * 8 : 0}분 소요
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Zap size={14} color="#94A3B8" />
                  <Text className="text-xs text-slate-300">
                    강도 {plan?.workout_plan?.intensity ?? 3}단계
                  </Text>
                </View>
              </View>
            </View>

            {/* 당일 배정된 핵심 운동 요약 목록 */}
            <Text className="mb-3 text-base font-bold text-gray-800">
              수행 동작 ({todayPlan?.exercises?.length ?? 0})
            </Text>

            {todayPlan?.exercises?.map((ex: Exercise, idx: number) => (
              <TouchableOpacity
                key={idx}
                onPress={() => setSelectedExercise(ex)}
                className="mb-3 flex-row items-center rounded-2xl border border-gray-100 bg-white p-4 shadow-sm active:bg-gray-50">
                <View className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                  <Text className="text-sm font-bold text-blue-600">{idx + 1}</Text>
                </View>
                <View className="flex-1">
                  {/* 번역된 한글 이름 표출 */}
                  <Text className="text-base font-bold text-gray-800">{ex.name_ko || ex.name}</Text>
                  <Text className="mt-1 text-xs text-gray-400" numberOfLines={1}>
                    {ex.reason}
                  </Text>
                </View>
                <View className="mr-2 items-end">
                  <Text className="text-sm font-extrabold text-blue-600">{ex.sets}세트</Text>
                  <Text className="mt-0.5 text-xs text-gray-400">{ex.reps}</Text>
                </View>
                <ChevronRight size={18} color="#D1D5DB" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 5. 바텀 고정 시작 인터랙션 패널 */}
      <View className="absolute bottom-0 w-full border-t border-gray-100 bg-white px-6 py-4 shadow-lg">
        {isRestDay ? (
          <View className="flex-row items-center justify-center rounded-2xl bg-gray-100 py-4">
            <Coffee size={18} color="#9CA3AF" className="mr-2" />
            <Text className="text-base font-bold text-gray-400">오늘은 근육 회복일입니다</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setShowRoutineList(true)} // 클릭 시 종목 리스트 바텀시트 모달 실행
            className="flex-row items-center justify-center rounded-2xl bg-blue-600 py-4 shadow-md active:bg-blue-700">
            <Play size={18} color="white" fill="white" className="mr-2" />
            <Text className="ml-2 text-base font-bold text-white">오늘의 운동 시작하기</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ==================== 주간 스케줄 전체 루틴 조회 모달 ==================== */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isWeeklyModalOpen}
        onRequestClose={() => setIsWeeklyModalOpen(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="h-[80%] rounded-t-3xl bg-white px-6 pt-6">
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-4">
              <View>
                <Text className="text-lg font-bold text-gray-900">주간 운동 스케줄</Text>
                <Text className="text-xs text-gray-400">일주일 맞춤 운동 플랜</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsWeeklyModalOpen(false)}
                className="rounded-full bg-gray-100 p-2">
                <X size={18} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <ScrollView className="mt-4 flex-1" showsVerticalScrollIndicator={false}>
              {plan?.workout_plan?.weekly_routine?.map((dayPlan, dIdx) => (
                <View
                  key={dIdx}
                  className={`mb-4 rounded-2xl border p-4 ${
                    dayPlan.day === currentDay
                      ? 'border-blue-500 bg-blue-50/20'
                      : 'border-gray-100 bg-white'
                  }`}>
                  <View className="mb-2 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <Text
                        className={`text-sm font-bold ${
                          dayPlan.day === currentDay ? 'text-blue-600' : 'text-gray-800'
                        }`}>
                        {getDayNameKo(dayPlan.day)}
                      </Text>
                      {dayPlan.day === currentDay && (
                        <View className="rounded bg-blue-500 px-1.5 py-0.5">
                          <Text className="text-[10px] font-bold text-white">TODAY</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs font-semibold text-gray-500">
                      {dayPlan.is_rest_day ? '휴식일' : `${dayPlan.exercises?.length || 0}개 동작`}
                    </Text>
                  </View>

                  <Text className="mb-2 text-xs text-gray-400">{dayPlan.daily_target}</Text>

                  {!dayPlan.is_rest_day &&
                    dayPlan.exercises?.map((ex: Exercise, eIdx: number) => (
                      <View key={eIdx} className="mt-1 flex-row items-center justify-between">
                        <Text className="text-xs text-gray-600">• {ex.name_ko || ex.name}</Text>
                        <Text className="text-[10px] text-gray-400">
                          {ex.sets}세트 × {ex.reps}
                        </Text>
                      </View>
                    ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================== 오늘 해야할 운동 선택 리스트 대기 목록 모달 ==================== */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showRoutineList}
        onRequestClose={() => setShowRoutineList(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="max-h-[85%] rounded-t-3xl bg-white px-6 pb-8 pt-6">
            <View className="flex-row items-center justify-between border-b border-gray-100 pb-4">
              <View>
                <Text className="text-lg font-bold text-gray-900">오늘의 운동 종목 리스트</Text>
                <Text className="text-xs text-gray-400">운동 종목을 선택해 주세요.</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowRoutineList(false)}
                className="rounded-full bg-gray-100 p-2">
                <X size={18} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
              {todayPlan?.exercises?.map((ex: Exercise, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    setShowRoutineList(false); // 리스트 닫기
                    setSelectedExercise(ex); // 3단계: 즉시 프리뷰 모달 팝업 실행
                  }}
                  className="mb-3 flex-row items-center rounded-2xl border border-gray-100 p-4 active:bg-gray-50">
                  <View className="mr-4 h-10 w-10 items-center justify-center rounded-full bg-blue-500">
                    <Play size={14} color="white" fill="white" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-800">{ex.name_ko || ex.name}</Text>
                    <Text className="mt-0.5 text-[11px] text-gray-400">
                      {ex.sets}세트 × {ex.reps}
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================== 동작 정밀 미리보기 및 메디컬 프리뷰 모달 ==================== */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={selectedExercise !== null}
        onRequestClose={() => setSelectedExercise(null)}>
        {selectedExercise && (
          <View className="flex-1 justify-between bg-slate-50">
            {/* 상단 닫기 및 동작 전환 가이드 */}
            <SafeAreaView
              className="flex-row items-center justify-between border-b border-slate-100 bg-white px-6 py-4"
              edges={['top']}>
              <TouchableOpacity
                onPress={() => setSelectedExercise(null)}
                className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 active:bg-slate-200">
                <X size={20} color="#1E293B" />
              </TouchableOpacity>
              <Text className="flex-1 text-center text-xl font-bold text-slate-800">
                동작 가이드
              </Text>
              <View className="h-10 w-10" />
            </SafeAreaView>

            {/* 원격 외부 CDN 스트리밍 GIF 프레임 */}
            <View className="flex-1 items-center justify-center bg-white">
              {selectedExercise.gif_url ? (
                <Image
                  source={{
                    uri: selectedExercise.gif_url.includes('exercisedb.p.rapidapi.com')
                      ? `${selectedExercise.gif_url}&rapidapi-key=${process.env.EXPO_PUBLIC_RAPIDAPI_KEY || ''}`
                      : selectedExercise.gif_url,
                  }}
                  style={{ width: '100%', height: SCREEN_HEIGHT * 0.35 }}
                  resizeMode="contain"
                />
              ) : (
                <View className="h-60 w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                  <AlertTriangle size={32} color="#D97706" />
                  <Text className="mt-2 text-sm text-slate-500">
                    가이드 비디오를 불러올 수 없습니다.
                  </Text>
                </View>
              )}
            </View>

            {/* 바텀 안전 가이드 및 코칭 텍스트 */}
            <View
              className="rounded-t-3xl border-t border-slate-100 bg-white px-6 py-6 shadow-2xl"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -6 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
                elevation: 20,
              }}>
              <View className="mb-4 flex-row items-start gap-2">
                <View className="mt-2.5 h-2.5 w-2.5 rounded-full bg-blue-500" />
                <Text className="flex-1 text-xl font-extrabold text-slate-800" numberOfLines={2}>
                  {selectedExercise.name_ko || selectedExercise.name}
                </Text>
                <Text className="mt-1 pl-2 text-sm font-extrabold text-blue-600">
                  {selectedExercise.sets}세트 × {selectedExercise.reps}
                </Text>
              </View>

              {/* 추천 근거 */}
              <View className="mb-4 flex-row items-start gap-2.5 rounded-xl border border-blue-100/70 bg-blue-50/40 p-4">
                <Info size={16} color="#2563EB" className="mt-0.5" />
                <View className="flex-1">
                  <Text className="text-xs font-bold text-blue-600">
                    이 부위에 이 운동을 제안하는 이유
                  </Text>
                  <Text className="mt-1.5 text-sm leading-5 text-slate-700">
                    {selectedExercise.reason}
                  </Text>
                </View>
              </View>

              {/* 안전 텍스트 가이드 */}
              <View className="flex-row items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <AlertTriangle size={16} color="#D97706" />
                <View className="flex-1">
                  <Text className="text-xs font-bold text-amber-700">주의사항</Text>
                  <Text className="mt-1.5 text-sm leading-5 text-amber-900">
                    {selectedExercise.cautions}
                  </Text>
                </View>
              </View>

              {/* 하단 메인 '지금 시작하기' 터치 시 비로소 카메라모드로 진입 */}
              <TouchableOpacity
                onPress={() => {
                  const targetEx = selectedExercise;
                  setSelectedExercise(null);
                  router.push({
                    pathname: '/camera',
                    params: { workoutName: targetEx.name_ko || targetEx.name },
                  });
                }}
                className="mt-6 w-full flex-row items-center justify-center rounded-2xl bg-emerald-600 py-4 shadow-md active:bg-emerald-700">
                <Play size={18} color="white" fill="white" className="mr-2" />
                <Text className="ml-2 text-lg font-bold text-white">지금 카메라 코칭 시작하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}
