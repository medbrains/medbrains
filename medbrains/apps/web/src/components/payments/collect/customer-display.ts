import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  CounterDisplayEvent,
  CounterDisplayLine,
  CounterDisplayTender,
  DueBill,
  UpiQrResponse,
} from "@medbrains/types";
import { P, PATIENT_NAME_FIELD_ACCESS_KEYS } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { useProtectedFieldValue } from "@/components/PermissionedFieldValue";
import { toPaise } from "./collect-math";
import { LANE_LABEL } from "./use-dues";

/** Typing an amount sends one update after a pause, not one per key. */
const SETTLE_MS = 300;

type Body<E> = E extends CounterDisplayEvent ? Omit<E, "session"> : never;
export type DisplayEventBody = Body<CounterDisplayEvent>;

interface FeedState {
  stationId: string | null;
  session: string | null;
  /** The cashier's "Show QR on display" switch. */
  showQr: boolean;
  /** The last send failed: the indicator says so. */
  failed: boolean;
  setShowQr: (value: boolean) => void;
  begin: (stationId: string, session: string) => void;
  end: (session: string) => void;
  send: (event: DisplayEventBody) => void;
  /** A UPI QR was made in the drawer: put it on the display, if allowed. */
  showUpiQr: (qr: UpiQrResponse, amount: number) => void;
}

// Sends go one after another: an `items` must never overtake its `session_start`.
let chain: Promise<unknown> = Promise.resolve();

/**
 * What the drawer has sent to the counter's customer display (#4883). One
 * store for the app, like the drawer's own: the UPI tender lives a few
 * components down and reaches it without threading props.
 */
export const useDisplayFeed = create<FeedState>((set, get) => ({
  stationId: null,
  session: null,
  showQr: true,
  failed: false,
  setShowQr: (showQr) => set({ showQr }),
  begin: (stationId, session) => set({ stationId, session, failed: false }),
  end: (session) => {
    if (get().session !== session) return;
    get().send({ type: "cleared" });
    set({ session: null });
  },
  send: (event) => {
    const { stationId, session } = get();
    if (!stationId || !session) return;
    const body = { ...event, session } as CounterDisplayEvent;
    chain = chain
      .then(() => api.publishCounterDisplayEvent(stationId, body))
      .then(
        () => set({ failed: false }),
        () => set({ failed: true }),
      );
  },
  showUpiQr: (qr, amount) => {
    if (!get().showQr) return;
    if (!qr.upi_uri && !qr.image_url) return;
    get().send({
      type: "qr_shown",
      amount_paise: toPaise(amount),
      upi_uri: qr.upi_uri,
      image_url: qr.image_url,
      close_by: qr.close_by,
    });
  },
}));

/** Department lines for the display: the lanes each bill is for, never item names. */
export function displayLines(bills: DueBill[]): CounterDisplayLine[] {
  const byLabel = new Map<string, number>();
  for (const bill of bills) {
    const label = bill.lanes.map((lane) => LANE_LABEL[lane]).join(" + ") || "Hospital bill";
    byLabel.set(label, (byLabel.get(label) ?? 0) + toPaise(Number(bill.balance)));
  }
  return [...byLabel].map(([label, amount_paise]) => ({ label, amount_paise }));
}

interface MirrorArgs {
  stationId: string | null;
  /** New for every collection the drawer starts. */
  attempt: string;
  patientName: string | undefined;
  lines: CounterDisplayLine[];
  totalDue: number;
  tender: CounterDisplayTender | null;
  amount: number;
}

/**
 * Mirror the drawer on the counter's display: a session per collection,
 * the lines and total, the way of paying. Paid and the QR are sent where
 * they happen. Does nothing without a counter or the permission.
 */
export function useMirrorToDisplay(args: MirrorArgs) {
  const canPublish = useHasPermission(P.BILLING.COUNTER_DISPLAY.PUBLISH);
  const name = useProtectedFieldValue({
    fieldCodes: PATIENT_NAME_FIELD_ACCESS_KEYS,
    value: args.patientName ?? "",
    kind: "name",
  }).displayValue;
  // Only a counter with a display paired gets anything — not even a first name.
  const paired = useDisplayStatus(args.stationId).data?.paired ?? false;
  const station = canPublish && paired ? args.stationId : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new attempt is a new session
  const session = useMemo(() => crypto.randomUUID(), [args.attempt]);
  const linesKey = JSON.stringify(args.lines);
  const { begin, end, send } = useDisplayFeed.getState();

  // The display is an external system: open its session with the drawer and
  // clear it when the drawer closes or moves to the next patient.
  useEffect(() => {
    if (!station) return;
    begin(station, session);
    return () => end(session);
  }, [station, session, begin, end]);

  // Repeated when the name arrives: the server only renames the session.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new session starts again
  useEffect(() => {
    if (!station) return;
    send({ type: "session_start", patient_name: name || undefined });
  }, [station, session, name, send]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new session gets its lines again
  useEffect(() => {
    if (!station) return;
    send({ type: "items", lines: JSON.parse(linesKey), total_due_paise: toPaise(args.totalDue) });
  }, [station, session, linesKey, args.totalDue, send]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new session gets its tender again
  useEffect(() => {
    if (!station || !args.tender) return;
    const tender = args.tender;
    const timer = window.setTimeout(
      () => send({ type: "tender_selected", tender, amount_paise: toPaise(args.amount) }),
      SETTLE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [station, session, args.tender, args.amount, send]);
}

/** "Customer display: connected" for the cashier's counter. */
export function useDisplayStatus(stationId: string | null) {
  const canPublish = useHasPermission(P.BILLING.COUNTER_DISPLAY.PUBLISH);
  return useQuery({
    queryKey: ["counter-display-status", stationId],
    queryFn: () => api.getCounterDisplayStatus(stationId ?? ""),
    enabled: canPublish && Boolean(stationId),
    refetchInterval: 15_000,
  });
}
