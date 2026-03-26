import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryEventRepository } from "../../src/repositories/in-memory-event-repository.js";
import { EventService } from "../../src/services/event-service.js";

function seedService() {
  const repository = new InMemoryEventRepository({ now: () => new Date("2026-03-25T00:00:00Z") });
  const service = new EventService(repository, {
    now: () => new Date("2026-03-25T00:00:00Z"),
    idGenerator: () => "7K2M4Q9P"
  });

  return {
    repository,
    service,
    seed: () =>
      service.createEvent({
        name: "주원이 약속",
        start: "2026-03-26T01:00:00Z",
        end: "2026-03-28T13:00:00Z"
      })
  };
}

function basic(name: string, password = ""): string {
  return `Basic ${Buffer.from(`${name}:${password}`).toString("base64")}`;
}

test("PATCH는 새 참여자를 생성하고 GET과 동일한 DTO를 반환한다", async () => {
  const { service, seed } = seedService();
  await seed();
  const detail = await service.upsertMemberAvailability("7K2M4Q9P", basic("주워니"), {
    rrule: "DTSTART:20260326T010000Z"
  });

  assert.equal(detail.members.length, 1);
  assert.equal(detail.members[0]?.name, "주워니");
});

test("비밀번호가 필요한 참여자에 잘못된 비밀번호와 잘못된 RRULE을 함께 보내도 401이 우선한다", async () => {
  const { service, seed } = seedService();
  await seed();

  await service.upsertMemberAvailability("7K2M4Q9P", basic("주워니", "1234"), {
    rrule: "DTSTART:20260326T010000Z"
  });

  await assert.rejects(
    () =>
      service.upsertMemberAvailability("7K2M4Q9P", basic("주워니", "9999"), {
        rrule: "DTSTART:20260329T010000Z"
      }),
    { code: "INVALID_MEMBER_AUTH" }
  );
});

test("이벤트 범위를 벗어난 RRULE은 거부한다", async () => {
  const { service, seed } = seedService();
  await seed();

  await assert.rejects(
    () =>
      service.upsertMemberAvailability("7K2M4Q9P", basic("임채성"), {
        rrule: "DTSTART:20260329T010000Z"
      }),
    { code: "RRULE_OUT_OF_EVENT_RANGE" }
  );
});

test("비밀번호 없는 기존 참여자에 비밀번호 추가 시도를 거부한다", async () => {
  const { service, seed } = seedService();
  await seed();

  await service.upsertMemberAvailability("7K2M4Q9P", basic("주워니"), {
    rrule: "DTSTART:20260326T010000Z"
  });

  await assert.rejects(
    () =>
      service.upsertMemberAvailability("7K2M4Q9P", basic("주워니", "1234"), {
        rrule: "DTSTART:20260326T013000Z"
      }),
    { code: "PASSWORD_REGISTRATION_NOT_ALLOWED" }
  );
});
