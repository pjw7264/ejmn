import { Event } from "../domain/event.js";
import { Member } from "../domain/member.js";
import type { EventRecord, MemberRecord } from "../domain/types.js";

interface StoredEventRecord extends EventRecord {
  expiresAt: string;
}

interface StoredMemberRecord extends MemberRecord {
  expiresAt: string;
}

export class InMemoryEventRepository {
  now: () => Date;
  events = new Map<string, StoredEventRecord>();
  memberIndexes = new Map<string, Set<string>>();
  members = new Map<string, Map<string, StoredMemberRecord>>();

  constructor({ now = () => new Date() }: { now?: () => Date } = {}) {
    this.now = now;
  }

  saveEvent(event: Event): void {
    this.events.set(event.id, {
      ...event.toRecord(),
      expiresAt: event.getExpiryAt().toISOString()
    });

    if (!this.memberIndexes.has(event.id)) {
      this.memberIndexes.set(event.id, new Set());
    }

    if (!this.members.has(event.id)) {
      this.members.set(event.id, new Map());
    }
  }

  getEvent(eventId: string): Event | null {
    const record = this.events.get(eventId);

    if (!record) {
      return null;
    }

    if (this.#isExpired(record.expiresAt)) {
      this.#purgeEvent(eventId);
      return null;
    }

    return Event.fromRecord(record);
  }

  saveMember(member: Member, expiryAt: Date): void {
    if (!this.members.has(member.eventId)) {
      this.members.set(member.eventId, new Map());
    }

    if (!this.memberIndexes.has(member.eventId)) {
      this.memberIndexes.set(member.eventId, new Set());
    }

    this.members.get(member.eventId)!.set(member.name, {
      ...member.toRecord(),
      expiresAt: expiryAt.toISOString()
    });
    this.memberIndexes.get(member.eventId)!.add(member.name);
  }

  getMember(eventId: string, name: string): Member | null {
    const event = this.getEvent(eventId);

    if (!event) {
      return null;
    }

    const record = this.members.get(eventId)?.get(name);

    if (!record) {
      return null;
    }

    if (this.#isExpired(record.expiresAt)) {
      this.members.get(eventId)?.delete(name);
      this.memberIndexes.get(eventId)?.delete(name);
      return null;
    }

    return Member.fromRecord(record);
  }

  listMembersByEvent(eventId: string): Member[] {
    const event = this.getEvent(eventId);

    if (!event) {
      return [];
    }

    const names = [...(this.memberIndexes.get(eventId) ?? new Set())];
    const members: Member[] = [];

    for (const name of names) {
      const member = this.getMember(eventId, name);

      if (member) {
        members.push(member);
      }
    }

    return members;
  }

  #isExpired(expiresAt: string): boolean {
    return new Date(expiresAt).getTime() <= this.now().getTime();
  }

  #purgeEvent(eventId: string): void {
    this.events.delete(eventId);
    this.memberIndexes.delete(eventId);
    this.members.delete(eventId);
  }
}
