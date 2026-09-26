import { z } from "zod";

/**
 * Admin → Queues form. The server refuses the same things; this says so before
 * the admin presses Save.
 */
export const queueFormSchema = z
  .object({
    name: z.string().trim().min(1, "Give the queue a name"),
    module: z.string().min(1, "Choose what the queue is for"),
    place: z.string().min(1, "Choose the place it serves"),
    prefix: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{1,6}$/, "1 to 6 letters or digits, like GEN or C1"),
    start_at: z.number().int().min(0, "Starts at 0 or more"),
    pad_width: z.number().int().min(1).max(6),
    reset_rule: z.enum(["daily", "session", "never"]),
    max_tokens_per_period: z.number().int().min(1, "At least 1").nullable(),
    lifecycle: z.enum(["permanent", "temporary"]),
    valid_from: z.date().nullable(),
    valid_until: z.date().nullable(),
    board_shows: z.enum(["number", "initials"]),
    voice_languages: z
      .array(z.enum(["en", "hi", "ta"]))
      .min(1, "Choose at least one language for the voice")
      .max(3),
    announce_repeat: z.number().int().min(1).max(3),
    early_issue_minutes: z
      .number()
      .int()
      .min(0, "0 or more")
      .max(240, "At most 4 hours before a session opens"),
  })
  .superRefine((value, ctx) => {
    if (value.lifecycle === "temporary" && (!value.valid_from || !value.valid_until)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["valid_until"],
        message: "A temporary queue needs its first and last day",
      });
    }
    if (value.valid_from && value.valid_until && value.valid_until < value.valid_from) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["valid_until"],
        message: "The last day is before the first",
      });
    }
  });

export type QueueFormInput = z.infer<typeof queueFormSchema>;

/** What the first token of a period will read, e.g. GEN-100. */
export function previewQueueNumber(prefix: string, startAt: number, padWidth: number): string {
  const n = String(Math.max(0, startAt)).padStart(Math.min(Math.max(padWidth, 1), 6), "0");
  return `${prefix.trim().toUpperCase() || "?"}-${n}`;
}
