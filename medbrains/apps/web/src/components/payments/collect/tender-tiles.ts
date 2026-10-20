// The ways a desk can take money, and which of them this desk, this user and
// this hospital's provider can use right now. Each keeps its number key, so
// a cashier's fingers learn one layout even when a tile is missing.

export type TenderTile = "cash" | "card" | "upi" | "link" | "online" | "advance" | "credit";

export const TILE_KEY: Record<TenderTile, number> = {
  cash: 1,
  card: 2,
  upi: 3,
  link: 4,
  online: 5,
  advance: 6,
  credit: 7,
};

export const TILE_LABEL: Record<TenderTile, string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI QR",
  link: "Payment link",
  online: "Online",
  advance: "Deposit",
  credit: "Insurance / credit",
};

export interface TileContext {
  /** A counter sale not posted yet (pharmacy): no bill to pay online. */
  isSale: boolean;
  /** Cash may be taken here (a pharmacy cash drawer is open). */
  cashAllowed: boolean;
  /** May use the hospital's gateway: QR codes, online checkout. */
  canUseGateway: boolean;
  /** The active provider takes online checkout here. */
  providerCheckout: boolean;
  /** Bills in scope: online checkout pays exactly one. */
  billCount: number;
  /** Some bill in scope is still a draft (a deposit applies to issued bills only). */
  hasDraft: boolean;
  canApplyDeposit: boolean;
  depositBalance: number;
  /** A registered patient's sale may go on their account. */
  creditAllowed: boolean;
  isInsured: boolean;
}

export interface TileState {
  tile: TenderTile;
  disabled: boolean;
  hint: string;
}

/** A bill-balance payment link has no endpoint yet: it shows, and says so. */
export const LINK_PENDING = "Coming soon (#4871)";

/** The tiles to show, in key order; a tile nobody here can use is left out. */
export function usableTiles(c: TileContext): TileState[] {
  const tiles: TileState[] = [];
  if (c.cashAllowed) tiles.push({ tile: "cash", disabled: false, hint: "Tendered and change" });
  tiles.push({ tile: "card", disabled: false, hint: "Machine or approval code" });
  tiles.push({
    tile: "upi",
    disabled: false,
    hint: c.canUseGateway ? "Patient scans, confirms itself" : "Counter QR, enter the UTR",
  });
  tiles.push({ tile: "link", disabled: true, hint: LINK_PENDING });
  if (!c.isSale && c.canUseGateway && c.providerCheckout && c.billCount === 1) {
    tiles.push({ tile: "online", disabled: false, hint: "Card or net banking checkout" });
  }
  if (!c.isSale && c.canApplyDeposit && c.depositBalance > 0) {
    tiles.push({
      tile: "advance",
      disabled: c.hasDraft,
      hint: c.hasDraft
        ? "Bills not issued yet — collect, then apply"
        : `${c.depositBalance.toLocaleString("en-IN", { style: "currency", currency: "INR" })} available`,
    });
  }
  if (c.isSale ? c.creditAllowed : c.isInsured) {
    tiles.push({
      tile: "credit",
      disabled: false,
      hint: c.isSale ? "On the patient's account" : "Claim on the bill",
    });
  }
  return tiles;
}

/** The tile to start on: the one last used at this counter, if it is here. */
export function startTile(tiles: TileState[], last: string | null): TenderTile | null {
  const usable = tiles.filter((t) => !t.disabled);
  return (usable.find((t) => t.tile === last) ?? usable[0])?.tile ?? null;
}

const LAST_KEY = "collect.last-tile";

/** The tile last used at this counter (a convenience: never money). */
export function readLastTile(stationId: string | null): string | null {
  try {
    return localStorage.getItem(`${LAST_KEY}:${stationId ?? "any"}`);
  } catch {
    return null;
  }
}

export function rememberTile(stationId: string | null, tile: TenderTile): void {
  try {
    localStorage.setItem(`${LAST_KEY}:${stationId ?? "any"}`, tile);
  } catch {
    // Private window or blocked storage: the default tile is used next time.
  }
}
