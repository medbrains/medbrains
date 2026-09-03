import type { CreateCampRegistrationRequest } from "@medbrains/types";

/**
 * Registrations that could not be sent yet.
 *
 * A camp is held where the signal is worst. Today a failed POST loses the
 * registration entirely: the volunteer has already turned to the next person,
 * and nobody finds out until the roll is short at the end of the session.
 *
 * This holds them in order and retries. It is deliberately storage-agnostic —
 * the app has no persistence library, so the default keeps the queue in memory
 * and it survives a network blip but NOT the app being killed. Give it a
 * durable `QueueStore` (AsyncStorage, MMKV) and the same logic survives a
 * restart, which is what a real camp needs.
 */

export interface PendingRegistration {
  /** Client-side id, so a retry cannot enqueue the same person twice. */
  localId: string;
  campId: string;
  personName: string;
  /** Exactly what the API expects, so a retry needs no reconstruction. */
  payload: CreateCampRegistrationRequest;
  attempts: number;
}

export interface QueueStore {
  read(): PendingRegistration[];
  write(items: PendingRegistration[]): void;
}

/** Survives a network blip, not an app restart. See the note above. */
export function inMemoryStore(): QueueStore {
  let items: PendingRegistration[] = [];
  return {
    read: () => items,
    write: (next) => {
      items = next;
    },
  };
}

/** Give up on a registration only after this many tries. */
export const MAX_ATTEMPTS = 5;

export function enqueue(store: QueueStore, item: PendingRegistration): void {
  const items = store.read();
  // Idempotent on localId: a double tap, or a retry racing the original,
  // must not put the same person on the roll twice.
  if (items.some((existing) => existing.localId === item.localId)) return;
  store.write([...items, item]);
}

export function pendingCount(store: QueueStore): number {
  return store.read().length;
}

export interface DrainResult {
  sent: number;
  failed: number;
  abandoned: PendingRegistration[];
}

/**
 * Try every pending registration, oldest first.
 *
 * Order is kept because registration numbers are issued in the order the
 * server receives them, and a camp roll read back out of order is a roll
 * nobody trusts.
 *
 * One failure does not stop the rest: a single malformed entry should not
 * hold up everyone queued behind it.
 */
export async function drain(
  store: QueueStore,
  send: (item: PendingRegistration) => Promise<void>,
): Promise<DrainResult> {
  const items = store.read();
  const stillPending: PendingRegistration[] = [];
  const abandoned: PendingRegistration[] = [];
  let sent = 0;

  for (const item of items) {
    try {
      await send(item);
      sent += 1;
    } catch {
      const attempts = item.attempts + 1;
      // Kept, not dropped silently. A registration that cannot be sent is
      // still a person who was seen, and somebody has to be told.
      if (attempts >= MAX_ATTEMPTS) abandoned.push({ ...item, attempts });
      else stillPending.push({ ...item, attempts });
    }
  }

  store.write(stillPending);
  return { sent, failed: stillPending.length, abandoned };
}
