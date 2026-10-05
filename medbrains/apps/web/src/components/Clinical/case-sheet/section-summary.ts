// What a structured note section says, as lines a reader of the case sheet
// (or its print) can take in: the paper sheet's "PMH: DM (controlled)".

import type {
  FamilyHistoryEntry,
  PastMedicalEntry,
  PastSurgicalEntry,
  PhysicalExamination,
  ReviewOfSystems,
  SocialHistory,
} from "@medbrains/types";
import { formatBodySite } from "@/components/BodySite/anatomy-atlas";

/** Sections whose content is a record edited on its own tab. */
export const STRUCTURED_SECTIONS: Record<string, { tab: string; label: string }> = {
  history: { tab: "history", label: "History" },
  ros: { tab: "ros", label: "ROS" },
  examination: { tab: "physical-exam", label: "Physical Exam" },
};

export interface HistoryData {
  hpi?: string | null;
  past_medical_history?: PastMedicalEntry[] | null;
  past_surgical_history?: PastSurgicalEntry[] | null;
  family_history?: FamilyHistoryEntry[] | null;
  social_history?: SocialHistory | null;
}

export interface ExaminationData {
  exam?: PhysicalExamination | null;
  general_appearance?: string | null;
}

const humanise = (key: string) => key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const joined = (parts: Array<string | null | undefined | false>) =>
  parts.filter(Boolean).join(", ");

function historyLines(d: HistoryData): string[] {
  const social = d.social_history ?? {};
  const habits = joined([
    social.smoking && `smoking ${social.smoking.status}`,
    social.alcohol && `alcohol ${social.alcohol.status}`,
    social.tobacco_chewing && `tobacco chewing ${social.tobacco_chewing.status}`,
    social.occupation && `works as ${social.occupation}`,
    social.notes,
  ]);
  return [
    d.hpi?.trim() && `HPI: ${d.hpi.trim()}`,
    d.past_medical_history?.length &&
      `Past medical: ${joined(d.past_medical_history.map((e) => `${e.condition} (${e.status})`))}`,
    d.past_surgical_history?.length &&
      `Past surgical: ${joined(d.past_surgical_history.map((e) => joined([e.procedure, e.year ? String(e.year) : null])))}`,
    d.family_history?.length &&
      `Family: ${joined(d.family_history.map((e) => `${e.relation}: ${e.condition}`))}`,
    habits && `Social: ${habits}`,
  ].filter((line): line is string => typeof line === "string" && line.length > 0);
}

function rosLines(d: ReviewOfSystems): string[] {
  const entries = Object.entries(d).filter(([, v]) => v !== undefined);
  const abnormal = entries
    .filter(([, v]) => v?.abnormal)
    .map(([k, v]) => `${humanise(k)}: ${v?.details?.trim() || "abnormal"}`);
  const normal = entries.filter(([, v]) => v && !v.abnormal).map(([k]) => humanise(k));
  return [...abnormal, normal.length > 0 ? `Normal: ${normal.join(", ")}` : ""].filter(Boolean);
}

function examLines(d: ExaminationData): string[] {
  const exam = d.exam ?? {};
  const systems = Object.entries(exam)
    .filter(([k, v]) => k !== "findings" && typeof v === "string" && v.trim())
    .map(([k, v]) => `${humanise(k)}: ${String(v).trim()}`);
  // The same words the examination tab shows the finding in.
  const findings = (exam.findings ?? []).map(
    (f) =>
      `${formatBodySite({ label: f.site, code: f.site_code, laterality: f.laterality })}: ${f.finding}`,
  );
  return [
    d.general_appearance?.trim() && `General appearance: ${d.general_appearance.trim()}`,
    ...systems,
    ...findings,
  ].filter((line): line is string => typeof line === "string" && line.length > 0);
}

/** The lines a structured section reads as; none when it records nothing. */
export function summariseSection(code: string, data: unknown): string[] {
  if (data === null || typeof data !== "object") return [];
  if (code === "history") return historyLines(data as HistoryData);
  if (code === "ros") return rosLines(data as ReviewOfSystems);
  if (code === "examination") return examLines(data as ExaminationData);
  return [];
}
