import { SLOT_MILLISECONDS } from "./constants.js";
import { appError } from "./errors.js";

const UTC_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const BASIC_UTC_PATTERN = /^\d{8}T\d{6}Z$/;

function isoWithoutMilliseconds(date: Date): string {
  return date.toISOString().replace(".000Z", "Z");
}

export function parseUtcIsoDateTime(value: unknown): Date {
  if (typeof value !== "string" || !UTC_ISO_PATTERN.test(value)) {
    throw appError("INVALID_DATETIME_FORMAT");
  }

  if (!value.endsWith("Z")) {
    throw appError("INVALID_TIMEZONE");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime()) || isoWithoutMilliseconds(date) !== value) {
    throw appError("INVALID_DATETIME_FORMAT");
  }

  return date;
}

export function parseBasicUtcDateTime(value: unknown): Date {
  if (typeof value !== "string" || !BASIC_UTC_PATTERN.test(value)) {
    throw appError("UNSUPPORTED_RRULE");
  }

  const isoValue = [
    value.slice(0, 4),
    "-",
    value.slice(4, 6),
    "-",
    value.slice(6, 8),
    "T",
    value.slice(9, 11),
    ":",
    value.slice(11, 13),
    ":",
    value.slice(13, 15),
    "Z"
  ].join("");

  const date = new Date(isoValue);

  if (Number.isNaN(date.getTime()) || formatBasicUtcDateTime(date) !== value) {
    throw appError("UNSUPPORTED_RRULE");
  }

  return date;
}

export function formatBasicUtcDateTime(date: Date): string {
  const iso = date.toISOString();

  return [
    iso.slice(0, 4),
    iso.slice(5, 7),
    iso.slice(8, 10),
    "T",
    iso.slice(11, 13),
    iso.slice(14, 16),
    iso.slice(17, 19),
    "Z"
  ].join("");
}

export function assertSlotAligned(
  date: Date,
  errorCode: "INVALID_TIME_ALIGNMENT" | "RRULE_NOT_SLOT_ALIGNED" = "INVALID_TIME_ALIGNMENT"
): void {
  if (
    date.getUTCSeconds() !== 0 ||
    date.getUTCMilliseconds() !== 0 ||
    date.getTime() % SLOT_MILLISECONDS !== 0
  ) {
    throw appError(errorCode);
  }
}

export function assertFuture(date: Date, now: Date): void {
  if (date.getTime() <= now.getTime()) {
    throw appError("EVENT_END_IN_PAST");
  }
}
