import assert from "node:assert/strict";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { cp, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, type Browser, type Page } from "playwright";

let browser: Browser;
let baseUrl = "";
let serverProcess: ChildProcess | null = null;
let serverLogs = "";
let isolatedAppDir = "";

const AVAILABLE_COLOR = "rgb(15, 61, 145)";
const UNAVAILABLE_COLOR = "rgb(199, 204, 214)";

async function isPortOpen(port: number): Promise<boolean> {
  try {
    await new Promise<void>((resolve, reject) => {
      const socket = net.connect({ host: "127.0.0.1", port }, () => {
        socket.end();
        resolve();
      });

      socket.once("error", reject);
    });

    return true;
  } catch {
    return false;
  }
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("failed to reserve a port"));
        return;
      }

      const { port } = address;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function respondsOnRoot(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get(`http://127.0.0.1:${port}`, (response) => {
      response.resume();
      resolve((response.statusCode ?? 500) < 500);
    });

    request.once("error", () => resolve(false));
  });
}

async function waitForServer(port: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 30_000) {
    if ((await isPortOpen(port)) && (await respondsOnRoot(port))) {
      await delay(1_000);

      if (serverProcess?.exitCode === null) {
        return;
      }
    }

    const exitedProcess = serverProcess;
    if (exitedProcess && exitedProcess.exitCode !== null) {
      throw new Error(
        `next dev exited early with code ${exitedProcess.exitCode ?? "unknown"}\n${serverLogs}`,
      );
    }

    await delay(200);
  }

  throw new Error(`timed out waiting for next dev on port ${port}\n${serverLogs}`);
}

async function createIsolatedAppDir() {
  const tempRoot = path.join(process.cwd(), ".tmp");
  await mkdir(tempRoot, { recursive: true });
  const targetDir = await mkdtemp(path.join(tempRoot, "e2e-next-"));

  await cp(path.join(process.cwd(), "src"), path.join(targetDir, "src"), { recursive: true });
  await cp(path.join(process.cwd(), "package.json"), path.join(targetDir, "package.json"));
  await cp(path.join(process.cwd(), "package-lock.json"), path.join(targetDir, "package-lock.json"));
  await cp(path.join(process.cwd(), "tsconfig.json"), path.join(targetDir, "tsconfig.json"));
  await cp(path.join(process.cwd(), "next.config.ts"), path.join(targetDir, "next.config.ts"));
  await mkdir(path.join(targetDir, "app"), { recursive: true });
  await cp(path.join(process.cwd(), "app", "globals.css"), path.join(targetDir, "app", "globals.css"));
  await cp(path.join(process.cwd(), "app", "layout.tsx"), path.join(targetDir, "app", "layout.tsx"));
  await writeFile(
    path.join(targetDir, "next-env.d.ts"),
    [
      '/// <reference types="next" />',
      '/// <reference types="next/image-types/global" />',
      "",
      "// NOTE: This file should not be edited",
      "// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.",
      "",
    ].join("\n"),
  );
  await writeFile(
    path.join(targetDir, "app", "page.tsx"),
    [
      'import { AvailabilityComposer } from "../src/components/availability-composer.js";',
      "",
      "export default function Page() {",
      "  return <AvailabilityComposer />;",
      "}",
      "",
    ].join("\n"),
  );
  await symlink(
    path.join(process.cwd(), "node_modules"),
    path.join(targetDir, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );

  isolatedAppDir = targetDir;
}

async function startDevServer() {
  const port = await getFreePort();
  await createIsolatedAppDir();
  serverLogs = "";
  const command =
    process.platform === "win32" ? "cmd.exe" : path.join(isolatedAppDir, "node_modules", ".bin", "next");
  const args =
    process.platform === "win32"
      ? [
          "/c",
          path.join(isolatedAppDir, "node_modules", ".bin", "next.cmd"),
          "dev",
          "--hostname",
          "127.0.0.1",
          "--port",
          String(port),
        ]
      : ["dev", "--hostname", "127.0.0.1", "--port", String(port)];
  serverProcess = spawn(command, args, {
    cwd: isolatedAppDir,
    env: {
      ...process.env,
      CI: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  serverProcess.stdout?.on("data", (chunk) => {
    serverLogs += chunk.toString();
  });

  serverProcess.stderr?.on("data", (chunk) => {
    serverLogs += chunk.toString();
  });

  await waitForServer(port);
  baseUrl = `http://127.0.0.1:${port}`;
}

function slotLocator(page: Page, slotKey: string) {
  return page.locator(`[data-slot-key="${slotKey}"]`);
}

async function openPage(options?: Parameters<Browser["newPage"]>[0]): Promise<Page> {
  const page = await browser.newPage(options);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator('[data-composer-ready="true"]').waitFor();
  await slotLocator(page, "mon-0").waitFor();
  return page;
}

async function dragBetween(page: Page, fromKey: string, toKey: string) {
  const fromBox = await slotLocator(page, fromKey).boundingBox();
  const toBox = await slotLocator(page, toKey).boundingBox();

  assert.ok(fromBox, `missing bounding box for ${fromKey}`);
  assert.ok(toBox, `missing bounding box for ${toKey}`);

  const fromX = fromBox.x + fromBox.width / 2;
  const fromY = fromBox.y + fromBox.height / 2;
  const toX = toBox.x + toBox.width / 2;
  const toY = toBox.y + toBox.height / 2;

  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await page.mouse.move(toX, toY, { steps: 12 });
  await page.mouse.move(toX, toY);
  await delay(50);
  await page.mouse.up();
}

async function getSelectedCount(page: Page): Promise<number> {
  const text = await page.locator("[data-selected-count]").first().textContent();
  assert.ok(text, "selected count text should exist");

  const match = text.match(/\d+/);
  assert.ok(match, `could not parse selected count from: ${text}`);
  return Number.parseInt(match[0], 10);
}

async function getSlotColor(page: Page, slotKey: string): Promise<string> {
  return slotLocator(page, slotKey).evaluate((element) => getComputedStyle(element).backgroundColor);
}

test.before(async () => {
  if (process.env.E2E_BASE_URL) {
    baseUrl = process.env.E2E_BASE_URL;
  } else {
    await startDevServer();
  }

  browser = await chromium.launch({ channel: "chrome", headless: true });
});

test.after(async () => {
  if (browser) {
    await browser.close();
  }

  if (serverProcess?.pid) {
    try {
      if (process.platform === "win32") {
        execFileSync("taskkill", ["/PID", String(serverProcess.pid), "/T", "/F"], { stdio: "ignore" });
      } else if (serverProcess.exitCode === null) {
        serverProcess.kill("SIGTERM");
      }
    } catch {
      // Ignore teardown failures if the process already exited.
    } finally {
      serverProcess = null;
    }
  }

  if (isolatedAppDir) {
    await rm(isolatedAppDir, { recursive: true, force: true });
    isolatedAppDir = "";
  }
});

test("브라우저에서 단일 클릭은 슬롯 하나만 채운다", async () => {
  const page = await openPage();

  try {
    assert.equal(await getSelectedCount(page), 5);
    await slotLocator(page, "mon-0").click();
    await expectCount(page, 6);
    await expectSlotColor(page, "mon-0", AVAILABLE_COLOR);
    await expectSummaryItem(page, "03/23 월 9:00 AM - 9:30 AM");
  } finally {
    await page.close();
  }
});

test("브라우저에서 드래그하면 직사각형 전체가 채워진다", async () => {
  const page = await openPage();

  try {
    await dragBetween(page, "tue-10", "thu-11");
    await expectCount(page, 11);
    await expectSlotColor(page, "tue-10", AVAILABLE_COLOR);
    await expectSlotColor(page, "wed-10", AVAILABLE_COLOR);
    await expectSlotColor(page, "thu-11", AVAILABLE_COLOR);
    await expectSummaryItem(page, "03/24 화 2:00 PM - 3:00 PM");
    await expectSummaryItem(page, "03/25 수 2:00 PM - 3:00 PM");
    await expectSummaryItem(page, "03/26 목 2:00 PM - 3:00 PM");
  } finally {
    await page.close();
  }
});

test("브라우저에서 선택된 슬롯을 드래그하면 직사각형 전체가 지워진다", async () => {
  const page = await openPage();

  try {
    await dragBetween(page, "tue-10", "thu-11");
    await expectCount(page, 11);
    await dragBetween(page, "tue-10", "thu-11");
    await expectCount(page, 5);
    await expectSlotColor(page, "tue-10", UNAVAILABLE_COLOR);
    await expectSlotColor(page, "wed-10", UNAVAILABLE_COLOR);
    await expectSlotColor(page, "thu-11", UNAVAILABLE_COLOR);
    const summary = await page.locator("li").allTextContents();
    assert.deepEqual(summary, [
      "03/22 일 10:00 AM - 11:00 AM",
      "03/25 수 12:30 PM - 1:00 PM",
      "03/26 목 12:30 PM - 1:00 PM",
      "03/27 금 12:30 PM - 1:00 PM",
    ]);
  } finally {
    await page.close();
  }
});

test("브라우저에서 슬롯 중앙 좌표는 실제 슬롯으로 히트 테스트된다", async () => {
  const page = await openPage();

  try {
    const hitTarget = await slotLocator(page, "mon-0").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      return hit?.closest("[data-slot-key]")?.getAttribute("data-slot-key") ?? null;
    });

    assert.equal(hitTarget, "mon-0");
  } finally {
    await page.close();
  }
});

test("모바일 뷰포트에서도 슬롯 클릭이 유지된다", async () => {
  const page = await openPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  try {
    assert.equal(await getSelectedCount(page), 5);
    await slotLocator(page, "mon-0").click();
    await expectCount(page, 6);
    await expectSlotColor(page, "mon-0", AVAILABLE_COLOR);
  } finally {
    await page.close();
  }
});

async function expectCount(page: Page, expected: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5_000) {
    if ((await getSelectedCount(page)) === expected) {
      return;
    }

    await delay(50);
  }

  assert.equal(await getSelectedCount(page), expected);
}

async function expectSummaryItem(page: Page, expected: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5_000) {
    const items = await page.locator("li").allTextContents();
    if (items.includes(expected)) {
      return;
    }

    await delay(50);
  }

  assert.ok((await page.locator("li").allTextContents()).includes(expected));
}

async function expectSlotColor(page: Page, slotKey: string, expected: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5_000) {
    if ((await getSlotColor(page, slotKey)) === expected) {
      return;
    }

    await delay(50);
  }

  assert.equal(await getSlotColor(page, slotKey), expected);
}
