"use client";

import React from "react";
import { addMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import Holidays from "date-holidays";
import {
  Day as DayPickerDay,
  DayFlag,
  DayPicker,
  Weekday as DayPickerWeekday,
  type DateRange,
  SelectionState,
  UI,
  type CalendarDay as DayModel,
  type DayButtonProps,
  type DayPickerProps,
  type DayProps,
  type WeekdayProps,
} from "react-day-picker";

type CalendarTouchHandlers = {
  onDaySelect?: (day: Date) => void;
  onRangeTouchStart?: (day: Date) => void;
  onRangeTouchMove?: (day: Date) => void;
  onRangeTouchEnd?: (day: Date | null, moved: boolean) => void;
};

type CalendarDayButtonTouchProps = {
  onDayPress?: (day: Date) => void;
};

type CalendarProps = DayPickerProps & CalendarTouchHandlers;

const koreanHolidays = new Holidays("KR");

const navButtonStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "1px solid #cad3e2",
  background: "#ffffff",
  color: "#35507c",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const baseStyles: CalendarProps["styles"] = {
  [UI.Root]: {
    width: "100%",
    fontFamily: "inherit",
    color: "#182845",
    touchAction: "pan-y",
  },
  [UI.Months]: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    width: "100%",
  },
  [UI.Month]: {
    width: "100%",
  },
  [UI.MonthCaption]: {
    display: "none",
  },
  [UI.Nav]: {
    display: "none",
  },
  [UI.MonthGrid]: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: "0 8px",
    tableLayout: "fixed",
  },
  [UI.Weekdays]: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    marginBottom: 6,
  },
  [UI.Weekday]: {
    color: "#61738d",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
  },
  [UI.Week]: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  },
  [UI.Day]: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 60,
    padding: 0,
    textAlign: "center",
  },
  [UI.DayButton]: {
    width: "100%",
    minHeight: 56,
    borderRadius: 16,
    border: 0,
    background: "transparent",
    color: "#182845",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    margin: 0,
    position: "relative",
    zIndex: 1,
  },
  [DayFlag.disabled]: {
    opacity: 1,
    color: "#98a2b3",
  },
  [DayFlag.outside]: {
    opacity: 1,
    color: "#98a2b3",
  },
  [DayFlag.today]: {
    color: "#0f3d91",
    fontWeight: 800,
  },
  [SelectionState.selected]: {
    background: "transparent",
  },
  [SelectionState.range_start]: {
    background: "transparent",
  },
  [SelectionState.range_middle]: {
    background: "transparent",
  },
  [SelectionState.range_end]: {
    background: "transparent",
  },
};

export function Calendar({ styles, ...props }: CalendarProps) {
  const {
    defaultMonth,
    month: controlledMonth,
    onMonthChange,
    onDaySelect,
    onRangeTouchStart,
    onRangeTouchMove,
    onRangeTouchEnd,
    ...restProps
  } = props;
  const selectedRange = props.mode === "range" ? (props.selected as DateRange | undefined) : undefined;
  const isControlled = controlledMonth !== undefined;
  const [uncontrolledMonth, setUncontrolledMonth] = useState<Date>(() =>
    normalizeMonth(defaultMonth ?? selectedRange?.from ?? new Date()),
  );
  const previousSelectedFromRef = useRef<number | null>(selectedRange?.from ? normalizeDate(selectedRange.from).getTime() : null);
  const touchDraggingRef = useRef(false);
  const touchMovedRef = useRef(false);
  const lastTouchedDayKeyRef = useRef<string | null>(null);
  const suppressClickRef = useRef(false);
  const suppressClickTimeoutRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const currentMonth = normalizeMonth(controlledMonth ?? uncontrolledMonth);

  useEffect(() => {
    if (isControlled || !selectedRange?.from) {
      previousSelectedFromRef.current = selectedRange?.from
        ? normalizeDate(selectedRange.from).getTime()
        : null;
      return;
    }

    if (touchDraggingRef.current) {
      return;
    }

    const selectedFromTime = normalizeDate(selectedRange.from).getTime();
    const hasSelectionChanged = previousSelectedFromRef.current !== selectedFromTime;
    previousSelectedFromRef.current = selectedFromTime;

    if (hasSelectionChanged) {
      const selectedMonth = normalizeMonth(selectedRange.from);
      setUncontrolledMonth(selectedMonth);
    }
  }, [isControlled, selectedRange?.from]);

  function updateMonth(nextMonth: Date) {
    const normalized = normalizeMonth(nextMonth);

    if (!isControlled) {
      setUncontrolledMonth(normalized);
    }

    onMonthChange?.(normalized);
  }

  useEffect(() => {
    const frameElement = frameRef.current;

    if (!frameElement) {
      return;
    }

    function getDayFromTarget(target: EventTarget | null): Date | null {
      const button = target instanceof Element ? target.closest<HTMLElement>("[data-calendar-day]") : null;

      if (!button || button.dataset.calendarDisabled === "true") {
        return null;
      }

      const dayKey = button.dataset.calendarDay;
      return dayKey ? parseDateKey(dayKey) : null;
    }

    function finishPointerInteraction(clientX: number, clientY: number) {
      const finalTouchedDay = getPointDayFromClient(clientX, clientY);
      const fallbackTouchedDay = lastTouchedDayKeyRef.current ? parseDateKey(lastTouchedDayKeyRef.current) : null;
      const settledDay = finalTouchedDay ?? fallbackTouchedDay;
      const didMove = touchMovedRef.current;

      if (didMove && settledDay) {
        emitTouchedDay(settledDay, "move");
      }

      touchDraggingRef.current = false;
      touchMovedRef.current = false;
      lastTouchedDayKeyRef.current = null;
      activePointerIdRef.current = null;
      onRangeTouchEnd?.(settledDay, didMove);
      if (suppressClickTimeoutRef.current !== null) {
        window.clearTimeout(suppressClickTimeoutRef.current);
      }
      if (!didMove) {
        suppressClickRef.current = false;
      } else {
        suppressClickTimeoutRef.current = window.setTimeout(() => {
          suppressClickRef.current = false;
          suppressClickTimeoutRef.current = null;
        }, 120);
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.pointerType !== "touch") {
        return;
      }

      const touchedDay = getDayFromTarget(event.target) ?? getPointDayFromClient(event.clientX, event.clientY);

      if (!touchedDay) {
        return;
      }

      activePointerIdRef.current = event.pointerId;
      touchDraggingRef.current = true;
      touchMovedRef.current = false;
      suppressClickRef.current = true;
      emitTouchedDay(touchedDay, "start");
    }

    function handlePointerMove(event: PointerEvent) {
      if (!touchDraggingRef.current || event.pointerType !== "touch" || activePointerIdRef.current !== event.pointerId) {
        return;
      }

      const touchedDay = getPointDayFromClient(event.clientX, event.clientY);

      if (!touchedDay) {
        return;
      }

      touchMovedRef.current = true;
      emitTouchedDay(touchedDay, "move");
    }

    function handlePointerEnd(event: PointerEvent) {
      if (!touchDraggingRef.current || event.pointerType !== "touch" || activePointerIdRef.current !== event.pointerId) {
        return;
      }

      finishPointerInteraction(event.clientX, event.clientY);
    }

    frameElement.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      frameElement.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [onRangeTouchEnd, onRangeTouchStart, onRangeTouchMove]);

  useEffect(() => {
    return () => {
      if (suppressClickTimeoutRef.current !== null) {
        window.clearTimeout(suppressClickTimeoutRef.current);
      }
    };
  }, []);

  function emitTouchedDay(day: Date, phase: "start" | "move") {
    const dayKey = formatDateKey(day);

    if (lastTouchedDayKeyRef.current === dayKey && phase === "move") {
      return;
    }

      lastTouchedDayKeyRef.current = dayKey;

    if (phase === "start") {
      onRangeTouchStart?.(day);
      return;
    }

    suppressClickRef.current = true;
    onRangeTouchMove?.(day);
  }

  function getPointDayFromClient(clientX: number, clientY: number): Date | null {
    const element = document.elementFromPoint(clientX, clientY);
    const button = element?.closest<HTMLElement>("[data-calendar-day]");

    if (!button || button.dataset.calendarDisabled === "true") {
      return null;
    }

    const dayKey = button.dataset.calendarDay;
    return dayKey ? parseDateKey(dayKey) : null;
  }

  return (
    <div ref={frameRef} style={calendarFrameStyle}>
      <div style={calendarHeaderStyle}>
        <button type="button" style={navButtonStyle} onClick={() => updateMonth(addMonths(currentMonth, -1))} aria-label="이전 달">
          &lt;
        </button>
        <strong style={calendarTitleStyle}>{formatMonthLabel(currentMonth)}</strong>
        <button type="button" style={navButtonStyle} onClick={() => updateMonth(addMonths(currentMonth, 1))} aria-label="다음 달">
          &gt;
        </button>
      </div>

      <DayPicker
        components={{
          Day: (dayProps) => <CalendarDay {...dayProps} selectedRange={selectedRange} />,
          DayButton: (buttonProps) => (
            <CalendarDayButton
              {...buttonProps}
              selectedRange={selectedRange}
              onDayPress={(day) => {
                if (suppressClickRef.current) {
                  return;
                }

                onDaySelect?.(day);
              }}
            />
          ),
          Weekday: CalendarWeekday,
        }}
        locale={ko}
        month={currentMonth}
        onMonthChange={updateMonth}
        hideNavigation
        fixedWeeks
        showOutsideDays
        weekStartsOn={1}
        styles={mergeStyles(baseStyles, styles)}
        {...restProps}
      />
    </div>
  );
}

function mergeStyles(
  defaults: CalendarProps["styles"],
  overrides: CalendarProps["styles"],
): CalendarProps["styles"] {
  if (!overrides) {
    return defaults;
  }

  const merged = { ...defaults };

  for (const key of Object.keys(overrides)) {
    const typedKey = key as keyof NonNullable<CalendarProps["styles"]>;
    merged[typedKey] = {
      ...(defaults?.[typedKey] as CSSProperties | undefined),
      ...(overrides?.[typedKey] as CSSProperties | undefined),
    };
  }

  return merged;
}

function CalendarDayButton({
  day,
  modifiers,
  style,
  selectedRange,
  onDayPress,
  ...props
}: DayButtonProps &
  CalendarDayButtonTouchProps & {
    selectedRange?: DateRange;
  }) {
  const isEndpoint = isSelectedEndpoint(day, selectedRange);
  const isRangeMiddle = isSelectedRangeMiddle(day.date, selectedRange);
  const isDisabled = Boolean(modifiers[DayFlag.disabled] || modifiers.disabled);
  const isOutside = Boolean(modifiers[DayFlag.outside] || modifiers.outside);
  const dayOfWeek = day.date.getDay();
  const holidayLabel = getDisplayHolidayLabel(day.date);
  const holidayName = holidayLabel?.text ?? null;
  const isHoliday = Boolean(holidayName);
  const weekendColor = dayOfWeek === 0 ? "#d92d20" : dayOfWeek === 6 ? "#175cd3" : "#182845";
  const baseDayColor = isHoliday ? "#d92d20" : weekendColor;
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (modifiers.focused) {
      buttonRef.current?.focus();
    }
  }, [modifiers.focused]);

  return (
    <button
      ref={buttonRef}
      {...props}
      data-calendar-day={formatDateKey(day.date)}
      data-calendar-disabled={isDisabled ? "true" : "false"}
      style={{
        ...style,
        background: isEndpoint ? "#2f6df6" : "transparent",
        color: isDisabled || isOutside ? "#98a2b3" : isEndpoint ? "#ffffff" : isRangeMiddle ? "#55657d" : baseDayColor,
        borderRadius: "50%",
        boxShadow: isEndpoint ? "0 10px 22px rgba(47, 109, 246, 0.22)" : "none",
        cursor: isDisabled ? "default" : style?.cursor ?? "pointer",
        opacity: 1,
        fontWeight: isOutside ? 500 : style?.fontWeight,
        display: "grid",
        alignContent: "center",
        justifyItems: "center",
        gap: holidayName ? 2 : 0,
        touchAction: "pan-y",
      }}
      onClick={(event) => {
        props.onClick?.(event);
        if (isDisabled) {
          event.preventDefault();
          return;
        }

        onDayPress?.(day.date);
      }}
    >
      <span>{day.date.getDate()}</span>
      {holidayName ? (
        <span
          style={{
            fontSize: holidayLabel?.truncated ? 8 : 8.5,
            lineHeight: 1.2,
            fontWeight: isOutside ? 500 : 700,
            color: isDisabled || isOutside ? "#98a2b3" : isEndpoint ? "#ffffff" : "#d92d20",
            width: "100%",
            padding: "0 1px",
            whiteSpace: "normal",
            wordBreak: "keep-all",
            textAlign: "center",
          }}
        >
          {holidayName}
        </span>
      ) : null}
    </button>
  );
}

function CalendarWeekday({ children, style, ...props }: WeekdayProps) {
  return (
    <DayPickerWeekday
      style={{
        ...style,
        color: "#61738d",
      }}
      {...props}
    >
      {children}
    </DayPickerWeekday>
  );
}

function getDisplayHolidayLabel(date: Date): { text: string; truncated: boolean } | null {
  const holidayName = getKoreanHolidayName(date);

  if (!holidayName) {
    return null;
  }

  if (holidayName.length <= 5) {
    return { text: holidayName, truncated: false };
  }

  return { text: `${holidayName.slice(0, 3)}...`, truncated: true };
}

function getKoreanHolidayName(date: Date): string | null {
  const holiday = koreanHolidays.isHoliday(formatDateKey(date));

  if (!holiday) {
    return null;
  }

  const firstHoliday = Array.isArray(holiday) ? holiday[0] : holiday;
  return firstHoliday?.name ?? null;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string): Date | null {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function CalendarDay({ day, modifiers, children, style, selectedRange, ...props }: DayProps & { selectedRange?: DateRange }) {
  const isRangeMiddle = isSelectedRangeMiddle(day.date, selectedRange);

  return (
    <DayPickerDay
      day={day}
      modifiers={modifiers}
      style={{
        ...style,
        position: "relative",
      }}
      {...props}
    >
      {isRangeMiddle ? <div style={rangeBarStyle} /> : null}
      {children}
    </DayPickerDay>
  );
}

function isSelectedEndpoint(
  day: DayModel,
  selectedRange?: DateRange,
): boolean {
  const dayTime = normalizeDate(day.date).getTime();
  const fromTime = selectedRange?.from ? normalizeDate(selectedRange.from).getTime() : undefined;
  const toTime = selectedRange?.to ? normalizeDate(selectedRange.to).getTime() : undefined;

  if (fromTime !== undefined && dayTime === fromTime) {
    return true;
  }

  if (toTime !== undefined && dayTime === toTime) {
    return true;
  }

  return false;
}

function isSelectedRangeMiddle(day: Date, selectedRange?: DateRange): boolean {
  if (!selectedRange?.from || !selectedRange.to) {
    return false;
  }

  const dayTime = normalizeDate(day).getTime();
  const fromTime = normalizeDate(selectedRange.from).getTime();
  const toTime = normalizeDate(selectedRange.to).getTime();

  if (fromTime === toTime) {
    return false;
  }

  return dayTime > Math.min(fromTime, toTime) && dayTime < Math.max(fromTime, toTime);
}

function normalizeDate(date: Date): Date {
  const next = new Date(date.getTime());
  next.setHours(0, 0, 0, 0);
  return next;
}

function normalizeMonth(date: Date): Date {
  const next = new Date(date.getTime());
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isSameMonth(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function formatMonthLabel(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

const rangeBarStyle: CSSProperties = {
  position: "absolute",
  left: -2,
  right: -2,
  top: "50%",
  transform: "translateY(-50%)",
  height: 30,
  background: "#e5e7eb",
  borderRadius: 0,
  pointerEvents: "none",
};

const calendarFrameStyle: CSSProperties = {
  width: "100%",
  overflow: "hidden",
  touchAction: "pan-y",
  overscrollBehavior: "auto",
};

const calendarHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 12,
};

const calendarTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#182845",
};
