import type { DeviceBindingCode } from "@medbrains/types";
import { z } from "zod";

/** Server limits (crates/medbrains-device-pairing/src/binding.rs). */
export const BINDING_MAX_LIFETIME_HOURS = 24 * 30;
export const BINDING_MAX_USES = 500;
export const BINDING_MAX_LABEL = 120;

export const LIFETIME_OPTIONS = [
  { value: "1", label: "1 hour" },
  { value: "8", label: "8 hours (one shift)" },
  { value: "24", label: "1 day" },
  { value: "168", label: "1 week" },
  { value: String(BINDING_MAX_LIFETIME_HOURS), label: "30 days" },
];

export const issueBindingSchema = z.object({
  label: z.string().trim().min(1, "Name the code").max(BINDING_MAX_LABEL),
  expires_in_hours: z.coerce.number().int().min(1).max(BINDING_MAX_LIFETIME_HOURS),
  max_uses: z.coerce
    .number()
    .int()
    .min(1, "At least one device")
    .max(BINDING_MAX_USES, `At most ${BINDING_MAX_USES} devices`),
});

export type IssueBindingForm = z.input<typeof issueBindingSchema>;

export const DEFAULT_ISSUE_BINDING: IssueBindingForm = {
  label: "",
  expires_in_hours: 24,
  max_uses: 1,
};

export type BindingStatus = "active" | "used_up" | "expired" | "revoked";

/** Revoked outranks everything: it was a decision, the rest are facts. */
export function bindingStatus(code: DeviceBindingCode, now: Date = new Date()): BindingStatus {
  if (code.revoked_at) return "revoked";
  if (new Date(code.expires_at) <= now) return "expired";
  if (code.use_count >= code.max_uses) return "used_up";
  return "active";
}

export const BINDING_STATUS_LABEL: Record<BindingStatus, string> = {
  active: "Active",
  used_up: "Used up",
  expired: "Expired",
  revoked: "Revoked",
};
