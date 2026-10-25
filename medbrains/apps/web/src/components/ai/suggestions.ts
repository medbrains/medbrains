import type { ChatContext } from "./transport/types";

/** Questions offered for the screen the user is on: no model call to make them. */
export interface ScreenSuggestions {
  /** On the empty conversation. */
  starters: string[];
  /** Under the latest answer. */
  followUps: string[];
}

const PATIENT: ScreenSuggestions = {
  starters: [
    "Summarise this patient's recorded allergies, medicines and problems",
    "Is anything in this patient's record inconsistent?",
    "Which discharge clearances are still pending?",
  ],
  followUps: [
    "Which required fields are missing?",
    "Summarise the latest nursing note",
    "Is anything in this record inconsistent?",
  ],
};

const GENERAL: ScreenSuggestions = {
  starters: [
    "What can you help me with?",
    "Which reports can you read for me?",
    "Show today's daily billing report",
  ],
  followUps: ["Which reports can you read for me?", "What can you help me with?"],
};

/** The questions for a screen: patient ones when a patient is open, else general. */
export function suggestionsFor(context: ChatContext | undefined): ScreenSuggestions {
  return typeof context?.patient_id === "string" && context.patient_id ? PATIENT : GENERAL;
}
