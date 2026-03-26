# EJMN 서버 설계 문서

## 1. 개요

### 1.1 목적

EJMN은 When2Meet와 유사하게 여러 사용자의 가용 시간을 한 화면에서 시각화하는 일정 조율 서비스다.  
v1 서버는 아래 세 가지 기능에 집중한다.

- 유한한 기간을 가진 이벤트 생성
- 이벤트의 최신 상태 조회
- 각 참여자의 가용 시간 등록 또는 수정

가장 좋은 시간을 자동 추천하는 기능은 v1 범위에 포함하지 않는다.

### 1.2 배포 제약

| 항목 | 값 |
| --- | --- |
| 런타임 | Vercel 위의 Next.js 16 Route Handler |
| 저장소 | `REDIS_URL`로 연결하는 Redis 호환 저장소 |
| 서버 기준 시각 | UTC |
| UI 슬롯 단위 | 30분 고정 |

### 1.4 CI 및 배포 정책

| 항목 | 값 |
| --- | --- |
| 기본 CI | GitHub Actions `ci` workflow |
| 기본 CI job | `test`, `typecheck`, `build` |
| 기본 CI 저장소 드라이버 | `memory` |
| 수동 Redis 검증 | GitHub Actions `redis-live` workflow |
| 운영 배포 | Vercel Git 연동 |

- `pull_request`와 `main` push에서 기본 CI를 실행한다.
- `redis-live` workflow는 `workflow_dispatch`로만 실행한다.
- `redis-live`는 GitHub Secret `REDIS_URL`을 사용한다.
- `main` 브랜치에는 `test`, `typecheck`, `build`를 required check로 설정하는 것을 권장한다.
- Vercel 운영 환경 변수는 `STORAGE_DRIVER=redis`, `REDIS_URL=<비공개 값>`을 사용한다.

### 1.3 v1 고정 원칙

| 항목 | 규칙 |
| --- | --- |
| 이벤트 기간 | 모든 이벤트는 시작 시각과 종료 시각이 모두 있어야 한다. |
| 날짜/시각 API 필드 | UTC로만 주고받는다. |
| RRULE | RFC 5545 형식의 UTC 문자열로만 주고받는다. |
| 시간대 변환 | 사용자별 시간대 변환은 항상 프론트엔드가 담당한다. |
| 이벤트 구간 기준 | 이벤트 응답은 `start`, `end`를 진실 원천으로 사용한다. |
| `eventRRule` 의미 | 내부 확장용 메타데이터이며, v1에서 이벤트 구간의 주 진실 원천으로 쓰지 않는다. |
| 참여자 이름 유일성 | 이벤트 안에서 유일해야 하며 변경할 수 없다. |
| 참여자 이름 허용 문자 | 한글, 영문자, 일본어 문자, 숫자, 공백 문자만 허용한다. |
| 참여자 이름 공백 규칙 | 공백 문자는 일반 공백(`U+0020`)만 허용한다. 이름의 앞 공백과 뒤 공백은 허용하지 않고, 글 중간 공백은 허용한다. 탭, 줄바꿈, 캐리지 리턴 등 다른 공백 문자는 허용하지 않는다. |

## 2. 제품 요구사항

### 2.1 사용자 목표

| 번호 | 목표 |
| --- | --- |
| 1 | 사용자는 여러 사람이 함께 보는 일정 이벤트를 만들 수 있어야 한다. |
| 2 | 사용자는 이벤트 ID로 이벤트를 열고 최신 가용 시간을 볼 수 있어야 한다. |
| 3 | 참여자는 이름과 선택 비밀번호를 이용해 자신의 가용 시간을 등록하거나 수정할 수 있어야 한다. |
| 4 | 프론트엔드는 서버 응답만으로 화면을 다시 그릴 수 있어야 한다. |

### 2.2 범위 밖

| 항목 | 설명 |
| --- | --- |
| 사용자 계정 시스템 | 포함하지 않음 |
| 전역 인증 | 포함하지 않음 |
| 이벤트 검색 또는 목록 화면 | 포함하지 않음 |
| 최적 시간 추천 알고리즘 | 포함하지 않음 |
| 다중 시간대 지원 | 포함하지 않음 |
| 참여자 이름 변경 | 포함하지 않음 |
| 이벤트 수정 또는 삭제 API | 포함하지 않음 |

## 3. HTTP API 계약

### 3.1 공통 규칙

| 항목 | 규칙 |
| --- | --- |
| 기본 경로 | `/api/events` |
| 콘텐츠 타입 | `application/json` |
| `start`, `end` 형식 | UTC ISO 8601 문자열 |
| `rrule`, `eventRRule` 형식 | RFC 5545 UTC 문자열 |
| 성공 응답 | 최신 `EventDetail` 또는 생성 결과 반환 |
| 비밀번호 응답 노출 | 절대 포함하지 않음 |
| 조회/수정 응답 계약 | `GET /api/events/{eventId}`와 `PATCH /api/events/{eventId}`는 동일한 `EventDetail` DTO와 동일한 참여자 정렬 규칙을 사용한다. |

### 3.7 `GET /api/health`

운영 상태를 확인하는 내부 점검 엔드포인트다.

#### 성공 응답

| 필드명 | 타입 | 설명 |
| --- | --- | --- |
| `status` | `string` | 전체 상태. `ok` 또는 `error` |
| `checkedAt` | `string` | UTC ISO 8601 점검 시각 |
| `storage.driver` | `string` | 현재 저장소 드라이버. `memory` 또는 `redis` |
| `storage.status` | `string` | 저장소 상태. `ok` 또는 `error` |
| `storage.message` | `string` | 저장소 점검 결과 메시지 |

#### 상태 코드

| 상태 코드 | 조건 |
| --- | --- |
| `200 OK` | 메모리 저장소 사용 중이거나 Redis ping 성공 |
| `503 Service Unavailable` | Redis ping 실패 |

### 3.2 조회 기준

| 조회 대상 | 기준 |
| --- | --- |
| 특정 이벤트 조회 | 이벤트 ID |
| 이벤트 소속 참여자 조회 | 이벤트 ID |
| PATCH 대상 참여자 조회 | 이벤트 ID + 참여자 이름 + 저장된 비밀번호와 입력 비밀번호 비교. 저장된 비밀번호가 `null`이면 입력 비밀번호도 비어 있어야 같은 참여자로 본다. |

### 3.3 EventDetail

#### 필드

| 필드명 | 타입 | Null 허용 | 설명 |
| --- | --- | --- | --- |
| `id` | `string` | 아니오 | 이벤트 ID |
| `name` | `string` | 아니오 | 이벤트 이름 |
| `slotMinutes` | `number` | 아니오 | 슬롯 단위, 항상 `30` |
| `start` | `string` | 아니오 | UTC 시작 시각 |
| `end` | `string` | 아니오 | UTC 종료 시각 |
| `members` | `MemberDetail[]` | 아니오 | 참여자 목록 |

#### MemberDetail 필드

| 필드명 | 타입 | Null 허용 | 설명 |
| --- | --- | --- | --- |
| `name` | `string` | 아니오 | 참여자 이름 |
| `rrule` | `string` | 아니오 | RFC 5545 UTC RRULE |

#### 예시

```json
{
  "id": "7K2M4Q9P",
  "name": "주원이 약속",
  "slotMinutes": 30,
  "start": "2026-03-26T01:00:00Z",
  "end": "2026-03-28T13:00:00Z",
  "members": [
    {
      "name": "주워니",
      "rrule": "DTSTART:20260326T010000Z"
    },
    {
      "name": "임채성",
      "rrule": "DTSTART:20260326T013000Z"
    }
  ]
}
```

### 3.4 `POST /api/events`

이벤트를 생성한다.

#### 요청 본문

```json
{
  "name": "주원이 약속",
  "start": "2026-03-26T01:00:00Z",
  "end": "2026-03-28T13:00:00Z"
}
```

#### 검증 규칙

| 항목 | 규칙 |
| --- | --- |
| `name` 존재 여부 | 비어 있지 않은 문자열이어야 한다. |
| `name` 문자 규칙 | 허용 문자 규칙을 만족해야 한다. |
| `name` 공백 규칙 | 일반 공백(`U+0020`)만 글 중간에 허용한다. 앞 공백과 뒤 공백은 허용하지 않으며, 탭·줄바꿈·캐리지 리턴은 허용하지 않는다. |
| `name` 실패 코드 | 위 규칙을 어기면 `INVALID_EVENT_NAME`으로 거부한다. |
| `start`, `end` 존재 여부 | 모두 필수다. |
| 구간 순서 | `start`는 `end`보다 빨라야 한다. |
| 종료 시각 | 생성 시점 기준 미래여야 한다. |
| 슬롯 정렬 | `start`, `end`는 30분 단위여야 한다. |
| 시간대 | 입력 시각은 UTC여야 한다. |

#### 성공 응답

| 항목 | 값 |
| --- | --- |
| 상태 코드 | `201 Created` |
| 응답 본문 | `EventDetail` |

### 3.5 `GET /api/events/{eventId}`

이벤트의 최신 상태를 조회한다.

#### 성공 응답

| 항목 | 값 |
| --- | --- |
| 상태 코드 | `200 OK` |
| 응답 본문 | `EventDetail` |

### 3.6 `PATCH /api/events/{eventId}`

참여자의 가용 시간을 새로 등록하거나 기존 값을 수정한다.

#### 인증 규칙

| 항목 | 규칙 |
| --- | --- |
| 인증 방식 | `Authorization: Basic <base64(name:password)>` |
| `username` 의미 | 참여자 `name` |
| PATCH 유저 ID 의미 | PATCH에서 유저 ID는 참여자 `name`이다. |
| 비밀번호 | 선택 입력 |
| 빈 비밀번호 인코딩 | `name:` 형태를 base64로 인코딩 |
| 인증 헤더 실패 | 헤더 누락, `Basic` 스킴 아님, base64 파싱 실패, `name:password` 형식 불일치는 `INVALID_AUTH_HEADER`로 거부한다. |
| 이름 문자 제한 | `:`을 포함한 특수문자를 허용하지 않음 |
| 이름 공백 규칙 | 일반 공백(`U+0020`)만 글 중간에 허용하고, 앞 공백과 뒤 공백은 허용하지 않음. 탭·줄바꿈·캐리지 리턴은 허용하지 않음 |

#### 요청 본문

```json
{
  "rrule": "DTSTART:20260326T010000Z"
}
```

#### 등록 및 수정 규칙

| 조건 | 동작 |
| --- | --- |
| 같은 `name`이 없음 | 새 참여자를 만든다. |
| 새 참여자 + 비밀번호 있음 | 비밀번호를 저장한다. |
| 새 참여자 + 비밀번호 없음 | `password`를 `null`로 저장한다. |
| 기존 참여자 + `password`가 `null`이 아님 | 입력 비밀번호가 반드시 일치해야 한다. |
| 기존 참여자 + `password`가 `null` | 같은 `name`이고 입력 비밀번호도 비어 있으면 공개 수정이 가능하다. |
| 기존 참여자 + `password`가 `null` + 비밀번호 추가 시도 | 허용하지 않는다. |
| 이름 변경 시도 | 지원하지 않는다. |

#### 인증 결과

인증 단계의 결과는 아래 두 가지다.

| 상태 코드 | 조건 |
| --- | --- |
| `200 OK` | 새 참여자 생성 |
| `200 OK` | 비밀번호가 있는 참여자 수정 성공 |
| `200 OK` | 비밀번호가 없는 참여자 공개 수정 성공 |
| `401 Unauthorized` | 인증 헤더가 없거나 형식이 잘못되었을 때 |
| `401 Unauthorized` | 비밀번호가 필요한 참여자에 비밀번호가 없을 때 |
| `401 Unauthorized` | 비밀번호가 필요한 참여자에 잘못된 비밀번호를 보냈을 때 |
| `401 Unauthorized` | 비밀번호가 없는 참여자에 새 비밀번호를 추가하려고 할 때 |

#### RRULE 검증 규칙

| 항목 | 규칙 |
| --- | --- |
| 형식 | `rrule`은 RFC 5545 UTC 문자열이어야 한다. |
| 이벤트 범위 | RRULE을 펼친 모든 슬롯은 UTC 이벤트 구간 `[event.start, event.end)` 안에 있어야 한다. |
| 슬롯 단위 | RRULE을 펼친 모든 슬롯은 30분 단위여야 한다. |
| 유한성 | 이벤트 구간 안에서 유한한 슬롯 집합으로 계산할 수 있어야 한다. |
| 비지원 필드 | `422`로 거부한다. |

#### 허용 RRULE 형식

| 구분 | 형식 |
| --- | --- |
| 단일 시점 | `DTSTART:YYYYMMDDTHHMMSSZ` |
| 반복 시점 | `DTSTART:YYYYMMDDTHHMMSSZ` + `RRULE:FREQ=...;UNTIL=...Z` |

#### 허용 RRULE 필드

| 필드 | 규칙 |
| --- | --- |
| `FREQ` | `DAILY`, `WEEKLY`만 허용 |
| `UNTIL` | `RRULE`이 있으면 필수, UTC여야 하며 `event.end` 이하여야 함 |
| `INTERVAL` | 선택, 양의 정수만 허용 |
| `BYDAY` | 선택, `FREQ=WEEKLY`일 때만 허용 |
| `BYHOUR` | 선택, 30분 슬롯 계산과 모순되면 안 됨 |
| `BYMINUTE` | 선택, `0` 또는 `30`만 허용 |

#### 비허용 RRULE 필드

| 비허용 필드 |
| --- |
| `COUNT` |
| `BYSECOND` |
| `BYMONTH` |
| `BYMONTHDAY` |
| `BYYEARDAY` |
| `BYWEEKNO` |
| `BYSETPOS` |
| `WKST` |
| `RDATE` |
| `EXDATE` |
| `EXRULE` |

#### 정규 저장 규칙

| 구분 | 저장 규칙 |
| --- | --- |
| 공통 | 검증이 끝난 RRULE을 UTC RFC 5545 정규 형식으로 저장한다. |
| 단일 시점 | `DTSTART:YYYYMMDDTHHMMSSZ` 형태로 저장한다. |
| 반복 시점 | `DTSTART:YYYYMMDDTHHMMSSZ`와 `RRULE:FREQ=...;UNTIL=YYYYMMDDTHHMMSSZ` 형태로 저장한다. |

#### 처리 순서

1. 요청 본문과 인증 헤더를 파싱한다.
2. 이벤트와 기존 참여자를 읽는다.
3. 기존 참여자 수정 경로이면 인증 규칙을 먼저 검증한다.
4. 입력 RRULE이 UTC RFC 5545 형식을 만족하는지 확인한다.
5. RRULE을 이벤트 UTC 구간 안에서 검증한다.
6. 인증 규칙에 따라 생성 또는 수정을 수행한다.
7. 최신 `EventDetail`을 반환한다.

#### 성공 응답

| 항목 | 값 |
| --- | --- |
| 상태 코드 | `200 OK` |
| 응답 본문 | 최신 `EventDetail` |
| DTO 규칙 | `GET /api/events/{eventId}`와 동일한 `EventDetail` |
| 정렬 규칙 | `GET /api/events/{eventId}`와 동일하게 `Members.sortByAvailability()` 결과를 사용 |

## 4. 오류 정책

오류 응답은 `application/json`을 사용하며 형식은 아래와 같다.

```json
{
  "error": {
    "code": "INVALID_EVENT_RANGE",
    "message": "시작 시간은 종료 시간보다 빨라야 합니다."
  }
}
```

- `code`는 프론트엔드가 분기 처리에 사용하는 기계용 코드다.
- `message`는 프론트엔드가 사용자에게 그대로 보여주는 문구다.
- 프론트엔드는 반드시 `error.code` 기준으로 분기해야 하며, `message` 문자열 비교에 의존하면 안 된다.

### 4.1 상태 코드

| 상태 코드 | 의미 |
| --- | --- |
| `401 Unauthorized` | 인증 헤더 누락 또는 형식 오류 |
| `401 Unauthorized` | 비밀번호가 필요한 참여자에 인증 실패 |
| `401 Unauthorized` | 비밀번호가 없는 참여자에 비밀번호 추가 시도 |
| `404 Not Found` | 존재하지 않는 이벤트 |
| `404 Not Found` | 만료되어 삭제된 이벤트 |
| `422 Unprocessable Entity` | 이벤트 이름 검증 실패 |
| `422 Unprocessable Entity` | 참여자 이름 검증 실패 |
| `422 Unprocessable Entity` | RRULE 검증 실패 |
| `422 Unprocessable Entity` | 잘못된 datetime 형식 |
| `422 Unprocessable Entity` | 30분 단위 위반 |
| `422 Unprocessable Entity` | 잘못된 요청 본문 |
| `500 Internal Server Error` | 예상하지 못한 서버 내부 오류 |

### 4.2 오류 코드 표

| 오류 코드 | 상태 코드 | 사용자 메시지 |
| --- | --- | --- |
| `MALFORMED_JSON` | `422` | 요청 본문 형식이 올바르지 않습니다. |
| `MISSING_REQUIRED_FIELD` | `422` | 필수 입력값이 누락되었습니다. |
| `INVALID_DATETIME_FORMAT` | `422` | 날짜 또는 시간 형식이 올바르지 않습니다. |
| `INVALID_EVENT_RANGE` | `422` | 시작 시간은 종료 시간보다 빨라야 합니다. |
| `EVENT_END_IN_PAST` | `422` | 종료된 일정은 생성할 수 없습니다. |
| `INVALID_TIME_ALIGNMENT` | `422` | 시간은 30분 단위여야 합니다. |
| `INVALID_TIMEZONE` | `422` | UTC 형식의 시간만 입력할 수 있습니다. |
| `INVALID_EVENT_NAME` | `422` | 이벤트 이름 형식이 올바르지 않습니다. |
| `INVALID_MEMBER_NAME` | `422` | 참여자 이름 형식이 올바르지 않습니다. |
| `EVENT_NOT_FOUND` | `404` | 존재하지 않는 이벤트입니다. |
| `INVALID_AUTH_HEADER` | `401` | 인증 정보 형식이 올바르지 않습니다. |
| `INVALID_MEMBER_AUTH` | `401` | 이름 또는 비밀번호를 확인해 주세요. |
| `PASSWORD_REGISTRATION_NOT_ALLOWED` | `401` | 비밀번호 없는 참여자는 이후 비밀번호를 등록할 수 없습니다. |
| `UNSUPPORTED_RRULE` | `422` | 지원하지 않는 일정 형식입니다. |
| `RRULE_OUT_OF_EVENT_RANGE` | `422` | 가능한 일정은 이벤트 범위 안에 있어야 합니다. |
| `RRULE_NOT_SLOT_ALIGNED` | `422` | 가능한 일정은 30분 단위여야 합니다. |
| `INTERNAL_SERVER_ERROR` | `500` | 서버 내부 오류가 발생했습니다. |

## 5. Redis 값 객체 모델

이 절의 Redis 구조는 저장용 값 객체다.  
도메인 객체와 혼용하면 안 된다.

### 5.1 Event 값 객체

| 필드 | 타입 | Null 허용 | 설명 |
| --- | --- | --- | --- |
| `id` | `string` | 아니오 | Crockford Base32 이벤트 ID |
| `name` | `string` | 아니오 | 이벤트 이름 |
| `start` | `string` | 아니오 | UTC ISO 8601 시작 시각 |
| `end` | `string` | 아니오 | UTC ISO 8601 종료 시각 |
| `eventRRule` | `string` | 아니오 | 미래 확장용 내부 UTC RFC 5545 메타데이터 |

예시:

```json
{
  "id": "7K2M4Q9P",
  "name": "주원이 약속",
  "start": "2026-03-26T01:00:00Z",
  "end": "2026-03-28T13:00:00Z",
  "eventRRule": "DTSTART:20260326T010000Z"
}
```

### 5.2 Member 값 객체

| 필드 | 타입 | Null 허용 | 설명 |
| --- | --- | --- | --- |
| `eventId` | `string` | 아니오 | 소속 이벤트 ID |
| `name` | `string` | 아니오 | 이벤트 안에서 유일한 참여자 이름 |
| `password` | `string` | 예 | 선택 비밀번호 |
| `rrule` | `string` | 아니오 | UTC RFC 5545 RRULE |

예시:

```json
{
  "eventId": "7K2M4Q9P",
  "name": "홍길동",
  "password": null,
  "rrule": "DTSTART:20260326T013000Z"
}
```

### 5.3 Redis 키 구조

| 키 | 설명 |
| --- | --- |
| `event:{eventId}` | 이벤트 값 객체 저장 |
| `event:{eventId}:members` | 참여자 이름 인덱스 SET |
| `event:{eventId}:member:{name}` | 참여자 값 객체 저장 |

### 5.4 Member 인덱스 SET

| 항목 | 값 |
| --- | --- |
| Redis 타입 | `SET` |
| 키 | `event:{eventId}:members` |
| 멤버 값 | 참여자 `name` |
| 역할 | 이벤트 조회 시 참여자 이름 목록을 열거하는 시작점 제공 |

| 항목 | 규칙 |
| --- | --- |
| Redis 정렬 책임 | 담당하지 않는다. |
| 서버 정렬 책임 | SET에서 이벤트 ID 기준 참여자 이름 목록을 읽은 뒤 `Members` 도메인 객체를 만들고 `Members.sortByAvailability()`를 호출해 정렬한다. 동률이면 `name` 오름차순을 사용한다. |

### 5.5 TTL 정책

| 항목 | 규칙 |
| --- | --- |
| TTL 계산식 | `event.end + 7일` |
| 적용 대상 | 이벤트 값 객체, 참여자 값 객체, 참여자 인덱스 SET |
| 수정 시 TTL | 참여자 수정은 TTL을 연장하지 않는다. |
| 만료 후 동작 | 이벤트는 삭제되며 이후 조회와 수정은 모두 `EVENT_NOT_FOUND`에 해당하는 `404`가 된다. |

## 6. 도메인 모델

이 절은 도메인 객체를 정의한다.  
Redis 값 객체와 도메인 객체는 반드시 분리한다.

### 6.1 Event

| 구분 | 내용 |
| --- | --- |
| 역할 | 하나의 일정 이벤트를 대표하는 애그리게이트 루트 |
| 역할 | 이벤트 구간과 참여자 집합의 경계를 관리하는 객체 |
| 필드 | `id`, `name`, `start`, `end`, `eventRRule` |
| 책임 | UTC 이벤트 구간의 유효성 검사 |
| 책임 | 특정 시각이 이벤트 구간 안에 있는지 판단 |
| 책임 | TTL 계산에 사용할 만료 시각 계산 |
| 책임 | `Members`와 함께 최종 `EventDetail` 생성 |
| 행위 | `validateRange()` |
| 행위 | `contains(slotDateTimeUtc)` |
| 행위 | `getExpiryAt()` |
| 행위 | `toEventDetail(members)` |

### 6.2 Members

| 구분 | 내용 |
| --- | --- |
| 역할 | `Member` 컬렉션을 표현하는 도메인 객체 |
| 역할 | 참여자 정렬을 담당하는 도메인 객체 |
| 필드 | `items: Member[]` |
| 책임 | 이벤트 ID 기준 참여자 집합 구성 |
| 책임 | 가용 슬롯 수 기준 오름차순 정렬 |
| 책임 | 가용 슬롯 수가 같으면 `name` 오름차순으로 안정 정렬 |
| 행위 | `fromEventMembers(items)` |
| 행위 | `sortByAvailability()` |

### 6.3 Member

| 구분 | 내용 |
| --- | --- |
| 역할 | 이벤트 안의 한 참여자를 표현하는 도메인 객체 |
| 필드 | `eventId`, `name`, `password`, `rrule` |
| 필드 | `name`은 PATCH 기준 유저 ID 역할을 한다. |
| 책임 | 이름 정책 검증 |
| 책임 | 자신의 가용 시간 RRULE 검증 |
| 책임 | 수정 권한 검증 |
| 책임 | 이벤트 구간 안에서 자신의 가용 슬롯 수 계산 |
| 행위 | `authorize(password)` |
| 행위 | `validateName()` |
| 행위 | `validateAvailability(event)` |
| 행위 | `getAvailabilitySlotCount(event)` |
| 행위 | `updateRRule(rrule)` |

### 6.4 보조 도메인 객체

구현 경계를 더 명확히 해야 할 때 아래 객체를 추가할 수 있다.

#### AvailabilityRRule

| 구분 | 내용 |
| --- | --- |
| 역할 | UTC RFC 5545 RRULE 파싱과 검증 전담 |
| 필드 | 정규화된 RRULE 문자열 |
| 행위 | `parse()`, `expandWithin(event)`, `validateSlotAlignment()` |

#### MemberAuth

| 구분 | 내용 |
| --- | --- |
| 역할 | Basic 인증 파싱과 비밀번호 비교 전담 |
| 필드 | `name`, `password` |
| 행위 | `parseBasicHeader()`, `matches(member)` |

## 7. 서버 동작

### 7.1 이벤트 생성

| 순서 | 동작 |
| --- | --- |
| 1 | `eventId`를 Crockford Base32로 생성한다. |
| 2 | 입력 `start`, `end`를 UTC로 검증하고 저장한다. |
| 3 | `eventRRule`은 미래 확장용 내부 메타데이터로 저장한다. |
| 4 | 이벤트 값 객체와 TTL을 Redis에 기록한다. |

### 7.2 이벤트 조회

| 순서 | 동작 |
| --- | --- |
| 1 | `eventId`로 이벤트 값을 읽는다. |
| 2 | 참여자 인덱스 SET에서 이름 목록을 읽는다. |
| 3 | 이름 목록으로 참여자 값 객체를 읽는다. |
| 4 | 참여자 값으로 `Members.fromEventMembers(items)`를 생성한다. |
| 5 | `Members.sortByAvailability()`를 호출해 정렬한다. 가용 슬롯 수가 같으면 `name` 오름차순으로 정렬한다. |
| 6 | `Event.toEventDetail(members)`로 최종 응답을 만든다. |

### 7.3 참여자 가용 시간 등록 또는 수정

| 순서 | 동작 |
| --- | --- |
| 1 | Basic 인증 헤더를 파싱해 `name`, `password`를 얻는다. |
| 2 | 이름이 비었거나 허용 문자 규칙에 어긋나면 거부한다. |
| 3 | 이벤트와 기존 참여자를 읽는다. |
| 4 | 기존 참여자가 있으면 인증 규칙을 먼저 검증하고, 실패 시 `401`을 반환한다. |
| 5 | RRULE을 UTC RFC 5545 규칙으로 검증한다. |
| 6 | 인증 규칙에 따라 새 참여자를 만들거나 기존 참여자를 수정한다. |
| 7 | 참여자 값 객체를 저장한다. |
| 8 | 참여자 이름을 인덱스 SET에 반영한다. |
| 9 | 최신 참여자 값으로 `Members` 도메인 객체를 다시 구성한다. |
| 10 | `Members.sortByAvailability()`를 호출해 GET과 동일한 순서로 정렬한다. 가용 슬롯 수가 같으면 `name` 오름차순을 사용한다. |
| 11 | `Event.toEventDetail(members)`를 호출해 GET과 동일한 `EventDetail` DTO로 응답한다. |

## 8. 운영 제약

| 항목 | 내용 |
| --- | --- |
| 배포 환경 | Vercel 서버리스 환경을 전제로 한다. |
| Redis 클라이언트 | `REDIS_URL` 기반 Redis 클라이언트를 서버리스 환경에서 안전하게 재사용하거나 요청 단위로 생성해야 한다. |
| 데이터 진실 원천 | Redis는 이벤트와 참여자 상태의 단일 진실 원천이다. |
| 만료 처리 | Redis TTL에 맡기며 별도 정리 배치를 두지 않는다. |
| 접근 제어 | 사용자 계정이 없으므로 의도적으로 단순하다. |
| 로컬 저장소 드라이버 | 로컬 개발 기본값은 `memory` 드라이버다. |
| 드라이버 선택 기준 | `STORAGE_DRIVER=memory|redis` 환경 변수로 선택한다. |
| Redis 필수 환경 변수 | `STORAGE_DRIVER=redis`일 때 `REDIS_URL`이 필요하다. |
| Redis 호환성 | Vercel Serverless Redis를 포함해 `REDIS_URL`로 접속 가능한 Redis 호환 저장소를 사용할 수 있다. |
| 메모리 저장소 유지 방식 | Next.js 개발 중에는 `globalThis` 싱글턴으로 유지해 HMR 시 메모리 데이터가 즉시 사라지지 않게 한다. |

## 9. 테스트 시나리오

### 9.1 이벤트 생성

| 번호 | 시나리오 |
| --- | --- |
| 1 | 유효한 UTC 구간으로 이벤트 생성 성공 |
| 2 | `start >= end` 거부 |
| 3 | 이미 종료된 이벤트 생성 거부 |
| 4 | 30분 단위가 아닌 시각 거부 |
| 5 | UTC가 아닌 시각 거부 |

### 9.2 이벤트 조회

| 번호 | 시나리오 |
| --- | --- |
| 1 | 참여자가 없는 이벤트 상세 조회 성공 |
| 2 | 여러 참여자가 있는 이벤트 상세 조회 성공 |
| 3 | 존재하지 않는 이벤트에 `404` 반환 |
| 4 | 만료된 이벤트에 `404` 반환 |

### 9.3 참여자 가용 시간 등록 또는 수정

| 번호 | 시나리오 |
| --- | --- |
| 1 | 비밀번호 없는 첫 참여자 생성 |
| 2 | 비밀번호 있는 참여자 생성 |
| 3 | 올바른 비밀번호로 기존 참여자 수정 |
| 4 | 비밀번호 없는 참여자 공개 수정 |
| 5 | 비밀번호 없는 참여자에 비밀번호 추가 시도 거부 |
| 6 | 잘못된 비밀번호로 수정 시도 거부 |
| 7 | 빈 이름 거부 |
| 8 | 허용되지 않은 문자가 포함된 이름 거부 |
| 9 | 이벤트 범위를 벗어난 RRULE 거부 |
| 10 | 30분 단위를 벗어난 RRULE 거부 |
| 11 | 지원하지 않는 RRULE 필드 거부 |
| 12 | 잘못된 JSON 거부 |
| 13 | 필수 필드 누락 거부 |
| 14 | 잘못된 datetime 형식 거부 |

## 10. 구현 메모

| 항목 | 내용 |
| --- | --- |
| HTTP API 경로 | `/api/events`, `/api/events/{eventId}` |
| 운영 점검 경로 | `/api/health` |
| Route Handler 파일 경로 | `app/api/events/route.ts`, `app/api/events/[eventId]/route.ts` |
| 프론트엔드 페이지 경로 | `/events`, `/events/{eventId}`를 프론트엔드 전용 경로로 비워 둔다. |
| 현재 프론트엔드 페이지 상태 | `app/events` 아래에 페이지 파일을 두지 않아 API와 경로 역할이 섞이지 않는다. |
| 코드 기본 환경 변수 | `STORAGE_DRIVER`가 없으면 `memory`를 사용한다. |
| 로컬 환경 오버라이드 | `.env.local`이 있으면 `STORAGE_DRIVER`와 `REDIS_URL`로 런타임 설정을 덮어쓴다. |
| 내부 레이어 확장 | 내부 도메인 레이어는 추가할 수 있지만, 본 문서의 외부 API 계약은 유지해야 한다. |
| 허용 상태 코드 | `200`, `201`, `401`, `404`, `422`, `500` |
