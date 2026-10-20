import type { CollectResult, CollectTender } from "@medbrains/types";
import { create } from "zustand";
import type { CollectFocus } from "./collect-math";

/** A counter sale that is not posted yet: the drawer takes the tenders, the sale posts them. */
export interface CollectSale {
  amount: number;
  /** A pharmacy cash drawer is open. */
  cashAllowed: boolean;
  /** A registered patient may put it on their account. */
  creditAllowed: boolean;
  /** Post the sale with these tenders. Rejecting keeps the drawer open. */
  pay: (tenders: CollectTender[]) => Promise<void>;
}

export interface CollectTarget extends CollectFocus {
  patientId: string | null;
  /** What "this department" reads as when it is not a lane: "This visit", "This bill". */
  focusLabel?: string;
  sale?: CollectSale;
  onCollected?: (result: CollectResult) => void;
}

interface CollectState {
  target: CollectTarget | null;
  /** Bumped on every open, so a reopened drawer starts fresh. */
  session: number;
  open: (target: CollectTarget) => void;
  close: () => void;
}

/** One drawer for the whole app: any screen, chip or key opens it. */
export const useCollect = create<CollectState>((set) => ({
  target: null,
  session: 0,
  open: (target) => set((s) => ({ target, session: s.session + 1 })),
  close: () => set({ target: null }),
}));
