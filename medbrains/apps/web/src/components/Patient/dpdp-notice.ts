/**
 * The privacy notice the desk and the portal show a patient (DPDP Act s.5,
 * Rules 2025 r.3): what is collected and why, the purposes that need their
 * own yes, how to withdraw, and where to complain. It is shown in the
 * patient's language, whatever language the staff member's screen is in.
 *
 * The text lives in `packages/privacy/dpdp-notice.json`, one file for web,
 * iOS and Android. Its `version` must match `NOTICE_VERSION` in
 * `crates/medbrains-patients/src/dpdp_consent.rs` — every consent records
 * which text the patient read.
 */
import type { DpdpNoticeLanguage, DpdpPurpose } from "@medbrains/types";
import notice from "../../../../../packages/privacy/dpdp-notice.json";

interface NoticeText {
  language: string;
  collected: string;
  purposesIntro: string;
  purposes: Record<DpdpPurpose, string>;
  rights: string;
}

export const DPDP_NOTICE_VERSION: string = notice.version;

export const DPDP_PURPOSES = notice.purposes as DpdpPurpose[];

export const DPDP_NOTICE = notice.languages as Record<DpdpNoticeLanguage, NoticeText>;

export const DPDP_LANGUAGES = (Object.keys(DPDP_NOTICE) as DpdpNoticeLanguage[]).map((value) => ({
  value,
  label: DPDP_NOTICE[value].language,
}));
