export interface EventRecord {
  id: string;
  name: string;
  start: string;
  end: string;
  eventRRule: string;
}

export interface MemberRecord {
  eventId: string;
  name: string;
  password: string | null;
  rrule: string;
}

export interface MemberDetail {
  name: string;
  rrule: string;
}

export interface EventDetail {
  id: string;
  name: string;
  slotMinutes: number;
  start: string;
  end: string;
  members: MemberDetail[];
}
