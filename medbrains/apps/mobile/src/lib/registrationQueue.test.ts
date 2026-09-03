import { describe, expect, it, vi } from "vitest";
import {
  drain,
  enqueue,
  inMemoryStore,
  MAX_ATTEMPTS,
  type PendingRegistration,
  pendingCount,
} from "./registrationQueue";

const person = (localId: string, personName: string): PendingRegistration => ({
  localId,
  campId: "camp-1",
  personName,
  payload: { camp_id: "camp-1", person_name: personName },
  attempts: 0,
});

describe("registrations waiting for signal", () => {
  it("keeps the order they were taken in", async () => {
    // Registration numbers are issued in the order the server receives them.
    // A roll that reads back out of order is a roll nobody trusts.
    const store = inMemoryStore();
    const taken: Array<[string, string]> = [
      ["1", "Kannan"],
      ["2", "Meena"],
      ["3", "Raja"],
    ];
    for (const [id, name] of taken) enqueue(store, person(id, name));
    const seen: string[] = [];
    await drain(store, async (item) => {
      seen.push(item.personName);
    });

    expect(seen).toEqual(["Kannan", "Meena", "Raja"]);
  });

  it("will not queue the same person twice", () => {
    // A volunteer double-taps Register on a slow screen constantly.
    const store = inMemoryStore();
    enqueue(store, person("1", "Kannan"));
    enqueue(store, person("1", "Kannan"));

    expect(pendingCount(store)).toBe(1);
  });

  it("keeps the ones that failed and clears the ones that went", async () => {
    const store = inMemoryStore();
    enqueue(store, person("1", "Kannan"));
    enqueue(store, person("2", "Meena"));

    const result = await drain(store, async (item) => {
      if (item.localId === "2") throw new Error("no signal");
    });

    expect(result.sent).toBe(1);
    expect(pendingCount(store)).toBe(1);
    expect(store.read()[0]?.personName).toBe("Meena");
  });

  it("does not let one bad entry hold up everyone behind it", async () => {
    const store = inMemoryStore();
    enqueue(store, person("1", "Bad"));
    enqueue(store, person("2", "Meena"));
    enqueue(store, person("3", "Raja"));

    const result = await drain(store, async (item) => {
      if (item.localId === "1") throw new Error("malformed");
    });

    expect(result.sent, "the two behind the failure must still be sent").toBe(2);
  });

  it("surfaces a registration it has given up on rather than dropping it", async () => {
    // Silently discarding is the one unacceptable outcome: that person was
    // seen by a clinician, and the record would simply cease to exist.
    const store = inMemoryStore();
    enqueue(store, { ...person("1", "Kannan"), attempts: MAX_ATTEMPTS - 1 });

    const result = await drain(store, async () => {
      throw new Error("still no signal");
    });

    expect(result.abandoned).toHaveLength(1);
    expect(result.abandoned[0]?.personName).toBe("Kannan");
    expect(pendingCount(store), "abandoned items leave the retry queue").toBe(0);
  });

  it("counts attempts so a hopeless entry eventually stops retrying", async () => {
    const store = inMemoryStore();
    enqueue(store, person("1", "Kannan"));
    const send = vi.fn(async () => {
      throw new Error("no signal");
    });

    for (let i = 0; i < MAX_ATTEMPTS; i += 1) await drain(store, send);

    expect(send).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    expect(pendingCount(store)).toBe(0);
  });
});
