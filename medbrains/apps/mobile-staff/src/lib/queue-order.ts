/**
 * Reading an OPD queue the way the desk works it.
 *
 * The "who is next" rule is no longer here. It used to be: lowest token number
 * still waiting, sorted on the device. The unified queue orders by priority
 * weight and then by position, so an elderly or emergency-referral patient is
 * called before a lower number — and a desk sorting locally by the number on
 * the slip would have called the wrong person, in front of everyone. Calling
 * the wrong person is not a cosmetic error.
 *
 * The server owns that rule now, in `token_priority_weight`, and returns rows
 * already in it. Nothing here re-sorts; these helpers read a list that arrived
 * in order.
 */

export interface QueueItem {
  id: string;
  status: string;
}

/** Nobody in these states is waiting to be called. */
const CLOSED = new Set(["completed", "cancelled", "no_show"]);

export function isWaiting(entry: QueueItem): boolean {
  return entry.status === "waiting";
}

export function isOpen(entry: QueueItem): boolean {
  return !CLOSED.has(entry.status);
}

/**
 * The next person to call — the first still waiting, in the order given.
 *
 * Used to label the button, not to decide the call: the desk presses call-next
 * and the server picks, under a lock, by the same rule it used to order this
 * list. If the two ever disagreed, the server would win and the label would
 * have been a guess; they do not disagree, because neither side sorts.
 *
 * Someone already called is skipped — they are in the room, or they did not
 * answer, and calling them again would put them in front a second time.
 *
 * Null when nobody is waiting, so the screen can say the queue is clear rather
 * than offer a button that would call nobody.
 */
export function nextToCall<T extends QueueItem>(entries: ReadonlyArray<T>): T | null {
  return entries.find(isWaiting) ?? null;
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
