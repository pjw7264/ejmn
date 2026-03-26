import test from "node:test";
import assert from "node:assert/strict";
import { parseAuthorizationHeader } from "../../src/lib/basic-auth.js";

test("빈 비밀번호를 포함한 Basic 헤더를 파싱한다", () => {
  const header = `Basic ${Buffer.from("주워니:").toString("base64")}`;
  assert.deepEqual(parseAuthorizationHeader(header), { name: "주워니", password: "" });
});

test("헤더가 없으면 INVALID_AUTH_HEADER를 던진다", () => {
  assert.throws(() => parseAuthorizationHeader(undefined), { code: "INVALID_AUTH_HEADER" });
});

test("Basic 스킴이 아니면 INVALID_AUTH_HEADER를 던진다", () => {
  const header = `Bearer ${Buffer.from("주워니:1234").toString("base64")}`;
  assert.throws(() => parseAuthorizationHeader(header), { code: "INVALID_AUTH_HEADER" });
});
