import { z } from "zod";

export const createEventSchema = z.object({
  name: z.string(),
  start: z.string(),
  end: z.string()
});

export const patchMemberSchema = z.object({
  rrule: z.string()
});
