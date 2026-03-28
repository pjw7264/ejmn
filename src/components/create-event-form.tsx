"use client";

import type { CSSProperties, FormEvent, UIEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import {
  getLocalDateTimeSummary,
  toUtcIsoFromParts,
  type CreateEventDraft,
  type CreateEventErrors,
  validateCreateEventDraft,
} from "./create-event-form-utils.js";
import { Calendar } from "./ui/calendar.js";
import { Card, CardContent } from "./ui/card.js";

type CreateEventFormProps = { variant?: "home" | "standalone" };
type HourOption =
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "11"
  | "12"
  | "13"
  | "14"
  | "15"
  | "16"
  | "17"
  | "18"
  | "19"
  | "20"
  | "21"
  | "22"
  | "23"
  | "24";
type TimeWheelPickerProps = { label: string; value: string; onChange: (next: string) => void };
type TimeoutRef = { current: number | null };

const HOUR_OPTIONS: HourOption[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
];
const WHEEL_ITEM_HEIGHT = 44;
const WHEEL_VIEWPORT_HEIGHT = 176;
const WHEEL_CENTER_OFFSET = (WHEEL_VIEWPORT_HEIGHT - WHEEL_ITEM_HEIGHT) / 2;

function getDefaultDraft(): CreateEventDraft {
  const now = new Date();
  const nextHour = new Date(now.getTime());
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  const end = new Date(nextHour.getTime() + 60 * 60 * 1000);

  return {
    name: "",
    startDate: toDateInputValue(nextHour),
    endDate: toDateInputValue(end),
    startTime: toTimeValue(nextHour),
    endTime: toTimeValue(end),
  };
}

export function CreateEventForm({ variant = "standalone" }: CreateEventFormProps) {
  const [draft, setDraft] = useState<CreateEventDraft>(() => getDefaultDraft());
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<CreateEventErrors>({});
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const dateSectionRef = useRef<HTMLElement | null>(null);
  const timeSectionRef = useRef<HTMLElement | null>(null);

  const selectedDateRange = useMemo<DateRange | undefined>(() => {
    const from = parseDateValue(draft.startDate);
    const to = parseDateValue(draft.endDate);
    if (!from) return undefined;
    return { from, to: to ?? from };
  }, [draft.endDate, draft.startDate]);

  function handleCalendarDayClick(day: Date) {
    if (isBeforeToday(day)) return;

    const nextRange = normalizeDateRange(getNextDateRange(selectedDateRange, day));
    const startDate = nextRange?.from ? toDateInputValue(nextRange.from) : "";
    const endDate = nextRange?.to ? toDateInputValue(nextRange.to) : "";

    setDraft((current) => ({ ...current, startDate, endDate }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedDraft = normalizeDraftTimes(normalizeDraftDateRange(draft));
    setDraft(normalizedDraft);
    const nextErrors = validateCreateEventDraft(normalizedDraft);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalidField(nextErrors, {
        name: nameInputRef.current,
        date: dateSectionRef.current,
        time: timeSectionRef.current,
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: normalizedDraft.name.trim(),
          start: toUtcIsoFromParts(normalizedDraft.startDate, normalizedDraft.startTime),
          end: toUtcIsoFromParts(normalizedDraft.endDate, normalizedDraft.endTime),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setErrors({ submit: payload?.error?.message ?? "이벤트를 만들지 못했습니다." });
        return;
      }
      window.location.assign(`/events/${payload.id}`);
    } catch {
      setErrors({ submit: "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <div style={{ ...styles.sidebar, ...(variant === "home" ? styles.homeSidebar : null) }}>
          <p style={styles.eyebrow}>Create Event</p>
          <h1 style={styles.title}>언제만나</h1>
          <p style={styles.tagline}>모두의 가능한 시간을 한 번에</p>
          {variant === "standalone" ? (
            <a href="/" style={styles.backLink}>
              홈으로 돌아가기
            </a>
          ) : null}
        </div>

        <form style={styles.formCard} onSubmit={handleSubmit}>
          <label style={styles.field}>
            <span style={styles.label}>이벤트 이름</span>
            <input
              ref={nameInputRef}
              style={styles.input}
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="예: 팀 주간 회고"
            />
            {errors.name ? <span style={styles.error}>{errors.name}</span> : null}
          </label>

          <section ref={dateSectionRef} style={styles.pickerSection} tabIndex={-1}>
            <div style={styles.sectionHeader}>
              <div>
                <p style={styles.sectionEyebrow}>Date Range</p>
                <h2 style={styles.sectionTitle}>날짜범위 선택</h2>
              </div>
            </div>
            <Card style={styles.calendarCard}>
              <CardContent style={styles.calendarCardContent}>
                <div style={styles.calendarScrollArea}>
                  <Calendar
                    mode="range"
                    defaultMonth={selectedDateRange?.from}
                    selected={selectedDateRange}
                    onDayClick={handleCalendarDayClick}
                    numberOfMonths={1}
                    showOutsideDays={false}
                    disabled={isBeforeToday}
                  />
                </div>
              </CardContent>
            </Card>
            <p style={styles.inlineHint}>시작일과 종료일만 선택하고, 중간 날짜는 자동으로 범위로 처리됩니다.</p>
            {errors.startDate || errors.endDate ? (
              <span style={styles.error}>{errors.startDate ?? errors.endDate}</span>
            ) : null}
          </section>

          <section ref={timeSectionRef} style={styles.pickerSection} tabIndex={-1}>
            <div style={styles.sectionHeader}>
              <div>
                <p style={styles.sectionEyebrow}>Time Range</p>
                <h2 style={styles.sectionTitle}>시간범위 선택</h2>
              </div>
            </div>
            <div style={styles.timePickerGrid}>
              <TimeWheelPicker
                label="시작 시간"
                value={draft.startTime}
                onChange={(next) => setDraft((current) => applyTimeSelection(current, "start", next))}
              />
              <TimeWheelPicker
                label="종료 시간"
                value={draft.endTime}
                onChange={(next) => setDraft((current) => applyTimeSelection(current, "end", next))}
              />
            </div>
            <p style={styles.inlineHint}>각 컬럼은 독립적으로 스크롤되며 멈출 때 가장 가까운 값으로 맞춰집니다.</p>
            {errors.startTime || errors.endTime ? (
              <span style={styles.error}>{errors.startTime ?? errors.endTime}</span>
            ) : null}
          </section>

          {errors.submit ? <p style={styles.submitError}>{errors.submit}</p> : null}

          <button type="submit" disabled={submitting} style={styles.submitButton}>
            {submitting ? "이벤트 생성 중..." : "이벤트 만들기"}
          </button>
        </form>
      </section>
    </main>
  );
}

function TimeWheelPicker({ label, value, onChange }: TimeWheelPickerProps) {
  const hourRef = useRef<HTMLDivElement | null>(null);
  const hourTimeoutRef = useRef<number | null>(null);
  const selectedHour = useMemo(() => toHourValue(value), [value]);

  useEffect(() => {
    scrollColumnToValue(hourRef.current, HOUR_OPTIONS.indexOf(selectedHour));
  }, [selectedHour]);

  useEffect(() => {
    return () => {
      if (hourTimeoutRef.current !== null) window.clearTimeout(hourTimeoutRef.current);
    };
  }, []);

  function handleHourScroll(event: UIEvent<HTMLDivElement>) {
    scheduleSnap(event.currentTarget, HOUR_OPTIONS, hourTimeoutRef, (next) => {
      onChange(fromHourValue(next));
    });
  }

  return (
    <div style={styles.wheelPicker}>
      <div style={styles.wheelPickerHeader}>
        <span style={styles.label}>{label}</span>
      </div>
      <div style={styles.wheelPickerBody}>
        <div style={styles.wheelHighlight} />
        <div style={styles.wheelFadeTop} />
        <div style={styles.wheelFadeBottom} />

        <div ref={hourRef} style={styles.wheelColumn} onScroll={handleHourScroll} data-wheel-column={`${label}-hour`}>
          <div style={styles.wheelSpacer} />
          {HOUR_OPTIONS.map((option) => (
            <div
              key={option}
              style={{
                ...styles.wheelItem,
                ...(selectedHour === option ? styles.wheelItemActive : styles.wheelItemInactive),
              }}
            >
              {formatKoreanHour(option)}
            </div>
          ))}
          <div style={styles.wheelSpacer} />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "20px 12px 88px",
    overflowX: "hidden",
    background:
      "linear-gradient(180deg, rgba(231,238,252,0.9) 0%, rgba(255,255,255,1) 36%), radial-gradient(circle at top right, rgba(244,226,210,0.7), transparent 25%)",
  },
  shell: {
    maxWidth: 420,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 16,
  },
  sidebar: {
    padding: 22,
    borderRadius: 26,
    background: "#13233f",
    color: "#f8fbff",
  },
  homeSidebar: {
    paddingBottom: 20,
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#b7c6e5",
  },
  title: {
    margin: "10px 0 8px",
    fontSize: "clamp(2rem, 4vw, 3.4rem)",
    lineHeight: 1.05,
    fontWeight: 800,
  },
  tagline: {
    margin: 0,
    fontSize: "clamp(1rem, 2.8vw, 1.2rem)",
    lineHeight: 1.5,
    color: "#c8d4ea",
    maxWidth: 260,
  },
  backLink: {
    display: "inline-flex",
    marginTop: 18,
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 700,
  },
  formCard: {
    padding: 20,
    borderRadius: 28,
    background: "#ffffff",
    border: "1px solid #dfe5ef",
    boxShadow: "0 22px 48px rgba(18, 31, 54, 0.08)",
  },
  field: {
    display: "grid",
    gap: 8,
    marginBottom: 18,
  },
  label: {
    fontWeight: 700,
    color: "#182845",
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    border: "1px solid #cad3e2",
    padding: "0 14px",
    fontSize: 15,
    width: "100%",
    background: "#ffffff",
  },
  pickerSection: {
    display: "grid",
    gap: 12,
    marginBottom: 24,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    gap: 12,
  },
  sectionEyebrow: {
    margin: 0,
    fontSize: 11,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#61738d",
  },
  sectionTitle: {
    margin: "6px 0 0",
    fontSize: 22,
    color: "#182845",
  },
  calendarCard: {
    borderRadius: 20,
    overflow: "hidden",
    width: "100%",
  },
  calendarCardContent: {
    padding: 14,
  },
  calendarScrollArea: {
    overflow: "hidden",
    maxHeight: "none",
    maxWidth: "100%",
  },
  timePickerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  wheelPicker: {
    display: "grid",
    gap: 10,
  },
  wheelPickerHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wheelPickerBody: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 0,
    padding: 8,
    borderRadius: 18,
    border: "1px solid #cad3e2",
    background: "#fbfcfe",
    overflow: "hidden",
  },
  wheelColumn: {
    position: "relative",
    height: WHEEL_VIEWPORT_HEIGHT,
    overflowY: "auto",
    overscrollBehavior: "contain",
    scrollSnapType: "y mandatory",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    WebkitOverflowScrolling: "touch",
    touchAction: "pan-y",
    zIndex: 1,
  },
  wheelSpacer: {
    height: WHEEL_CENTER_OFFSET,
    flexShrink: 0,
  },
  wheelItem: {
    height: WHEEL_ITEM_HEIGHT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    scrollSnapAlign: "center",
    fontSize: 16,
    fontWeight: 700,
    transition: "opacity 120ms ease, transform 120ms ease, color 120ms ease",
  },
  wheelItemActive: {
    opacity: 1,
    transform: "scale(1.02)",
    color: "#ffffff",
    fontWeight: 800,
    background: "#2f6df6",
    borderRadius: 12,
    boxShadow: "0 10px 20px rgba(47, 109, 246, 0.18)",
  },
  wheelItemInactive: {
    opacity: 0.34,
    transform: "scale(0.94)",
    color: "#7a889d",
  },
  wheelHighlight: {
    position: "absolute",
    left: 8,
    right: 8,
    top: "50%",
    height: WHEEL_ITEM_HEIGHT,
    transform: "translateY(-50%)",
    borderRadius: 14,
    background: "rgba(47, 109, 246, 0.08)",
    border: "1px solid rgba(47, 109, 246, 0.14)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.45)",
    pointerEvents: "none",
    zIndex: 0,
  },
  wheelFadeTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 32,
    background: "linear-gradient(180deg, rgba(251,252,254,1), rgba(251,252,254,0))",
    pointerEvents: "none",
    zIndex: 2,
  },
  wheelFadeBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 32,
    background: "linear-gradient(0deg, rgba(251,252,254,1), rgba(251,252,254,0))",
    pointerEvents: "none",
    zIndex: 2,
  },
  inlineHint: {
    margin: 0,
    color: "#61738d",
    lineHeight: 1.6,
    fontSize: 14,
  },
  error: {
    color: "#b42318",
    fontSize: 13,
  },
  submitError: {
    color: "#b42318",
    margin: "16px 0 0",
  },
  submitButton: {
    marginTop: 18,
    minHeight: 52,
    width: "100%",
    borderRadius: 999,
    border: 0,
    background: "#0f3d91",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
  },
};

function parseDateValue(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeValue(date: Date): string {
  const hour = date.getHours() === 0 ? 24 : date.getHours();
  return `${String(hour === 24 ? 0 : hour).padStart(2, "0")}:00`;
}

function isBeforeToday(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const value = new Date(date.getTime());
  value.setHours(0, 0, 0, 0);
  return value < today;
}

function getNextDateRange(current: DateRange | undefined, day: Date): DateRange {
  const normalizedDay = normalizeDate(day);
  if (!current?.from) return { from: normalizedDay, to: undefined };
  if (!current.to) {
    const from = normalizeDate(current.from);
    if (isSameCalendarDay(from, normalizedDay)) return { from: normalizedDay, to: normalizedDay };
    return isEarlierDay(normalizedDay, from) ? { from: normalizedDay, to: from } : { from, to: normalizedDay };
  }
  return { from: normalizedDay, to: undefined };
}

function normalizeDate(date: Date): Date {
  const next = new Date(date.getTime());
  next.setHours(0, 0, 0, 0);
  return next;
}

function isSameCalendarDay(left: Date, right: Date): boolean {
  return normalizeDate(left).getTime() === normalizeDate(right).getTime();
}

function isEarlierDay(left: Date, right: Date): boolean {
  return normalizeDate(left).getTime() < normalizeDate(right).getTime();
}

function normalizeDateRange(range: DateRange | undefined): DateRange | undefined {
  if (!range?.from) return range;
  if (!range.to) return { from: normalizeDate(range.from), to: undefined };
  const from = normalizeDate(range.from);
  const to = normalizeDate(range.to);
  return isEarlierDay(to, from) ? { from: to, to: from } : { from, to };
}

function focusFirstInvalidField(
  errors: CreateEventErrors,
  elements: { name: HTMLInputElement | null; date: HTMLElement | null; time: HTMLElement | null },
) {
  if (errors.name && elements.name) {
    elements.name.scrollIntoView({ behavior: "smooth", block: "center" });
    elements.name.focus();
    return;
  }
  if ((errors.startDate || errors.endDate) && elements.date) {
    elements.date.scrollIntoView({ behavior: "smooth", block: "center" });
    elements.date.focus();
    return;
  }
  if ((errors.startTime || errors.endTime) && elements.time) {
    elements.time.scrollIntoView({ behavior: "smooth", block: "center" });
    elements.time.focus();
  }
}

function toHourValue(value: string): HourOption {
  const hour = Number(value.slice(0, 2));
  if (Number.isNaN(hour) || hour === 0) return "24";
  return String(hour) as HourOption;
}

function fromHourValue(hour: HourOption): string {
  if (hour === "24") return "00:00";
  return `${hour.padStart(2, "0")}:00`;
}

function scheduleSnap<T extends string>(
  element: HTMLDivElement,
  options: readonly T[],
  timeoutRef: TimeoutRef,
  onSelect: (next: T) => void,
) {
  if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
  timeoutRef.current = window.setTimeout(() => {
    const nextIndex = clamp(Math.round(element.scrollTop / WHEEL_ITEM_HEIGHT), 0, options.length - 1);
    scrollColumnToValue(element, nextIndex);
    onSelect(options[nextIndex]);
  }, 90);
}

function scrollColumnToValue(element: HTMLDivElement | null, index: number) {
  if (!element || index < 0) return;
  const targetTop = index * WHEEL_ITEM_HEIGHT;
  if (Math.abs(element.scrollTop - targetTop) < 1) return;
  element.scrollTo({ top: targetTop, behavior: "smooth" });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function applyTimeSelection(draft: CreateEventDraft, field: "start" | "end", nextTime: string): CreateEventDraft {
  const nextDraft = field === "start" ? { ...draft, startTime: nextTime } : { ...draft, endTime: nextTime };
  return normalizeDraftTimes(nextDraft);
}

function normalizeDraftDateRange(draft: CreateEventDraft): CreateEventDraft {
  if (!draft.startDate || draft.endDate) {
    return draft;
  }

  return {
    ...draft,
    endDate: draft.startDate,
  };
}

function isNextDay(startDate: string, endDate: string): boolean {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return end.getTime() - start.getTime() === 24 * 60 * 60 * 1000;
}

function normalizeDraftTimes(draft: CreateEventDraft): CreateEventDraft {
  if (!draft.startDate || !draft.endDate || !draft.startTime || !draft.endTime) {
    return draft;
  }

  const start = new Date(`${draft.startDate}T${draft.startTime}:00`);
  const end = new Date(`${draft.endDate}T${draft.endTime}:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return draft;
  }

  if (end <= start) {
    const nextDay = new Date(`${draft.startDate}T00:00:00`);
    nextDay.setDate(nextDay.getDate() + 1);

    return {
      ...draft,
      endDate: toDateInputValue(nextDay),
    };
  }

  if (draft.endDate !== draft.startDate && isNextDay(draft.startDate, draft.endDate)) {
    const sameDayEnd = new Date(`${draft.startDate}T${draft.endTime}:00`);
    if (sameDayEnd > start) {
      return {
        ...draft,
        endDate: draft.startDate,
      };
    }
  }

  return draft;
}

function formatKoreanHour(hour: HourOption): string {
  const numeric = Number(hour);

  if (numeric >= 1 && numeric <= 11) {
    return `오전 ${numeric}시`;
  }

  return `오후 ${numeric}시`;
}
