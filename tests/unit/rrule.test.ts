import test from "node:test";
import assert from "node:assert/strict";
import { Event } from "../../src/domain/event.js";
import { validateAndNormalizeRRule } from "../../src/lib/rrule.js";

const event = new Event({
  id: "7K2M4Q9P",
  name: "주원이 약속",
  start: new Date("2026-03-26T01:00:00Z"),
  end: new Date("2026-03-28T13:00:00Z"),
  eventRRule: "DTSTART:20260326T010000Z"
});

test("단일 시점 RRULE을 정규화한다", () => {
  const result = validateAndNormalizeRRule("DTSTART:20260326T010000Z", event);
  assert.equal(result.normalized, "DTSTART:20260326T010000Z");
  assert.equal(result.slots.length, 1);
});

test("주간 RRULE을 펼친다", () => {
  const input = "DTSTART:20260326T010000Z\nRRULE:FREQ=WEEKLY;UNTIL=20260328T010000Z;BYDAY=TH,FR;BYHOUR=1;BYMINUTE=0";
  const result = validateAndNormalizeRRule(input, event);
  assert.equal(result.normalized, input);
  assert.equal(result.slots.length, 2);
});

test("비지원 RRULE 필드를 거부한다", () => {
  const input = "DTSTART:20260326T010000Z\nRRULE:FREQ=DAILY;UNTIL=20260328T010000Z;COUNT=2";
  assert.throws(() => validateAndNormalizeRRule(input, event), { code: "UNSUPPORTED_RRULE" });
});

test("부분 숫자 INTERVAL을 거부한다", () => {
  const input = "DTSTART:20260326T010000Z\nRRULE:FREQ=DAILY;UNTIL=20260328T010000Z;INTERVAL=1x";
  assert.throws(() => validateAndNormalizeRRule(input, event), { code: "UNSUPPORTED_RRULE" });
});

test("부분 숫자 BYMINUTE를 거부한다", () => {
  const input = "DTSTART:20260326T010000Z\nRRULE:FREQ=DAILY;UNTIL=20260328T010000Z;BYMINUTE=30x";
  assert.throws(() => validateAndNormalizeRRule(input, event), { code: "UNSUPPORTED_RRULE" });
});

test("이벤트 범위를 벗어난 RRULE을 거부한다", () => {
  const input = "DTSTART:20260329T010000Z";
  assert.throws(() => validateAndNormalizeRRule(input, event), { code: "RRULE_OUT_OF_EVENT_RANGE" });
});

test("다중 BYHOUR와 BYMINUTE 조합을 확장한다", () => {
  const input = "DTSTART:20260326T010000Z\nRRULE:FREQ=DAILY;UNTIL=20260328T010000Z;BYHOUR=1,2;BYMINUTE=0,30";
  const result = validateAndNormalizeRRule(input, event);
  assert.equal(result.slots.length, 9);
});
