import { validateName } from "../lib/name-policy.js";
import { appError } from "../lib/errors.js";
import { validateAndNormalizeRRule } from "../lib/rrule.js";
import type { Event } from "./event.js";
import type { MemberDetail, MemberRecord } from "./types.js";

export class Member {
  eventId: string;
  name: string;
  password: string | null;
  rrule: string;

  constructor({ eventId, name, password = null, rrule }: MemberRecord) {
    this.eventId = eventId;
    this.name = name;
    this.password = password;
    this.rrule = rrule;
  }

  static fromRecord(record: MemberRecord): Member {
    return new Member(record);
  }

  validateName(): void {
    validateName(this.name, "INVALID_MEMBER_NAME");
  }

  authorize(inputPassword: string): true {
    if (this.password === null) {
      if (inputPassword !== "") {
        throw appError("PASSWORD_REGISTRATION_NOT_ALLOWED");
      }

      return true;
    }

    if (inputPassword !== this.password) {
      throw appError("INVALID_MEMBER_AUTH");
    }

    return true;
  }

  validateAvailability(event: Event) {
    return validateAndNormalizeRRule(this.rrule, event);
  }

  getAvailabilitySlotCount(event: Event): number {
    return this.validateAvailability(event).slots.length;
  }

  updateRRule(rrule: string): void {
    this.rrule = rrule;
  }

  toRecord(): MemberRecord {
    return {
      eventId: this.eventId,
      name: this.name,
      password: this.password,
      rrule: this.rrule
    };
  }

  toDetail(): MemberDetail {
    return {
      name: this.name,
      rrule: this.rrule
    };
  }
}
