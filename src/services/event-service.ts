import { Event } from "../domain/event.js";
import { Member } from "../domain/member.js";
import { Members } from "../domain/members.js";
import { parseAuthorizationHeader } from "../lib/basic-auth.js";
import { parseUtcIsoDateTime } from "../lib/datetime.js";
import { appError } from "../lib/errors.js";
import { generateEventId } from "../lib/event-id.js";
import { buildEventRRule } from "../lib/event-rrule.js";
import { validateName } from "../lib/name-policy.js";
import { validateAndNormalizeRRule } from "../lib/rrule.js";
import type { EventDetail } from "../domain/types.js";
import type { EventRepository } from "../repositories/types.js";

interface CreateEventInput {
  name?: unknown;
  start?: unknown;
  end?: unknown;
}

interface UpsertMemberInput {
  rrule?: unknown;
}

export class EventService {
  repository: EventRepository;
  now: () => Date;
  idGenerator: () => string;

  constructor(
    repository: EventRepository,
    { now = () => new Date(), idGenerator = generateEventId }: { now?: () => Date; idGenerator?: () => string } = {}
  ) {
    this.repository = repository;
    this.now = now;
    this.idGenerator = idGenerator;
  }

  async createEvent(input: CreateEventInput): Promise<EventDetail> {
    if (!input || typeof input !== "object") {
      throw appError("MISSING_REQUIRED_FIELD");
    }

    if (input.name === undefined || input.start === undefined || input.end === undefined) {
      throw appError("MISSING_REQUIRED_FIELD");
    }

    const name = validateName(input.name, "INVALID_EVENT_NAME");
    const start = parseUtcIsoDateTime(input.start);
    const end = parseUtcIsoDateTime(input.end);
    const event = new Event({
      id: this.idGenerator(),
      name,
      start,
      end,
      eventRRule: buildEventRRule(start)
    });

    event.validateRange(this.now());
    await this.repository.saveEvent(event);

    return event.toEventDetail(new Members([]));
  }

  async getEventDetail(eventId: string): Promise<EventDetail> {
    const event = await this.repository.getEvent(eventId);

    if (!event) {
      throw appError("EVENT_NOT_FOUND");
    }

    const members = Members.fromEventMembers(await this.repository.listMembersByEvent(eventId)).sortByAvailability(event);
    return event.toEventDetail(members);
  }

  async upsertMemberAvailability(eventId: string, authorizationHeader: unknown, input: UpsertMemberInput): Promise<EventDetail> {
    if (!input || typeof input !== "object" || input.rrule === undefined) {
      throw appError("MISSING_REQUIRED_FIELD");
    }

    const credentials = parseAuthorizationHeader(authorizationHeader);
    validateName(credentials.name, "INVALID_MEMBER_NAME");

    const event = await this.repository.getEvent(eventId);

    if (!event) {
      throw appError("EVENT_NOT_FOUND");
    }

    const existingMember = await this.repository.getMember(eventId, credentials.name);

    if (existingMember) {
      existingMember.authorize(credentials.password);
    }

    const { normalized } = validateAndNormalizeRRule(input.rrule, event);
    const member =
      existingMember ??
      new Member({
        eventId,
        name: credentials.name,
        password: credentials.password === "" ? null : credentials.password,
        rrule: normalized
      });

    member.validateName();
    member.updateRRule(normalized);
    await this.repository.saveMember(member, event.getExpiryAt());

    const members = Members.fromEventMembers(await this.repository.listMembersByEvent(eventId)).sortByAvailability(event);
    return event.toEventDetail(members);
  }
}
