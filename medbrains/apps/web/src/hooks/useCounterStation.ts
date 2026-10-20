import { useState } from "react";

const KEY = "payments.counter-station";

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * The counter (station) this browser sits at, remembered on this machine so
 * the cashier picks it once — the card machine is the one at their counter.
 */
export function useCounterStation(): [string | null, (stationId: string | null) => void] {
  const [stationId, setStationId] = useState<string | null>(read);
  const choose = (next: string | null) => {
    setStationId(next);
    try {
      if (next) localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    } catch {
      // Private window: it is remembered for this page only.
    }
  };
  return [stationId, choose];
}
