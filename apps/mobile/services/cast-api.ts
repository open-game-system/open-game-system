import { z } from "zod";

/**
 * Response schema for POST /api/v1/cast/sessions
 * Parse at the boundary — validates API responses before use.
 */
const CreateCastSessionResponseSchema = z.object({
  sessionId: z.string(),
  streamSessionId: z.string(),
  streamUrl: z.string(),
  status: z.literal("active"),
});

/**
 * Error response schema from the OGS API.
 */
const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    status: z.number(),
  }),
});

export type CreateCastSessionResponse = z.infer<typeof CreateCastSessionResponseSchema>;

/**
 * Creates a cast session via the OGS API.
 * Provisions a stream-kit container and returns stream details.
 *
 * @throws Error on non-OK response or network failure
 */
export async function createCastSession(
  apiUrl: string,
  apiKey: string,
  deviceId: string,
  viewUrl: string,
): Promise<CreateCastSessionResponse> {
  const response = await fetch(`${apiUrl}/api/v1/cast/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ deviceId, viewUrl }),
  });

  if (!response.ok) {
    const body = await response.json();
    const parsed = ApiErrorResponseSchema.safeParse(body);
    if (parsed.success) {
      throw new Error(parsed.data.error.message);
    }
    throw new Error(`Cast session creation failed with status ${response.status}`);
  }

  const body = await response.json();
  const parsed = CreateCastSessionResponseSchema.parse(body);
  return parsed;
}

/**
 * Deletes (ends) a cast session via the OGS API.
 *
 * @throws Error on non-OK response or network failure
 */
export async function deleteCastSession(
  apiUrl: string,
  apiKey: string,
  sessionId: string,
): Promise<void> {
  const response = await fetch(`${apiUrl}/api/v1/cast/sessions/${sessionId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.json();
    const parsed = ApiErrorResponseSchema.safeParse(body);
    if (parsed.success) {
      throw new Error(parsed.data.error.message);
    }
    throw new Error(`Cast session deletion failed with status ${response.status}`);
  }
}

/**
 * Pushes a game state update to an active cast session (best effort).
 * Does NOT throw on failure — state updates are non-critical.
 */
export async function pushCastStateUpdate(
  apiUrl: string,
  apiKey: string,
  sessionId: string,
  state: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch(`${apiUrl}/api/v1/cast/sessions/${sessionId}/state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ state }),
    });
  } catch {
    // Best effort — swallow errors
  }
}
