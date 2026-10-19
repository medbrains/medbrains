import type { PatientRegistrationInitialValues } from "@medbrains/schemas";
import type {
  AbdmProfileShareStatus,
  AbdmSharedProfile,
  AbhaVerifiedProfile,
  MpiMatchRequest,
  MpiMatchResult,
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

type NamedProfile = Pick<AbdmSharedProfile, "first_name" | "last_name" | "full_name">;

/** Given and family name, from the parts or else the full name. */
function splitName(p: NamedProfile): { first: string; last: string } {
  const words = (p.full_name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = p.first_name ?? words[0] ?? "";
  const last = p.first_name ? (p.last_name ?? "") : words.length > 1 ? (words.at(-1) ?? "") : "";
  return { first, last };
}

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
  const { first, last } = splitName(p);
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

/** The registration duplicate check (`POST /api/patients/match`) for a share. */
export function shareMatchRequest(p: AbdmSharedProfile): MpiMatchRequest {
  const { first, last } = splitName(p);
  return {
    first_name: first,
    last_name: last,
    date_of_birth: p.date_of_birth ?? undefined,
    phone: mobile(p.mobile),
  };
}

export interface ShareCandidate extends MpiMatchResult {
  sameMobile: boolean;
  sameDob: boolean;
  similarName: boolean;
}

/** Name words of three letters or more, lower-cased. */
const nameWords = (...parts: (string | null | undefined)[]) =>
  parts
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);

/** A word in common, or one a prefix of the other ("Ravi" / "Ravindran"). */
function namesOverlap(a: string[], b: string[]): boolean {
  return a.some((x) => b.some((y) => x.startsWith(y) || y.startsWith(x)));
}

/**
 * The MPI's matches for a share, same mobile first and then by the server's
 * score — a family can share a mobile, so the reasons are shown, not assumed.
 */
export function rankCandidates(p: AbdmSharedProfile, matches: MpiMatchResult[]): ShareCandidate[] {
  const phone = mobile(p.mobile);
  const shared = nameWords(p.first_name, p.middle_name, p.last_name, p.full_name);
  return matches
    .map((m) => ({
      ...m,
      sameMobile: phone !== undefined && mobile(m.phone) === phone,
      sameDob: !!p.date_of_birth && m.date_of_birth === p.date_of_birth,
      similarName: namesOverlap(shared, nameWords(m.first_name, m.last_name)),
    }))
    .sort((a, b) => Number(b.sameMobile) - Number(a.sameMobile) || b.score - a.score);
}

/**
 * Probably the same person, so registering would make a second UHID: the
 * same mobile with a similar name or the same date of birth, or a similar
 * name born the same day.
 */
export function likelyDuplicates(
  p: AbdmSharedProfile,
  matches: MpiMatchResult[],
): ShareCandidate[] {
  return rankCandidates(p, matches).filter(
    (c) => (c.sameMobile && (c.similarName || c.sameDob)) || (c.sameDob && c.similarName),
  );
}
