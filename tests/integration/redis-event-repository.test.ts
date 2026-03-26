import test from "node:test";
import assert from "node:assert/strict";
import { Event } from "../../src/domain/event.js";
import { Member } from "../../src/domain/member.js";
import { RedisEventRepository } from "../../src/repositories/redis-event-repository.js";

interface StoredValue {
  value: string;
  expiresAt: number | null;
}

class FakeRedisClient {
  nowMs: number;
  strings = new Map<string, StoredValue>();
  sets = new Map<string, { values: Set<string>; expiresAt: number | null }>();

  constructor(nowIso = "2026-03-25T00:00:00Z") {
    this.nowMs = new Date(nowIso).getTime();
  }

  setNow(nowIso: string): void {
    this.nowMs = new Date(nowIso).getTime();
  }

  async set(key: string, value: string): Promise<void> {
    const current = this.strings.get(key);
    this.strings.set(key, { value, expiresAt: current?.expiresAt ?? null });
  }

  async get(key: string): Promise<string | null> {
    this.#purgeExpiredString(key);
    return this.strings.get(key)?.value ?? null;
  }

  async sAdd(key: string, value: string): Promise<void> {
    this.#purgeExpiredSet(key);
    const current = this.sets.get(key) ?? { values: new Set<string>(), expiresAt: null };
    current.values.add(value);
    this.sets.set(key, current);
  }

  async sMembers(key: string): Promise<string[]> {
    this.#purgeExpiredSet(key);
    return [...(this.sets.get(key)?.values ?? new Set<string>())];
  }

  async expireAt(key: string, seconds: number): Promise<void> {
    const expiresAt = seconds * 1000;

    if (this.strings.has(key)) {
      const current = this.strings.get(key)!;
      current.expiresAt = expiresAt;
      this.strings.set(key, current);
    }

    if (this.sets.has(key)) {
      const current = this.sets.get(key)!;
      current.expiresAt = expiresAt;
      this.sets.set(key, current);
    }
  }

  #purgeExpiredString(key: string): void {
    const current = this.strings.get(key);

    if (current && current.expiresAt !== null && current.expiresAt <= this.nowMs) {
      this.strings.delete(key);
    }
  }

  #purgeExpiredSet(key: string): void {
    const current = this.sets.get(key);

    if (current && current.expiresAt !== null && current.expiresAt <= this.nowMs) {
      this.sets.delete(key);
    }
  }
}

function createEvent(): Event {
  return new Event({
    id: "7K2M4Q9P",
    name: "주원이 약속",
    start: new Date("2026-03-26T01:00:00Z"),
    end: new Date("2026-03-28T13:00:00Z"),
    eventRRule: "DTSTART:20260326T010000Z"
  });
}

test("Redis 저장소는 이벤트와 참여자를 저장하고 다시 읽는다", async () => {
  const fakeRedis = new FakeRedisClient();
  const repository = new RedisEventRepository(() => Promise.resolve(fakeRedis as never));
  const event = createEvent();
  const member = new Member({
    eventId: event.id,
    name: "주워니",
    password: null,
    rrule: "DTSTART:20260326T010000Z"
  });

  await repository.saveEvent(event);
  await repository.saveMember(member, event.getExpiryAt());

  const storedEvent = await repository.getEvent(event.id);
  const storedMember = await repository.getMember(event.id, member.name);
  const members = await repository.listMembersByEvent(event.id);

  assert.equal(storedEvent?.id, event.id);
  assert.equal(storedMember?.name, member.name);
  assert.equal(members.length, 1);
  assert.equal(members[0]?.rrule, member.rrule);
});

test("Redis 저장소는 TTL이 지나면 이벤트와 참여자 목록을 만료 처리한다", async () => {
  const fakeRedis = new FakeRedisClient();
  const repository = new RedisEventRepository(() => Promise.resolve(fakeRedis as never));
  const event = createEvent();
  const member = new Member({
    eventId: event.id,
    name: "임채성",
    password: "1234",
    rrule: "DTSTART:20260326T013000Z"
  });

  await repository.saveEvent(event);
  await repository.saveMember(member, event.getExpiryAt());
  fakeRedis.setNow("2026-04-05T13:00:00Z");

  const expiredEvent = await repository.getEvent(event.id);
  const expiredMember = await repository.getMember(event.id, member.name);
  const expiredMembers = await repository.listMembersByEvent(event.id);

  assert.equal(expiredEvent, null);
  assert.equal(expiredMember, null);
  assert.deepEqual(expiredMembers, []);
});

test("Redis 저장소는 초기 연결 실패 뒤 다음 호출에서 재시도할 수 있다", async () => {
  const fakeRedis = new FakeRedisClient();
  const event = createEvent();
  let callCount = 0;
  const repository = new RedisEventRepository(async () => {
    callCount += 1;

    if (callCount === 1) {
      throw new Error("temporary redis failure");
    }

    return fakeRedis as never;
  });

  await assert.rejects(() => repository.saveEvent(event), {
    message: "temporary redis failure"
  });

  await repository.saveEvent(event);
  const storedEvent = await repository.getEvent(event.id);

  assert.equal(callCount >= 2, true);
  assert.equal(storedEvent?.id, event.id);
});
