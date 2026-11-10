// The "Record a dose" form: what makes a vaccine dose recordable, the same
// rules the server applies (routes/immunizations.rs).

import { z } from "zod";

export const doseSchema = z
  .object({
    vaccine_name: z.string().trim().min(1, "Name the vaccine"),
    /** Set when recorded from the schedule; the server checks it. */
    vaccine_key: z.string().optional(),
    dose_number: z.number().int().min(1).max(20).optional(),
    administered_on: z.date({ message: "When was it given?" }),
    lot_number: z.string().trim().optional(),
    route: z
      .enum(["intramuscular", "subcutaneous", "intradermal", "oral", "intranasal"])
      .optional(),
    site: z.string().trim().optional(),
    given_elsewhere: z.boolean(),
    notes: z.string().trim().optional(),
  })
  .refine((v) => v.administered_on <= new Date(), {
    path: ["administered_on"],
    message: "A dose cannot be recorded for a date still to come",
  })
  // Batch traceability (Drugs and Cosmetics Act): a dose given here carries its lot.
  .refine((v) => v.given_elsewhere || Boolean(v.lot_number), {
    path: ["lot_number"],
    message: "A dose given here needs its lot number",
  });

export type DoseForm = z.infer<typeof doseSchema>;
