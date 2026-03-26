import { EVENT_TTL_DAYS, SLOT_MINUTES } from "../lib/constants.js";
import { assertFuture, assertSlotAligned } from "../lib/datetime.js";
import { appError } from "../lib/errors.js";
import type { EventDetail, EventRecord } from "./types.js";
import type { Members } from "./members.js";

export class Event {
  id: string;
  name: string;
  start: Date;
  end: Date;
  eventRRule: string;

  constructor({
    id,
    name,
    start,
    end,
    eventRRule
  }: {
    id: string;
    name: string;
    start: Date;
    end: Date;
    eventRRule: string;
  }) {
    this.id = id;
    this.name = name;
    this.start = start;
    this.end = end;
    this.eventRRule = eventRRule;
  }

  static fromRecord(record: EventRecord): Event {
    return new Event({
      id: record.id,
      name: record.name,
      start: new Date(record.start),
      end: new Date(record.end),
      eventRRule: record.eventRRule
    });
  }

  validateRange(now: Date): void {
    if (this.start.getTime() >= this.end.getTime()) {
      throw appError("INVALID_EVENT_RANGE");
    }

    assertSlotAligned(this.start);
    assertSlotAligned(this.end);
    assertFuture(this.end, now);
  }

  contains(slotDateTimeUtc: Date): boolean {
    return slotDateTimeUtc.getTime() >= this.start.getTime() && slotDateTimeUtc.getTime() < this.end.getTime();
  }

  getExpiryAt(): Date {
    return new Date(this.end.getTime() + EVENT_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  toRecord(): EventRecord {
    return {
      id: this.id,
      name: this.name,
      start: this.start.toISOString(),
      end: this.end.toISOString(),
      eventRRule: this.eventRRule
    };
  }

  toEventDetail(members: Members): EventDetail {
    return {
      id: this.id,
      name: this.name,
      slotMinutes: SLOT_MINUTES,
      start: this.start.toISOString(),
      end: this.end.toISOString(),
      members: members.toDetails()
    };
  }
}
