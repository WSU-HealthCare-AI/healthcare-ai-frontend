# HealthCare AI - Frontend

## 📌 프로젝트 소개

AI 기반 맞춤형 헬스케어 앱입니다.

- **대상:** 오프라인 PT 비용이 부담되거나, 바빠서 식단을 챙기기 힘든 현대인, 기저질환 때문에 운동을 시작하기 두려운 사람
- **핵심 목표:**
  - 인바디 결과와 개인 상태 기반 식단/운동 추천
  - 비전 AI로 실시간 자세 교정

**담당자**

- 프론트엔드 리드: 오승하
- 비전/센서 연동: 오승하, 권성욱

---

## 🛠️ 기술 스택

- **Core:** React Native, Expo (Dev Client)
  - _실시간 관절 궤적 분석 및 프레임 드랍 방지를 위해 네이티브 자원이 필요하므로 Expo Go는 사용 불가. Dev Client로 커스텀 빌드 필수_
- **Language:** TypeScript
- **Routing:** Expo Router
- **Vision/AI:** `react-native-vision-camera`, MediaPipe Pose Landmark
- **Styling:** NativeWind (Tailwind CSS)
- **State/Data Management:** Zustand(전역), TanStack Query(서버), React Hook Form(폼)

---

## 🚀 초기 세팅 가이드

1. **레포지토리 클론 및 의존성 설치**
   ```bash
   git clone https://github.com/WSU-HealthCare-AI/healthcare-ai-frontend
   cd healthcare-ai-frontend
   npm install
   ```
2. **앱 실행 (Dev Client 환경)**
   - EAS 빌드 가이드는 추후 업데이트 예정

---

## GitHub 협업 가이드 (GitHub Flow)

- **main 브랜치는 항상 완벽한 상태 유지**
- 직접 main 브랜치에 푸시 금지

### 1. 작업 시작 전

```bash
git switch main
git pull origin main
npm install # 라이브러리 동기화
```

### 2. 브랜치 생성 및 네이밍

- 기능 추가: `feature/기능이름` (예: `feature/onboarding-ui`)
- 버그 수정: `bugfix/버그내용` (예: `bugfix/login-error`)

```bash
git switch -c feature/작업명
```

### 3. 작업 및 커밋

- 코드는 작게, 자주 커밋
- 커밋 메시지 규칙:
  - `feat:` 새로운 기능
  - `fix:` 버그 수정
  - `style:` 코드/스타일 변경
  - `chore:` 패키지/설정 등

```bash
git commit -m "feat: 온보딩 화면 레이아웃 구현"
```

### 4. 작업 공유 및 리뷰 (Pull Request)

```bash
git push origin feature/작업명
```

- PR 본문에 작업 내용 및 리뷰 요청 사항 작성
- 팀원 리뷰/승인 후 main으로 Merge

---

## 🚨 라이브러리 충돌 방지

- main에서 pull 받은 후 **반드시** `npm install` 실행  
  (라이브러리 미동기화 시 에러 발생)

---
