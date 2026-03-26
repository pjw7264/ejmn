import { randomBytes } from "node:crypto";

const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function generateEventId(length = 8): string {
  const bytes = randomBytes(length);
  let id = "";

  for (let index = 0; index < length; index += 1) {
    id += CROCKFORD_BASE32[bytes[index] % CROCKFORD_BASE32.length];
  }

  return id;
}
