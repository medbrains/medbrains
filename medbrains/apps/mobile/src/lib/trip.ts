/**
 * Closing a home-collection round.
 *
 * "End trip" used to show a success message and submit nothing. The cost of
 * that is not the missing record — it is the collections left behind. A round
 * ended with visits still pending leaves those patients expecting a
 * phlebotomist who is no longer coming, and nothing anywhere says so.
 */

export interface Collection {
  id: string;
  status: string;
}

/** Statuses that mean the visit has not happened yet. */
const PENDING = new Set(["scheduled", "assigned", "in_transit", "arrived"]);

export function isPending(collection: Collection): boolean {
  return PENDING.has(collection.status);
}

export interface TripCloseCheck {
  outstanding: Collection[];
  canEnd: boolean;
}

/**
 * A trip may only be closed once every collection has been resolved one way or
 * the other — collected, returned, or cancelled. Leaving one pending is the
 * failure this guards, so the outstanding ones are named rather than counted.
 */
export function checkTripClose(collections: ReadonlyArray<Collection>): TripCloseCheck {
  const outstanding = collections.filter(isPending);
  return { outstanding, canEnd: outstanding.length === 0 };
}
