# 선수 사진 출처

확인일·로스터 기준일: **2026-10-02 (KST)**. 팬 제작 로컬 데모이며 NBA/Dallas Mavericks 공식 제품이 아닙니다.

공식 출발점: https://www.nba.com/mavs/roster
보조 공식 로스터: https://pdfroster.nba.com/dallas-mavericks/ (페이지에는 2025 시즌 데이터라고 표시되어 있어 현재 소속 판단의 단독 근거로 사용하지 않았습니다.)

개별 NBA 프로필에서 Dallas Mavericks 소속을 교차 확인한 Cooper Flagg, Max Christie, Dereck Lively II, Dwight Powell, Kyrie Irving만 사용합니다. 보조 로스터에 있던 Klay Thompson은 개별 프로필에서 Miami Heat 소속으로 표시되어 제외했습니다. 전체 2026–27 로스터를 모두 수록한 앱이 아닙니다.

각 이름·실제 player ID·확인한 프로필 URL·확인한 이미지 URL·로컬 경로·확인일·크기·바이트 수는 `src/players.json`에 기록했습니다. URL은 공식 페이지의 이미지 링크에서 확인했습니다. PNG 원본 바이트를 그대로 저장했으며 수정·워터마크 제거를 하지 않았습니다. 화면에서는 CSS로 잘라 표시합니다. HTTP 200 및 image/png, PNG 크기, 실제 브라우저 디코딩과 시각 검증을 수행합니다.

사용 조건 확인 링크: https://www.nba.com/termsofuse
사진의 저작권 및 관련 권리는 NBA/팀/권리자에게 있습니다. 공개 접근 가능하다는 사실은 재배포 또는 상업적 사용 허가를 의미하지 않습니다. 별도의 이미지 재배포·상업 이용 허락은 확보하지 않았습니다. 공개 배포는 이번 작업 범위에 포함되지 않습니다.

# 브라우저 구현 근거 (2026-10-02 확인)

- Pointer Events: https://www.w3.org/TR/pointerevents/latest/
- 사용자 활성화: https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event
- Fullscreen: https://fullscreen.spec.whatwg.org/
- Vibration: https://www.w3.org/TR/vibration/
- Web Crypto: https://www.w3.org/TR/webcrypto/
- iOS 일반 요소 fullscreen 관련 WebKit 현황: https://bugs.webkit.org/show_bug.cgi?id=206854

Fullscreen 및 진동은 기능 감지하고 실패를 허용합니다. iPhone Safari 지원을 보장하지 않으며 실제 기기 동작은 별도 확인이 필요합니다.
