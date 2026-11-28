/** The `/counter-display` API area. Moved from `client.ts`; one module per first path segment. */
import type {
  CounterDisplayAck,
  CounterDisplayEvent,
  CounterDisplayStatus,
} from "@medbrains/types";
import { request } from "../client.js";

export const counterDisplayApi = {
  publishCounterDisplayEvent: (stationId: string, event: CounterDisplayEvent) =>
    request<CounterDisplayAck>(`/counter-display/${stationId}/events`, {
      method: "POST",
      body: JSON.stringify(event),
    }),
  getCounterDisplayStatus: (stationId: string) =>
    request<CounterDisplayStatus>(`/counter-display/${stationId}/status`),
};
