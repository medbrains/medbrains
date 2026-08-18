/**
 * Bands — the wearables the Health tab connects.
 *
 * A band is a `RecordSource` like any other (see `record-source.ts`), so
 * pairing one is an added implementation rather than a change to the app. This
 * module owns only the *connection* state, because that is what the person
 * manages: what is paired, whether it is reporting, and when it last did.
 *
 * Deliberately not modelled on `paired_devices` from the hospital schema. That
 * table is a hospital's asset register — a tablet issued to a ward, tracked by
 * the hospital, revocable by the hospital. A band somebody bought is theirs,
 * exists with no tenant at all, and must keep working if they never link a
 * hospital. Sharing the shape would have meant inventing a tenant to hold it.
 */

/** The kinds we can talk to. A closed set: each needs a real integration. */
export type BandKind =
  /** Apple Watch via HealthKit. */
  | "apple_watch"
  /** Wear OS / Android via Health Connect. */
  | "health_connect"
  /** A MedBrains band, over the device bridge. */
  | "medbrains";

export interface Band {
  readonly id: string;
  readonly kind: BandKind;
  /** What the person calls it. Theirs to change. */
  readonly name: string;
  /** ISO instant of the last reading we accepted, or undefined if never. */
  readonly lastSyncedAt?: string;
}

/**
 * What a band is doing, as the person would describe it.
 *
 * `stale` exists because "connected" and "reporting" are different facts, and
 * a band that paired three weeks ago and has sent nothing since is not
 * connected in any sense the person cares about. Showing it as connected would
 * be the same failure as an empty ward reading as a fact.
 */
export type BandState = "reporting" | "stale" | "never_synced";

/** A band that has said nothing for this long is stale, not connected. */
export const STALE_AFTER_HOURS = 36;

export function bandState(band: Band, now: Date): BandState {
  if (band.lastSyncedAt === undefined) {
    return "never_synced";
  }
  const hours = (now.getTime() - Date.parse(band.lastSyncedAt)) / 3_600_000;
  return hours > STALE_AFTER_HOURS ? "stale" : "reporting";
}

export const BAND_KIND_LABEL: Readonly<Record<BandKind, string>> = {
  apple_watch: "Apple Watch",
  health_connect: "Health Connect",
  medbrains: "MedBrains band",
};

/** Plain words, no jargon, and never a claim the band is fine when it is silent. */
export function describeBandState(state: BandState): string {
  switch (state) {
    case "reporting":
      return "Reporting";
    case "stale":
      return "No data recently";
    case "never_synced":
      return "Paired, nothing received yet";
  }
}
