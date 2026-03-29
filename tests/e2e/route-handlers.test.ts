import test from "node:test";
import assert from "node:assert/strict";
import { POST as createEvent } from "../../app/api/events/route.js";
import { GET as getEvent, PATCH as patchEvent } from "../../app/api/events/[eventId]/route.js";
import { GET as getHealth } from "../../app/api/health/route.js";
import { InMemoryEventRepository } from "../../src/repositories/in-memory-event-repository.js";
import { setRepositoryForTesting } from "../../src/server/runtime.js";
import { setLogErrorForTesting, setPingRedisForTesting } from "../../src/server/health.js";

const EVENT_START = "2026-03-31T01:00:00Z";
const EVENT_END = "2026-04-02T13:00:00Z";
const MEMBER_RRULE = "DTSTART:20260331T010000Z";

function context(eventId: string) {
  return { params: Promise.resolve({ eventId }) };
}

function withEnv(name: string, value: string | undefined) {
  const previous = process.env[name];

  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }

  return () => {
    if (previous === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = previous;
    }
  };
}

test.afterEach(() => {
  setLogErrorForTesting(null);
  setPingRedisForTesting(null);
  setRepositoryForTesting(null);
});

test("이벤트 생성, 참여자 등록, 상세 조회의 전체 흐름이 동작한다", async () => {
  setRepositoryForTesting(new InMemoryEventRepository({ now: () => new Date("2026-03-25T00:00:00Z") }));

  const createResponse = await createEvent(
    new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "주원이 약속",
        start: EVENT_START,
        end: EVENT_END
      })
    })
  );
  const createdEvent = (await createResponse.json()) as { id: string };

  assert.equal(createResponse.status, 201);
  assert.equal(typeof createdEvent.id, "string");
  assert.ok(createdEvent.id.length > 0);

  const eventId = createdEvent.id;
  const patchResponse = await patchEvent(
    new Request(`http://localhost/api/events/${eventId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${Buffer.from("주워니:").toString("base64")}`
      },
      body: JSON.stringify({ rrule: MEMBER_RRULE })
    }),
    context(eventId)
  );
  const patchedEvent = (await patchResponse.json()) as { members: Array<{ name: string }> };

  assert.equal(patchResponse.status, 200);
  assert.equal(patchedEvent.members.length, 1);

  const getResponse = await getEvent(new Request(`http://localhost/api/events/${eventId}`), context(eventId));
  const detail = (await getResponse.json()) as { members: Array<{ name: string }> };

  assert.equal(getResponse.status, 200);
  assert.equal(detail.members[0]?.name, "주워니");
});

test("잘못된 Authorization 헤더는 401과 INVALID_AUTH_HEADER를 반환한다", async () => {
  setRepositoryForTesting(new InMemoryEventRepository({ now: () => new Date("2026-03-25T00:00:00Z") }));

  const createResponse = await createEvent(
    new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "주원이 약속",
        start: EVENT_START,
        end: EVENT_END
      })
    })
  );
  const createdEvent = (await createResponse.json()) as { id: string };

  const response = await patchEvent(
    new Request(`http://localhost/api/events/${createdEvent.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: "Basic invalid-base64"
      },
      body: JSON.stringify({ rrule: MEMBER_RRULE })
    }),
    context(createdEvent.id)
  );
  const body = (await response.json()) as { error: { code: string } };

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "INVALID_AUTH_HEADER");
});

test("잘못된 JSON 요청 본문은 422와 MALFORMED_JSON을 반환한다", async () => {
  setRepositoryForTesting(new InMemoryEventRepository({ now: () => new Date("2026-03-25T00:00:00Z") }));

  const response = await createEvent(
    new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    })
  );
  const body = (await response.json()) as { error: { code: string } };

  assert.equal(response.status, 422);
  assert.equal(body.error.code, "MALFORMED_JSON");
});

test("필수 필드가 누락된 이벤트 생성 요청은 422와 MISSING_REQUIRED_FIELD를 반환한다", async () => {
  setRepositoryForTesting(new InMemoryEventRepository({ now: () => new Date("2026-03-25T00:00:00Z") }));

  const response = await createEvent(
    new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "주원이 약속",
        start: EVENT_START
      })
    })
  );
  const body = (await response.json()) as { error: { code: string } };

  assert.equal(response.status, 422);
  assert.equal(body.error.code, "MISSING_REQUIRED_FIELD");
});

test("존재하지 않는 이벤트 조회는 404와 EVENT_NOT_FOUND를 반환한다", async () => {
  setRepositoryForTesting(new InMemoryEventRepository({ now: () => new Date("2026-03-25T00:00:00Z") }));

  const response = await getEvent(new Request("http://localhost/api/events/UNKNOWN"), context("UNKNOWN"));
  const body = (await response.json()) as { error: { code: string } };

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "EVENT_NOT_FOUND");
});

test("잘못된 datetime 형식의 이벤트 생성 요청은 422와 INVALID_DATETIME_FORMAT을 반환한다", async () => {
  setRepositoryForTesting(new InMemoryEventRepository({ now: () => new Date("2026-03-25T00:00:00Z") }));

  const response = await createEvent(
    new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "주원이 약속",
        start: "2026-03-31 01:00:00",
        end: EVENT_END
      })
    })
  );
  const body = (await response.json()) as { error: { code: string } };

  assert.equal(response.status, 422);
  assert.equal(body.error.code, "INVALID_DATETIME_FORMAT");
});

test("PATCH 요청에서 rrule이 누락되면 422와 MISSING_REQUIRED_FIELD를 반환한다", async () => {
  setRepositoryForTesting(new InMemoryEventRepository({ now: () => new Date("2026-03-25T00:00:00Z") }));

  const createResponse = await createEvent(
    new Request("http://localhost/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "주원이 약속",
        start: EVENT_START,
        end: EVENT_END
      })
    })
  );
  const createdEvent = (await createResponse.json()) as { id: string };

  const response = await patchEvent(
    new Request(`http://localhost/api/events/${createdEvent.id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Basic ${Buffer.from("주워니:").toString("base64")}`
      },
      body: JSON.stringify({})
    }),
    context(createdEvent.id)
  );
  const body = (await response.json()) as { error: { code: string } };

  assert.equal(response.status, 422);
  assert.equal(body.error.code, "MISSING_REQUIRED_FIELD");
});

test("memory 드라이버 health endpoint는 200과 ok를 반환한다", async () => {
  const restoreDriver = withEnv("STORAGE_DRIVER", "memory");

  try {
    const response = await getHealth();
    const body = (await response.json()) as { status: string; storage: { driver: string; status: string } };

    assert.equal(response.status, 200);
    assert.equal(body.status, "ok");
    assert.equal(body.storage.driver, "memory");
    assert.equal(body.storage.status, "ok");
  } finally {
    restoreDriver();
  }
});

test("redis 드라이버 health endpoint는 ping 실패 시 503을 반환한다", async () => {
  const restoreDriver = withEnv("STORAGE_DRIVER", "redis");
  const restoreUrl = withEnv("REDIS_URL", "redis://example");

  try {
    setLogErrorForTesting(() => {});
    setPingRedisForTesting(async () => {
      throw new Error("redis ping failed");
    });

    const response = await getHealth();
    const body = (await response.json()) as { status: string; storage: { driver: string; status: string; message: string } };

    assert.equal(response.status, 503);
    assert.equal(body.status, "error");
    assert.equal(body.storage.driver, "redis");
    assert.equal(body.storage.status, "error");
    assert.equal(body.storage.message, "redis 연결 확인에 실패했습니다.");
  } finally {
    restoreDriver();
    restoreUrl();
  }
});
