import { createRedisClient } from "../repositories/redis-event-repository.js";
import { getStorageDriver } from "./runtime.js";

export interface HealthCheckResult {
  status: "ok" | "error";
  checkedAt: string;
  storage: {
    driver: "memory" | "redis";
    status: "ok" | "error";
    message: string;
  };
}

let pingRedisOverride: (() => Promise<void>) | null = null;
let logErrorOverride: ((error: unknown) => void) | null = null;

async function pingRedis(): Promise<void> {
  const client = await createRedisClient();
  await client.ping();
}

export async function getHealthCheckResult(): Promise<HealthCheckResult> {
  const driver = getStorageDriver();
  const checkedAt = new Date().toISOString();

  if (driver === "memory") {
    return {
      status: "ok",
      checkedAt,
      storage: {
        driver,
        status: "ok",
        message: "memory 저장소를 사용 중입니다."
      }
    };
  }

  try {
    await (pingRedisOverride ?? pingRedis)();

    return {
      status: "ok",
      checkedAt,
      storage: {
        driver,
        status: "ok",
        message: "redis 연결이 정상입니다."
      }
    };
  } catch (error) {
    (logErrorOverride ?? console.error)(error);

    return {
      status: "error",
      checkedAt,
      storage: {
        driver,
        status: "error",
        message: "redis 연결 확인에 실패했습니다."
      }
    };
  }
}

export function setPingRedisForTesting(ping: (() => Promise<void>) | null): void {
  pingRedisOverride = ping;
}

export function setLogErrorForTesting(logger: ((error: unknown) => void) | null): void {
  logErrorOverride = logger;
}
