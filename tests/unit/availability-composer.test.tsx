import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import React from "react";
import type { CSSProperties } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AvailabilityComposer } from "../../src/components/availability-composer.js";

type TestContext = {
  cleanup: () => void;
  container: HTMLElement;
  getSlot: (key: string) => HTMLButtonElement;
  getSelectedCount: () => number;
  getSummaryItems: () => string[];
  pointerDown: (slotKey: string) => void;
  pointerEnter: (slotKey: string) => void;
  pointerUp: () => void;
};

function setup(): TestContext {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  const { window } = dom;
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousHTMLElement = globalThis.HTMLElement;
  const previousEvent = globalThis.Event;
  const previousMouseEvent = globalThis.MouseEvent;
  const previousPointerEvent = globalThis.PointerEvent;
  const previousNavigator = globalThis.navigator;

  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Event: window.Event,
    MouseEvent: window.MouseEvent,
    PointerEvent: window.MouseEvent,
  });

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: window.navigator,
  });

  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
  });

  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = function noop() {};
  }

  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = function noop() {};
  }

  const container = window.document.createElement("div");
  window.document.body.appendChild(container);

  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(<AvailabilityComposer />);
  });

  function getSlot(key: string): HTMLButtonElement {
    const element = container.querySelector(`[data-slot-key="${key}"]`);
    assert.ok(element instanceof window.HTMLButtonElement, `slot ${key} should exist`);
    return element;
  }

  function pointerDown(slotKey: string) {
    const slot = getSlot(slotKey);
    act(() => {
      slot.dispatchEvent(
        new window.MouseEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX: 10,
          clientY: 10,
        }),
      );
    });
  }

  function pointerEnter(slotKey: string) {
    const slot = getSlot(slotKey);
    act(() => {
      slot.dispatchEvent(
        new window.MouseEvent("pointerenter", {
          bubbles: false,
          cancelable: true,
          composed: true,
        }),
      );

      slot.dispatchEvent(
        new window.MouseEvent("pointerover", {
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      );
    });
  }

  function pointerUp() {
    act(() => {
      window.dispatchEvent(
        new window.MouseEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      );
    });
  }

  function getSelectedCount(): number {
    const value = container.querySelector("[data-selected-count]");
    assert.ok(value, "selected count element should exist");
    return Number.parseInt(value.textContent ?? "", 10);
  }

  function getSummaryItems(): string[] {
    return Array.from(container.querySelectorAll("li")).map((item) => item.textContent ?? "");
  }

  return {
    container,
    getSlot,
    getSelectedCount,
    getSummaryItems,
    pointerDown,
    pointerEnter,
    pointerUp,
    cleanup: () => {
      act(() => {
        root.unmount();
      });

      dom.window.close();

      Object.assign(globalThis, {
        window: previousWindow,
        document: previousDocument,
        HTMLElement: previousHTMLElement,
        Event: previousEvent,
        MouseEvent: previousMouseEvent,
        PointerEvent: previousPointerEvent,
      });

      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: previousNavigator,
      });

      Object.assign(globalThis, {
        IS_REACT_ACT_ENVIRONMENT: undefined,
      });
    },
  };
}

function backgroundColorOf(button: HTMLButtonElement): string {
  return (button.style as CSSStyleDeclaration & CSSProperties).backgroundColor;
}

test("단일 슬롯 클릭은 선택 수를 1 증가시킨다", () => {
  const app = setup();

  try {
    assert.equal(app.getSelectedCount(), 5);

    app.pointerDown("mon-0");
    app.pointerUp();

    assert.equal(app.getSelectedCount(), 6);
    assert.equal(backgroundColorOf(app.getSlot("mon-0")), "rgb(15, 61, 145)");
    assert.ok(app.getSummaryItems().some((item) => item.includes("03/23")));
  } finally {
    app.cleanup();
  }
});

test("빈 슬롯 드래그는 시작점과 끝점 사이 직사각형을 채운다", () => {
  const app = setup();

  try {
    app.pointerDown("tue-10");
    app.pointerEnter("thu-11");
    app.pointerUp();

    assert.equal(app.getSelectedCount(), 11);
    assert.equal(backgroundColorOf(app.getSlot("tue-10")), "rgb(15, 61, 145)");
    assert.equal(backgroundColorOf(app.getSlot("wed-10")), "rgb(15, 61, 145)");
    assert.equal(backgroundColorOf(app.getSlot("thu-11")), "rgb(15, 61, 145)");
    assert.ok(app.getSummaryItems().some((item) => item.includes("03/24")));
    assert.ok(app.getSummaryItems().some((item) => item.includes("03/25")));
    assert.ok(app.getSummaryItems().some((item) => item.includes("03/26")));
  } finally {
    app.cleanup();
  }
});

test("선택된 슬롯 드래그는 직사각형 전체를 지운다", () => {
  const app = setup();

  try {
    app.pointerDown("wed-7");
    app.pointerEnter("fri-7");
    app.pointerUp();

    assert.equal(app.getSelectedCount(), 2);
    assert.equal(backgroundColorOf(app.getSlot("wed-7")), "rgb(199, 204, 214)");
    assert.equal(backgroundColorOf(app.getSlot("thu-7")), "rgb(199, 204, 214)");
    assert.equal(backgroundColorOf(app.getSlot("fri-7")), "rgb(199, 204, 214)");
    assert.equal(app.getSummaryItems().length, 1);
    assert.ok(app.getSummaryItems()[0]?.includes("03/22"));
  } finally {
    app.cleanup();
  }
});
