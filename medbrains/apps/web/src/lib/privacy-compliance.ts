// What the privacy compliance screens show, worked out once and tested.

import type {
  CompliancePolicy,
  CompliancePolicyKind,
  CompliancePolicyLanguage,
  PrivacyOfficerRole,
} from "@medbrains/types";

export const OFFICER_LABEL: Record<PrivacyOfficerRole, string> = {
  grievance_officer: "Grievance officer",
  dpo: "Data Protection Officer",
  certin_poc: "CERT-In point of contact",
};

export const OFFICER_BASIS: Record<PrivacyOfficerRole, string> = {
  grievance_officer:
    "Answers patients' privacy questions and grievances within 90 days — DPDP Rules 2025 r.9, r.14(3)",
  dpo: "Published business contact for processing questions — DPDP Act 2023 s.8(9), Rules 2025 r.9",
  certin_poc: "Receives CERT-In's directions and requests — CERT-In Directions 28-04-2022 (iii)",
};

export const LANGUAGE_LABEL: Record<CompliancePolicyLanguage, string> = {
  en: "English",
  hi: "Hindi",
  ta: "Tamil",
};

export const POLICY_LANGUAGES: Record<CompliancePolicyKind, CompliancePolicyLanguage[]> = {
  privacy_notice: ["en", "hi", "ta"],
  retention_schedule: ["en"],
  breach_response_plan: ["en"],
  processor_policy: ["en"],
  children_data_policy: ["en"],
  confidentiality_undertaking: ["en", "hi", "ta"],
};

export interface PolicySlot {
  kind: CompliancePolicyKind;
  language: CompliancePolicyLanguage;
  published: CompliancePolicy | null;
  open: CompliancePolicy | null;
}

const OPEN = new Set(["draft", "in_review", "returned"]);

/** One row per policy and language: its published version and open draft. */
export function policySlots(policies: CompliancePolicy[]): PolicySlot[] {
  return (Object.keys(POLICY_LANGUAGES) as CompliancePolicyKind[]).flatMap((kind) =>
    POLICY_LANGUAGES[kind].map((language) => {
      const mine = policies.filter((p) => p.kind === kind && p.language === language);
      return {
        kind,
        language,
        published: mine.find((p) => p.status === "published") ?? null,
        open: mine.find((p) => OPEN.has(p.status)) ?? null,
      };
    }),
  );
}

/** Maker-checker: the drafter never approves their own draft. */
export function canDecidePolicy(p: CompliancePolicy, userId: string | undefined): boolean {
  return p.status === "in_review" && p.drafted_by !== userId;
}

/** Days until a deadline (negative when past). */
export function daysUntil(isoDate: string, now: number = Date.now()): number {
  return Math.floor((Date.parse(isoDate) - now) / 86_400_000);
}

/** Mirrors the server: a draft is not approvable while it still carries the
 * template's review note or an unfilled placeholder. */
export function policyUnfinished(body: string): string | null {
  if (body.includes("review with counsel before approval")) {
    return "Remove the template's review note once counsel has reviewed the text.";
  }
  if (body.includes("— not set yet]") || body.includes("{{")) {
    return "Fill in every placeholder still marked “not set yet”.";
  }
  return null;
}
