import type { CssdPack } from "@medbrains/types";
import { describe, expect, it } from "vitest";
import { blockedPacks, packLabel } from "./pack-status";

const pack = (id: string, block_reason: string | null): CssdPack => ({
  id,
  tenant_id: "t",
  load_id: "l",
  set_id: "s",
  instrument_id: null,
  quantity: 1,
  pack_expiry_date: "2026-11-30",
  block_reason,
});

describe("CSSD pack status", () => {
  it("lists only the packs the server refuses", () => {
    const rows = [pack("a", null), pack("b", "Pack expired"), pack("c", null)];
    expect(blockedPacks(rows).map((p) => p.id)).toEqual(["b"]);
  });

  it("marks a refused pack as not issuable in the picker", () => {
    expect(packLabel(pack("b", "Load recalled"), "Major set")).toBe(
      "Major set · exp 2026-11-30 · not issuable",
    );
    expect(packLabel(pack("a", null), undefined)).toBe("Pack · exp 2026-11-30");
  });
});
