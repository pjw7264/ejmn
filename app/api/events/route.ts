import { createEventSchema } from "../../../src/server/schemas.js";
import { getEventService } from "../../../src/server/runtime.js";
import { toErrorResponse, toJsonResponse } from "../../../src/server/response.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = createEventSchema.parse(await request.json());
    const detail = await getEventService().createEvent(body);
    return toJsonResponse(detail, 201);
  } catch (error) {
    return toErrorResponse(error);
  }
}
