# EJMN 페이지 요구사항 명세서

## 문서 메타 정보

| 항목 | 내용 |
| --- | --- |
| 페이지명 | `이벤트 생성 페이지` |
| 경로 | `/` |
| 주 사용기기 | `모바일(PWA)` |
| 주 사용자 | 한국인 |
| 문서 상태 | `현재 구현 기준 반영` |
| 작성자 | `박주원` |
| 최종 수정일 | `2026-03-30` |
| 관련 API | `POST /api/events` |
| 관련 문서 | `README.md`, `docs/server-design.md`, `docs/tdd-plan.md`, `docs/페이지-시나리오.md`, `docs/캘린더-컴포넌트-요구사항.md` |

## 문서 기준

- 이 문서는 `현재 구현된 생성 화면`을 기준으로 작성한다.
- 화면에서 보이는 입력 구조는 `이름 + 날짜 범위 + 시간 범위`를 기준으로 설명한다.
- 내부적으로 `start`, `end` datetime으로 조합되는 처리 규칙은 구현 해석 메모로 함께 유지한다.

## 1. 페이지 개요

### 1.1 페이지 목적

- 주최자가 새 일정 조율 이벤트의 기본 정보인 이벤트 이름, 날짜 범위, 시간 범위를 생성한다.
- 생성 성공 후 사용자는 별도 참가 전용 경로가 아니라 같은 루트 페이지의 `/?{eventId}` 화면으로 이동한다.
- 공유와 참여자 등록/수정은 생성 직후 상세 페이지에서 이어서 수행한다.

### 1.2 대상 사용자

| 사용자 유형 | 설명 |
| --- | --- |
| 1차 사용자 | 새 일정 조율 이벤트를 만들려는 주최자 |

### 1.3 완료 기준

- 사용자가 이벤트 이름, 날짜 범위, 시간 범위를 입력하여 이벤트 생성을 완료할 수 있어야 한다.
- 프론트엔드는 화면상으로는 날짜 범위와 시간 범위를 분리해 입력받되, 내부적으로는 `start`, `end` 두 개의 datetime으로 조합해 관리해야 한다.
- 프론트엔드는 제출 전에 `start < end`, `end > now`, `30분 단위 정렬`을 검증해 서버의 예측 가능한 `422`를 사전에 막아야 한다.
- 프론트엔드는 `POST /api/events` 성공 후 생성된 `eventId`로 `/?{eventId}` 페이지로 이동해야 한다.

## 2. 공통 제약 및 정책

| 항목 | 규칙 |
| --- | --- |
| 시간 기준 | API 입출력은 UTC 기준이다. |
| 화면 표시 | 사용자 현지 시간 표시 여부와 변환 책임은 프론트엔드가 가진다. |
| 슬롯 단위 | 30분 고정 |
| 이벤트 기간 | 모든 이벤트는 `start`, `end`를 가진다. |
| datetime 형식 | API 요청 시 `start`, `end`는 UTC ISO 8601 문자열이어야 한다. |
| 사전 검증 | 프론트엔드는 제출 전에 `start < end`, `end > now`, `30분 단위`를 검증해야 한다. |
| 오류 처리 기준 | 프론트엔드는 `error.code`로 분기한다. |
| 다음 전이 | 생성 성공 후 반드시 `/?{eventId}`로 이동한다. |

## 3. 사용자 목표와 핵심 시나리오

| 시나리오 ID | 사용자 목표 | 시작 조건 | 완료 조건 | 우선순위 |
| --- | --- | --- | --- | --- |
| S-01 | 새 이벤트를 만들고 싶다 | 사용자가 `/` 경로로 진입했다 | 이벤트 생성 성공 후 `/?{eventId}`로 이동한다 | `Must` |

## 4. 진입/이탈 경로

### 4.1 진입 경로

| 진입 방식 | 설명 |
| --- | --- |
| 홈 또는 직접 URL 진입 | 사용자가 `/` 경로로 접속한다. |

### 4.2 이탈 경로

| 이탈 목적지 | 조건 | 방식 |
| --- | --- | --- |
| `/?{eventId}` | 이벤트 생성 성공 | 클라이언트 라우팅 |

## 5. 정보 구조

### 5.1 화면 구성

| 영역 | 목적 | 포함 요소 | 우선순위 |
| --- | --- | --- | --- |
| 헤더 | 페이지 목적 인지 | 이벤트 생성 타이틀 | `High` |
| 주요 콘텐츠 | 이벤트 기본 정보 입력 | 이벤트 이름 입력, 날짜 범위 선택, 시간 범위 선택 | `High` |
| 푸터/보조 액션 | 생성 완료 실행 | `이벤트 만들기` 버튼 | `High` |

### 5.2 콘텐츠 우선순위

1. 이벤트 이름과 날짜/시간 범위 입력
2. 제출 가능 여부를 결정하는 검증 메시지
3. 제출 오류와 생성 결과 피드백

## 6. 입력 및 검증 요구사항

### 6.1 입력 필드

| 필드명 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| 이벤트 이름 | text | Y | 비어 있을 수 없고, 허용 문자 정책을 따라야 한다. |
| 약속 날짜 | date range | Y | 사용자가 시작일과 종료일을 범위로 선택한다. |
| 약속 시간 | time range | Y | 사용자가 시작/종료 시간을 휠 선택기로 입력한다. |

### 6.2 프론트엔드 사전 검증

| 규칙 ID | 규칙 | 실패 메시지 | 관련 서버 오류 코드 |
| --- | --- | --- | --- |
| V-01 | 이벤트 이름은 비어 있을 수 없다 | 이벤트 이름을 입력해 주세요. | `MISSING_REQUIRED_FIELD`, `INVALID_EVENT_NAME` |
| V-02 | 약속 날짜와 약속 시간은 모두 선택되어야 한다 | 날짜와 시간을 모두 입력해 주세요. | `MISSING_REQUIRED_FIELD` |
| V-03 | `start`는 `end`보다 빨라야 한다 | 시작 시간은 종료 시간보다 빨라야 합니다. | `INVALID_EVENT_RANGE` |
| V-04 | `end`는 현재 시각보다 미래여야 한다 | 종료된 일정은 생성할 수 없습니다. | `EVENT_END_IN_PAST` |
| V-05 | `start`, `end`는 모두 30분 단위여야 한다 | 시간은 30분 단위로 선택해 주세요. | `INVALID_TIME_ALIGNMENT` |
| V-06 | API 요청 직전 `start`, `end`는 UTC ISO 8601 형식이어야 한다 | 시간 변환에 실패했습니다. 다시 선택해 주세요. | `INVALID_DATETIME_FORMAT`, `INVALID_TIMEZONE` |

### 6.3 제출 정책

- 사용자는 로컬 시간 기준으로 날짜 범위와 시간 범위를 나누어 입력한다.
- 프론트엔드는 내부적으로 선택값을 `start`, `end` 두 개의 datetime으로 조합해 관리한다.
- `POST /api/events` 요청 직전에만 UTC ISO 8601 문자열로 변환한다.
- 사전 검증에 실패하면 API를 호출하지 않고, 해당 필드 근처에 즉시 오류를 표시한다.

## 7. 개선 OpenUI 코드

- 문서 반영 범위: `/` 모바일 생성 페이지의 목표 UI 구성
- 표현 원칙: 화면 라벨은 한국어만 사용하고, 부가설명 문단과 선택 결과 요약 영역은 제외한다.

```openui
Surface "이벤트 생성 페이지" {
  RootFrame viewport="mobile" width="centered max-width 420px" minHeight="100vh" {
    PageShell background="밝은 파랑 계열 그라디언트" {
      HeaderBand background="파란색" padding="18px 20px" {
        HeaderCenterStack align="center" {
          HeaderTitle text="이벤트 만들기" color="white"
        }
      }

      FormSurface background="white" border="light stroke" borderTop="none" padding="22px 18px 20px" {
        NameBlock gap="10px" {
          FieldLabel text="이름" align="left"
          TextInput placeholder="약속 이름을 입력하세요" textAlign="left"
          ErrorSlot key="name"
        }

        SectionDivider spacing="18px"

        DateBlock gap="14px" {
          SectionTitle text="약속 날짜" align="left"
          CalendarCard radius="22px" padding="14px" {
            CalendarFrame emphasis="single panel" {
              CalendarView mode="range" months="1" outsideDays="visible"
            }
          }
          ErrorSlot key="date"
        }

        SectionDivider spacing="18px"

          TimeBlock gap="14px" {
          SectionTitle text="약속 시간" align="left"

          TimeSelectionRow columns="1fr auto 1fr" align="center" gap="10px" {
            TimeWheelBar radius="18px" border="light stroke" padding="8px" {
              MiniLabel text="시작" align="center"
              SelectionHighlight
              FadeOverlay position="top"
              WheelColumnGroup columns="0.95fr 1.05fr" gap="6px" {
                MeridiemColumn items="오전, 오후"
                HourSlotColumn items="1시 ... 12시, 1시 ... 12시"
              }
              FadeOverlay position="bottom"
            }

            WaveSeparator text="~" align="selected row y-axis" weight="700" color="deep navy"

            TimeWheelBar radius="18px" border="light stroke" padding="8px" {
              MiniLabel text="종료" align="center"
              SelectionHighlight
              FadeOverlay position="top"
              WheelColumnGroup columns="0.95fr 1.05fr" gap="6px" {
                MeridiemColumn items="오전, 오후"
                HourSlotColumn items="1시 ... 12시, 1시 ... 12시"
              }
              FadeOverlay position="bottom"
            }
          }
          ErrorSlot key="time"
        }

        FormErrorSlot key="submit"
        PrimaryButton text="이벤트 만들기" loadingText="이벤트 생성 중..." fullWidth="true"
      }
    }
  }
}
```

### 7.1 OpenUI 해석 메모

- 상단은 공통 `brandBand` 헤더를 사용하고, 현재 `/` 생성 화면에서는 뒤로 액션 없이 제목 `이벤트 만들기`만 중앙 배치한다.
- 본문은 폼 스캔성을 위해 필드 라벨과 섹션 제목을 좌정렬로 두고, 입력값은 일반적인 입력 관례에 맞게 좌정렬한다.
- 날짜 구역 명칭은 `약속 날짜`로 고정하고, 선택 결과 요약 없이 캘린더 자체 선택 상태만 보여준다. 캘린더는 바깥 달 날짜를 함께 보여주는 단일 패널 구성을 사용한다.
- 시간 구역 명칭은 `약속 시간`으로 유지하고, 두 개의 시간 스크롤 바 사이 물결 기호는 각 휠의 선택 행 중심 높이에 맞춰 둔다.
- 각 시간 스크롤 바는 `오전/오후` 2개 항목 컬럼과 `1시 ... 12시, 1시 ... 12시`로 이어지는 24슬롯 시간 컬럼을 나란히 배치한다.
