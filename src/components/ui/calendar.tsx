"use client";

import { addMonths } from "date-fns";
import { ko } from "date-fns/locale";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import {
  Day as DayPickerDay,
  DayButton as DayPickerDayButton,
  DayFlag,
  DayPicker,
  type DateRange,
  SelectionState,
  UI,
  type CalendarDay as DayModel,
  type DayButtonProps,
  type DayPickerProps,
  type DayProps,
} from "react-day-picker";

type CalendarProps = DayPickerProps;

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
    minHeight: 48,
    padding: 0,
    textAlign: "center",
  },
  [UI.DayButton]: {
    width: 44,
    height: 44,
    borderRadius: "50%",
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
    opacity: 0.32,
  },
  [DayFlag.outside]: {
    opacity: 0.32,
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
  const { defaultMonth, month: controlledMonth, onMonthChange, ...restProps } = props;
  const selectedRange = props.mode === "range" ? (props.selected as DateRange | undefined) : undefined;
  const isControlled = controlledMonth !== undefined;
  const [uncontrolledMonth, setUncontrolledMonth] = useState<Date>(() =>
    normalizeMonth(defaultMonth ?? selectedRange?.from ?? new Date()),
  );
  const previousSelectedFromRef = useRef<number | null>(selectedRange?.from ? normalizeDate(selectedRange.from).getTime() : null);

  const currentMonth = normalizeMonth(controlledMonth ?? uncontrolledMonth);

  useEffect(() => {
    if (isControlled || !selectedRange?.from) {
      previousSelectedFromRef.current = selectedRange?.from
        ? normalizeDate(selectedRange.from).getTime()
        : null;
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

  return (
    <div style={calendarFrameStyle}>
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
          Day: CalendarDay,
          DayButton: (buttonProps) => (
            <CalendarDayButton {...buttonProps} selectedRange={selectedRange} />
          ),
        }}
        locale={ko}
        month={currentMonth}
        onMonthChange={updateMonth}
        hideNavigation
        fixedWeeks
        showOutsideDays={false}
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
  ...props
}: DayButtonProps & { selectedRange?: DateRange }) {
  const isEndpoint = isSelectedEndpoint(day, modifiers, selectedRange);
  const isRangeMiddle = Boolean(modifiers[SelectionState.range_middle]);

  return (
    <DayPickerDayButton
      day={day}
      modifiers={modifiers}
      style={{
        ...style,
        background: isEndpoint ? "#2f6df6" : "transparent",
        color: isEndpoint ? "#ffffff" : isRangeMiddle ? "#55657d" : "#182845",
        borderRadius: "50%",
        boxShadow: isEndpoint ? "0 10px 22px rgba(47, 109, 246, 0.22)" : "none",
      }}
      {...props}
    />
  );
}

function CalendarDay({ modifiers, children, style, ...props }: DayProps) {
  const isRangeMiddle = Boolean(modifiers[SelectionState.range_middle]);

  return (
    <DayPickerDay
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
  modifiers: DayButtonProps["modifiers"],
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

  if (modifiers[SelectionState.range_start] || modifiers[SelectionState.range_end]) {
    return true;
  }

  if (modifiers[SelectionState.selected] && !modifiers[SelectionState.range_middle]) {
    return true;
  }

  return Boolean(modifiers.selected && !modifiers.range_middle);
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
