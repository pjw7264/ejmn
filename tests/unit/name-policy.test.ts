import test from "node:test";
import assert from "node:assert/strict";
import { validateName } from "../../src/lib/name-policy.js";

test("한글과 중간 공백이 포함된 이름을 허용한다", () => {
  assert.equal(validateName("홍 길동", "INVALID_MEMBER_NAME"), "홍 길동");
});

test("앞 공백이 있으면 이름을 거부한다", () => {
  assert.throws(() => validateName(" 홍길동", "INVALID_MEMBER_NAME"), { code: "INVALID_MEMBER_NAME" });
});

test("특수문자가 있으면 이름을 거부한다", () => {
  assert.throws(() => validateName("홍길동!", "INVALID_MEMBER_NAME"), { code: "INVALID_MEMBER_NAME" });
});
