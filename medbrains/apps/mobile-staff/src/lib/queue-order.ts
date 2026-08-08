/**
 * Reading an OPD queue the way the desk works it.
 *
 * Extracted so the "who is next" rule is testable and stated once. Calling the
 * wrong person is not a cosmetic error: it sends someone into a consulting room
 * ahead of people who have been waiting longer, in front of all of them.
 */

export interface QueueItem {
  id: string;
  token_number: number;
  status: string;
  called_at: string | null;
}

/** Nobody in these states is waiting to be called. */
const CLOSED = new Set(["completed", "cancelled", "no_show"]);

export function isWaiting(entry: QueueItem): boolean {
  return entry.status === "waiting";
}

export function isOpen(entry: QueueItem): boolean {
  return !CLOSED.has(entry.status);
}

/** Token order. The number on the slip is the promise the board made. */
export function byToken<T extends QueueItem>(entries: ReadonlyArray<T>): T[] {
  return [...entries].sort((a, b) => a.token_number - b.token_number);
}

/**
 * The next person to call: lowest token still waiting.
 *
 * Someone already called is skipped even if their token is lower — they are in
 * the room, or they did not answer, and calling them again would put them in
 * front of the queue a second time.
 *
 * Null when nobody is waiting, so the screen can say the queue is clear rather
 * than offer a button that would call nobody.
 */
export function nextToCall<T extends QueueItem>(entries: ReadonlyArray<T>): T | null {
  return byToken(entries).find(isWaiting) ?? null;
}

export interface QueueCounts {
  waiting: number;
  open: number;
}

export function countQueue(entries: ReadonlyArray<QueueItem>): QueueCounts {
  let waiting = 0;
  let open = 0;
  for (const entry of entries) {
    if (isWaiting(entry)) {
      waiting += 1;
    }
    if (isOpen(entry)) {
      open += 1;
    }
  }
  return { waiting, open };
}
