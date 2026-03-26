import test from "node:test";
import assert from "node:assert/strict";
import { setLogErrorForTesting, setPingRedisForTesting, getHealthCheckResult } from "../../src/server/health.js";

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
});

test("memory 드라이버 health check는 200 대상 결과를 반환한다", async () => {
  const restore = withEnv("STORAGE_DRIVER", "memory");

  try {
    const result = await getHealthCheckResult();

    assert.equal(result.status, "ok");
    assert.equal(result.storage.driver, "memory");
    assert.equal(result.storage.status, "ok");
  } finally {
    restore();
  }
});

test("redis 드라이버 health check는 ping 성공 시 정상 결과를 반환한다", async () => {
  const restoreDriver = withEnv("STORAGE_DRIVER", "redis");
  const restoreUrl = withEnv("REDIS_URL", "redis://example");

  try {
    setPingRedisForTesting(async () => {});
    const result = await getHealthCheckResult();

    assert.equal(result.status, "ok");
    assert.equal(result.storage.driver, "redis");
    assert.equal(result.storage.status, "ok");
  } finally {
    restoreDriver();
    restoreUrl();
  }
});

test("redis 드라이버 health check는 ping 실패 시 오류 결과를 반환한다", async () => {
  const restoreDriver = withEnv("STORAGE_DRIVER", "redis");
  const restoreUrl = withEnv("REDIS_URL", "redis://example");
  const loggedErrors: unknown[] = [];

  try {
    setLogErrorForTesting((error) => {
      loggedErrors.push(error);
    });
    setPingRedisForTesting(async () => {
      throw new Error("redis ping failed");
    });
    const result = await getHealthCheckResult();

    assert.equal(result.status, "error");
    assert.equal(result.storage.driver, "redis");
    assert.equal(result.storage.status, "error");
    assert.equal(result.storage.message, "redis 연결 확인에 실패했습니다.");
    assert.equal(loggedErrors.length, 1);
  } finally {
    restoreDriver();
    restoreUrl();
  }
});
