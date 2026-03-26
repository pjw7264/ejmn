import type { Event } from "../domain/event.js";
import type { Member } from "../domain/member.js";

export interface EventRepository {
  saveEvent(event: Event): Promise<void> | void;
  getEvent(eventId: string): Promise<Event | null> | Event | null;
  saveMember(member: Member, expiryAt: Date): Promise<void> | void;
  getMember(eventId: string, name: string): Promise<Member | null> | Member | null;
  listMembersByEvent(eventId: string): Promise<Member[]> | Member[];
}
