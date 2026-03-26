import { getHealthCheckResult } from "../../../src/server/health.js";
import { toJsonResponse } from "../../../src/server/response.js";

export async function GET(): Promise<Response> {
  const result = await getHealthCheckResult();
  return toJsonResponse(result, result.status === "ok" ? 200 : 503);
}
