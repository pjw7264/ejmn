import { InMemoryEventRepository } from "../repositories/in-memory-event-repository.js";
import { RedisEventRepository, resetRedisClientForTesting } from "../repositories/redis-event-repository.js";
import { EventService } from "../services/event-service.js";
import type { EventRepository } from "../repositories/types.js";

declare global {
  var __ejmn_memory_repository__: InMemoryEventRepository | undefined;
}

let repository: EventRepository | null = null;
let service: EventService | null = null;
let redisRepositoryFactory: (() => EventRepository) | null = null;

export function getStorageDriver(): "memory" | "redis" {
  return process.env.STORAGE_DRIVER === "redis" ? "redis" : "memory";
}

function assertRedisEnv(): void {
  if (!process.env.REDIS_URL) {
    throw new Error("STORAGE_DRIVER=redis requires REDIS_URL.");
  }
}

function getMemoryRepository(): InMemoryEventRepository {
  if (!globalThis.__ejmn_memory_repository__) {
    globalThis.__ejmn_memory_repository__ = new InMemoryEventRepository();
  }

  return globalThis.__ejmn_memory_repository__;
}

export function getRepository(): EventRepository {
  if (!repository) {
    if (getStorageDriver() === "redis") {
      assertRedisEnv();
      repository = (redisRepositoryFactory ?? (() => new RedisEventRepository()))();
    } else {
      repository = getMemoryRepository();
    }
  }

  return repository;
}

export function getEventService(): EventService {
  if (!service) {
    service = new EventService(getRepository());
  }

  return service;
}

export function setRepositoryForTesting(nextRepository: EventRepository | null): void {
  repository = nextRepository;
  service = nextRepository ? new EventService(nextRepository) : null;

  if (nextRepository === null) {
    globalThis.__ejmn_memory_repository__ = undefined;
    resetRedisClientForTesting();
  }
}

export function setRedisRepositoryFactoryForTesting(factory: (() => EventRepository) | null): void {
  redisRepositoryFactory = factory;
  repository = null;
  service = null;
  resetRedisClientForTesting();
}

export function resetRuntimeForTesting({ preserveMemoryRepository = false }: { preserveMemoryRepository?: boolean } = {}): void {
  repository = null;
  service = null;
  redisRepositoryFactory = null;
  resetRedisClientForTesting();

  if (!preserveMemoryRepository) {
    globalThis.__ejmn_memory_repository__ = undefined;
  }
}
