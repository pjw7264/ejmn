import test from "node:test";
import assert from "node:assert/strict";
import { Event } from "../../src/domain/event.js";
import { Member } from "../../src/domain/member.js";
import { Members } from "../../src/domain/members.js";

const event = new Event({
  id: "7K2M4Q9P",
  name: "주원이 약속",
  start: new Date("2026-03-26T01:00:00Z"),
  end: new Date("2026-03-28T13:00:00Z"),
  eventRRule: "DTSTART:20260326T010000Z"
});

test("동일한 가용 슬롯 수면 이름 오름차순으로 정렬한다", () => {
  const members = Members.fromEventMembers([
    new Member({ eventId: event.id, name: "홍길동", password: null, rrule: "DTSTART:20260326T010000Z" }),
    new Member({ eventId: event.id, name: "가길동", password: null, rrule: "DTSTART:20260326T013000Z" })
  ]);

  const sorted = members.sortByAvailability(event);
  assert.deepEqual(
    sorted.toDetails().map((member) => member.name),
    ["가길동", "홍길동"]
  );
});
