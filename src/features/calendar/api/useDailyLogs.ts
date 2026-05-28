import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../shared/api/supabase";

export interface DailyLog {
  id?: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  completed_exercises: string[]; // 완료한 운동 이름 목록
  completed_diets: string[]; // ['breakfast', 'lunch', 'snack', 'dinner'] 중 완료한 키 목록
  fatigue_level?: number;
  pain_level?: number;
  user_notes?: string;
  ai_coaching_feedback?: string;
}

// 해당 월의 실제 마지막 날짜를 동적으로 구하는 헬퍼 함수 (22008 예외 차단)
const getLastDayOfMonth = (yearMonthStr: string): string => {
  const [year, month] = yearMonthStr.split("-").map(Number);
  // month가 1-based 이므로, 다음 달의 0번째 날은 이번 달의 마지막 날이 됩니다.
  const lastDay = new Date(year, month, 0).getDate();
  return `${yearMonthStr}-${String(lastDay).padStart(2, "0")}`;
};

// 1. 활성화된 최신 AI 운동/식단 계획 템플릿 가져오기
export function useActiveAiPlan(userId: string | undefined) {
  return useQuery({
    queryKey: ["activeAiPlan", userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("ai_plans")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("AI Plan 조회 에러:", error);
        throw error;
      }
      return data;
    },
    enabled: !!userId,
  });
}

// 2. 특정 월(Month) 범위의 모든 일일 기록 조회하기
export function useMonthlyLogs(userId: string | undefined, yearMonth: string) {
  return useQuery({
    queryKey: ["dailyLogs", userId, yearMonth],
    queryFn: async () => {
      if (!userId) return [];

      const startDate = `${yearMonth}-01`;
      const endDate = getLastDayOfMonth(yearMonth); // 동적 계산을 적용하여 6월 31일 등의 파싱 크래시 해결

      const { data, error } = await supabase
        .from("user_daily_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("date", startDate)
        .lte("date", endDate);

      if (error) {
        console.error("Monthly logs 조회 에러:", error);
        throw error;
      }
      return (data || []) as DailyLog[];
    },
    enabled: !!userId,
  });
}

// 3. 일일 수행 체크 및 피드백 정보 업데이트/추가 (Upsert)
export function useUpdateDailyLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (log: Omit<DailyLog, "id"> & { id?: string }) => {
      const { data, error } = await supabase
        .from("user_daily_logs")
        .upsert(
          {
            ...log,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,date" },
        )
        .select()
        .single();

      if (error) {
        console.error("Daily log upsert 에러:", error);
        throw error;
      }
      return data;
    },
    onMutate: async (newLog) => {
      const yearMonth = newLog.date.substring(0, 7); // YYYY-MM
      const queryKey = ["dailyLogs", newLog.user_id, yearMonth];

      // 진행 중인 다른 목록 갱신(Refetch) 요청이 있다면 취소하여 충돌 방지
      await queryClient.cancelQueries({ queryKey });

      // 에러가 났을 때 원복(Rollback)할 수 있도록 이전 캐시의 스냅샷 저장
      const previousLogs = queryClient.getQueryData<DailyLog[]>(queryKey);

      // 캐시 데이터를 백그라운드 요청 전에 즉시 갱신 (유저 클릭 시 즉각 체크 처리)
      queryClient.setQueryData<DailyLog[]>(queryKey, (old = []) => {
        const exists = old.some((log) => log.date === newLog.date);
        if (exists) {
          return old.map((log) =>
            log.date === newLog.date ? { ...log, ...newLog } : log
          );
        } else {
          return [...old, newLog as DailyLog];
        }
      });

      // 기존 캐시 데이터를 컨텍스트로 반환
      return { previousLogs, queryKey };
    },
    onError: (err, newLog, context) => {
      // 서버 저장 실패 시 이전 상태로 안전하게 원복(Rollback)
      if (context?.previousLogs) {
        queryClient.setQueryData(context.queryKey, context.previousLogs);
      }
    },
    onSettled: (data, error, variables, context) => {
      // 작업이 성공하든 실패하든 캐시를 최신화하여 서버 실제 데이터와 동기화 맞춤
      if (context?.queryKey) {
        queryClient.invalidateQueries({ queryKey: context.queryKey });
      }
    },
  });
}
