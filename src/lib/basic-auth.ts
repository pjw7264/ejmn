import { appError } from "./errors.js";

const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export interface BasicCredentials {
  name: string;
  password: string;
}

export function parseAuthorizationHeader(headerValue: unknown): BasicCredentials {
  if (typeof headerValue !== "string" || headerValue.length === 0) {
    throw appError("INVALID_AUTH_HEADER");
  }

  const [scheme, token, ...rest] = headerValue.split(" ");

  if (scheme !== "Basic" || typeof token !== "string" || rest.length > 0 || !BASE64_PATTERN.test(token)) {
    throw appError("INVALID_AUTH_HEADER");
  }

  const decoded = Buffer.from(token, "base64").toString("utf8");
  const delimiterIndex = decoded.indexOf(":");

  if (delimiterIndex < 0) {
    throw appError("INVALID_AUTH_HEADER");
  }

  return {
    name: decoded.slice(0, delimiterIndex),
    password: decoded.slice(delimiterIndex + 1)
  };
}
