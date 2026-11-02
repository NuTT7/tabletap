"use client";

import { useEffect, useRef, useState } from "react";
import type { OrderEvent } from "./events";

export type StreamState = "connecting" | "live" | "reconnecting";

/**
 * Subscribe to an SSE endpoint. `onEvent` is called for each order event, and
 * `onReconnect` after the connection comes back, so the caller can refetch
 * anything it missed while offline.
 */
export function useEventStream(
  url: string,
  onEvent: (event: OrderEvent) => void,
  onReconnect: () => void,
): StreamState {
  const [state, setState] = useState<StreamState>("connecting");
  const handlers = useRef({ onEvent, onReconnect });
  handlers.current = { onEvent, onReconnect };

  useEffect(() => {
    const source = new EventSource(url);
    let hasConnected = false;

    source.addEventListener("ready", () => {
      setState("live");
      if (hasConnected) handlers.current.onReconnect();
      hasConnected = true;
    });
    source.addEventListener("order", (e) => {
      try {
        handlers.current.onEvent(JSON.parse((e as MessageEvent).data) as OrderEvent);
      } catch {
        // ignore malformed event
      }
    });
    source.onerror = () => setState("reconnecting");

    return () => source.close();
  }, [url]);

  return state;
}
