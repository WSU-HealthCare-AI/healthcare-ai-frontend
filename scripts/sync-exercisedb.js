const { createClient } = require('@supabase/supabase-js');
const path = require('path');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
require('dotenv').config();

// 1. 환경변수 확인 및 Supabase Admin 클라이언트 세팅
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !RAPIDAPI_KEY) {
  console.error(
    '❌ 필수 환경 변수가 누락되었습니다: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RAPIDAPI_KEY를 확인해 주세요.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 2. 글로벌 fetch의 무한 Hanging 현상을 방지하기 위한 타늄아웃 구현 헬퍼
async function fetchWithTimeout(url, options, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// 3. 지수 백오프 기반의 안전한 Fetcher 구현
async function fetchWithRetry(url, options, retries = 5, delay = 2000) {
  try {
    const res = await fetchWithTimeout(url, options, 10000);

    if (res.ok || (res.status >= 400 && res.status < 429)) {
      return res;
    }
    if (retries > 1 && (res.status === 429 || res.status >= 500)) {
      console.log(
        `⚠️ Rate Limit 감지 (Status: ${res.status}). ${delay}ms 후 재시도합니다... (남은 횟수: ${retries - 1})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    return res;
  } catch (error) {
    const isAbort = error.name === 'AbortError';
    const errorMsg = isAbort ? '네트워크 요청 시간 초과(10초 타임아웃)' : error.message;

    if (retries > 1) {
      console.log(
        `⚠️ ${errorMsg} 발생. ${delay}ms 후 안전하게 재시도합니다... (남은 횟수: ${retries - 1})`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw new Error(`${errorMsg} - 백오프 재시도 한계를 초과했습니다.`);
  }
}

// 4. 메인 동기화 루프 가동 (오프셋 페이징 수집 구현)
async function runSync() {
  try {
    const payload = [];
    let offset = 0;
    const limit = 10; // 무료 플랜의 안전 상한선
    let keepFetching = true;
    const maxSafetyPages = 35; // 최대 350개 운동 수집 (무한 루프 방지용 안전 가드레일)
    let pageCount = 0;

    console.log(
      `\n🔄 [영문 벌크 시딩 가동] ExerciseDB로부터 기구 없는 순수 영문 맨몸 운동 데이터 수집을 시작합니다...`
    );

    while (keepFetching && pageCount < maxSafetyPages) {
      pageCount++;
      const url = `https://exercisedb.p.rapidapi.com/exercises/equipment/body%20weight?limit=${limit}&offset=${offset}`;
      const options = {
        method: 'GET',
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
        },
      };

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📦 [페이징 요청] Page ${pageCount} (Offset: ${offset}) 가져오는 중...`);

      try {
        const response = await fetchWithRetry(url, options);
        if (!response.ok) {
          console.error(`❌ [수집 실패] API 요청 오류 (Status: ${response.status})`);
          break;
        }

        const rawText = await response.text();
        if (!rawText || rawText.trim() === '') {
          console.log(`ℹ️ 빈 본문 수신으로 인해 수집을 종료합니다.`);
          keepFetching = false;
          break;
        }

        const data = JSON.parse(rawText);
        if (!Array.isArray(data) || data.length === 0) {
          console.log(`✅ [수집 종료] 더 이상 가져올 운동 데이터가 없습니다.`);
          keepFetching = false;
          break;
        }

        console.log(`📥 이번 페이지에서 ${data.length}개의 로우 데이터를 수신했습니다.`);

        for (const ex of data) {
          // 장비 필터링 크로스체크
          if (!ex.equipment || ex.equipment.toLowerCase().trim() !== 'body weight') {
            continue;
          }

          // 이미지 경로 자동 합성 (무인가 CDN 스트리밍 프록시 포맷 적용)
          const generatedImageUrl = `https://exercisedb.p.rapidapi.com/image?exerciseId=${ex.id}&resolution=360`;

          const koInstructions = ex.instructions
            ? Array.isArray(ex.instructions)
              ? ex.instructions.map((inst) => inst.trim())
              : [ex.instructions]
            : [];

          // 중복 여부 확인
          const isAlreadyAdded = payload.some(
            (p) => p.name_en.toLowerCase() === ex.name.toLowerCase()
          );
          if (!isAlreadyAdded) {
            payload.push({
              name_en: ex.name,
              gif_url: generatedImageUrl,
              body_part: ex.bodyPart || 'etc',
              target_muscle: ex.target || 'general',
              instructions: koInstructions,
              updated_at: new Date().toISOString(),
            });
            console.log(`   ✨ [적재 대기 추가] "${ex.name}"`);
          }
        }

        // 다음 페이지 오프셋 증가 및 안전 지연(Rate Limit 방어용 1.5초)
        offset += limit;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (innerErr) {
        console.error(`❌ Page ${pageCount} 처리 중 에러 발생:`, innerErr.message);
        break;
      }
    }

    if (payload.length === 0) {
      console.warn('\n⚠️ 동기화할 수 있는 순수 맨몸 운동 데이터가 존재하지 않습니다.');
      return;
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(
      `🔄 수집 완료! 총 ${payload.length}개의 순수 영문 맨몸 운동 데이터를 Supabase에 Upsert 중...`
    );

    // 분할 업서트를 통한 커넥션 타임아웃 예방 (Chunking: 50개 단위)
    const chunkSize = 50;
    for (let i = 0; i < payload.length; i += chunkSize) {
      const chunk = payload.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('exercise_metadata')
        .upsert(chunk, { onConflict: 'name_en' });

      if (error) {
        throw error;
      }
      console.log(`   ⚡ [벌크 적재 완료] ${i + chunk.length} / ${payload.length} 개 완료`);
    }

    console.log('\n🎉 [성공 종결] 수백 개의 영문 맨몸 운동 데이터가 완벽하게 적재되었습니다!');
  } catch (err) {
    console.error('❌ Supabase 벌크 적재 중 치명적인 에러 발생:', err);
    process.exit(1);
  }
}

runSync();
