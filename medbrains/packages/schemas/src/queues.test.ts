import { describe, expect, it } from "vitest";
import { previewQueueNumber, queueFormSchema } from "./queues";

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

  it("refuses a prefix a slip cannot print", () => {
    expect(queueFormSchema.safeParse({ ...base, prefix: "OPD-1" }).success).toBe(false);
    expect(queueFormSchema.safeParse(base).success).toBe(true);
  });
});
