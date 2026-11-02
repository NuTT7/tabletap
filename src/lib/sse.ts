import { getBus, type OrderEvent } from "./events";

/**
 * Build a Server-Sent Events response that forwards bus events for the given
 * channels. SSE is one-way (server -> browser), which is all these screens
 * need, and the browser's EventSource reconnects automatically.
 */
export function sseResponse(
  channels: string[],
  request: Request,
  filter: (event: OrderEvent) => boolean = () => true,
): Response {
  const encoder = new TextEncoder();
  const bus = getBus();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      // Tell the browser to wait 3s before reconnecting after a drop.
      send("retry: 3000\n\n");
      send(`event: ready\ndata: {}\n\n`);

      const unsubscribers = channels.map((channel) =>
        bus.subscribe(channel, (event) => {
          if (filter(event)) send(`event: order\ndata: ${JSON.stringify(event)}\n\n`);
        }),
      );

      // Comment lines keep proxies and load balancers from closing an idle stream.
      const heartbeat = setInterval(() => send(": ping\n\n"), 20_000);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribers.forEach((u) => u());
        cleanup = () => {};
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
