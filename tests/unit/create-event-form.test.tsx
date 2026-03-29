import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CreateEventForm } from "../../src/components/create-event-form.js";

type RenderedForm = {
  cleanup: () => void;
  container: HTMLElement;
};

function setup(): RenderedForm {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  const { window } = dom;
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousHTMLElement = globalThis.HTMLElement;
  const previousNavigator = globalThis.navigator;
  const previousScrollTo = window.HTMLElement.prototype.scrollTo;
  const previousAttachEvent = (window.HTMLElement.prototype as HTMLElement & {
    attachEvent?: (name: string, listener: EventListener) => void;
    detachEvent?: (name: string, listener: EventListener) => void;
  }).attachEvent;
  const previousDetachEvent = (window.HTMLElement.prototype as HTMLElement & {
    attachEvent?: (name: string, listener: EventListener) => void;
    detachEvent?: (name: string, listener: EventListener) => void;
  }).detachEvent;

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

  window.HTMLElement.prototype.scrollTo = function scrollTo(options: ScrollToOptions | number, y?: number) {
    if (typeof options === "number") {
      (this as HTMLElement).scrollTop = y ?? 0;
      return;
    }

    (this as HTMLElement).scrollTop = options.top ?? 0;
  };

  (window.HTMLElement.prototype as HTMLElement & {
    attachEvent?: (name: string, listener: EventListener) => void;
    detachEvent?: (name: string, listener: EventListener) => void;
  }).attachEvent = function attachEvent() {};

  (window.HTMLElement.prototype as HTMLElement & {
    attachEvent?: (name: string, listener: EventListener) => void;
    detachEvent?: (name: string, listener: EventListener) => void;
  }).detachEvent = function detachEvent() {};

  const container = window.document.createElement("div");
  window.document.body.appendChild(container);

  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(<CreateEventForm variant="home" />);
  });

  return {
    container,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      dom.window.close();
      Object.assign(globalThis, {
        window: previousWindow,
        document: previousDocument,
        HTMLElement: previousHTMLElement,
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: previousNavigator,
      });
      window.HTMLElement.prototype.scrollTo = previousScrollTo;
      (window.HTMLElement.prototype as HTMLElement & {
        attachEvent?: (name: string, listener: EventListener) => void;
        detachEvent?: (name: string, listener: EventListener) => void;
      }).attachEvent = previousAttachEvent;
      (window.HTMLElement.prototype as HTMLElement & {
        attachEvent?: (name: string, listener: EventListener) => void;
        detachEvent?: (name: string, listener: EventListener) => void;
      }).detachEvent = previousDetachEvent;
      Object.assign(globalThis, {
        IS_REACT_ACT_ENVIRONMENT: undefined,
      });
    },
  };
}

test("첫 화면에 이벤트 이름, 날짜범위 캘린더, 시간 wheel picker, CTA가 모두 보인다", () => {
  const app = setup();

  try {
    const nameInput = app.container.querySelector("input");
    assert.ok(app.container.textContent?.includes("이름"));
    assert.ok(app.container.textContent?.includes("약속 날짜"));
    assert.ok(app.container.textContent?.includes("약속 시간"));
    assert.ok(app.container.textContent?.includes("이벤트 만들기"));
    assert.ok(app.container.querySelector('[role="grid"]'));
    assert.equal(app.container.querySelectorAll('[data-wheel-column]').length, 4);
    assert.equal(nameInput?.getAttribute("placeholder"), "약속 이름을 입력하세요");
  } finally {
    app.cleanup();
  }
});
