import type { CssdPack } from "@medbrains/types";

/** Max blocked packs listed under the picker; the rest are summarised. */
const MAX_BLOCKED_SHOWN = 10;

/** Packs the server will refuse, in list order, capped for display. */
export function blockedPacks(packs: readonly CssdPack[]): CssdPack[] {
  return packs.filter((p) => p.block_reason !== null).slice(0, MAX_BLOCKED_SHOWN);
}

/** "Major set · exp 2026-11-30 · not issuable" — the reason itself is shown separately. */
export function packLabel(pack: CssdPack, setName: string | undefined): string {
  const parts = [setName ?? "Pack", `exp ${pack.pack_expiry_date ?? "not recorded"}`];
  if (pack.block_reason !== null) parts.push("not issuable");
  return parts.join(" · ");
}
