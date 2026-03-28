export type CreateEventDraft = {
  name: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
};

export type CreateEventErrors = {
  name?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  submit?: string;
};

export const TIME_OPTIONS = Array.from({ length: 24 }, (_, index) => {
  const hour = String(index).padStart(2, "0");
  return `${hour}:00`;
});

function assertDateAndTime(date: string, time: string): string {
  return `${date}T${time}:00`;
}

export function toUtcIsoFromParts(date: string, time: string): string {
  return new Date(assertDateAndTime(date, time)).toISOString().replace(".000Z", "Z");
}

export function getLocalDateTimeSummary(date: string, time: string): string {
  if (!date || !time) {
    return "";
  }

  return `${date} ${time}`;
}

export function validateCreateEventDraft(draft: CreateEventDraft, now = Date.now()): CreateEventErrors {
  const errors: CreateEventErrors = {};
  const effectiveEndDate = draft.endDate || draft.startDate;

  if (!draft.name.trim()) {
    errors.name = "이벤트 이름을 입력해 주세요.";
  }

  if (!draft.startDate) {
    errors.startDate = "시작 날짜를 선택해 주세요.";
  }

  if (!effectiveEndDate) {
    errors.endDate = "종료 날짜를 선택해 주세요.";
  }

  if (!draft.startTime) {
    errors.startTime = "시작 시간을 선택해 주세요.";
  }

  if (!draft.endTime) {
    errors.endTime = "종료 시간을 선택해 주세요.";
  }

  if (draft.startDate && effectiveEndDate && draft.startTime && draft.endTime) {
    const startTime = new Date(assertDateAndTime(draft.startDate, draft.startTime)).getTime();
    const endTime = new Date(assertDateAndTime(effectiveEndDate, draft.endTime)).getTime();

    if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
      errors.endTime = "날짜와 시간을 다시 확인해 주세요.";
      return errors;
    }

    if (startTime >= endTime) {
      errors.endTime = "종료 시간은 시작 시간보다 뒤여야 합니다.";
    }

    if (endTime <= now) {
      errors.endTime = "종료 시간은 현재보다 미래여야 합니다.";
    }
  }

  return errors;
}
