"use client";

import React from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

export type AvailabilityComposerDay = {
  key: string;
  labelKo: string;
  shortLabelKo: string;
  monthDay: string;
};

type Slot = {
  key: string;
  dayKey: string;
  row: number;
  col: number;
  label: string;
};

type DragMode = "fill" | "erase";

type DragState = {
  anchor: Slot;
  current: Slot;
  mode: DragMode;
};

export const DEFAULT_DAYS: AvailabilityComposerDay[] = [
  { key: "sun", labelKo: "일요일", shortLabelKo: "일", monthDay: "03/22" },
  { key: "mon", labelKo: "월요일", shortLabelKo: "월", monthDay: "03/23" },
  { key: "tue", labelKo: "화요일", shortLabelKo: "화", monthDay: "03/24" },
  { key: "wed", labelKo: "수요일", shortLabelKo: "수", monthDay: "03/25" },
  { key: "thu", labelKo: "목요일", shortLabelKo: "목", monthDay: "03/26" },
  { key: "fri", labelKo: "금요일", shortLabelKo: "금", monthDay: "03/27" },
  { key: "sat", labelKo: "토요일", shortLabelKo: "토", monthDay: "03/28" },
];

export const DEFAULT_TIME_LABELS = [
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
  "5:00 PM",
];

export const DEFAULT_RANGE_END_LABELS = [
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
  "5:00 PM",
  "5:30 PM",
];

export const DEFAULT_SELECTED_KEYS = ["sun-2", "sun-3", "wed-7", "thu-7", "fri-7"];

const AVAILABLE_COLOR = "#0f3d91";
const UNAVAILABLE_COLOR = "#c7ccd6";

export interface AvailabilityComposerProps {
  days?: AvailabilityComposerDay[];
  timeLabels?: string[];
  rangeEndLabels?: string[];
  defaultSelectedKeys?: string[];
  selectedKeys?: string[];
  onSelectionChange?: (selectedKeys: string[]) => void;
  title?: string;
  description?: string;
  eyebrow?: string;
  availableLabel?: string;
  unavailableLabel?: string;
  summaryTitle?: string;
  emptySummaryText?: string;
}

function buildSlots(days: AvailabilityComposerDay[], timeLabels: string[]): Slot[] {
  return days.flatMap((day, col) =>
    timeLabels.map((label, row) => ({
      key: `${day.key}-${row}`,
      dayKey: day.key,
      row,
      col,
      label,
    })),
  );
}

function getRectangleKeys(anchor: Slot, current: Slot, slots: Slot[]): Set<string> {
  const minCol = Math.min(anchor.col, current.col);
  const maxCol = Math.max(anchor.col, current.col);
  const minRow = Math.min(anchor.row, current.row);
  const maxRow = Math.max(anchor.row, current.row);

  return new Set(
    slots
      .filter((slot) => slot.col >= minCol && slot.col <= maxCol && slot.row >= minRow && slot.row <= maxRow)
      .map((slot) => slot.key),
  );
}

function buildSelection(base: Set<string>, drag: DragState | null, slots: Slot[]): Set<string> {
  if (!drag) {
    return new Set(base);
  }

  const rectangleKeys = getRectangleKeys(drag.anchor, drag.current, slots);
  const next = new Set(base);

  for (const key of rectangleKeys) {
    if (drag.mode === "fill") {
      next.add(key);
    } else {
      next.delete(key);
    }
  }

  return next;
}

function formatRange(
  slotKeys: Set<string>,
  days: AvailabilityComposerDay[],
  slots: Slot[],
  timeLabels: string[],
  rangeEndLabels: string[],
): string[] {
  return days.flatMap((day) => {
    const rows = slots
      .filter((slot) => slot.dayKey === day.key && slotKeys.has(slot.key))
      .map((slot) => slot.row)
      .sort((left, right) => left - right);

    if (rows.length === 0) {
      return [];
    }

    const groups: Array<{ start: number; end: number }> = [];

    for (const row of rows) {
      const previous = groups.at(-1);

      if (!previous || row !== previous.end + 1) {
        groups.push({ start: row, end: row });
        continue;
      }

      previous.end = row;
    }

    return groups.map(({ start, end }) => {
      const startLabel = timeLabels[start];
      const endLabel = rangeEndLabels[end] ?? timeLabels[end];
      return `${day.monthDay} ${day.shortLabelKo} ${startLabel} - ${endLabel}`;
    });
  });
}

function getSlotFromElement(target: EventTarget | null, slotByKey: Map<string, Slot>): Slot | null {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const cell = target.closest<HTMLElement>("[data-slot-key]");
  if (!cell) {
    return null;
  }

  return slotByKey.get(cell.dataset.slotKey ?? "") ?? null;
}

export function AvailabilityComposer({
  days = DEFAULT_DAYS,
  timeLabels = DEFAULT_TIME_LABELS,
  rangeEndLabels = DEFAULT_RANGE_END_LABELS,
  defaultSelectedKeys = DEFAULT_SELECTED_KEYS,
  selectedKeys,
  onSelectionChange,
  title = "사각형 드래그 일정 등록",
  description = "시작 슬롯이 채우기인지 지우기인지를 결정하고, 드래그 동안 시작점과 현재 위치 사이의 직사각형 전체를 같은 상태로 반영합니다.",
  eyebrow = "When2Meet 역설계",
  availableLabel = "가능",
  unavailableLabel = "불가",
  summaryTitle = "병합된 시간대",
  emptySummaryText = "선택된 가능 시간이 없습니다.",
}: AvailabilityComposerProps) {
  const slots = useMemo(() => buildSlots(days, timeLabels), [days, timeLabels]);
  const slotByKey = useMemo(() => new Map(slots.map((slot) => [slot.key, slot])), [slots]);
  const [internalSelected, setInternalSelected] = useState<Set<string>>(() => new Set(defaultSelectedKeys));
  const [drag, setDrag] = useState<DragState | null>(null);
  const [isReady, setIsReady] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const ignoreSyntheticClickRef = useRef(false);
  const isControlled = selectedKeys !== undefined;

  const resolvedSelected = useMemo(
    () => new Set(isControlled ? selectedKeys : Array.from(internalSelected)),
    [internalSelected, isControlled, selectedKeys],
  );
  const selectedRef = useRef(resolvedSelected);

  selectedRef.current = resolvedSelected;

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  useEffect(() => {
    setIsReady(true);
  }, []);

  const preview = useMemo(() => buildSelection(resolvedSelected, drag, slots), [drag, resolvedSelected, slots]);
  const summary = useMemo(
    () => formatRange(preview, days, slots, timeLabels, rangeEndLabels),
    [days, preview, rangeEndLabels, slots, timeLabels],
  );

  function commitSelection(next: Set<string>) {
    if (!isControlled) {
      setInternalSelected(next);
    }

    onSelectionChange?.(
      slots.filter((slot) => next.has(slot.key)).map((slot) => slot.key),
    );
  }

  useEffect(() => {
    function releaseSyntheticClickGuardSoon() {
      window.setTimeout(() => {
        ignoreSyntheticClickRef.current = false;
      }, 0);
    }

    function commitDrag() {
      const currentDrag = dragRef.current;
      if (!currentDrag) {
        return;
      }

      ignoreSyntheticClickRef.current = true;
      commitSelection(buildSelection(selectedRef.current, currentDrag, slots));
      setDrag(null);
      dragRef.current = null;
      releaseSyntheticClickGuardSoon();
    }

    function cancelWindowDrag() {
      if (!dragRef.current) {
        return;
      }

      setDrag(null);
      dragRef.current = null;
      releaseSyntheticClickGuardSoon();
    }

    function updateDragFromPoint(event: PointerEvent) {
      const currentDrag = dragRef.current;
      if (!currentDrag) {
        return;
      }

      const slot = getSlotFromElement(document.elementFromPoint(event.clientX, event.clientY), slotByKey);
      if (!slot || slot.key === currentDrag.current.key) {
        return;
      }

      const nextDrag = { ...currentDrag, current: slot };
      dragRef.current = nextDrag;
      setDrag(nextDrag);
    }

    window.addEventListener("pointermove", updateDragFromPoint);
    window.addEventListener("pointerup", commitDrag);
    window.addEventListener("pointercancel", cancelWindowDrag);

    return () => {
      window.removeEventListener("pointermove", updateDragFromPoint);
      window.removeEventListener("pointerup", commitDrag);
      window.removeEventListener("pointercancel", cancelWindowDrag);
    };
  }, [onSelectionChange, slotByKey, slots]);

  function startDrag(slot: Slot, event: ReactPointerEvent<HTMLButtonElement>) {
    const mode: DragMode = selectedRef.current.has(slot.key) ? "erase" : "fill";
    const nextDrag = { anchor: slot, current: slot, mode };

    ignoreSyntheticClickRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function updateDragFromHover(slot: Slot) {
    const currentDrag = dragRef.current;
    if (!currentDrag || currentDrag.current.key === slot.key) {
      return;
    }

    const nextDrag = { ...currentDrag, current: slot };
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function finishDrag() {
    const currentDrag = dragRef.current;
    if (!currentDrag) {
      return;
    }

    ignoreSyntheticClickRef.current = true;
    commitSelection(buildSelection(selectedRef.current, currentDrag, slots));
    setDrag(null);
    dragRef.current = null;

    window.setTimeout(() => {
      ignoreSyntheticClickRef.current = false;
    }, 0);
  }

  function cancelDrag() {
    if (!dragRef.current) {
      return;
    }

    setDrag(null);
    dragRef.current = null;

    window.setTimeout(() => {
      ignoreSyntheticClickRef.current = false;
    }, 0);
  }

  function toggleSingleSlot(slot: Slot) {
    const next = new Set(selectedRef.current);

    if (next.has(slot.key)) {
      next.delete(slot.key);
    } else {
      next.add(slot.key);
    }

    commitSelection(next);
  }

  function handleFallbackClick(slot: Slot) {
    if (ignoreSyntheticClickRef.current) {
      ignoreSyntheticClickRef.current = false;
      return;
    }

    toggleSingleSlot(slot);
  }

  return (
    <section data-composer-ready={isReady ? "true" : "false"} style={styles.shell}>
      <div style={styles.header}>
        <div style={styles.headerCopy}>
          <p style={styles.eyebrow}>{eyebrow}</p>
          <h1 style={styles.title}>{title}</h1>
          <p style={styles.description}>{description}</p>
        </div>

        <div style={styles.legendCard}>
          <div style={styles.legendRow}>
            <span style={{ ...styles.swatch, backgroundColor: UNAVAILABLE_COLOR }} />
            <span>{unavailableLabel}</span>
          </div>
          <div style={styles.legendRow}>
            <span style={{ ...styles.swatch, backgroundColor: AVAILABLE_COLOR }} />
            <span>{availableLabel}</span>
          </div>
          <p style={styles.legendHint}>
            드래그 모드: {drag ? (drag.mode === "fill" ? "사각형 채우기" : "사각형 지우기") : "대기 중"}
          </p>
        </div>
      </div>

      <div style={styles.boardScroller}>
        <div style={{ ...styles.board, gridTemplateColumns: `132px repeat(${days.length}, minmax(58px, 1fr))` }}>
          <div style={styles.corner} />
          {days.map((day) => (
            <div key={day.key} style={styles.dayHeader}>
              <span style={styles.dayDate}>{day.monthDay}</span>
              <span style={styles.dayName}>{day.shortLabelKo}</span>
            </div>
          ))}

          {timeLabels.map((timeLabel, row) => (
            <div key={timeLabel} style={{ display: "contents" }}>
              <div style={styles.timeLabel}>
                <span style={styles.timeDivider} />
                {row % 2 === 0 ? <span style={styles.timeLabelText}>{timeLabel}</span> : null}
              </div>

              {days.map((day, col) => {
                const slot = slots[row + col * timeLabels.length];
                const isSelected = preview.has(slot.key);
                const isThirtyMinuteBoundary = row % 2 === 1;
                const borderTopColor = isThirtyMinuteBoundary ? "#9aa7bb" : "#ffffff";

                return (
                  <button
                    key={slot.key}
                    type="button"
                    data-slot-key={slot.key}
                    aria-label={`${day.labelKo} ${timeLabel}`}
                    onPointerDown={(event) => startDrag(slot, event)}
                    onPointerEnter={() => updateDragFromHover(slot)}
                    onPointerMove={() => updateDragFromHover(slot)}
                    onPointerUp={finishDrag}
                    onPointerCancel={cancelDrag}
                    onLostPointerCapture={finishDrag}
                    onClick={() => handleFallbackClick(slot)}
                    style={{
                      ...styles.cell,
                      backgroundColor: isSelected ? AVAILABLE_COLOR : UNAVAILABLE_COLOR,
                      borderTopStyle: isThirtyMinuteBoundary ? "dashed" : "solid",
                      borderTopColor,
                      boxShadow: "inset 1px 0 0 #8f9db3, inset -1px 0 0 #8f9db3, inset 0 -1px 0 #8f9db3",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div style={styles.footer}>
        <div style={styles.summaryCard}>
          <p style={styles.summaryTitle}>선택된 슬롯</p>
          <p data-selected-count={preview.size} style={styles.summaryValue}>
            {preview.size}칸
          </p>
        </div>

        <div style={styles.summaryListCard}>
          <p style={styles.summaryTitle}>{summaryTitle}</p>
          {summary.length === 0 ? (
            <p style={styles.emptyText}>{emptySummaryText}</p>
          ) : (
            <ul style={styles.summaryList}>
              {summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: {
    maxWidth: 420,
    margin: "0 auto",
    padding: "20px 0 8px",
  },
  header: {
    display: "grid",
    gap: 12,
    marginBottom: 16,
  },
  headerCopy: {
    minWidth: 0,
  },
  eyebrow: {
    margin: 0,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontSize: 12,
    color: "#35507c",
  },
  title: {
    margin: "8px 0 12px",
    fontSize: "clamp(1.6rem, 6vw, 2.2rem)",
    lineHeight: 1.04,
  },
  description: {
    margin: 0,
    maxWidth: "100%",
    fontSize: 15,
    lineHeight: 1.6,
    color: "#45556f",
  },
  legendCard: {
    minWidth: 0,
    padding: 16,
    border: "1px solid #dde3ea",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
  },
  legendRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 15,
    marginBottom: 10,
  },
  swatch: {
    width: 28,
    height: 18,
    border: "1px solid #20304b",
    display: "inline-block",
    borderRadius: 4,
  },
  legendHint: {
    margin: "10px 0 0",
    fontSize: 14,
    color: "#5b6778",
  },
  boardScroller: {
    overflowX: "auto",
    paddingBottom: 6,
  },
  board: {
    display: "grid",
    backgroundColor: "#ffffff",
    boxShadow: "0 18px 40px rgba(33, 50, 84, 0.08)",
    borderRadius: 18,
    minWidth: 538,
    overflow: "hidden",
  },
  corner: {
    minHeight: 62,
    backgroundColor: "#ffffff",
  },
  dayHeader: {
    minHeight: 62,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
  },
  dayDate: {
    fontSize: 12,
    color: "#526176",
  },
  dayName: {
    fontSize: 18,
    lineHeight: 1,
  },
  timeLabel: {
    minHeight: 28,
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "stretch",
    backgroundColor: "#ffffff",
    overflow: "visible",
    position: "relative",
    paddingLeft: 12,
    paddingRight: 16,
  },
  timeLabelText: {
    position: "absolute",
    right: 16,
    top: 0,
    transform: "translateY(-50%)",
    color: "#526176",
    fontSize: 13,
    whiteSpace: "nowrap",
    lineHeight: 1,
    zIndex: 1,
  },
  timeDivider: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#8f9db3",
  },
  cell: {
    minHeight: 28,
    border: 0,
    borderTopWidth: 1,
    borderTopStyle: "solid",
    borderTopColor: "#ffffff",
    borderLeft: "1px solid transparent",
    borderRight: "1px solid transparent",
    borderBottom: "1px solid transparent",
    cursor: "crosshair",
    padding: 0,
    touchAction: "none",
    outline: "none",
    borderRadius: 0,
    WebkitTapHighlightColor: "transparent",
  },
  footer: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 12,
    marginTop: 16,
  },
  summaryCard: {
    padding: 18,
    border: "1px solid #dde3ea",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
  },
  summaryListCard: {
    padding: 18,
    border: "1px solid #dde3ea",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
  },
  summaryTitle: {
    margin: 0,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "#35507c",
  },
  summaryValue: {
    margin: "10px 0 0",
    fontSize: 28,
    lineHeight: 1,
  },
  summaryList: {
    margin: "10px 0 0",
    paddingLeft: 18,
    lineHeight: 1.8,
  },
  emptyText: {
    margin: "10px 0 0",
    color: "#5b6778",
  },
};
