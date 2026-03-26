import { ZodError } from "zod";
import { appError, serializeError } from "../lib/errors.js";

export function toJsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof SyntaxError) {
    const serialized = serializeError(appError("MALFORMED_JSON"));
    return toJsonResponse(serialized.body, serialized.status);
  }

  if (error instanceof ZodError) {
    const serialized = serializeError(appError("MISSING_REQUIRED_FIELD"));
    return toJsonResponse(serialized.body, serialized.status);
  }

  const serialized = serializeError(error);
  return toJsonResponse(serialized.body, serialized.status);
}
