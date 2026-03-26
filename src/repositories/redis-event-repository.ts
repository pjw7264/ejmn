import { createClient } from "redis";
import { Event } from "../domain/event.js";
import { Member } from "../domain/member.js";
import type { EventRecord, MemberRecord } from "../domain/types.js";
import type { EventRepository } from "./types.js";

type AppRedisClient = ReturnType<typeof createClient>;

declare global {
  var __ejmn_redis_client_promise__: Promise<AppRedisClient> | undefined;
}

interface StoredEventRecord extends EventRecord {
  expiresAt: string;
}

interface StoredMemberRecord extends MemberRecord {
  expiresAt: string;
}

function parseStoredRecord<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  return JSON.parse(value) as T;
}

export class RedisEventRepository implements EventRepository {
  getRedis: () => Promise<AppRedisClient>;

  constructor(getRedis: () => Promise<AppRedisClient> = createRedisClient) {
    this.getRedis = getRedis;
  }

  async saveEvent(event: Event): Promise<void> {
    const redis = await this.getRedis();
    const record: StoredEventRecord = {
      ...event.toRecord(),
      expiresAt: event.getExpiryAt().toISOString()
    };

    await redis.set(`event:${event.id}`, JSON.stringify(record));
    await redis.expireAt(`event:${event.id}`, Math.floor(event.getExpiryAt().getTime() / 1000));
  }

  async getEvent(eventId: string): Promise<Event | null> {
    const redis = await this.getRedis();
    const record = parseStoredRecord<StoredEventRecord>(await redis.get(`event:${eventId}`));
    return record ? Event.fromRecord(record) : null;
  }

  async saveMember(member: Member, expiryAt: Date): Promise<void> {
    const redis = await this.getRedis();
    const key = `event:${member.eventId}:member:${member.name}`;
    const record: StoredMemberRecord = {
      ...member.toRecord(),
      expiresAt: expiryAt.toISOString()
    };
    const expireAt = Math.floor(expiryAt.getTime() / 1000);

    await redis.set(key, JSON.stringify(record));
    await redis.sAdd(`event:${member.eventId}:members`, member.name);
    await redis.expireAt(key, expireAt);
    await redis.expireAt(`event:${member.eventId}:members`, expireAt);
  }

  async getMember(eventId: string, name: string): Promise<Member | null> {
    const redis = await this.getRedis();
    const record = parseStoredRecord<StoredMemberRecord>(await redis.get(`event:${eventId}:member:${name}`));
    return record ? Member.fromRecord(record) : null;
  }

  async listMembersByEvent(eventId: string): Promise<Member[]> {
    const redis = await this.getRedis();
    const names = await redis.sMembers(`event:${eventId}:members`);
    const members = await Promise.all(
      names.map(async (name) => {
        const record = parseStoredRecord<StoredMemberRecord>(await redis.get(`event:${eventId}:member:${name}`));
        return record ? Member.fromRecord(record) : null;
      })
    );

    return members.filter((member): member is Member => member !== null);
  }
}

export function createRedisClient(url = process.env.REDIS_URL): Promise<AppRedisClient> {
  if (!url) {
    throw new Error("STORAGE_DRIVER=redis requires REDIS_URL.");
  }

  if (!globalThis.__ejmn_redis_client_promise__) {
    const client = createClient({ url });
    globalThis.__ejmn_redis_client_promise__ = client
      .connect()
      .then(() => client)
      .catch((error) => {
        globalThis.__ejmn_redis_client_promise__ = undefined;
        client.destroy();
        throw error;
      });
  }

  return globalThis.__ejmn_redis_client_promise__!;
}

export function resetRedisClientForTesting(): void {
  globalThis.__ejmn_redis_client_promise__ = undefined;
}
