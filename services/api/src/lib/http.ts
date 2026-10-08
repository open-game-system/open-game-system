import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** The API's error contract: `{ error: { code, message, status } }` with a matching HTTP status. */
export function apiError(c: Context, status: ContentfulStatusCode, code: string, message: string) {
  return c.json({ error: { code, message, status } }, status);
}

/** Any schema with zod's safeParse shape (zod 3 in ogs-protocol, zod 4 here). */
export interface Parser<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

/** Parses the JSON body at the boundary. Returns the data, or null when it is not JSON or not valid. */
export async function parseBody<T>(c: Context, schema: Parser<T>): Promise<T | null> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return null;
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export const invalidBody = (c: Context, message: string) =>
  apiError(c, 400, "invalid_body", message);

/** Compares a presented secret with the expected one in constant time (for equal lengths). */
export function timingSafeEqual(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) {
    return false;
  }

  const encoder = new TextEncoder();
  const actualBytes = encoder.encode(actual);
  const expectedBytes = encoder.encode(expected);

  let result = 0;
  for (let i = 0; i < actualBytes.length; i++) {
    result |= actualBytes[i] ^ expectedBytes[i];
  }
  return result === 0;
}
