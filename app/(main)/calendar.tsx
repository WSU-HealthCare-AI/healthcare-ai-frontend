import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { Keyboard, ScrollView } from 'react-native';
import { useAuthStore } from '@/src/entities/user/model/authStore';
import {
  useActiveAiPlan,
  useMonthlyLogs,
  useUpdateDailyLog,
} from '@/src/features/calendar/api/useDailyLogs';

import {
  formatLocalDate,
  formatMonthDay,
  isDateWithinRange,
  parseLocalDate,
} from '@/src/widgets/calendar/lib/date';
import { CalendarWidget } from '@/src/widgets/calendar/ui/CalendarWidget';

export default function CalendarScreen() {
  // 1. AuthState에서 session을 안전하게 셀렉터로 가져와 userId 추출
  const session = useAuthStore((state: any) => state.session);
  const userId = session?.user?.id;

  // 2. 달력 및 활성화 날짜 상태 관리
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState(formatLocalDate(new Date()));
  const [calendarKey, setCalendarKey] = useState(0);

  // 3. 조건부 렌더링을 위한 탭 상태 추가 (수행 체크 / 달성률 / 신체 피드백)
  const [activeTab, setActiveTab] = useState<'checklist' | 'stats' | 'feedback'>('checklist');

  // 4. 피드백 기록용 내부 폼 상태 관리
  const [fatigue, setFatigue] = useState(3);
  const [pain, setPain] = useState(3);
  const [notes, setNotes] = useState('');

  // AI 분석용 상태 관리
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // 키보드 활성화 상태 관리
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  const todayStr = formatLocalDate(new Date());
  const isFutureDate = selectedDateStr > todayStr;

  // 5. API 데이터 통신 쿼리 호출
  const yearMonth = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, [currentDate]);

  const { data: activePlan, isLoading: isPlanLoading } = useActiveAiPlan(userId);
  const { data: monthlyLogs = [], isLoading: isLogsLoading } = useMonthlyLogs(userId, yearMonth);
  const updateLogMutation = useUpdateDailyLog();

  // 6. 플랜 생성일 기준의 경과 일차(Day 1 ~ Day 7) 자동 계산 헬퍼 함수
  const getPlanDayForDate = useMemo(() => {
    return (dateStr: string) => {
      if (!activePlan?.created_at || !dateStr) return 1;

      const createdDate = new Date(activePlan.created_at.split('T')[0]);
      const targetDate = new Date(dateStr);

      const diffTime = targetDate.getTime() - createdDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return 1;
      return (diffDays % 7) + 1;
    };
  }, [activePlan]);

  const planStartDate = useMemo(() => {
    if (!activePlan?.created_at) return null;
    const startStr = activePlan.created_at.split('T')[0];
    if (!startStr) return null;
    return parseLocalDate(startStr);
  }, [activePlan]);

  const planWindow = useMemo(() => {
    if (!planStartDate) return null;

    const start = new Date(planStartDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return { start, end };
  }, [planStartDate]);

  const isDateInPlanWindow = useCallback(
    (dateStr: string) => {
      if (!planWindow) return false;
      return isDateWithinRange(dateStr, planWindow.start, planWindow.end);
    },
    [planWindow]
  );

  const planDateState = useMemo(() => {
    if (!planWindow) return 'no_plan';
    const selectedDate = parseLocalDate(selectedDateStr);
    if (selectedDate < planWindow.start) return 'before_plan';
    if (selectedDate > planWindow.end) return 'after_plan';
    return 'in_plan';
  }, [planWindow, selectedDateStr]);

  const isPlanWeekSelected = planDateState === 'in_plan';
  const isChecklistDisabled = isFutureDate || !isPlanWeekSelected;
  const isTabsDisabled = !isPlanWeekSelected || isFutureDate;


  const disabledNotice = useMemo(() => {
    if (planDateState === 'after_plan') {
      return {
        title: '아직 플랜이 생성되지 않았습니다.',
        description: '다음 플랜이 생성되면 기록할 수 있어요.',
      };
    }
    if (planDateState === 'before_plan') {
      return {
        title: '플랜이 생성되지 않은 날짜입니다.',
        description: '플랜 시작 이후부터 기록할 수 있어요.',
      };
    }
    if (planDateState === 'no_plan') {
      return {
        title: '플랜이 아직 없습니다.',
        description: '플랜 생성 후 기록할 수 있어요.',
      };
    }
    if (isFutureDate) {
      return {
        title: '아직 기록할 수 없어요.',
        description: '오늘 이후 날짜는 기록이 비활성화됩니다.',
      };
    }
    return null;
  }, [planDateState, isFutureDate]);

  const planRangeLabel = useMemo(() => {
    if (!planWindow) return '플랜이 아직 없습니다.';
    return `${formatMonthDay(planWindow.start)} ~ ${formatMonthDay(planWindow.end)}`;
  }, [planWindow]);

  // 7. 날짜별 상태 정보 가져오기 (전체 완료, 부분 완료, 휴식 여부 등)
  const getDayStatus = useCallback(
    (dateStr: string) => {
      if (!dateStr) return 'none';
      if (!isDateInPlanWindow(dateStr)) return 'none';
      const log = monthlyLogs.find((l: any) => l.date === dateStr);

      const planDay = getPlanDayForDate(dateStr);

      const routineDay = activePlan?.plan_payload?.workout_plan?.weekly_routine?.find(
        (r: any) => r.day === planDay
      );

      const isRestDay = routineDay?.is_rest_day ?? true;

      if (!log) return isRestDay ? 'rest' : 'empty';

      const totalExercises = routineDay?.exercises?.length || 0;
      const completedExercisesCount = log.completed_exercises?.length || 0;
      const completedDietsCount = log.completed_diets?.length || 0;

      const isWorkoutDone = totalExercises === 0 || completedExercisesCount >= totalExercises;
      const isDietDone = completedDietsCount >= 4;

      if (isWorkoutDone && isDietDone) return 'all_done';
      if (completedExercisesCount > 0 || completedDietsCount > 0) return 'partial';
      return isRestDay ? 'rest' : 'empty';
    },
    [monthlyLogs, activePlan, getPlanDayForDate, isDateInPlanWindow]
  );

  const monthDateStrings = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();

    return Array.from({ length: totalDays }, (_, index) =>
      formatLocalDate(new Date(year, month, index + 1))
    );
  }, [currentDate]);

  const markedDates = useMemo(() => {
    const marks: Record<
      string,
      {
        selected?: boolean;
        selectedColor?: string;
        selectedTextColor?: string;
        marked?: boolean;
        dotColor?: string;
        statusColor?: string;
      }
    > = {};

    marks[selectedDateStr] = {
      selected: true,
      selectedColor: '#2563EB',
      selectedTextColor: '#FFFFFF',
    };

    monthDateStrings.forEach((dateStr) => {
      if (!isDateInPlanWindow(dateStr)) return;
      const status = getDayStatus(dateStr);
      if (status === 'none') return;

      let statusColor = '#9CA3AF';
      if (status === 'all_done') statusColor = '#059669';
      else if (status === 'partial') statusColor = '#D97706';
      else if (status === 'rest') statusColor = '#3B82F6';

      const isSelected = dateStr === selectedDateStr;
      const existing = marks[dateStr] ?? {};
      marks[dateStr] = {
        ...existing,
        marked: true,
        dotColor: isSelected ? '#FFFFFF' : statusColor,
        statusColor,
        selected: isSelected ? true : existing.selected,
        selectedColor: existing.selectedColor,
        selectedTextColor: existing.selectedTextColor,
      };
    });

    return marks;
  }, [monthDateStrings, selectedDateStr, getDayStatus, isDateInPlanWindow]);

  // 9. 현재 선택한 날짜에 매핑되는 상세 데이터 분석
  const selectedLog = useMemo(() => {
    return monthlyLogs.find((l: any) => l.date === selectedDateStr);
  }, [monthlyLogs, selectedDateStr]);

  const selectedPlanDay = useMemo(() => {
    return getPlanDayForDate(selectedDateStr);
  }, [selectedDateStr, getPlanDayForDate]);

  const todayWorkoutPlan = useMemo(() => {
    return activePlan?.plan_payload?.workout_plan?.weekly_routine?.find(
      (r: any) => r.day === selectedPlanDay
    );
  }, [activePlan, selectedPlanDay]);

  const todayDietPlan = useMemo(() => {
    return activePlan?.plan_payload?.weekly_diet_plan?.find((d: any) => d.day === selectedPlanDay);
  }, [activePlan, selectedPlanDay]);

  // 10. 일간 달성도 통계 계산 (오늘의 달성률 연동)
  const stats = useMemo(() => {
    const totalExercises = todayWorkoutPlan?.exercises?.length || 0;
    const totalDiets = 4;
    const completedExercises = selectedLog?.completed_exercises?.length || 0;
    const completedDiets = selectedLog?.completed_diets?.length || 0;
    const isRestDay = todayWorkoutPlan?.is_rest_day ?? false;

    const totalItems = totalExercises + totalDiets;
    const completedItems = completedExercises + completedDiets;
    const rate = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    return { totalExercises, totalDiets, completedExercises, completedDiets, rate, isRestDay };
  }, [todayWorkoutPlan, selectedLog]);

  // 11. 주간 누적 달성도 통계 계산
  const weeklyStats = useMemo(() => {
    if (!activePlan) {
      return {
        rate: 0,
        completedExercises: 0,
        totalExercises: 0,
        completedDiets: 0,
        totalDiets: 0,
      };
    }

    const targetDate = new Date(selectedDateStr);
    const day = targetDate.getDay();
    const diffToMonday = targetDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(targetDate.setDate(diffToMonday));

    let totalPlannedItems = 0;
    let totalCompletedItems = 0;
    let totalExercisesCount = 0;
    let totalDietsCount = 0;
    let totalCompletedExercises = 0;
    let totalCompletedDiets = 0;

    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(monday);
      currentDay.setDate(monday.getDate() + i);
      const dateStr = currentDay.toISOString().split('T')[0];

      const log = monthlyLogs.find((l: any) => l.date === dateStr);
      const planDay = getPlanDayForDate(dateStr);
      const routineDay = activePlan?.plan_payload?.workout_plan?.weekly_routine?.find(
        (r: any) => r.day === planDay
      );

      const exercisesCount = routineDay?.exercises?.length || 0;
      const completedExercises = log?.completed_exercises?.length || 0;
      const completedDiets = log?.completed_diets?.length || 0;

      totalPlannedItems += exercisesCount + 4;
      totalCompletedItems += completedExercises + completedDiets;
      totalExercisesCount += exercisesCount;
      totalDietsCount += 4;
      totalCompletedExercises += completedExercises;
      totalCompletedDiets += completedDiets;
    }

    const rate =
      totalPlannedItems > 0 ? Math.round((totalCompletedItems / totalPlannedItems) * 100) : 0;
    return {
      rate,
      completedExercises: totalCompletedExercises,
      totalExercises: totalExercisesCount,
      completedDiets: totalCompletedDiets,
      totalDiets: totalDietsCount,
    };
  }, [selectedDateStr, monthlyLogs, activePlan, getPlanDayForDate]);

  // 12. 폼 필드 로컬 싱크 동기화 (날짜 변경 시 자동으로 기존 입력값 로드)
  const [prevLog, setPrevLog] = useState<any>(null);
  const [prevDateStr, setPrevDateStr] = useState(selectedDateStr);

  if (selectedLog !== prevLog || selectedDateStr !== prevDateStr) {
    setPrevLog(selectedLog);
    setPrevDateStr(selectedDateStr);
    
    if (!isAnalyzing) {
      if (selectedLog) {
        setFatigue(selectedLog.fatigue_level ?? 3);
        setPain(selectedLog.pain_level ?? 3);
        setNotes(selectedLog.user_notes ?? '');
        setShowFeedback(!!selectedLog.ai_coaching_feedback);
      } else {
        setFatigue(3);
        setPain(3);
        setNotes('');
        setShowFeedback(false);
      }
      setIsAnalyzing(false);
    }
  }

  // 13. 체크박스 상호작용 및 기록 저장 로직
  const toggleExercise = async (exerciseName: string) => {
    if (!userId || isChecklistDisabled) return;
    const currentCompleted: string[] = selectedLog?.completed_exercises || [];
    const newCompleted = currentCompleted.includes(exerciseName)
      ? currentCompleted.filter((name: string) => name !== exerciseName)
      : [...currentCompleted, exerciseName];

    updateLogMutation.mutate({
      user_id: userId,
      date: selectedDateStr,
      completed_exercises: newCompleted,
      completed_diets: selectedLog?.completed_diets || [],
      fatigue_level: fatigue,
      pain_level: pain,
      user_notes: notes,
      ai_coaching_feedback: selectedLog?.ai_coaching_feedback,
    });
  };

  const toggleDiet = async (dietType: string) => {
    if (!userId || isChecklistDisabled) return;
    const currentCompleted: string[] = selectedLog?.completed_diets || [];
    const newCompleted = currentCompleted.includes(dietType)
      ? currentCompleted.filter((t: string) => t !== dietType)
      : [...currentCompleted, dietType];

    updateLogMutation.mutate({
      user_id: userId,
      date: selectedDateStr,
      completed_exercises: selectedLog?.completed_exercises || [],
      completed_diets: newCompleted,
      fatigue_level: fatigue,
      pain_level: pain,
      user_notes: notes,
      ai_coaching_feedback: selectedLog?.ai_coaching_feedback,
    });
  };

  const saveFeedback = async () => {
    if (!userId) return;

    setIsAnalyzing(true);
    setShowFeedback(false);
    setAnalysisStep(0);

    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    let aiAdvice = '오늘 하루도 건강 플랜을 실천하시느라 수고하셨습니다!';
    if (fatigue >= 4) {
      aiAdvice =
        '⚠️ 플랜 수행의 난이도가 다소 높으셨군요! 신체 디스크 배열과 근 피로도를 고려하여 내일은 운동 반복 횟수를 15% 가량 낮춰 조율하는 것을 권장합니다.';
    } else if (pain <= 2) {
      aiAdvice =
        '🚨 오늘 컨디션 지표가 저조한 구간입니다. 이럴 때는 강도 높은 트레이닝을 피하고, 척추 부하가 없는 스트레칭 및 수분 보충 중심으로 건강을 충전해 보세요.';
    } else {
      aiAdvice =
        '✨ 아주 안정적인 신체 밸런스와 플랜 만족도입니다! 지치지 않고 꾸준히 운동 플랜을 실천하도록 현 강도를 쭉 유지해 주셔도 좋습니다.';
    }

    updateLogMutation.mutate({
      user_id: userId,
      date: selectedDateStr,
      completed_exercises: selectedLog?.completed_exercises || [],
      completed_diets: selectedLog?.completed_diets || [],
      fatigue_level: fatigue,
      pain_level: pain,
      user_notes: notes,
      ai_coaching_feedback: aiAdvice,
    });

    const t1 = 1500 + Math.floor(Math.random() * 1000);
    const t2 = 1400 + Math.floor(Math.random() * 800);
    const t3 = 1200 + Math.floor(Math.random() * 600);

    setTimeout(() => {
      setAnalysisStep(1);
      scrollRef.current?.scrollToEnd({ animated: true });
      setTimeout(() => {
        setAnalysisStep(2);
        scrollRef.current?.scrollToEnd({ animated: true });
        setTimeout(() => {
          setIsAnalyzing(false);
          setShowFeedback(true);
          setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
          }, 150);
        }, t3);
      }, t2);
    }, t1);
  };

  return (
    <CalendarWidget
      currentDate={currentDate}
      setCurrentDate={setCurrentDate}
      selectedDateStr={selectedDateStr}
      setSelectedDateStr={setSelectedDateStr}
      calendarKey={calendarKey}
      setCalendarKey={setCalendarKey}
      activeTab={isTabsDisabled ? 'checklist' : activeTab}
      setActiveTab={setActiveTab}
      fatigue={fatigue}
      setFatigue={setFatigue}
      pain={pain}
      setPain={setPain}
      notes={notes}
      setNotes={setNotes}
      isAnalyzing={isAnalyzing}
      analysisStep={analysisStep}
      showFeedback={showFeedback}
      isKeyboardVisible={isKeyboardVisible}
      scrollRef={scrollRef}
      planRangeLabel={planRangeLabel}
      markedDates={markedDates}
      todayWorkoutPlan={todayWorkoutPlan}
      selectedLog={selectedLog}
      todayDietPlan={todayDietPlan}
      stats={stats}
      weeklyStats={weeklyStats}
      isPlanWeekSelected={isPlanWeekSelected}
      isChecklistDisabled={isChecklistDisabled}
      isTabsDisabled={isTabsDisabled}
      disabledNotice={disabledNotice}
      isPlanLoading={isPlanLoading}
      isLogsLoading={isLogsLoading}
      updateLogMutationIsPending={updateLogMutation.isPending}
      toggleExercise={toggleExercise}
      toggleDiet={toggleDiet}
      saveFeedback={saveFeedback}
    />
  );
}
