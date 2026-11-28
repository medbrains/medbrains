/** The `/device` API area. Moved from `client.ts`; one module per first path segment. */
import type { CounterDisplayView, DeviceBoard } from "@medbrains/types";
import { request } from "../client.js";

export const deviceApi = {
  getDeviceBoard: () => request<DeviceBoard>("/device/board"),
  /** A paired customer display: its counter and what to show (also the polling fallback). */
  getCounterDisplay: () => request<CounterDisplayView>("/device/counter-display"),
};
