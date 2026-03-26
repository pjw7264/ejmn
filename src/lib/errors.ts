const DEFINITIONS = Object.freeze({
  MALFORMED_JSON: { status: 422, message: "요청 본문 형식이 올바르지 않습니다." },
  MISSING_REQUIRED_FIELD: { status: 422, message: "필수 입력값이 누락되었습니다." },
  INVALID_DATETIME_FORMAT: { status: 422, message: "날짜 또는 시간 형식이 올바르지 않습니다." },
  INVALID_EVENT_RANGE: { status: 422, message: "시작 시간은 종료 시간보다 빨라야 합니다." },
  EVENT_END_IN_PAST: { status: 422, message: "종료된 일정은 생성할 수 없습니다." },
  INVALID_TIME_ALIGNMENT: { status: 422, message: "시간은 30분 단위여야 합니다." },
  INVALID_TIMEZONE: { status: 422, message: "UTC 형식의 시간만 입력할 수 있습니다." },
  INVALID_EVENT_NAME: { status: 422, message: "이벤트 이름 형식이 올바르지 않습니다." },
  INVALID_MEMBER_NAME: { status: 422, message: "참여자 이름 형식이 올바르지 않습니다." },
  EVENT_NOT_FOUND: { status: 404, message: "존재하지 않는 이벤트입니다." },
  INVALID_AUTH_HEADER: { status: 401, message: "인증 정보 형식이 올바르지 않습니다." },
  INVALID_MEMBER_AUTH: { status: 401, message: "이름 또는 비밀번호를 확인해 주세요." },
  PASSWORD_REGISTRATION_NOT_ALLOWED: {
    status: 401,
    message: "비밀번호 없는 참여자는 이후 비밀번호를 등록할 수 없습니다."
  },
  UNSUPPORTED_RRULE: { status: 422, message: "지원하지 않는 일정 형식입니다." },
  RRULE_OUT_OF_EVENT_RANGE: {
    status: 422,
    message: "가능한 일정은 이벤트 범위 안에 있어야 합니다."
  },
  RRULE_NOT_SLOT_ALIGNED: { status: 422, message: "가능한 일정은 30분 단위여야 합니다." }
});

export type ErrorCode = keyof typeof DEFINITIONS;

export class AppError extends Error {
  status: number;
  code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export function appError(code: ErrorCode, overrideMessage?: string): AppError {
  const definition = DEFINITIONS[code];

  if (!definition) {
    throw new Error(`Unknown error code: ${code}`);
  }

  return new AppError(definition.status, code, overrideMessage ?? definition.message);
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function serializeError(error: unknown) {
  if (isAppError(error)) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message
        }
      }
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "서버 내부 오류가 발생했습니다."
      }
    }
  };
}
