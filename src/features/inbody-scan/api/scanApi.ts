const API_BASE_URL = process.env.EXPO_PUBLIC_AI_SCANNER_API_URL || '';

// AI 서버에 스캔 세션 시작 요청 (웹소켓 연결용 URL 반환)
export async function startScanSession(): Promise<{ sessionId: string; wsUrl: string }> {
  const url = `${API_BASE_URL}/api/scan/start`;

  console.log('[API] POST', url);
  const response = await fetch(url, { method: 'POST' });
  console.log('[API] Response status:', response.status);

  if (!response.ok) {
    throw new Error(`Failed to start scan: ${response.status}`);
  }

  return response.json();
}

// 특정 세션의 스캔 결과를 HTTP로 가져오는 함수
export async function getScanResult(
  sessionId: string
): Promise<{ status: string; result: unknown }> {
  const response = await fetch(`${API_BASE_URL}/api/scan/result/${sessionId}`);

  if (!response.ok) {
    throw new Error(`Failed to get result: ${response.status}`);
  }

  return response.json();
}
