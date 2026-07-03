/**
 * Assistant tool names — the single source of truth on the client. These MUST
 * match the backend tool `NAME`s (crates/medbrains-server/src/routes/ai.rs).
 * Use these constants instead of string literals when matching tool calls.
 */
export const AI_TOOL = {
  CHECK_DRUG_SAFETY: "check_drug_safety",
  DRAFT_PRESCRIPTION: "draft_prescription",
  GET_PATIENT_OVERVIEW: "get_patient_overview",
  CALL_API: "call_api",
  REQUEST_PATIENT: "request_patient",
} as const;

export type AiToolName = (typeof AI_TOOL)[keyof typeof AI_TOOL];

/** Human labels shown on the tool-call loader chip. */
export const AI_TOOL_LABELS: Record<string, string> = {
  [AI_TOOL.CHECK_DRUG_SAFETY]: "Checking drug safety",
  [AI_TOOL.DRAFT_PRESCRIPTION]: "Drafting prescription",
  [AI_TOOL.GET_PATIENT_OVERVIEW]: "Reading patient record",
  [AI_TOOL.CALL_API]: "Fetching data",
  [AI_TOOL.REQUEST_PATIENT]: "Waiting for patient selection",
};
