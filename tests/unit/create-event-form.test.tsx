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
      Object.assign(globalThis, {
        IS_REACT_ACT_ENVIRONMENT: undefined,
      });
    },
  };
}

test("첫 화면에 이벤트 이름, 날짜범위 캘린더, 시간 wheel picker, CTA가 모두 보인다", () => {
  const app = setup();

  try {
    assert.ok(app.container.textContent?.includes("이벤트 이름"));
    assert.ok(app.container.textContent?.includes("날짜범위 선택"));
    assert.ok(app.container.textContent?.includes("시간범위 선택"));
    assert.ok(app.container.textContent?.includes("이벤트 만들기"));
    assert.ok(app.container.querySelector('[role="grid"]'));
    assert.equal(app.container.querySelectorAll('[data-wheel-column]').length, 4);
  } finally {
    app.cleanup();
  }
});
