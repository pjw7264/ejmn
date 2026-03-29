"use client";

import type { CSSProperties, FormEvent, MutableRefObject, UIEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import {
  toUtcIsoFromParts,
  type CreateEventDraft,
  type CreateEventErrors,
  validateCreateEventDraft,
} from "./create-event-form-utils.js";
import { ScreenHeader } from "./screen-header.js";
import { Calendar } from "./ui/calendar.js";
import { Card, CardContent } from "./ui/card.js";

type CreateEventFormProps = { variant?: "home" | "standalone" };
type FormHeaderProps = { variant: "home" | "standalone" };
type NameFieldProps = {
  inputRef: MutableRefObject<HTMLInputElement | null>;
  value: string;
  error?: string;
  onChange: (next: string) => void;
};
type DateRangeSectionProps = {
  sectionRef: MutableRefObject<HTMLElement | null>;
  selectedRange: DateRange | undefined;
  error?: string;
  onDayClick: (day: Date) => void;
  onTouchStart: (day: Date) => void;
  onTouchMove: (day: Date) => void;
  onTouchEnd: (day: Date | null, moved: boolean) => void;
};
type TimeRangeSectionProps = {
  sectionRef: MutableRefObject<HTMLElement | null>;
  startTime: string;
  endTime: string;
  error?: string;
  onStartTimeChange: (next: string) => void;
  onEndTimeChange: (next: string) => void;
};
type MeridiemOption = "오전" | "오후";
type Hour12Option =
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
  | "12";
type TimeWheelPickerProps = { label: string; value: string; onChange: (next: string) => void };
type TimeoutRef = { current: number | null };
type WheelSelectionState = { meridiemIndex: number; hourIndex: number };
type WheelScrollBehaviorState = { meridiem: ScrollBehavior; hour: ScrollBehavior };

const MERIDIEM_OPTIONS: MeridiemOption[] = ["오전", "오후"];
const HOUR_OPTIONS: Hour12Option[] = [
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
];
const HOUR_SLOT_OPTIONS: Hour12Option[] = [...HOUR_OPTIONS, ...HOUR_OPTIONS];
const WHEEL_ITEM_HEIGHT = 44;
const WHEEL_VIEWPORT_HEIGHT = 176;
const WHEEL_CENTER_OFFSET = (WHEEL_VIEWPORT_HEIGHT - WHEEL_ITEM_HEIGHT) / 2;
const WHEEL_PICKER_GAP = 10;
const WHEEL_LABEL_ROW_HEIGHT = 18;
const WHEEL_BODY_VERTICAL_PADDING = 8;
const WAVE_SEPARATOR_OFFSET =
  WHEEL_LABEL_ROW_HEIGHT + WHEEL_PICKER_GAP + WHEEL_BODY_VERTICAL_PADDING + WHEEL_CENTER_OFFSET;

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
  const [touchPreviewRange, setTouchPreviewRange] = useState<DateRange | undefined>(undefined);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const dateSectionRef = useRef<HTMLElement | null>(null);
  const timeSectionRef = useRef<HTMLElement | null>(null);
  const touchRangeAnchorRef = useRef<Date | null>(null);
  const touchPreviewRangeRef = useRef<DateRange | undefined>(undefined);

  const selectedDateRange = useMemo<DateRange | undefined>(() => {
    const from = parseDateValue(draft.startDate);
    const to = parseDateValue(draft.endDate);
    if (!from) return undefined;
    return { from, to: to ?? from };
  }, [draft.endDate, draft.startDate]);
  const displayedDateRange = touchPreviewRange ?? selectedDateRange;

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  function updateTouchPreviewRange(nextRange: DateRange | undefined) {
    touchPreviewRangeRef.current = nextRange;
    setTouchPreviewRange(nextRange);
  }

  function applyCalendarRange(nextRange: DateRange | undefined) {
    setDraft((current) => ({
      ...current,
      startDate: nextRange?.from ? toDateInputValue(nextRange.from) : "",
      endDate: nextRange?.to ? toDateInputValue(nextRange.to) : "",
    }));
  }

  function selectSingleCalendarDay(day: Date) {
    applyCalendarRange({ from: day, to: day });
  }

  function handleCalendarDayClick(day: Date) {
    if (isBeforeToday(day)) {
      return;
    }

    updateTouchPreviewRange(undefined);
    selectSingleCalendarDay(normalizeDate(day));
  }

  function handleCalendarTouchStart(day: Date) {
    if (isBeforeToday(day)) {
      touchRangeAnchorRef.current = null;
      return;
    }

    const normalizedDay = normalizeDate(day);
    touchRangeAnchorRef.current = normalizedDay;
    updateTouchPreviewRange({ from: normalizedDay, to: normalizedDay });
  }

  function handleCalendarTouchMove(day: Date) {
    const anchor = touchRangeAnchorRef.current;

    if (!anchor || isBeforeToday(day)) {
      return;
    }

    const normalizedDay = normalizeDate(day);
    const nextRange = normalizeDateRange({ from: anchor, to: normalizedDay });
    updateTouchPreviewRange(nextRange);
  }

  function handleCalendarTouchEnd(day: Date | null, moved: boolean) {
    const anchor = touchRangeAnchorRef.current;
    const normalizedDay = day && !isBeforeToday(day) ? normalizeDate(day) : null;

    if (!moved && normalizedDay) {
      selectSingleCalendarDay(normalizedDay);
    } else if (moved) {
      const committedRange =
        anchor && normalizedDay
          ? normalizeDateRange({ from: anchor, to: normalizedDay })
          : touchPreviewRangeRef.current;

      if (committedRange?.from) {
        applyCalendarRange(committedRange);
      }
    }

    touchRangeAnchorRef.current = null;
    updateTouchPreviewRange(undefined);
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
      window.location.assign(`/?${encodeURIComponent(payload.id)}`);
    } catch {
      setErrors({ submit: "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.shell}>
        <CreateEventFormHeader variant={variant} />

        <form style={styles.formCard} onSubmit={handleSubmit}>
          <NameField
            inputRef={nameInputRef}
            value={draft.name}
            error={errors.name}
            onChange={(next) => setDraft((current) => ({ ...current, name: next }))}
          />

          <div style={styles.sectionDivider} />

          <DateRangeSection
            sectionRef={dateSectionRef}
            selectedRange={displayedDateRange}
            error={errors.startDate ?? errors.endDate}
            onDayClick={handleCalendarDayClick}
            onTouchStart={handleCalendarTouchStart}
            onTouchMove={handleCalendarTouchMove}
            onTouchEnd={handleCalendarTouchEnd}
          />

          <div style={styles.sectionDivider} />

          <TimeRangeSection
            sectionRef={timeSectionRef}
            startTime={draft.startTime}
            endTime={draft.endTime}
            error={errors.startTime ?? errors.endTime}
            onStartTimeChange={(next) => setDraft((current) => applyTimeSelection(current, "start", next))}
            onEndTimeChange={(next) => setDraft((current) => applyTimeSelection(current, "end", next))}
          />

          {errors.submit ? <p style={styles.submitError}>{errors.submit}</p> : null}

          <button type="submit" disabled={submitting} style={styles.submitButton}>
            {submitting ? "이벤트 생성 중..." : "이벤트 만들기"}
          </button>
        </form>
      </section>
    </main>
  );
}

function CreateEventFormHeader({ variant }: FormHeaderProps) {
  return (
    <ScreenHeader
      variant="brandBand"
      title="이벤트 만들기"
      align="center"
      topInset={variant === "home"}
      backHref={variant === "standalone" ? "/" : undefined}
    />
  );
}

function NameField({ inputRef, value, error, onChange }: NameFieldProps) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>이름</span>
      <input
        ref={inputRef}
        style={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="약속 이름을 입력하세요"
      />
      {error ? <span style={styles.error}>{error}</span> : null}
    </label>
  );
}

function DateRangeSection({
  sectionRef,
  selectedRange,
  error,
  onDayClick,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: DateRangeSectionProps) {
  return (
    <section ref={sectionRef} style={styles.pickerSection} tabIndex={-1}>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>약속 날짜</h2>
      </div>
      <Card style={styles.calendarCard}>
        <CardContent style={styles.calendarCardContent}>
          <div style={styles.calendarScrollArea}>
            <Calendar
              mode="range"
              defaultMonth={selectedRange?.from}
              selected={selectedRange}
              onDaySelect={onDayClick}
              onRangeTouchStart={onTouchStart}
              onRangeTouchMove={onTouchMove}
              onRangeTouchEnd={onTouchEnd}
              numberOfMonths={1}
              disabled={isBeforeToday}
            />
          </div>
        </CardContent>
      </Card>
      {error ? <span style={styles.error}>{error}</span> : null}
    </section>
  );
}

function TimeRangeSection({
  sectionRef,
  startTime,
  endTime,
  error,
  onStartTimeChange,
  onEndTimeChange,
}: TimeRangeSectionProps) {
  return (
    <section ref={sectionRef} style={styles.pickerSection} tabIndex={-1}>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>약속 시간</h2>
      </div>
      <div style={styles.timePickerGrid}>
        <TimeWheelPicker label="시작" value={startTime} onChange={onStartTimeChange} />
        <div aria-hidden="true" style={styles.waveSeparator}>
          ~
        </div>
        <TimeWheelPicker label="종료" value={endTime} onChange={onEndTimeChange} />
      </div>
      {error ? <span style={styles.error}>{error}</span> : null}
    </section>
  );
}

function TimeWheelPicker({ label, value, onChange }: TimeWheelPickerProps) {
  const meridiemRef = useRef<HTMLDivElement | null>(null);
  const hourRef = useRef<HTMLDivElement | null>(null);
  const meridiemTimeoutRef = useRef<number | null>(null);
  const hourTimeoutRef = useRef<number | null>(null);
  const meridiemFrameRef = useRef<number | null>(null);
  const hourFrameRef = useRef<number | null>(null);
  const selectedValue = useMemo(() => toMeridiemAndHourValue(value), [value]);
  const selectedHourSlotIndex = useMemo(() => getHourSlotIndex(value), [value]);
  const [activeWheelSelection, setActiveWheelSelection] = useState<WheelSelectionState>(() => ({
    meridiemIndex: MERIDIEM_OPTIONS.indexOf(selectedValue.meridiem),
    hourIndex: selectedHourSlotIndex,
  }));
  const activeWheelSelectionRef = useRef(activeWheelSelection);
  const lastEmittedValueRef = useRef(value);
  const shouldSyncScrollPositionRef = useRef(true);
  const pendingScrollBehaviorRef = useRef<WheelScrollBehaviorState>({ meridiem: "auto", hour: "auto" });

  useEffect(() => {
    activeWheelSelectionRef.current = activeWheelSelection;
  }, [activeWheelSelection]);

  useEffect(() => {
    lastEmittedValueRef.current = value;
  }, [value]);

  useEffect(() => {
    const currentMeridiem = MERIDIEM_OPTIONS[activeWheelSelectionRef.current.meridiemIndex];
    const currentHour = HOUR_SLOT_OPTIONS[activeWheelSelectionRef.current.hourIndex];

    if (currentMeridiem === selectedValue.meridiem && currentHour === selectedValue.hour) {
      return;
    }

    pendingScrollBehaviorRef.current = { meridiem: "auto", hour: "auto" };
    setActiveWheelSelection({
      meridiemIndex: MERIDIEM_OPTIONS.indexOf(selectedValue.meridiem),
      hourIndex: selectedHourSlotIndex,
    });
  }, [selectedHourSlotIndex, selectedValue.hour, selectedValue.meridiem]);

  useEffect(() => {
    if (!shouldSyncScrollPositionRef.current) {
      shouldSyncScrollPositionRef.current = true;
      return;
    }

    const { meridiem, hour } = pendingScrollBehaviorRef.current;
    scrollColumnToValue(meridiemRef.current, activeWheelSelection.meridiemIndex, meridiem);
    scrollColumnToValue(hourRef.current, activeWheelSelection.hourIndex, hour);
    pendingScrollBehaviorRef.current = { meridiem: "auto", hour: "auto" };
  }, [activeWheelSelection.hourIndex, activeWheelSelection.meridiemIndex]);

  useEffect(() => {
    return () => {
      if (meridiemTimeoutRef.current !== null) window.clearTimeout(meridiemTimeoutRef.current);
      if (hourTimeoutRef.current !== null) window.clearTimeout(hourTimeoutRef.current);
      if (meridiemFrameRef.current !== null) window.cancelAnimationFrame(meridiemFrameRef.current);
      if (hourFrameRef.current !== null) window.cancelAnimationFrame(hourFrameRef.current);
    };
  }, []);

  function updateWheelSelection(nextSelection: WheelSelectionState, frameRef?: MutableRefObject<number | null>) {
    activeWheelSelectionRef.current = nextSelection;
    shouldSyncScrollPositionRef.current = !frameRef;

    if (!frameRef) {
      setActiveWheelSelection(nextSelection);
      return;
    }

    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = window.requestAnimationFrame(() => {
      setActiveWheelSelection(activeWheelSelectionRef.current);
      frameRef.current = null;
    });
  }

  function emitTimeValue(nextSelection: WheelSelectionState) {
    const nextValue = fromHourSlotIndex(nextSelection.hourIndex);

    if (lastEmittedValueRef.current === nextValue) {
      return;
    }

    lastEmittedValueRef.current = nextValue;
    onChange(nextValue);
  }

  function handleMeridiemScroll(event: UIEvent<HTMLDivElement>) {
    const liveMeridiemIndex = getScrollAlignedWheelIndex(event.currentTarget.scrollTop, MERIDIEM_OPTIONS.length);
    const liveSelection = {
      ...activeWheelSelectionRef.current,
      meridiemIndex: liveMeridiemIndex,
    };

    updateWheelSelection(liveSelection, meridiemFrameRef);

    scheduleSnap(event.currentTarget, MERIDIEM_OPTIONS.length, meridiemTimeoutRef, (nextIndex) => {
      const nextHourIndex = nextIndex * HOUR_OPTIONS.length + (activeWheelSelectionRef.current.hourIndex % HOUR_OPTIONS.length);
      pendingScrollBehaviorRef.current = {
        meridiem: "smooth",
        hour: "smooth",
      };
      const nextSelection = {
        meridiemIndex: nextIndex,
        hourIndex: nextHourIndex,
      };
      updateWheelSelection(nextSelection);
      emitTimeValue(nextSelection);
    });
  }

  function handleHourScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const liveHourIndex = getScrollAlignedWheelIndex(element.scrollTop, HOUR_SLOT_OPTIONS.length);
    const liveSelection = {
      ...activeWheelSelectionRef.current,
      hourIndex: liveHourIndex,
    };

    updateWheelSelection(liveSelection, hourFrameRef);

    scheduleSnap(element, HOUR_SLOT_OPTIONS.length, hourTimeoutRef, (nextIndex) => {
      const nextMeridiemIndex = getMeridiemIndexFromHourSlot(nextIndex);
      pendingScrollBehaviorRef.current = {
        meridiem: nextMeridiemIndex !== MERIDIEM_OPTIONS.indexOf(selectedValue.meridiem) ? "smooth" : "auto",
        hour: "smooth",
      };
      const nextSelection = {
        meridiemIndex: nextMeridiemIndex,
        hourIndex: nextIndex,
      };
      updateWheelSelection(nextSelection);
      emitTimeValue(nextSelection);
    });
  }

  return (
    <div style={styles.wheelPicker}>
      <div style={styles.wheelPickerHeader}>
        <span style={styles.wheelPickerLabel}>{label}</span>
      </div>
      <div style={styles.wheelPickerBody}>
        <div style={styles.wheelHighlight} />
        <div style={styles.wheelFadeTop} />
        <div style={styles.wheelFadeBottom} />

        <div
          ref={meridiemRef}
          style={styles.wheelColumn}
          onScroll={handleMeridiemScroll}
          data-wheel-column={`${label}-meridiem`}
        >
          <div style={styles.wheelSpacer} />
          {MERIDIEM_OPTIONS.map((option, index) => (
            <div
              key={`${option}-${index}`}
              style={{
                ...styles.wheelItem,
                ...getWheelItemStateStyle(Math.abs(activeWheelSelection.meridiemIndex - index)),
              }}
            >
              {option}
            </div>
          ))}
          <div style={styles.wheelSpacer} />
        </div>

        <div ref={hourRef} style={styles.wheelColumn} onScroll={handleHourScroll} data-wheel-column={`${label}-hour`}>
          <div style={styles.wheelSpacer} />
          {HOUR_SLOT_OPTIONS.map((option, index) => (
            <div
              key={`${option}-${index}`}
              style={{
                ...styles.wheelItem,
                ...getWheelItemStateStyle(Math.abs(activeWheelSelection.hourIndex - index)),
              }}
            >
              {option}
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
    overflowX: "hidden",
    background:
      "linear-gradient(180deg, rgba(231,238,252,0.9) 0%, rgba(255,255,255,1) 36%), radial-gradient(circle at top right, rgba(244,226,210,0.7), transparent 25%)",
  },
  shell: {
    maxWidth: 420,
    margin: "0 auto",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  formCard: {
    padding: "22px 18px 20px",
    background: "#ffffff",
    border: "1px solid #dfe5ef",
    borderTop: 0,
  },
  field: {
    display: "grid",
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.4,
    color: "#182845",
    textAlign: "left",
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    border: "1px solid #cad3e2",
    padding: "0 14px",
    fontSize: 16,
    lineHeight: 1.5,
    width: "100%",
    background: "#ffffff",
    textAlign: "left",
  },
  sectionDivider: {
    height: 18,
  },
  pickerSection: {
    display: "grid",
    gap: 12,
  },
  sectionHeader: {
    display: "block",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 20,
    lineHeight: 1.3,
    fontWeight: 800,
    color: "#182845",
    textAlign: "left",
  },
  calendarCard: {
    borderRadius: 22,
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
    gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
    gap: 10,
    alignItems: "center",
  },
  waveSeparator: {
    alignSelf: "start",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: WHEEL_ITEM_HEIGHT,
    marginTop: WAVE_SEPARATOR_OFFSET,
    color: "#182845",
    fontSize: 22,
    fontWeight: 700,
  },
  wheelPicker: {
    display: "grid",
    gap: WHEEL_PICKER_GAP,
  },
  wheelPickerHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  wheelPickerLabel: {
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.4,
    color: "#182845",
    textAlign: "center",
  },
  wheelPickerBody: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "0.95fr 1.05fr",
    gap: 6,
    padding: `${WHEEL_BODY_VERTICAL_PADDING}px 10px`,
    borderRadius: 18,
    border: "1px solid #cad3e2",
    background: "#ffffff",
    overflow: "hidden",
  },
  wheelColumn: {
    position: "relative",
    height: WHEEL_VIEWPORT_HEIGHT,
    overflowY: "auto",
    overscrollBehavior: "contain",
    scrollPaddingBlock: WHEEL_CENTER_OFFSET,
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
    fontSize: 15,
    lineHeight: 1.4,
    fontWeight: 700,
    letterSpacing: "-0.01em",
    transition: "opacity 120ms ease, transform 120ms ease, color 120ms ease",
  },
  wheelItemActive: {
    opacity: 1,
    transform: "scale(1)",
    color: "#182845",
    fontWeight: 800,
  },
  wheelItemNear: {
    opacity: 0.72,
    transform: "scale(0.985)",
    color: "#44546d",
    fontWeight: 700,
  },
  wheelItemMid: {
    opacity: 0.48,
    transform: "scale(0.955)",
    color: "#6d7d94",
    fontWeight: 700,
  },
  wheelItemFar: {
    opacity: 0.24,
    transform: "scale(0.92)",
    color: "#7a889d",
    fontWeight: 700,
  },
  wheelHighlight: {
    position: "absolute",
    left: 8,
    right: 8,
    top: "50%",
    height: WHEEL_ITEM_HEIGHT,
    transform: "translateY(-50%)",
    borderRadius: 14,
    background: "rgba(24, 40, 69, 0.08)",
    border: "1px solid rgba(24, 40, 69, 0.06)",
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
  error: {
    color: "#b42318",
    fontSize: 13,
    lineHeight: 1.5,
  },
  submitError: {
    color: "#b42318",
    fontSize: 13,
    lineHeight: 1.5,
    margin: "16px 0 0",
  },
  submitButton: {
    marginTop: 18,
    minHeight: 52,
    width: "100%",
    borderRadius: 999,
    border: 0,
    background: "#1f5fd6",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 16,
    lineHeight: 1,
    cursor: "pointer",
  },
};

function getWheelItemStateStyle(distance: number): CSSProperties {
  if (distance === 0) {
    return styles.wheelItemActive;
  }

  if (distance === 1) {
    return styles.wheelItemNear;
  }

  if (distance === 2) {
    return styles.wheelItemMid;
  }

  return styles.wheelItemFar;
}

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

function normalizeDate(date: Date): Date {
  const next = new Date(date.getTime());
  next.setHours(0, 0, 0, 0);
  return next;
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

function toMeridiemAndHourValue(value: string): { meridiem: MeridiemOption; hour: Hour12Option } {
  const hour = Number(value.slice(0, 2));

  if (Number.isNaN(hour) || hour === 0) {
    return { meridiem: "오전", hour: "12" };
  }

  if (hour < 12) {
    return { meridiem: "오전", hour: String(hour) as Hour12Option };
  }

  if (hour === 12) {
    return { meridiem: "오후", hour: "12" };
  }

  return { meridiem: "오후", hour: String(hour - 12) as Hour12Option };
}

function fromMeridiemAndHourValue(meridiem: MeridiemOption, hour: Hour12Option): string {
  const numericHour = Number(hour);

  if (meridiem === "오전") {
    const hour24 = numericHour === 12 ? 0 : numericHour;
    return `${String(hour24).padStart(2, "0")}:00`;
  }

  const hour24 = numericHour === 12 ? 12 : numericHour + 12;
  return `${String(hour24).padStart(2, "0")}:00`;
}

function getHourSlotIndex(value: string): number {
  const { meridiem, hour } = toMeridiemAndHourValue(value);
  return MERIDIEM_OPTIONS.indexOf(meridiem) * HOUR_OPTIONS.length + HOUR_OPTIONS.indexOf(hour);
}

function getMeridiemIndexFromHourSlot(index: number): number {
  return index >= HOUR_OPTIONS.length ? 1 : 0;
}

function fromHourSlotIndex(index: number): string {
  const meridiem = MERIDIEM_OPTIONS[getMeridiemIndexFromHourSlot(index)];
  const hour = HOUR_SLOT_OPTIONS[index];
  return fromMeridiemAndHourValue(meridiem, hour);
}

function getScrollAlignedWheelIndex(scrollTop: number, wheelLength: number): number {
  return clamp(Math.floor((scrollTop + WHEEL_ITEM_HEIGHT / 2) / WHEEL_ITEM_HEIGHT), 0, wheelLength - 1);
}

function scheduleSnap(
  element: HTMLDivElement,
  wheelLength: number,
  timeoutRef: TimeoutRef,
  onSelect: (nextIndex: number) => void,
) {
  if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
  timeoutRef.current = window.setTimeout(() => {
    const snappedIndex = getScrollAlignedWheelIndex(element.scrollTop, wheelLength);
    onSelect(snappedIndex);
  }, 90);
}

function scrollColumnToValue(element: HTMLDivElement | null, index: number, behavior: ScrollBehavior = "smooth") {
  if (!element || index < 0) return;
  const targetTop = index * WHEEL_ITEM_HEIGHT;
  if (Math.abs(element.scrollTop - targetTop) < 1) return;
  element.scrollTo({ top: targetTop, behavior });
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
