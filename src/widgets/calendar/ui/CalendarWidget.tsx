import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatLocalDate } from '../lib/date';

import { AchievementRateCard } from './AchievementRateCard';
import { WorkoutChecklist } from './WorkoutChecklist';
import { DietChecklist } from './DietChecklist';
import { FeedbackForm } from './FeedbackForm';
import { NoticeCard, NoPlanNotice } from './NoticeCard';
import { AiAnalyzingCard } from './AiAnalyzingCard';
import { AiFeedbackCard } from './AiFeedbackCard';

export interface CalendarWidgetProps {
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  selectedDateStr: string;
  setSelectedDateStr: React.Dispatch<React.SetStateAction<string>>;
  calendarKey: number;
  setCalendarKey: React.Dispatch<React.SetStateAction<number>>;
  activeTab: 'checklist' | 'stats' | 'feedback';
  setActiveTab: React.Dispatch<React.SetStateAction<'checklist' | 'stats' | 'feedback'>>;
  fatigue: number;
  setFatigue: (lvl: number) => void;
  pain: number;
  setPain: (lvl: number) => void;
  notes: string;
  setNotes: (text: string) => void;
  isAnalyzing: boolean;
  analysisStep: number;
  showFeedback: boolean;
  isKeyboardVisible: boolean;
  scrollRef: React.RefObject<ScrollView | null>;

  planRangeLabel: string;
  markedDates: any;
  todayWorkoutPlan: any;
  selectedLog: any;
  todayDietPlan: any;
  stats: {
    totalExercises: number;
    totalDiets: number;
    completedExercises: number;
    completedDiets: number;
    rate: number;
    isRestDay: boolean;
  };
  weeklyStats: {
    rate: number;
    completedExercises: number;
    totalExercises: number;
    completedDiets: number;
    totalDiets: number;
  };
  isPlanWeekSelected: boolean;
  isChecklistDisabled: boolean;
  isTabsDisabled: boolean;
  disabledNotice: { title: string; description: string } | null;

  isPlanLoading: boolean;
  isLogsLoading: boolean;
  updateLogMutationIsPending: boolean;

  toggleExercise: (exerciseName: string) => Promise<void>;
  toggleDiet: (dietType: string) => Promise<void>;
  saveFeedback: () => Promise<void>;
}

export function CalendarWidget({
  currentDate,
  setCurrentDate,
  selectedDateStr,
  setSelectedDateStr,
  calendarKey,
  setCalendarKey,
  activeTab,
  setActiveTab,
  fatigue,
  setFatigue,
  pain,
  setPain,
  notes,
  setNotes,
  isAnalyzing,
  analysisStep,
  showFeedback,
  isKeyboardVisible,
  scrollRef,
  planRangeLabel,
  markedDates,
  todayWorkoutPlan,
  selectedLog,
  todayDietPlan,
  stats,
  weeklyStats,
  isPlanWeekSelected,
  isChecklistDisabled,
  isTabsDisabled,
  disabledNotice,
  isPlanLoading,
  isLogsLoading,
  updateLogMutationIsPending,
  toggleExercise,
  toggleDiet,
  saveFeedback,
}: CalendarWidgetProps) {
  const todayStr = formatLocalDate(new Date());
  const isFutureDate = selectedDateStr > todayStr;

  if (isPlanLoading || isLogsLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="mt-3 font-semibold text-gray-500">캘린더 일정을 분석하고 있습니다...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 64}
        className="flex-1">
        {/* 헤더 타이틀 */}
        <View className="border-b border-gray-50 px-6 py-4">
          <View>
            <Text className="text-2xl font-bold text-gray-900">캘린더</Text>
            <Text className="mt-1 text-blue-600">
              {selectedDateStr === todayStr
                ? '현재 오늘자 보는 중'
                : `현재 ${selectedDateStr.slice(2)}일자 보는 중`}
            </Text>
          </View>
        </View>
        {/* 1. 플랜 주차 안내 및 오늘 단축 버튼 */}
        <View className="px-4">
          <View className="mb-2 flex-row items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3">
            <View>
              <Text className="text-[11px] font-semibold text-gray-500">
                플랜이 생성된 이번 주차
              </Text>
              <Text className="text-sm font-bold text-gray-900">{planRangeLabel}</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                const today = new Date();
                setCurrentDate(today);
                setSelectedDateStr(formatLocalDate(today));
                setCalendarKey((prev) => prev + 1);
                scrollRef.current?.scrollTo({ y: 0, animated: true });
              }}
              className="rounded-xl border-2 border-gray-200 bg-blue-50 px-3.5 py-1.5">
              <Text className="text-xs font-bold text-blue-600">오늘로 가기</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          className="flex-1 px-4"
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: isKeyboardVisible ? 140 : 20,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* 2. 달력 상태 점 색상 설명 범례 가이드 */}
          <View className="mb-4 flex-row flex-wrap items-center justify-between gap-y-2 rounded-2xl bg-gray-50 px-4 py-3">
            <View className="flex-row items-center">
              <View className="mr-1.5 h-2.5 w-2.5 rounded-full bg-emerald-600" />
              <Text className="text-[11px] font-bold text-gray-500">전체 완료</Text>
            </View>
            <View className="flex-row items-center">
              <View className="mr-1.5 h-2.5 w-2.5 rounded-full bg-amber-600" />
              <Text className="text-[11px] font-bold text-gray-500">일부 완료</Text>
            </View>
            <View className="flex-row items-center">
              <View className="mr-1.5 h-2.5 w-2.5 rounded-full bg-blue-500" />
              <Text className="text-[11px] font-bold text-gray-500">휴식 권장일</Text>
            </View>
            <View className="flex-row items-center">
              <View className="mr-1.5 h-2.5 w-2.5 rounded-full bg-gray-400" />
              <Text className="text-[11px] font-bold text-gray-500">미이행 플랜</Text>
            </View>
          </View>

          {/* 3. 월간 캘린더 */}
          <View className="mb-4 overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <Calendar
              key={calendarKey}
              current={formatLocalDate(currentDate)}
              onDayPress={(day: DateData) => setSelectedDateStr(day.dateString)}
              onMonthChange={(month: DateData) =>
                setCurrentDate(new Date(month.year, month.month - 1, 1))
              }
              markedDates={markedDates}
              dayComponent={({ date, state, marking }) => {
                const dateStr = date?.dateString ?? '';
                const isSelected = dateStr === selectedDateStr;
                const dotColor = (marking as { dotColor?: string })?.dotColor;
                const ringColor = (marking as { statusColor?: string })?.statusColor;
                const isDisabled = state === 'disabled';
                const isToday = state === 'today';
                const textColor = isSelected
                  ? '#FFFFFF'
                  : isDisabled
                    ? '#E5E7EB'
                    : isToday
                      ? '#2563EB'
                      : '#1F2937';

                return (
                  <View
                    className="items-center justify-center"
                    style={{
                      height: 38,
                      width: 38,
                      borderRadius: 14,
                      borderWidth: isSelected && ringColor ? 2 : 0,
                      borderColor: isSelected && ringColor ? ringColor : 'transparent',
                    }}>
                    <TouchableOpacity
                      onPress={() => dateStr && setSelectedDateStr(dateStr)}
                      disabled={isDisabled}
                      className="items-center justify-center"
                      style={{
                        height: 32,
                        width: 32,
                        borderRadius: 12,
                        backgroundColor: isSelected ? '#2563EB' : 'transparent',
                      }}>
                      <Text style={{ color: textColor, fontSize: 14, fontWeight: '600' }}>
                        {date?.day}
                      </Text>
                      {dotColor && (
                        <View
                          style={{
                            position: 'absolute',
                            bottom: 2,
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: dotColor,
                          }}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              }}
              enableSwipeMonths
              hideExtraDays
              monthFormat={'yyyy년 M월'}
              firstDay={0}
              theme={{
                calendarBackground: '#FFFFFF',
                textSectionTitleColor: '#9CA3AF',
                dayTextColor: '#1F2937',
                textDisabledColor: '#E5E7EB',
                monthTextColor: '#1F2937',
                selectedDayBackgroundColor: '#2563EB',
                selectedDayTextColor: '#FFFFFF',
                todayTextColor: '#2563EB',
                arrowColor: '#4B5563',
                textDayFontWeight: '600',
                textMonthFontWeight: '700',
                textDayHeaderFontWeight: '700',
                textDayFontSize: 14,
                textMonthFontSize: 16,
                textDayHeaderFontSize: 12,
              }}
            />
          </View>

          {/* 4. 기획서 매핑 탭 컨트롤 바 (NativeWind v4 호환성 대응 인라인 스타일 적용) */}
          <View className="mb-6 flex-row rounded-2xl bg-gray-100 p-1.5">
            <TouchableOpacity
              onPress={() => !isTabsDisabled && setActiveTab('checklist')}
              disabled={isTabsDisabled}
              className="flex-1 items-center rounded-xl py-3"
              style={
                activeTab === 'checklist'
                  ? {
                      backgroundColor: '#FFFFFF',
                      ...Platform.select({
                        ios: {
                          shadowColor: '#000000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.12,
                          shadowRadius: 2,
                        },
                        android: {
                          elevation: 2,
                        },
                      }),
                    }
                  : { backgroundColor: 'transparent' }
              }>
              <Text
                className="text-sm font-bold"
                style={{
                  color: isTabsDisabled
                    ? '#CBD5F5'
                    : activeTab === 'checklist'
                      ? '#2563EB'
                      : '#6B7280',
                }}>
                수행 체크
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => !isTabsDisabled && setActiveTab('stats')}
              disabled={isTabsDisabled}
              className="flex-1 items-center rounded-xl py-3"
              style={
                activeTab === 'stats'
                  ? {
                      backgroundColor: '#FFFFFF',
                      ...Platform.select({
                        ios: {
                          shadowColor: '#000000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.12,
                          shadowRadius: 2,
                        },
                        android: {
                          elevation: 2,
                        },
                      }),
                    }
                  : { backgroundColor: 'transparent' }
              }>
              <Text
                className="text-sm font-bold"
                style={{
                  color: isTabsDisabled ? '#CBD5F5' : activeTab === 'stats' ? '#2563EB' : '#6B7280',
                }}>
                달성률
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => !isTabsDisabled && setActiveTab('feedback')}
              disabled={isTabsDisabled}
              className="flex-1 items-center rounded-xl py-3"
              style={
                activeTab === 'feedback'
                  ? {
                      backgroundColor: '#FFFFFF',
                      ...Platform.select({
                        ios: {
                          shadowColor: '#000000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: 0.12,
                          shadowRadius: 2,
                        },
                        android: {
                          elevation: 2,
                        },
                      }),
                    }
                  : { backgroundColor: 'transparent' }
              }>
              <Text
                className="text-sm font-bold"
                style={{
                  color: isTabsDisabled
                    ? '#CBD5F5'
                    : activeTab === 'feedback'
                      ? '#2563EB'
                      : '#6B7280',
                }}>
                신체 피드백
              </Text>
            </TouchableOpacity>
          </View>

          {/* 5. 탭 상태에 따른 조건부 영역 분할 렌더링 */}
          {activeTab === 'checklist' &&
            (isPlanWeekSelected ? (
              <View>
                {isFutureDate && disabledNotice && (
                  <NoticeCard
                    title={disabledNotice.title}
                    description={disabledNotice.description}
                  />
                )}
                {/* 운동 체크리스트 */}
                <WorkoutChecklist
                  todayWorkoutPlan={todayWorkoutPlan}
                  selectedLog={selectedLog}
                  toggleExercise={toggleExercise}
                  isCheckableDate={!isChecklistDisabled}
                />
                {/* 식단 체크리스트 */}
                <DietChecklist
                  todayDietPlan={todayDietPlan}
                  selectedLog={selectedLog}
                  toggleDiet={toggleDiet}
                  isCheckableDate={!isChecklistDisabled}
                />
              </View>
            ) : disabledNotice ? (
              <NoticeCard title={disabledNotice.title} description={disabledNotice.description} />
            ) : (
              <NoPlanNotice />
            ))}

          {activeTab === 'stats' &&
            (!isTabsDisabled && isPlanWeekSelected ? (
              <View className="mb-6 rounded-3xl border border-gray-100 bg-gray-50 p-4">
                {/* 일일 달성률 및 주간 달성률 동시 확인 레이아웃 적용 */}
                <AchievementRateCard stats={stats} weeklyStats={weeklyStats} />
              </View>
            ) : disabledNotice ? (
              <NoticeCard title={disabledNotice.title} description={disabledNotice.description} />
            ) : (
              <NoPlanNotice />
            ))}

          {activeTab === 'feedback' &&
            (!isTabsDisabled && isPlanWeekSelected ? (
              <View>
                {/* 범용 플랜 피드백 입력 폼 */}
                <FeedbackForm
                  fatigue={fatigue}
                  setFatigue={setFatigue}
                  pain={pain}
                  setPain={setPain}
                  notes={notes}
                  setNotes={setNotes}
                  saveFeedback={saveFeedback}
                  isPending={updateLogMutationIsPending}
                />

                {/* AI 코치 분석 중 시뮬레이션 */}
                {isAnalyzing && <AiAnalyzingCard step={analysisStep} />}

                {/* AI 코치 피드백 카드 */}
                {!isAnalyzing && showFeedback && selectedLog?.ai_coaching_feedback && (
                  <AiFeedbackCard feedback={selectedLog.ai_coaching_feedback} />
                )}
              </View>
            ) : disabledNotice ? (
              <NoticeCard title={disabledNotice.title} description={disabledNotice.description} />
            ) : (
              <NoPlanNotice />
            ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
