import type { PatientRegistrationInitialValues } from "@medbrains/schemas";
import type {
  AbdmProfileShareStatus,
  AbdmSharedProfile,
  AbhaVerifiedProfile,
} from "@medbrains/types";

/** Who the share names, for the queue row. */
export function shareName(profile: AbdmSharedProfile): string {
  const parts = [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : (profile.full_name ?? profile.abha_address);
}

/** Age in whole years from the date of birth, else the year; null when neither was shared. */
export function shareAge(
  profile: Pick<AbdmSharedProfile, "date_of_birth" | "year_of_birth">,
  today: Date,
): number | null {
  if (profile.date_of_birth) {
    const [y, m, d] = profile.date_of_birth.split("-").map(Number);
    if (!y || !m || !d) return null;
    const hadBirthday =
      today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d);
    return today.getFullYear() - y - (hadBirthday ? 0 : 1);
  }
  const year = Number(profile.year_of_birth);
  return Number.isInteger(year) && year > 1900 ? today.getFullYear() - year : null;
}

/** Only a share still waiting (or missed today) can be acted on. */
export const isActionable = (status: AbdmProfileShareStatus) =>
  status === "waiting" || status === "expired";

const STATUS: Record<
  AbdmProfileShareStatus,
  { label: string; tone: "primary" | "success" | "neutral" | "warning" }
> = {
  waiting: { label: "Waiting", tone: "primary" },
  linked: { label: "Linked", tone: "success" },
  registered: { label: "Registered", tone: "success" },
  expired: { label: "Token expired", tone: "warning" },
  dismissed: { label: "Dismissed", tone: "neutral" },
};

export const shareStatus = (status: AbdmProfileShareStatus) => STATUS[status];

/** A 10-digit Indian mobile from whatever the app sent, or undefined. */
function mobile(value: string | null): string | undefined {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : undefined;
}

/**
 * The registration form, pre-filled from the verified share — the profile
 * the server recorded, not one the browser holds.
 */
export function shareRegistrationValues(p: AbhaVerifiedProfile): PatientRegistrationInitialValues {
  const words = (p.full_name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = p.first_name ?? words[0] ?? "";
  const last = p.first_name ? (p.last_name ?? "") : words.length > 1 ? (words.at(-1) ?? "") : "";
  return {
    first_name: first,
    middle_name: p.middle_name ?? undefined,
    last_name: last,
    gender: p.gender ?? "",
    date_of_birth: p.date_of_birth,
    phone: mobile(p.mobile_masked),
    abha_number: p.abha_number,
    abha_address: p.abha_address ?? undefined,
    line1: p.address ?? undefined,
    district: p.district ?? undefined,
    state: p.state ?? undefined,
    postal_code: p.pincode ?? undefined,
    registration_source: "mobile_app",
  };
}
