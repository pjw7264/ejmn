# ejmn

언제만나. 여러 사람의 가능 시간을 시각화하는 When2Meet 스타일 일정 조율 서비스입니다.

## 프로젝트 목적

- 여러 사용자의 가능한 시간을 한 화면에서 겹쳐 볼 수 있는 일정 조율 서비스를 만든다.
- 현재 서버는 아래 기능을 제공한다.
  - 이벤트 생성
  - 이벤트 조회
  - 참여자 가용 시간 등록/수정
  - 서버 및 저장소 상태 확인
- 아직 없는 기능도 있다.
  - 실제 프론트엔드 화면
  - 추천 알고리즘
  - 계정 시스템

## 프론트엔드 팀원용 현재 상태

- 현재 프론트엔드 페이지는 거의 비어 있다.
- 지금 화면 엔트리는 [`app/page.tsx`](/Users/limchaesung/Github/ejmn/app/page.tsx) 하나뿐이다.
- `/events`, `/events/{eventId}`는 앞으로 프론트엔드 작업이 들어갈 예정 경로다.
- 지금 프론트엔드가 먼저 참고해야 할 것은 아래다.
  - `/api/events`
  - `/api/events/{eventId}`
  - `/api/health`
  - [`docs/server-design.md`](/Users/limchaesung/Github/ejmn/docs/server-design.md)

## 문서 읽기 순서

1. [`README.md`](/Users/limchaesung/Github/ejmn/README.md)
2. [`docs/server-design.md`](/Users/limchaesung/Github/ejmn/docs/server-design.md)
3. [`docs/tdd-plan.md`](/Users/limchaesung/Github/ejmn/docs/tdd-plan.md)

## 빠른 시작

### 전제 조건

- `Node.js`
- `npm`
- Redis는 기본 개발에 필수 아님

### 처음 실행할 때

처음에는 반드시 `memory` 저장소로 시작한다.

1. 예시 파일을 복사한다.

```bash
cp .env.local.example .env.local
```

2. [`.env.local`](/Users/limchaesung/Github/ejmn/.env.local)에 `STORAGE_DRIVER=memory`가 들어 있는지 확인한다.
3. 의존성을 설치한다.

```bash
npm ci
```

4. 테스트를 실행한다.

```bash
npm test
```

5. 개발 서버를 실행한다.

```bash
npm run dev
```

## 빠른 API 확인 예시

### 브라우저에서 바로 확인

- [http://localhost:3000/api/health](http://localhost:3000/api/health)
  - 기대 결과: `status: "ok"`
  - 기대 결과: `storage.driver: "memory"` 또는 `"redis"`

### 터미널 예시

`/api/health` 확인

```bash
curl http://localhost:3000/api/health
```

기대 결과 핵심 필드

```json
{
  "status": "ok",
  "storage": {
    "driver": "memory"
  }
}
```

`/api/events` 생성 요청

```bash
curl -X POST http://localhost:3000/api/events \
  -H 'content-type: application/json' \
  -d '{
    "name": "주말 약속",
    "start": "2026-03-28T01:00:00Z",
    "end": "2026-03-29T13:00:00Z"
  }'
```

기대 결과 핵심 필드

```json
{
  "id": "EVENT_ID",
  "name": "주말 약속",
  "start": "2026-03-28T01:00:00.000Z",
  "end": "2026-03-29T13:00:00.000Z",
  "members": []
}
```

## 실행 및 검증 명령

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | Next.js 개발 서버 실행 |
| `npm test` | 기본 테스트 실행 |
| `npx tsc --noEmit` | 타입 검사 |
| `npm run build` | 프로덕션 빌드 가능 여부 확인 |
| `npm run test:redis-live` | 실제 Redis 저장/조회 smoke test |

`npm run test:redis-live`는 선택 검증이다. 처음 온보딩 단계에서는 실행하지 않아도 된다.

## CI와 배포

| 항목 | 내용 |
| --- | --- |
| 기본 CI | GitHub Actions `ci` workflow |
| CI job | `test`, `typecheck`, `build` |
| CI 저장소 드라이버 | `memory` |
| 수동 Redis 검증 | GitHub Actions `redis-live` workflow |
| 운영 배포 | Vercel Git 연동 |

- `pull_request`와 `main` push에서는 `ci` workflow가 실행된다.
- `redis-live` workflow는 `workflow_dispatch`로만 수동 실행한다.
- `redis-live`는 GitHub Secret `REDIS_URL`이 필요하다.
- `main` 브랜치에는 `test`, `typecheck`, `build`를 required check로 설정하는 것을 권장한다.
- Vercel 운영 환경 변수에는 `STORAGE_DRIVER=redis`, `REDIS_URL=<비공개 값>`을 넣는다.

## 환경 변수와 보안 원칙

- 이 저장소는 public repository다.
- 실제 `REDIS_URL`, 비밀번호, 토큰, endpoint는 문서나 커밋에 넣지 않는다.
- 실제 비밀값은 절대 커밋하지 않는다.
- 기본 개발은 `memory` 저장소로 진행한다.
- Redis가 필요한 경우에만 팀에서 전달받은 값을 로컬 [`.env.local`](/Users/limchaesung/Github/ejmn/.env.local)에만 저장한다.
- 실제 값은 GitHub Secrets, Vercel Environment Variables, 개인 로컬 `.env.local`에서만 관리한다.

### `.env.local.example`

- 이 저장소에는 [`.env.local.example`](/Users/limchaesung/Github/ejmn/.env.local.example)만 포함한다.
- 예시 파일에는 placeholder만 들어 있다.
- 기본값은 반드시 `STORAGE_DRIVER=memory`다.

### Redis는 선택 단계

기본 개발은 `memory`로 진행한다. 실제 Redis 검증이 필요할 때만 아래처럼 바꾼다.

```env
STORAGE_DRIVER=redis
REDIS_URL=redis://<username>:<password>@<host>:<port>
```

그 다음 아래 명령으로 실제 Redis 연결을 확인한다.

```bash
npm run test:redis-live
```

## 주요 경로

| 경로 | 역할 |
| --- | --- |
| `/api/events` | 이벤트 생성 API |
| `/api/events/{eventId}` | 이벤트 조회, 참여자 가용 시간 수정 API |
| `/api/health` | 서버 및 저장소 상태 확인 API |
| `/events` | 앞으로 프론트엔드 페이지가 들어갈 경로 |

## 폴더 구조

| 위치 | 설명 |
| --- | --- |
| [`app/page.tsx`](/Users/limchaesung/Github/ejmn/app/page.tsx) | 현재 메인 페이지 엔트리 |
| [`app/api/events`](/Users/limchaesung/Github/ejmn/app/api/events) | 이벤트 관련 API Route Handler |
| [`app/api/health`](/Users/limchaesung/Github/ejmn/app/api/health) | health check API Route Handler |
| [`src/services`](/Users/limchaesung/Github/ejmn/src/services) | 서버 유스케이스 로직 |
| [`src/domain`](/Users/limchaesung/Github/ejmn/src/domain) | 이벤트/참여자 도메인 모델 |
| [`tests`](/Users/limchaesung/Github/ejmn/tests) | Unit, Integration, Route Handler 계약 테스트 |

## 참고 문서

| 문서 | 설명 |
| --- | --- |
| [`docs/server-design.md`](/Users/limchaesung/Github/ejmn/docs/server-design.md) | 서버 요구사항, API 계약, 도메인/Redis 모델 |
| [`docs/tdd-plan.md`](/Users/limchaesung/Github/ejmn/docs/tdd-plan.md) | 테스트 전략, 테스트 피라미드, smoke test 정책 |
