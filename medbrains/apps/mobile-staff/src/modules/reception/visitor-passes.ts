/**
 * What the visitor desk counts, in plain functions.
 *
 * Kept out of `api/front-office.ts` because that module reaches the network
 * through the shell's secure store, and the shell is React Native — the app's
 * test suite is pure logic on purpose so it runs without a device. These two
 * decide who the desk believes is inside the building, which is exactly the
 * kind of thing that should be pinned by a test that runs in milliseconds.
 */

import type { VisitorPass } from "@medbrains/types";

/** Passes still good right now — what the desk is actually working. */
export function activePasses(passes: readonly VisitorPass[], nowMs: number): VisitorPass[] {
  return passes.filter((pass) => pass.status === "active" && Date.parse(pass.valid_until) > nowMs);
}

/**
 * A pass that has run out but was never revoked.
 *
 * Worth its own state. `status` does not expire on its own and nothing sweeps
 * it, so a pass whose hours have passed still reads `active` in the database.
 * The visitor is probably still inside, and the desk is the only place that
 * finds out. Lumping this in with "expired and gone" is how somebody stays in
 * a ward after visiting hours with nobody counting them.
 */
export function overduePasses(passes: readonly VisitorPass[], nowMs: number): VisitorPass[] {
  return passes.filter((pass) => pass.status === "active" && Date.parse(pass.valid_until) <= nowMs);
}
