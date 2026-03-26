import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryEventRepository } from "../../src/repositories/in-memory-event-repository.js";
import { EventService } from "../../src/services/event-service.js";

function createService(now = "2026-03-25T00:00:00Z") {
  const repository = new InMemoryEventRepository({ now: () => new Date(now) });
  const service = new EventService(repository, {
    now: () => new Date(now),
    idGenerator: () => "7K2M4Q9P"
  });

  return { repository, service };
}

test("이벤트를 생성하면 초기 EventDetail을 반환한다", async () => {
  const { service } = createService();
  const detail = await service.createEvent({
    name: "주원이 약속",
    start: "2026-03-26T01:00:00Z",
    end: "2026-03-28T13:00:00Z"
  });

  assert.equal(detail.id, "7K2M4Q9P");
  assert.equal(detail.members.length, 0);
});

test("잘못된 이벤트 이름은 INVALID_EVENT_NAME으로 거부한다", async () => {
  const { service } = createService();

  await assert.rejects(
    () =>
      service.createEvent({
        name: "주원이 약속!",
        start: "2026-03-26T01:00:00Z",
        end: "2026-03-28T13:00:00Z"
      }),
    { code: "INVALID_EVENT_NAME" }
  );
});

test("이벤트가 만료되면 조회 시 EVENT_NOT_FOUND를 반환한다", async () => {
  const { repository, service } = createService("2026-03-25T00:00:00Z");
  await service.createEvent({
    name: "주원이 약속",
    start: "2026-03-26T01:00:00Z",
    end: "2026-03-28T13:00:00Z"
  });

  repository.now = () => new Date("2026-04-05T13:00:00Z");
  const expiredService = new EventService(repository, {
    now: () => new Date("2026-04-05T13:00:00Z"),
    idGenerator: () => "IGNORED"
  });

  await assert.rejects(() => expiredService.getEventDetail("7K2M4Q9P"), { code: "EVENT_NOT_FOUND" });
});
