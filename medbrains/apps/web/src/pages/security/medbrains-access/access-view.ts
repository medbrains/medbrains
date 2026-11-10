/**
 * What the MedBrains access screen says about a grant, kept apart from the
 * screen so the wording and the rules can be tested on their own.
 */
import { PERMISSIONS, type VendorAccessGrant, type VendorAccessStatus } from "@medbrains/types";
import type { BadgeTone } from "@/components/ui";

/** The scope entry meaning configuration only (the server's `CONFIG_SCOPE`). */
export const CONFIG_SCOPE = "config";

/**
 * Modules a grant can never open, so not offered: every code in them is on
 * the server's never-under-a-grant list (`vendor_access/scope.rs`). The server
 * refuses them anyway; this only keeps a dead option off the list.
 */
const NOT_OFFERED = new Set(["vpn", "integration", "storage"]);

const STATUS: Record<VendorAccessStatus, { tone: BadgeTone; label: string }> = {
  pending_approval: { tone: "warning", label: "Waiting for a second approver" },
  active: { tone: "danger", label: "Open now" },
  expired: { tone: "neutral", label: "Expired" },
  revoked: { tone: "neutral", label: "Ended" },
};

/** Badge tone and words for a grant's state. Open access reads as danger: it is. */
export function statusView(status: VendorAccessStatus): { tone: BadgeTone; label: string } {
  return STATUS[status];
}

/** Human name for a permission module code: `blood_bank` → `Blood bank`. */
export function moduleLabel(code: string): string {
  if (code === CONFIG_SCOPE) return "Configuration only";
  const words = code.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The scope choices: configuration only first, then every grantable module. */
export function scopeOptions(): { value: string; label: string }[] {
  const modules = [...new Set(PERMISSIONS.map((p) => p.module))]
    .filter((m) => !NOT_OFFERED.has(m))
    .sort((a, b) => a.localeCompare(b));
  return [CONFIG_SCOPE, ...modules].map((value) => ({ value, label: moduleLabel(value) }));
}

/** Whether the hospital can still end this grant. */
export function canEnd(grant: VendorAccessGrant): boolean {
  return grant.status === "active" || grant.status === "pending_approval";
}

/** "3 h 20 min left" for an open grant; null once it is over. */
export function timeLeft(expiresAt: string, now: Date = new Date()): string | null {
  const minutes = Math.floor((new Date(expiresAt).getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min left` : `${minutes} min left`;
}
