import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createClient } from "redis";
import { Event } from "../../src/domain/event.js";
import { Member } from "../../src/domain/member.js";
import { RedisEventRepository } from "../../src/repositories/redis-event-repository.js";
import { generateEventId } from "../../src/lib/event-id.js";

if (typeof process.loadEnvFile === "function" && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

function createSmokeEvent(eventId: string): Event {
  return new Event({
    id: eventId,
    name: `Redis Smoke ${eventId}`,
    start: new Date("2026-03-28T01:00:00Z"),
    end: new Date("2026-03-29T13:00:00Z"),
    eventRRule: "DTSTART:20260328T010000Z"
  });
}

const canRun = process.env.RUN_REDIS_LIVE_TESTS === "1";
const redisUrl = process.env.REDIS_URL;

test(
  "실제 Redis에 이벤트와 참여자를 저장하고 다시 읽는다",
  {
    skip: !canRun || !redisUrl ? "REDIS_URL이 없어서 live Redis 테스트를 건너뜁니다." : false
  },
  async () => {
    const client = createClient({ url: redisUrl });
    await client.connect();

    const eventId = `L${generateEventId(9)}`;
    const eventKey = `event:${eventId}`;
    const memberIndexKey = `event:${eventId}:members`;
    const memberKey = `event:${eventId}:member:라이브 사용자`;
    const repository = new RedisEventRepository(() => Promise.resolve(client as never));
    const event = createSmokeEvent(eventId);
    const member = new Member({
      eventId,
      name: "라이브 사용자",
      password: null,
      rrule: "DTSTART:20260328T013000Z"
    });

    try {
      await repository.saveEvent(event);
      await repository.saveMember(member, event.getExpiryAt());

      const storedEvent = await repository.getEvent(eventId);
      const storedMember = await repository.getMember(eventId, member.name);
      const members = await repository.listMembersByEvent(eventId);

      assert.equal(storedEvent?.id, eventId);
      assert.equal(storedMember?.name, member.name);
      assert.equal(members.length, 1);
      assert.equal(members[0]?.rrule, member.rrule);
    } finally {
      await client.del([eventKey, memberIndexKey, memberKey]);
      await client.quit();
    }
  }
);
