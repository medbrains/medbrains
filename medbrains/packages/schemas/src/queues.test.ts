import { describe, expect, it } from "vitest";
import { previewQueueNumber, queueFormSchema, queuesSharingPool } from "./queues";

const base = {
  name: "General OPD",
  module: "opd",
  place: "department:abc",
  prefix: "GEN",
  start_at: 100,
  pad_width: 3,
  reset_rule: "daily" as const,
  max_tokens_per_period: null,
  lifecycle: "permanent" as const,
  valid_from: null,
  valid_until: null,
  // The new-queue defaults (QueueFormDrawer).
  board_shows: "number" as const,
  voice_languages: ["en" as const],
  announce_repeat: 1,
  early_issue_minutes: 60,
  number_pool_size: null,
  reuse_cooloff_minutes: 30,
};

describe("queue form", () => {
  it("previews the first slip the way the server numbers it", () => {
    expect(previewQueueNumber("gen", 100, 3)).toBe("GEN-100");
    expect(previewQueueNumber("C1", 1, 4)).toBe("C1-0001");
  });

  it("refuses a temporary queue with no days", () => {
    const result = queueFormSchema.safeParse({ ...base, lifecycle: "temporary" });
    expect(result.success).toBe(false);
  });

  it("asks a recycling queue how many numbers go round", () => {
    const recycle = { ...base, reset_rule: "recycle" as const };
    expect(queueFormSchema.safeParse(recycle).success).toBe(false);
    expect(queueFormSchema.safeParse({ ...recycle, number_pool_size: 99 }).success).toBe(true);
    // A cool-off longer than a day is refused: issuing looks back two days.
    expect(
      queueFormSchema.safeParse({ ...recycle, number_pool_size: 99, reuse_cooloff_minutes: 1441 })
        .success,
    ).toBe(false);
  });

  it("refuses a prefix a slip cannot print", () => {
    expect(queueFormSchema.safeParse({ ...base, prefix: "OPD-1" }).success).toBe(false);
    expect(queueFormSchema.safeParse(base).success).toBe(true);
  });
});

describe("shared number pool", () => {
  const queue = (id: string, prefix: string, reset_rule = "recycle", status = "active") => ({
    id,
    prefix,
    reset_rule,
    status,
  });

  it("finds other live recycling queues under the same prefix, not itself", () => {
    const queues = [
      queue("a", "P"),
      queue("b", "P"),
      queue("c", "P", "daily"),
      queue("d", "P", "recycle", "closed"),
      queue("e", "Q"),
    ];
    expect(queuesSharingPool(queues, " p ", "a").map((q) => q.id)).toEqual(["b"]);
    expect(queuesSharingPool(queues, "P", null).map((q) => q.id)).toEqual(["a", "b"]);
    expect(queuesSharingPool(queues, "", null)).toEqual([]);
  });
});
