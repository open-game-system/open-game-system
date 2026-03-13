import type { StreamKitHooks, StateChange } from "./types";

/**
 * Creates a request handler for stream-kit server endpoints.
 *
 * This function takes a configuration object containing the necessary hooks
 * for storage interaction and returns an async function compatible with
 * server environments like Cloudflare Workers.
 *
 * The router handles basic RESTful operations on stream state:
 * - GET /stream/:streamId -> Loads stream state
 * - GET /stream/:streamId/sse -> Server-Sent Events for state changes
 * - POST /stream/:streamId -> Saves stream state (request body)
 * - DELETE /stream/:streamId -> Deletes stream state
 *
 * @template TEnv The environment type containing storage bindings.
 * @param config Configuration object with the implemented hooks.
 * @returns An async function that handles incoming requests for stream endpoints.
 */
export function createStreamKitRouter<TEnv>(config: {
  hooks: StreamKitHooks<TEnv>;
}) {
  const { hooks } = config;

  return async (request: Request, env: TEnv): Promise<Response> => {
    const url = new URL(request.url);
    const pathSegments = url.pathname.split("/").filter(Boolean);

    // Basic routing: /stream/:streamId[/sse]
    if (pathSegments.length < 2 || pathSegments[0] !== "stream") {
      return new Response("Not Found", { status: 404 });
    }

    const streamId = pathSegments[1];
    const isSSE = pathSegments[2] === "sse";

    try {
      switch (request.method) {
        case "GET": {
          if (isSSE) {
            // Get last event ID for resuming
            const lastEventId = request.headers.get("Last-Event-ID") || undefined;

            // Create SSE stream
            const stream = new ReadableStream({
              async start(controller) {
                try {
                  // Helper to send SSE messages
                  const sendEvent = (event: StateChange) => {
                    const data = JSON.stringify(event.data);
                    let message = `data: ${data}\n`;
                    if (event.id) {
                      message = `id: ${event.id}\n${message}`;
                    }
                    message += '\n';
                    controller.enqueue(new TextEncoder().encode(message));
                  };

                  // Send initial state
                  const initialState = await hooks.loadStreamState({ streamId, env });
                  if (initialState === null) {
                    controller.close();
                    return;
                  }

                  // Send initial snapshot
                  sendEvent({
                    type: 'snapshot',
                    data: initialState,
                    id: lastEventId
                  });

                  // Subscribe to changes
                  for await (const change of hooks.subscribeToStateChanges({ 
                    streamId, 
                    env,
                    lastEventId 
                  })) {
                    sendEvent(change);
                  }

                  // If we get here, the subscription has ended normally
                  controller.close();
                } catch (error) {
                  console.error(`[SSE Error] Stream ${streamId}:`, error);
                  // Send error message before closing
                  const errorMessage = `data: ${JSON.stringify({ error: 'Stream terminated due to error' })}\n\n`;
                  controller.enqueue(new TextEncoder().encode(errorMessage));
                  controller.close();
                }
              },
              cancel() {
                // Handle client disconnect
                console.log(`[SSE] Client disconnected from stream ${streamId}`);
              }
            });

            return new Response(stream, {
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
              }
            });
          }

          // Regular GET request for current state
          const state = await hooks.loadStreamState({ streamId, env });
          if (state === null) {
            return new Response("Stream Not Found", { status: 404 });
          }
          return new Response(JSON.stringify(state), {
            headers: { "Content-Type": "application/json" },
            status: 200,
          });
        }

        case "POST": {
          if (!request.body) {
            return new Response("Request body required for saving state", { status: 400 });
          }
          let state: unknown;
          try {
            state = await request.json();
          } catch (error) {
            return new Response("Invalid JSON in request body", { status: 400 });
          }
          await hooks.saveStreamState({ streamId, state, env });
          return new Response("Stream state saved", { status: 200 });
        }

        case "DELETE": {
          await hooks.deleteStreamState({ streamId, env });
          return new Response("Stream deleted", { status: 200 });
        }

        default: {
          return new Response("Method Not Allowed", { status: 405 });
        }
      }
    } catch (error) {
      console.error(`[StreamKitRouter Error] Failed operation for stream ${streamId}:`, error);
      return new Response("Internal Server Error", { status: 500 });
    }
  };
} 