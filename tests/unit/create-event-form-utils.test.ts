import assert from "node:assert/strict";
import test from "node:test";
import {
  TIME_OPTIONS,
  toUtcIsoFromParts,
  validateCreateEventDraft,
} from "../../src/components/create-event-form-utils.js";

test("시간 옵션은 00:00부터 23:00까지 생성된다", () => {
  assert.equal(TIME_OPTIONS[0], "00:00");
  assert.equal(TIME_OPTIONS.at(-1), "23:00");
  assert.equal(TIME_OPTIONS.length, 24);
});

test("날짜범위와 시간범위를 UTC ISO datetime으로 변환한다", () => {
  assert.equal(
    toUtcIsoFromParts("2026-03-28", "10:00"),
    new Date("2026-03-28T10:00:00").toISOString().replace(".000Z", "Z"),
  );
});

test("종료가 시작보다 빠르거나 같으면 검증에 실패한다", () => {
  const result = validateCreateEventDraft(
    {
      name: "주간 회고",
      startDate: "2026-03-28",
      endDate: "2026-03-28",
      startTime: "10:00",
      endTime: "10:00",
    },
    new Date("2026-03-20T00:00:00Z").getTime(),
  );

  assert.equal(result.endTime, "종료 시간은 시작 시간보다 뒤여야 합니다.");
});

test("종료가 현재보다 과거면 검증에 실패한다", () => {
  const result = validateCreateEventDraft(
    {
      name: "지난 일정",
      startDate: "2026-03-19",
      endDate: "2026-03-19",
      startTime: "10:00",
      endTime: "11:00",
    },
    new Date("2026-03-20T00:00:00Z").getTime(),
  );

  assert.equal(result.endTime, "종료 시간은 현재보다 미래여야 합니다.");
});

test("약속 시간은 시작과 종료가 모두 필요하다", () => {
  const result = validateCreateEventDraft({
    name: "입력 검증",
    startDate: "2026-03-28",
    endDate: "2026-03-28",
    startTime: "",
    endTime: "",
  });

  assert.equal(result.startTime, "약속 시간을 선택해 주세요.");
  assert.equal(result.endTime, "약속 시간을 선택해 주세요.");
});
