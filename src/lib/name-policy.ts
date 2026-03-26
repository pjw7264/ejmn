import { appError, type ErrorCode } from "./errors.js";

const ALLOWED_PATTERN =
  /^[\p{Script=Hangul}\p{Script=Latin}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}\p{Number} ]+$/u;

export function validateName(value: unknown, errorCode: ErrorCode): string {
  if (typeof value !== "string" || value.length === 0) {
    throw appError(errorCode);
  }

  if (value !== value.trim()) {
    throw appError(errorCode);
  }

  if (/[\t\n\r]/u.test(value)) {
    throw appError(errorCode);
  }

  if (!ALLOWED_PATTERN.test(value)) {
    throw appError(errorCode);
  }

  return value;
}
