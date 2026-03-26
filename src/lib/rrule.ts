import * as rruleNamespace from "rrule";
import { assertSlotAligned, formatBasicUtcDateTime, parseBasicUtcDateTime } from "./datetime.js";
import { appError } from "./errors.js";
import type { Event } from "../domain/event.js";

const runtimePackage = ("RRule" in rruleNamespace ? rruleNamespace : (rruleNamespace as unknown as { default: typeof rruleNamespace }).default);
const { datetime: rruleDateTime, RRule, RRuleSet, rrulestr } = runtimePackage;
type Weekday = InstanceType<typeof runtimePackage.Weekday>;

const ALLOWED_FIELDS = new Set(["FREQ", "UNTIL", "INTERVAL", "BYDAY", "BYHOUR", "BYMINUTE"]);
const INTEGER_PATTERN = /^\d+$/;
const MINUTE_PATTERN = /^(0|30)$/;

interface ParsedRuleFields {
  freq: "DAILY" | "WEEKLY";
  until: Date;
  interval: number;
  byDay: string[] | null;
  byHour: number[] | null;
  byMinute: number[] | null;
}

interface ParsedAvailabilityRRule {
  dtstart: Date;
  rule: ParsedRuleFields | null;
}

function strictParseInteger(value: string): number {
  if (!INTEGER_PATTERN.test(value)) {
    throw appError("UNSUPPORTED_RRULE");
  }

  return Number.parseInt(value, 10);
}

function parseIntegerList(value: string, validator: (value: number) => boolean): number[] {
  const numbers = value.split(",").map((item) => {
    if (!INTEGER_PATTERN.test(item)) {
      throw appError("UNSUPPORTED_RRULE");
    }

    const parsed = Number.parseInt(item, 10);

    if (!validator(parsed)) {
      throw appError("UNSUPPORTED_RRULE");
    }

    return parsed;
  });

  return [...new Set(numbers)].sort((left, right) => left - right);
}

function parseByDay(value: string): string[] {
  const dayValues = value.split(",").map((item) => {
    const normalized = item.trim().toUpperCase();

    if (!["SU", "MO", "TU", "WE", "TH", "FR", "SA"].includes(normalized)) {
      throw appError("UNSUPPORTED_RRULE");
    }

    return normalized;
  });

  return [...new Set(dayValues)];
}

function parseByMinute(value: string): number[] {
  const numbers = value.split(",").map((item) => {
    if (!MINUTE_PATTERN.test(item)) {
      throw appError("UNSUPPORTED_RRULE");
    }

    return Number.parseInt(item, 10);
  });

  return [...new Set(numbers)].sort((left, right) => left - right);
}

function parseRuleFields(ruleLine: string): ParsedRuleFields {
  const fields: Record<string, string> = {};

  for (const pair of ruleLine.slice("RRULE:".length).split(";")) {
    const [key, rawValue] = pair.split("=");

    if (!key || !rawValue || fields[key] !== undefined || !ALLOWED_FIELDS.has(key)) {
      throw appError("UNSUPPORTED_RRULE");
    }

    fields[key] = rawValue;
  }

  if (!fields.FREQ || !fields.UNTIL) {
    throw appError("UNSUPPORTED_RRULE");
  }

  if (!["DAILY", "WEEKLY"].includes(fields.FREQ)) {
    throw appError("UNSUPPORTED_RRULE");
  }

  if (fields.BYDAY && fields.FREQ !== "WEEKLY") {
    throw appError("UNSUPPORTED_RRULE");
  }

  const interval = fields.INTERVAL ? strictParseInteger(fields.INTERVAL) : 1;

  if (interval <= 0) {
    throw appError("UNSUPPORTED_RRULE");
  }

  return {
    freq: fields.FREQ as "DAILY" | "WEEKLY",
    until: parseBasicUtcDateTime(fields.UNTIL),
    interval,
    byDay: fields.BYDAY ? parseByDay(fields.BYDAY) : null,
    byHour: fields.BYHOUR ? parseIntegerList(fields.BYHOUR, (value) => value >= 0 && value <= 23) : null,
    byMinute: fields.BYMINUTE ? parseByMinute(fields.BYMINUTE) : null
  };
}

export function parseAvailabilityRRule(input: unknown): ParsedAvailabilityRRule {
  if (typeof input !== "string" || input.length === 0) {
    throw appError("UNSUPPORTED_RRULE");
  }

  const lines = input
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 1 || lines.length > 2 || !lines[0].startsWith("DTSTART:")) {
    throw appError("UNSUPPORTED_RRULE");
  }

  const dtstart = parseBasicUtcDateTime(lines[0].slice("DTSTART:".length));

  if (lines.length === 1) {
    return { dtstart, rule: null };
  }

  if (!lines[1].startsWith("RRULE:")) {
    throw appError("UNSUPPORTED_RRULE");
  }

  return { dtstart, rule: parseRuleFields(lines[1]) };
}

function toRRuleDate(date: Date): Date {
  return rruleDateTime(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds()
  );
}

function toWeekdays(values: string[] | null): Weekday[] | undefined {
  if (!values) {
    return undefined;
  }

  return values.map((value) => RRule[value as keyof typeof RRule] as Weekday);
}

function createRRuleSet(parsed: ParsedAvailabilityRRule): InstanceType<typeof runtimePackage.RRuleSet> {
  const set = new RRuleSet();

  if (!parsed.rule) {
    set.rdate(parsed.dtstart);
    return set;
  }

  set.rrule(
    new RRule({
      freq: parsed.rule.freq === "DAILY" ? RRule.DAILY : RRule.WEEKLY,
      dtstart: toRRuleDate(parsed.dtstart),
      until: toRRuleDate(parsed.rule.until),
      interval: parsed.rule.interval,
      byweekday: toWeekdays(parsed.rule.byDay),
      byhour: parsed.rule.byHour ?? undefined,
      byminute: parsed.rule.byMinute ?? undefined
    })
  );

  return set;
}

export function expandAvailabilitySlots(parsed: ParsedAvailabilityRRule, event: Event): Date[] {
  if (parsed.rule && parsed.rule.until.getTime() < parsed.dtstart.getTime()) {
    throw appError("RRULE_OUT_OF_EVENT_RANGE");
  }

  const set = createRRuleSet(parsed);
  const between = set.between(event.start, new Date(event.end.getTime() - 1), true);

  return between.map((date: Date) => new Date(date.getTime()));
}

export function normalizeAvailabilityRRule(parsed: ParsedAvailabilityRRule): string {
  const dtstartLine = `DTSTART:${formatBasicUtcDateTime(parsed.dtstart)}`;

  if (!parsed.rule) {
    return dtstartLine;
  }

  const fields = [`FREQ=${parsed.rule.freq}`, `UNTIL=${formatBasicUtcDateTime(parsed.rule.until)}`];

  if (parsed.rule.interval !== 1) {
    fields.push(`INTERVAL=${parsed.rule.interval}`);
  }

  if (parsed.rule.byDay?.length) {
    fields.push(`BYDAY=${parsed.rule.byDay.join(",")}`);
  }

  if (parsed.rule.byHour?.length) {
    fields.push(`BYHOUR=${parsed.rule.byHour.join(",")}`);
  }

  if (parsed.rule.byMinute?.length) {
    fields.push(`BYMINUTE=${parsed.rule.byMinute.join(",")}`);
  }

  const normalized = `${dtstartLine}\nRRULE:${fields.join(";")}`;
  rrulestr(normalized, { forceset: true });
  return normalized;
}

export function validateAndNormalizeRRule(input: unknown, event: Event): { normalized: string; slots: Date[] } {
  const parsed = parseAvailabilityRRule(input);

  if (parsed.rule && parsed.rule.until.getTime() > event.end.getTime()) {
    throw appError("RRULE_OUT_OF_EVENT_RANGE");
  }

  const slots = expandAvailabilitySlots(parsed, event);

  if (slots.length === 0) {
    throw appError("RRULE_OUT_OF_EVENT_RANGE");
  }

  for (const slot of slots) {
    assertSlotAligned(slot, "RRULE_NOT_SLOT_ALIGNED");

    if (!event.contains(slot)) {
      throw appError("RRULE_OUT_OF_EVENT_RANGE");
    }
  }

  return {
    normalized: normalizeAvailabilityRRule(parsed),
    slots
  };
}
