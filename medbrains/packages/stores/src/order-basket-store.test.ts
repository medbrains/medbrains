// @vitest-environment node

import type { BasketItem, BasketWarning } from "@medbrains/types";
import { beforeEach, describe, expect, it } from "vitest";
import { useOrderBasketStore } from "./order-basket-store";

/**
 * The order basket holds unsigned clinical orders and the interaction
 * warnings raised against them. Warnings address items by index, so anything
 * that reorders items has to invalidate them — a warning rendered against the
 * wrong drug is worse than no warning at all.
 */

const store = () => useOrderBasketStore.getState();

const item = (name: string): BasketItem =>
  ({ order_type: "medication", display_name: name }) as unknown as BasketItem;

const warning = (code: string, refs: number[], severity = "WARN"): BasketWarning =>
  ({ code, severity, message: code, refs }) as unknown as BasketWarning;

beforeEach(() => {
  store().clear();
  store().setContext("enc-1", "pat-1");
});

describe("encounter context", () => {
  it("clears the basket when the encounter changes", () => {
    store().addItem(item("amoxicillin"));
    store().setContext("enc-2", "pat-2");
    expect(store().items).toHaveLength(0);
    expect(store().encounterId).toBe("enc-2");
  });

  it("keeps the basket when the same encounter is set again", () => {
    store().addItem(item("amoxicillin"));
    store().setContext("enc-1", "pat-1");
    expect(store().items).toHaveLength(1);
  });

  /**
   * QUIRK: the guard keys on encounterId alone. Re-setting the same encounter
   * with a different patient keeps the existing items and simply overwrites
   * patientId, so a mismatched pair does not trigger the cross-encounter
   * clear.
   */
  it("QUIRK: a changed patient on the same encounter does not clear the basket", () => {
    store().addItem(item("amoxicillin"));
    store().setContext("enc-1", "pat-999");
    expect(store().items).toHaveLength(1);
    expect(store().patientId).toBe("pat-999");
  });
});

describe("warning invalidation", () => {
  beforeEach(() => {
    store().addItem(item("warfarin"));
    store().addItem(item("aspirin"));
    store().setWarnings([warning("DDI", [0, 1])]);
  });

  it("adding an item invalidates warnings", () => {
    store().addItem(item("ibuprofen"));
    expect(store().warnings).toEqual([]);
  });

  it("updating an item invalidates warnings", () => {
    store().updateItem(0, item("warfarin 5mg"));
    expect(store().warnings).toEqual([]);
  });

  /**
   * Regression: removeItem used to keep the warnings that did not name the
   * removed index, but every later item shifts down and the refs are not
   * rewritten. A warning on index 2 would then point at whatever moved into
   * slot 2 — the UI resolves warnings per item with
   * `warnings.filter(w => w.refs.includes(idx))`, so it rendered against the
   * wrong drug. Removing now invalidates, matching addItem and updateItem.
   */
  it("removing an item invalidates warnings rather than leaving stale indices", () => {
    store().addItem(item("ibuprofen")); // clears warnings
    store().setWarnings([warning("DDI", [1, 2])]);

    store().removeItem(0); // warfarin out; aspirin and ibuprofen shift down

    expect(store().warnings).toEqual([]);
    expect(store().items).toHaveLength(2);
  });

  it("removes the right item", () => {
    store().removeItem(0);
    expect(store().items).toHaveLength(1);
    expect((store().items[0] as unknown as { display_name: string }).display_name).toBe("aspirin");
  });

  it("an out-of-range remove is a no-op on items", () => {
    store().removeItem(99);
    expect(store().items).toHaveLength(2);
  });
});

describe("hasUnacknowledgedBlocks", () => {
  beforeEach(() => {
    store().addItem(item("warfarin"));
  });

  it("is false when there are no warnings at all", () => {
    expect(store().hasUnacknowledgedBlocks()).toBe(false);
  });

  it("ignores non-blocking severities", () => {
    store().setWarnings([warning("MINOR", [0], "WARN"), warning("NOTE", [0], "INFO")]);
    expect(store().hasUnacknowledgedBlocks()).toBe(false);
  });

  it("blocks until a BLOCK warning is acknowledged", () => {
    store().setWarnings([warning("HARD_STOP", [0], "BLOCK")]);
    expect(store().hasUnacknowledgedBlocks()).toBe(true);

    store().acknowledgeWarning("HARD_STOP", "clinically justified, monitoring INR");
    expect(store().hasUnacknowledgedBlocks()).toBe(false);
  });

  /**
   * The override reason is the audit trail for going ahead anyway, so a blank
   * or whitespace-only one does not count as an acknowledgement.
   */
  it("a blank or whitespace override reason does not unblock", () => {
    store().setWarnings([warning("HARD_STOP", [0], "BLOCK")]);
    store().acknowledgeWarning("HARD_STOP", "   ");
    expect(store().hasUnacknowledgedBlocks()).toBe(true);

    store().acknowledgeWarning("HARD_STOP", "");
    expect(store().hasUnacknowledgedBlocks()).toBe(true);
  });

  it("acknowledging one BLOCK does not clear another", () => {
    store().setWarnings([
      warning("HARD_STOP_A", [0], "BLOCK"),
      warning("HARD_STOP_B", [0], "BLOCK"),
    ]);
    store().acknowledgeWarning("HARD_STOP_A", "justified");
    expect(store().hasUnacknowledgedBlocks()).toBe(true);
  });

  it("re-acknowledging a code replaces the previous reason rather than duplicating", () => {
    store().acknowledgeWarning("HARD_STOP", "first reason");
    store().acknowledgeWarning("HARD_STOP", "better reason");
    expect(store().warningsAcknowledged).toEqual([
      { code: "HARD_STOP", override_reason: "better reason" },
    ]);
  });
});

describe("clear and loadDraft", () => {
  it("clear drops items, warnings and acknowledgements", () => {
    store().addItem(item("warfarin"));
    store().setWarnings([warning("DDI", [0], "BLOCK")]);
    store().acknowledgeWarning("DDI", "justified");

    store().clear();
    expect(store().items).toEqual([]);
    expect(store().warnings).toEqual([]);
    expect(store().warningsAcknowledged).toEqual([]);
  });

  it("clear keeps the encounter context, so the basket stays addressable", () => {
    store().clear();
    expect(store().encounterId).toBe("enc-1");
    expect(store().patientId).toBe("pat-1");
  });

  it("loadDraft replaces items and resets both warnings and acknowledgements", () => {
    store().addItem(item("warfarin"));
    store().setWarnings([warning("DDI", [0], "BLOCK")]);
    store().acknowledgeWarning("DDI", "justified");

    store().loadDraft([item("paracetamol"), item("ORS")]);
    expect(store().items).toHaveLength(2);
    expect(store().warnings).toEqual([]);
    expect(store().warningsAcknowledged).toEqual([]);
  });
});
