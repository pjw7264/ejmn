import test from "node:test";
import assert from "node:assert/strict";
import { assertSlotAligned, parseUtcIsoDateTime } from "../../src/lib/datetime.js";
import { Event } from "../../src/domain/event.js";

test("UTC ISO 8601 문자열을 파싱한다", () => {
  assert.equal(parseUtcIsoDateTime("2026-03-26T01:00:00Z").toISOString(), "2026-03-26T01:00:00.000Z");
});

test("UTC가 아닌 datetime 형식을 거부한다", () => {
  assert.throws(() => parseUtcIsoDateTime("2026-03-26T10:00:00+09:00"), { code: "INVALID_DATETIME_FORMAT" });
});

test("존재하지 않는 날짜를 거부한다", () => {
  assert.throws(() => parseUtcIsoDateTime("2026-02-31T00:00:00Z"), { code: "INVALID_DATETIME_FORMAT" });
});

test("이벤트 구간은 시작보다 종료가 빨라야 한다", () => {
  const event = new Event({
    id: "EVENT001",
    name: "테스트",
    start: new Date("2026-03-26T01:00:00Z"),
    end: new Date("2026-03-26T01:00:00Z"),
    eventRRule: "DTSTART:20260326T010000Z"
  });

  assert.throws(() => event.validateRange(new Date("2026-03-25T00:00:00Z")), { code: "INVALID_EVENT_RANGE" });
});

test("30분 단위가 아닌 시각을 거부한다", () => {
  assert.throws(() => assertSlotAligned(new Date("2026-03-26T01:10:00Z")), { code: "INVALID_TIME_ALIGNMENT" });
});
