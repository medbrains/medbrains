import type {
  BasketItem,
  BasketWarning,
  BasketWarningAck,
} from "@medbrains/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/// Order Basket — atomic cross-module order signing.
/// See `RFCs/sprints/SPRINT-order-basket.md`.
///
/// Store lives in **sessionStorage** (not localStorage) — clinical data
/// must not survive browser close. On encounter close or successful sign,
/// the store is cleared.

interface OrderBasketState {
  encounterId: string | null;
  patientId: string | null;
  items: BasketItem[];
  warnings: BasketWarning[];
  warningsAcknowledged: BasketWarningAck[];
  isChecking: boolean;
  isSigning: boolean;
  // actions
  setContext: (encounterId: string, patientId: string) => void;
  addItem: (item: BasketItem) => void;
  updateItem: (idx: number, item: BasketItem) => void;
  removeItem: (idx: number) => void;
  clear: () => void;
  setWarnings: (warnings: BasketWarning[]) => void;
  acknowledgeWarning: (code: string, override_reason: string) => void;
  setChecking: (v: boolean) => void;
  setSigning: (v: boolean) => void;
  loadDraft: (items: BasketItem[]) => void;
  hasUnacknowledgedBlocks: () => boolean;
}

export const useOrderBasketStore = create<OrderBasketState>()(
  persist(
    (set, get) => ({
      encounterId: null,
      patientId: null,
      items: [],
      warnings: [],
      warningsAcknowledged: [],
      isChecking: false,
      isSigning: false,

      setContext: (encounterId, patientId) => {
        const current = get();
        if (current.encounterId !== encounterId) {
          // Encounter changed — clear basket to avoid cross-encounter pollution
          set({
            encounterId,
            patientId,
            items: [],
            warnings: [],
            warningsAcknowledged: [],
          });
        } else {
          set({ encounterId, patientId });
        }
      },

      addItem: (item) =>
        set((state) => ({
          items: [...state.items, item],
          warnings: [], // invalidate; caller re-runs check
        })),

      updateItem: (idx, item) =>
        set((state) => ({
          items: state.items.map((it, i) => (i === idx ? item : it)),
          warnings: [],
        })),

      removeItem: (idx) =>
        set((state) => ({
          items: state.items.filter((_, i) => i !== idx),
          warnings: state.warnings.filter((w) => !w.refs.includes(idx)),
        })),

      clear: () =>
        set({
          items: [],
          warnings: [],
          warningsAcknowledged: [],
        }),

      setWarnings: (warnings) => set({ warnings }),

      acknowledgeWarning: (code, override_reason) =>
        set((state) => {
          const filtered = state.warningsAcknowledged.filter((a) => a.code !== code);
          return {
            warningsAcknowledged: [...filtered, { code, override_reason }],
          };
        }),

      setChecking: (v) => set({ isChecking: v }),
      setSigning: (v) => set({ isSigning: v }),

      loadDraft: (items) =>
        set({
          items,
          warnings: [],
          warningsAcknowledged: [],
        }),

      hasUnacknowledgedBlocks: () => {
        const { warnings, warningsAcknowledged } = get();
        return warnings.some(
          (w) =>
            w.severity === "BLOCK" &&
            !warningsAcknowledged.some(
              (a) => a.code === w.code && a.override_reason.trim().length > 0,
            ),
        );
      },
    }),
    {
      name: "medbrains-order-basket",
      // sessionStorage so basket dies with the browser session
      storage: createJSONStorage(() => sessionStorage),
      // Don't persist transient flags
      partialize: (state) => ({
        encounterId: state.encounterId,
        patientId: state.patientId,
        items: state.items,
        warningsAcknowledged: state.warningsAcknowledged,
      }),
    },
  ),
);
