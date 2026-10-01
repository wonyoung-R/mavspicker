# MAVS Finger Picker

모바일 화면에 두 개 이상 손가락을 유지하면 실제 Mavericks 선수 사진 중 한 터치를 추첨하는 정적 팬 데모입니다. 사진 5장은 로컬에 저장되며 외부 런타임 요청·계정·저장·추적은 없습니다.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npx playwright install chromium
npm run test:browser
npm run build
npm run preview
```

기본 포트: 개발 5173 / 미리보기 4173. 다른 프로젝트가 사용 중이면 Vite가 다음 포트를 선택합니다. 이번 세션 실행 주소: 개발 http://127.0.0.1:5175 / 프로덕션 미리보기 http://127.0.0.1:4175 (`npm run preview -- --port 4175 --strictPort`).

같은 Wi-Fi 휴대폰 접속을 원하는 경우 직접 `npm run dev -- --host 0.0.0.0`을 실행하고 Vite가 표시하는 LAN 주소를 엽니다. 방화벽 변경·터널·배포는 수행하지 않습니다. LAN HTTP에서는 브라우저 보안 정책 때문에 fullscreen 등 일부 API가 제한될 수 있습니다. Web Crypto를 사용할 수 없으면 추첨 오류를 표시합니다.

## 상태 규칙

터치 pointerId 기준으로 대기 → 400ms 안정화 → 3/2/1(3초) → 결과 고정. 이동은 위치만 갱신하며 추가·제거·취소·예기치 않은 capture 손실은 진행 예약을 취소합니다. 결과 후 들어온 터치는 해제만 추적하고 모두 해제해야 다음 판을 시작합니다. 사진이 5개를 넘으면 사진을 재사용하고 참가 번호로 구분합니다.

hidden·pagehide·창 포커스 이탈·회전은 오래된 터치와 타이머를 폐기합니다. 확정 결과는 보존하되 중단으로 이전 입력을 버렸으므로 복귀 뒤 새로운 pointerdown부터 새 판을 시작합니다. 주소창 높이·viewport resize·fullscreen 변화는 사진 좌표만 재계산합니다.

추첨은 Web Crypto Uint32 rejection sampling으로 각 활성 터치에 정확히 1/n 확률을 줍니다. 테스트에서만 난수와 타이머를 주입하며 앱에는 조작 모드가 없습니다. 사진 로딩·디코딩은 즉시 시작되며 입력 집합을 바꾸지 않습니다. 사진 실패 시 이름 접근성 라벨과 이니셜 fallback을 사용합니다.

## 지원과 확인 범위

Pointer Events 및 maxTouchPoints ≥ 2 환경용입니다. 마우스 게임 모드는 없습니다. 동시 터치 수는 하드웨어·OS에 달려 있으며 10명 지원을 보장하지 않습니다. 표준 fullscreen은 실제 탭 종료/click의 활성화 안에서 한 번만 요청합니다. 거절·미지원에서도 게임은 계속됩니다. 진동은 40ms를 한 번 요청하지만 실제 진동을 보장하지 않습니다. iOS Safari 일반 요소 fullscreen·진동도 보장하지 않습니다.

**실제 iPhone Safari·Android Chrome 실기기 미검증.** 합성 Pointer Events 및 Chromium CDP 터치는 OS 제스처·실제 사용자 활성화·터치 하드웨어·물리적 진동을 증명하지 않습니다. 실기기에서는 2/3/5개 손가락, 가장자리·밀집·이동, 당첨 손가락 먼저 해제, 앱 전환/잠금/복귀, 회전, 탭 fullscreen의 성공/거절, 실제 진동을 확인하세요.

브라우저 검증 코드: `e2e/`; 단위 테스트: `tests/`; 화면 증거: `artifacts/`. 선수·이미지 출처 및 권리 확인 한계는 `ATTRIBUTION.md`와 `src/players.json`에 있습니다.

## 이번 로컬 검증 결과

- 타입 검사·프로덕션 빌드 통과, npm audit 취약점 0건.
- 결정적 단위 테스트 59개 통과(상태·취소·공정한 인덱스 경계/재시도·화면 배치).
- Playwright 19개 통과: 360×640·390×844·844×390, 2/3/5개 터치, 취소/중단/복귀, 결과 고정, API 실패와 이미지 fallback, CDP 동시 터치.
- PNG 5개 실제 디코딩 및 직접 시각 확인. 정상 화면 콘솔 오류 0건.
- 프로덕션 미리보기에서도 3개 터치 → 단일 결과 확인. 화면 증거 `artifacts/production-{countdown,result}.png`.
- 실기기·OS 제스처·물리적 진동 미검증.
