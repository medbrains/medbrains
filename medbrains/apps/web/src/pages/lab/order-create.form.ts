import type {
  CreateDirectLabOrderRequest,
  DirectLabReferral,
  LabPriority,
  LabTestCatalog,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { z } from "zod";

/** Most tests one counter order may carry — the server's bound too. */
export const MAX_COUNTER_TESTS = 30;

/** Register a walk-in lab order. Literal until the generated catalogue carries it. */
export const LAB_ORDERS_DIRECT = P.LAB.ORDERS_DIRECT;

export type CounterTest = Pick<LabTestCatalog, "id" | "code" | "name" | "price">;

export const labCounterFormSchema = z
  .object({
    mode: z.enum(["visit", "walk_in"]),
    patient_id: z.string().min(1, "Pick the patient"),
    encounter_id: z.string(),
    tests: z
      .array(z.object({ id: z.string(), code: z.string(), name: z.string(), price: z.string() }))
      .min(1, "Add at least one test")
      .max(MAX_COUNTER_TESTS, `At most ${MAX_COUNTER_TESTS} tests per order`),
    priority: z.enum(["routine", "urgent", "stat"]),
    clinical_history: z.string().trim().max(2000),
    referral_kind: z.enum(["internal", "external", "self"]),
    doctor_id: z.string(),
    referral_doctor_id: z.string(),
    external_name: z.string().trim().max(200),
    external_registration_no: z.string().trim().max(100),
    external_phone: z.string().trim().max(20),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "visit" && !v.encounter_id) {
      ctx.addIssue({ code: "custom", path: ["encounter_id"], message: "Pick the visit" });
    }
    if (v.mode !== "walk_in") return;
    if (v.referral_kind === "internal" && !v.doctor_id) {
      ctx.addIssue({ code: "custom", path: ["doctor_id"], message: "Pick the referring doctor" });
    }
    if (v.referral_kind === "external" && !v.referral_doctor_id && !v.external_name) {
      ctx.addIssue({
        code: "custom",
        path: ["external_name"],
        message: "Pick the outside doctor, or enter their name",
      });
    }
  });

export type LabCounterFormValues = z.infer<typeof labCounterFormSchema>;

export function emptyCounterForm(mode: LabCounterFormValues["mode"]): LabCounterFormValues {
  return {
    mode,
    patient_id: "",
    encounter_id: "",
    tests: [],
    priority: "routine",
    clinical_history: "",
    referral_kind: "self",
    doctor_id: "",
    referral_doctor_id: "",
    external_name: "",
    external_registration_no: "",
    external_phone: "",
  };
}

/** Adds a test once; a second pick of the same test is ignored. */
export function addCounterTest(tests: CounterTest[], test: LabTestCatalog): CounterTest[] {
  if (tests.some((t) => t.id === test.id)) return tests;
  return [...tests, { id: test.id, code: test.code, name: test.name, price: test.price }];
}

/** Sum of catalogue prices, in paise-safe integer arithmetic. */
export function counterTotal(tests: CounterTest[]): number {
  const paise = tests.reduce((sum, t) => sum + Math.round(Number(t.price || 0) * 100), 0);
  return paise / 100;
}

export function formatRupees(amount: number | string): string {
  return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function toReferral(v: LabCounterFormValues): DirectLabReferral {
  if (v.referral_kind === "internal") return { kind: "internal", doctor_id: v.doctor_id };
  if (v.referral_kind === "self") return { kind: "self" };
  if (v.referral_doctor_id) return { kind: "external", referral_doctor_id: v.referral_doctor_id };
  return {
    kind: "external",
    name: v.external_name,
    registration_no: v.external_registration_no || undefined,
    phone: v.external_phone || undefined,
  };
}

export function toDirectLabOrderRequest(v: LabCounterFormValues): CreateDirectLabOrderRequest {
  return {
    patient_id: v.patient_id,
    test_ids: v.tests.map((t) => t.id),
    priority: v.priority as LabPriority,
    clinical_history: v.clinical_history || undefined,
    referral: toReferral(v),
  };
}
