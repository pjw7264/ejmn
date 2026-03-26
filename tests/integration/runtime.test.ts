import test from "node:test";
import assert from "node:assert/strict";
import {
  getRepository,
  getStorageDriver,
  resetRuntimeForTesting,
  setRedisRepositoryFactoryForTesting,
  setRepositoryForTesting
} from "../../src/server/runtime.js";
import { InMemoryEventRepository } from "../../src/repositories/in-memory-event-repository.js";
import type { EventRepository } from "../../src/repositories/types.js";

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
  setRedisRepositoryFactoryForTesting(null);
  setRepositoryForTesting(null);
});

test("기본 저장소 드라이버는 memory다", () => {
  const restore = withEnv("STORAGE_DRIVER", undefined);

  try {
    assert.equal(getStorageDriver(), "memory");
  } finally {
    restore();
  }
});

test("memory 드라이버는 동일한 메모리 저장소 싱글턴을 재사용한다", () => {
  const restore = withEnv("STORAGE_DRIVER", "memory");

  try {
    const firstRepository = getRepository();
    resetRuntimeForTesting({ preserveMemoryRepository: true });
    const secondRepository = getRepository();

    assert.ok(firstRepository instanceof InMemoryEventRepository);
    assert.strictEqual(firstRepository, secondRepository);
  } finally {
    restore();
  }
});

test("redis 드라이버는 필수 환경 변수가 없으면 즉시 실패한다", () => {
  const restoreDriver = withEnv("STORAGE_DRIVER", "redis");
  const restoreUrl = withEnv("REDIS_URL", undefined);

  try {
    assert.throws(() => getRepository(), {
      message: "STORAGE_DRIVER=redis requires REDIS_URL."
    });
  } finally {
    restoreDriver();
    restoreUrl();
  }
});

test("redis 드라이버는 저장소 팩토리를 통해 성공 경로를 초기화한다", () => {
  const restoreDriver = withEnv("STORAGE_DRIVER", "redis");
  const restoreUrl = withEnv("REDIS_URL", "redis://example");
  const fakeRepository: EventRepository = {
    saveEvent() {},
    getEvent() {
      return null;
    },
    saveMember() {},
    getMember() {
      return null;
    },
    listMembersByEvent() {
      return [];
    }
  };

  try {
    setRedisRepositoryFactoryForTesting(() => fakeRepository);
    const repository = getRepository();

    assert.strictEqual(repository, fakeRepository);
  } finally {
    restoreDriver();
    restoreUrl();
  }
});
