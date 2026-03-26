# EJMN TDD 및 테스트 피라미드 문서

## 1. 목표

| 항목 | 내용 |
| --- | --- |
| 목적 | EJMN 서버 개발을 TDD로 진행하고, API 계약과 도메인 규칙을 테스트로 고정한다. |
| 테스트 원칙 | 테스트 피라미드를 준수한다. |
| 피라미드 목표 비율 | Unit 60%, Integration 30%, E2E 10% |
| 구현 언어 | TypeScript |
| RRULE 엔진 | `rrule` 라이브러리를 사용하고, 서버 정책 검증은 별도 로직으로 보강한다. |
| 우선순위 | 도메인 규칙 → 서비스 조합 → HTTP 전체 흐름 순으로 검증한다. |

## 2. 테스트 피라미드 배치

| 계층 | 비율 | 대표 케이스 최소 개수 | 현재 파일 |
| --- | --- | --- | --- |
| Unit | 60% | 12 | `tests/unit/*.test.ts` |
| Integration | 30% | 8 | `tests/integration/*.test.ts` |
| E2E | 10% | 7 | `tests/e2e/*.test.ts` |

- 자동화된 실제 테스트 수는 회귀 방지를 위한 보조 케이스 때문에 최소 개수보다 늘어날 수 있다.
- 신규 테스트를 추가할 때는 테스트 개수보다 변경 영향도 기준으로 Unit 중심 구조를 유지하도록 조정한다.
- 문서의 비율은 목표 아키텍처를 뜻하며, 실제 케이스 수는 회귀 방어 필요에 따라 일시적으로 달라질 수 있다.

## 3. TDD 사이클

| 단계 | 설명 | 산출물 |
| --- | --- | --- |
| Red | 실패하는 테스트를 먼저 추가한다. | 테스트 케이스, 실패 로그 |
| Green | 최소 구현으로 테스트를 통과시킨다. | 도메인/서비스/HTTP 코드 |
| Refactor | 중복을 제거하고 책임을 정리한다. | 정리된 코드, 보강 테스트 |

## 4. 계층별 책임

| 계층 | 검증 대상 | 포함 범위 | 제외 범위 |
| --- | --- | --- | --- |
| Unit | 순수 함수와 도메인 규칙 | 이름 정책, UTC datetime, Basic 인증, RRULE, 정렬 | HTTP, 저장소 조합 |
| Integration | 서비스와 저장소 협력 | 이벤트 생성, 참여자 등록/수정, TTL, 응답 DTO | 실제 소켓 기반 HTTP |
| E2E | Route Handler 계약 흐름 | Request/Response JSON, 상태 코드, API 계약 시나리오 | 실제 `next start` 소켓 서버 |

## 5. Unit 테스트 케이스

| ID | 분류 | 대상 | 시나리오 | 케이스 유형 | 기대 결과 | 자동화 파일 |
| --- | --- | --- | --- | --- | --- | --- |
| U-01 | 이름 정책 | `validateName` | 한글과 글 중간 공백 이름 허용 | 정상 | 이름 통과 | `tests/unit/name-policy.test.ts` |
| U-02 | 이름 정책 | `validateName` | 이름 앞 공백 거부 | 엣지 | `INVALID_MEMBER_NAME` | `tests/unit/name-policy.test.ts` |
| U-03 | 이름 정책 | `validateName` | 특수문자 포함 이름 거부 | 엣지 | `INVALID_MEMBER_NAME` | `tests/unit/name-policy.test.ts` |
| U-04 | 인증 파싱 | `parseAuthorizationHeader` | 빈 비밀번호 Basic 헤더 파싱 | 정상 | `name`, `password=""` 반환 | `tests/unit/basic-auth.test.ts` |
| U-05 | 인증 파싱 | `parseAuthorizationHeader` | 헤더 누락 | 엣지 | `INVALID_AUTH_HEADER` | `tests/unit/basic-auth.test.ts` |
| U-06 | 인증 파싱 | `parseAuthorizationHeader` | `Basic`이 아닌 스킴 | 코너 | `INVALID_AUTH_HEADER` | `tests/unit/basic-auth.test.ts` |
| U-07 | datetime | `parseUtcIsoDateTime` | UTC ISO 8601 파싱 | 정상 | `Date` 반환 | `tests/unit/datetime.test.ts` |
| U-08 | datetime | `parseUtcIsoDateTime` | UTC 오프셋이 아닌 형식 거부 | 엣지 | `INVALID_DATETIME_FORMAT` | `tests/unit/datetime.test.ts` |
| U-09 | datetime | `parseUtcIsoDateTime` | 존재하지 않는 날짜 거부 | 코너 | `INVALID_DATETIME_FORMAT` | `tests/unit/datetime.test.ts` |
| U-10 | 이벤트 구간 | `Event.validateRange` | `start >= end` 거부 | 코너 | `INVALID_EVENT_RANGE` | `tests/unit/datetime.test.ts` |
| U-11 | 시간 정렬 | `assertSlotAligned` | 30분 단위가 아닌 시각 거부 | 엣지 | `INVALID_TIME_ALIGNMENT` | `tests/unit/datetime.test.ts` |
| U-12 | RRULE | `validateAndNormalizeRRule` | 단일 시점 RRULE 정규화 | 정상 | 정규화 문자열, 슬롯 1개 | `tests/unit/rrule.test.ts` |
| U-13 | RRULE | `validateAndNormalizeRRule` | 주간 RRULE 확장 | 정상 | 슬롯 2개 | `tests/unit/rrule.test.ts` |
| U-14 | RRULE | `validateAndNormalizeRRule` | 비지원 필드 거부 | 엣지 | `UNSUPPORTED_RRULE` | `tests/unit/rrule.test.ts` |
| U-15 | RRULE | `validateAndNormalizeRRule` | 부분 숫자 `INTERVAL` 거부 | 코너 | `UNSUPPORTED_RRULE` | `tests/unit/rrule.test.ts` |
| U-16 | RRULE | `validateAndNormalizeRRule` | 부분 숫자 `BYMINUTE` 거부 | 코너 | `UNSUPPORTED_RRULE` | `tests/unit/rrule.test.ts` |
| U-17 | RRULE | `validateAndNormalizeRRule` | 이벤트 범위 밖 시각 거부 | 코너 | `RRULE_OUT_OF_EVENT_RANGE` | `tests/unit/rrule.test.ts` |
| U-18 | RRULE | `validateAndNormalizeRRule` | 다중 `BYHOUR`/`BYMINUTE` 조합 확장 | 엣지 | 슬롯 수 확장 확인 | `tests/unit/rrule.test.ts` |
| U-19 | 정렬 | `Members.sortByAvailability` | 동률 시 이름 오름차순 정렬 | 코너 | 안정 정렬 | `tests/unit/members.test.ts` |

## 6. Integration 테스트 케이스

| ID | 분류 | 대상 | 시나리오 | 케이스 유형 | 기대 결과 | 자동화 파일 |
| --- | --- | --- | --- | --- | --- | --- |
| I-01 | 이벤트 생성 | `EventService.createEvent` | 유효한 입력으로 이벤트 생성 | 정상 | `201`에 대응하는 `EventDetail` 데이터 생성 | `tests/integration/event-service.test.ts` |
| I-02 | 이벤트 생성 | `EventService.createEvent` | 잘못된 이벤트 이름 거부 | 엣지 | `INVALID_EVENT_NAME` | `tests/integration/event-service.test.ts` |
| I-03 | 이벤트 만료 | `EventService.getEventDetail` | TTL 이후 조회 | 코너 | `EVENT_NOT_FOUND` | `tests/integration/event-service.test.ts` |
| I-04 | 참여자 생성 | `EventService.upsertMemberAvailability` | 비밀번호 없는 첫 참여자 생성 | 정상 | 최신 `EventDetail` 반환 | `tests/integration/member-service.test.ts` |
| I-05 | 인증 우선순위 | `EventService.upsertMemberAvailability` | 잘못된 비밀번호 + 잘못된 RRULE 동시 입력 | 코너 | `INVALID_MEMBER_AUTH` 우선 | `tests/integration/member-service.test.ts` |
| I-06 | RRULE 검증 | `EventService.upsertMemberAvailability` | 이벤트 범위를 벗어난 RRULE 거부 | 엣지 | `RRULE_OUT_OF_EVENT_RANGE` | `tests/integration/member-service.test.ts` |
| I-07 | 공개 수정 정책 | `EventService.upsertMemberAvailability` | 비밀번호 없는 기존 참여자에 비밀번호 추가 시도 | 엣지 | `PASSWORD_REGISTRATION_NOT_ALLOWED` | `tests/integration/member-service.test.ts` |
| I-08 | Redis 저장소 | `RedisEventRepository` | 이벤트와 참여자를 저장 후 재조회 | 정상 | Redis key 기반 CRUD 동작 | `tests/integration/redis-event-repository.test.ts` |
| I-09 | Redis TTL | `RedisEventRepository` | TTL 이후 이벤트와 참여자 만료 | 코너 | 조회 결과 `null` 또는 빈 목록 | `tests/integration/redis-event-repository.test.ts` |
| I-10 | Redis 재시도 | `RedisEventRepository` | 초기 연결 실패 후 다음 호출에서 재시도 | 코너 | 두 번째 호출부터 저장 성공 | `tests/integration/redis-event-repository.test.ts` |
| I-11 | Live Redis smoke | `RedisEventRepository` | 실제 `REDIS_URL`로 저장 후 재조회 | 정상 | 실제 Redis 저장/조회 성공 | `tests/integration/redis-live.test.ts` |
| I-12 | Health check | `getHealthCheckResult` | memory/redis 상태 점검 | 정상/코너 | `ok` 또는 `error` 상태 반환 | `tests/integration/health.test.ts` |

- `I-11`은 기본 `npm test`에서 건너뛰고 `npm run test:redis-live`에서만 실행한다.

## 7. E2E 테스트 케이스

| ID | 분류 | 대상 | 시나리오 | 케이스 유형 | 기대 결과 | 자동화 파일 |
| --- | --- | --- | --- | --- | --- | --- |
| E-01 | 전체 흐름 | Next.js Route Handler | `/api/events` 생성 → 참여자 등록 → 이벤트 조회 | 정상 | `POST`, `PATCH`, `GET` 계약 성공 | `tests/e2e/route-handlers.test.ts` |
| E-02 | 인증 실패 | Next.js Route Handler | 잘못된 Authorization 헤더로 `/api/events/{eventId}` PATCH 요청 | 엣지 | `401`, `INVALID_AUTH_HEADER` | `tests/e2e/route-handlers.test.ts` |
| E-03 | JSON 파싱 실패 | Next.js Route Handler | 잘못된 JSON으로 `/api/events` POST 요청 | 엣지 | `422`, `MALFORMED_JSON` | `tests/e2e/route-handlers.test.ts` |
| E-04 | 필수 필드 누락 | Next.js Route Handler | `end` 없는 `/api/events` POST 요청 | 엣지 | `422`, `MISSING_REQUIRED_FIELD` | `tests/e2e/route-handlers.test.ts` |
| E-05 | 이벤트 없음 | Next.js Route Handler | 없는 이벤트 ID로 `/api/events/{eventId}` GET 요청 | 코너 | `404`, `EVENT_NOT_FOUND` | `tests/e2e/route-handlers.test.ts` |
| E-06 | datetime 형식 오류 | Next.js Route Handler | 잘못된 `start` 형식으로 `/api/events` POST 요청 | 엣지 | `422`, `INVALID_DATETIME_FORMAT` | `tests/e2e/route-handlers.test.ts` |
| E-07 | PATCH 필수 필드 누락 | Next.js Route Handler | `rrule` 없는 `/api/events/{eventId}` PATCH 요청 | 엣지 | `422`, `MISSING_REQUIRED_FIELD` | `tests/e2e/route-handlers.test.ts` |
| E-08 | health 성공 | Next.js Route Handler | memory 드라이버로 `/api/health` GET 요청 | 정상 | `200`, `ok` | `tests/e2e/route-handlers.test.ts` |
| E-09 | health 실패 | Next.js Route Handler | redis ping 실패 상태로 `/api/health` GET 요청 | 코너 | `503`, `error` | `tests/e2e/route-handlers.test.ts` |

## 8. 엣지 케이스 및 코너 케이스 추가 후보

| ID | 분류 | 시나리오 | 이유 | 우선순위 |
| --- | --- | --- | --- | --- |
| X-01 | RRULE | `BYHOUR` 다중값 + `BYMINUTE=0,30` 조합 | 자동화 완료, 회귀 감시 유지 | 완료 |
| X-02 | 인증 | 비밀번호 없는 기존 참여자에 비밀번호 추가 시도 | 자동화 완료, 회귀 감시 유지 | 완료 |
| X-03 | 이름 정책 | 일본어 + 숫자 + 공백 조합 | 국제 문자 허용 범위 확인 | 중간 |
| X-04 | TTL | 만료 직전 요청과 만료 직후 요청 | 경계 시각 처리 확인 | 중간 |
| X-05 | 정렬 | 슬롯 수와 이름이 모두 동일한 더미 데이터 | 안정 정렬 구현 세부 확인 | 낮음 |

## 9. 개발 순서

| 순서 | 개발 대상 | 테스트 선행 규칙 |
| --- | --- | --- |
| 1 | 이름 정책, datetime, Basic 인증 | Unit 먼저 작성 |
| 2 | RRULE 파싱/검증 | Unit 먼저 작성 |
| 3 | Event, Member, Members 도메인 | Unit 먼저 작성 |
| 4 | 서비스 계층과 메모리 저장소 | Integration 추가 |
| 5 | HTTP 서버 어댑터 | E2E 추가 |
| 6 | Redis/Next.js 어댑터 | 기존 테스트 재사용 후 보강 |

## 10. CI 실행 정책

| 항목 | 정책 |
| --- | --- |
| 기본 CI workflow | GitHub Actions `ci` |
| 기본 CI 트리거 | `pull_request`, `push` to `main` |
| 기본 CI job | `test`, `typecheck`, `build` |
| 기본 CI 저장소 드라이버 | `memory` |
| Live Redis workflow | GitHub Actions `redis-live` |
| Live Redis 트리거 | `workflow_dispatch` |
| Live Redis 실행 조건 | `REDIS_URL` GitHub Secret 필요 |

- 기본 CI는 회귀 방지용이다.
- 실제 Redis smoke test는 네트워크와 비밀값에 의존하므로 기본 required check에 넣지 않는다.
- Redis 관련 코드 변경, `REDIS_URL` 변경, 운영 배포 직전에는 `redis-live` workflow 수동 실행을 권장한다.
