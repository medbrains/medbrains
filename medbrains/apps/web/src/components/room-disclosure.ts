// The disclosure the desk reads to the family before they choose a room above
// the policy's room rent limit. A consent records the version it was given
// on (server: `ROOM_DISCLOSURE_VERSION` in medbrains-server-services), so a
// change of wording is a new version, never an edit of this one.

/** The wording's version; must match the server's. */
export const ROOM_DISCLOSURE_VERSION = "room-cut-2026-11-v1";

/**
 * The words shown, for an insurer paying `payablePercent` of room-linked
 * charges (IRDAI/HLT/REG/CIR/151/06/2020).
 */
export function roomDisclosure(payablePercent: number): string {
  return (
    `In this room your insurer may pay only ${payablePercent}% of every room-linked ` +
    "charge (room, nursing, doctors' visits, OT and procedure fees), not just refuse " +
    "the difference in rent. Medicines and consumables, implants and devices, tests and " +
    "ICU charges are not cut. The difference is yours to pay."
  );
}
