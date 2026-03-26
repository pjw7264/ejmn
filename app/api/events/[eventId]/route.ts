import { patchMemberSchema } from "../../../../src/server/schemas.js";
import { getEventService } from "../../../../src/server/runtime.js";
import { toErrorResponse, toJsonResponse } from "../../../../src/server/response.js";

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  try {
    const { eventId } = await context.params;
    const detail = await getEventService().getEventDetail(eventId);
    return toJsonResponse(detail, 200);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { eventId } = await context.params;
    const body = patchMemberSchema.parse(await request.json());
    const detail = await getEventService().upsertMemberAvailability(eventId, request.headers.get("authorization"), body);
    return toJsonResponse(detail, 200);
  } catch (error) {
    return toErrorResponse(error);
  }
}
