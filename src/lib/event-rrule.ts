import { formatBasicUtcDateTime } from "./datetime.js";

export function buildEventRRule(start: Date): string {
  return `DTSTART:${formatBasicUtcDateTime(start)}`;
}
