export type SoapSectionKey = "chief_complaint" | "examination" | "history" | "plan";

export interface SoapKeywordSuggestion {
  id: string;
  section: SoapSectionKey;
  label: string;
  keywords: string[];
  text: string;
  hint: string;
  source: string;
}

export const SOAP_KEYWORD_SUGGESTIONS: Record<SoapSectionKey, SoapKeywordSuggestion[]> = {
  chief_complaint: [
    {
      id: "s-visit-header",
      section: "chief_complaint",
      label: "visit header",
      keywords: ["date", "time", "provider", "visit", "present", "chief"],
      hint: "Date, time, provider and presenting complaint",
      text: "Date:\nTime:\nProvider:\nThis ___ year old ___ presents for ___.",
      source: "medbrains_soap_template",
    },
    {
      id: "s-hpi",
      section: "chief_complaint",
      label: "HPI scaffold",
      keywords: ["hpi", "history", "onset", "location", "duration", "severity", "timing"],
      hint: "Location, quality, severity, timing, context and associated symptoms",
      text: "History of present illness:\nLocation:\nQuality:\nSeverity:\nDuration:\nTiming/onset:\nTiming/frequency:\nContext:\nRelieved by:\nWorsened by:\nAssociated signs and symptoms:",
      source: "medbrains_soap_template",
    },
    {
      id: "s-ros",
      section: "chief_complaint",
      label: "ROS systems",
      keywords: ["ros", "review", "symptoms", "systems", "constitutional", "cardio", "neuro"],
      hint: "Problem-focused review of systems",
      text: "Review of systems:\nConstitutional:\nEyes:\nENT:\nCardiovascular:\nRespiratory:\nGastrointestinal:\nGenitourinary:\nMusculoskeletal:\nSkin/breast:\nNeurological:\nPsychiatric:\nEndocrine:\nHematologic/lymphatic:\nAllergic/immunologic:",
      source: "medbrains_soap_template",
    },
    {
      id: "s-social-history",
      section: "chief_complaint",
      label: "social history",
      keywords: ["social", "culture", "education", "housing", "occupation", "tobacco", "alcohol"],
      hint: "Social determinants and habits relevant to care",
      text: "Social history:\nCultural background:\nEducation level:\nEconomic condition:\nHousing:\nNumber in household:\nMarital status:\nLives with:\nChildren:\nOccupation:\nOccupational hazards:\nNutrition:\nExercise:\nTobacco use:\nCaffeine:\nSexual activity/contraception:\nAlcohol/recreational drug use:",
      source: "medbrains_soap_template",
    },
    {
      id: "s-past-medical",
      section: "chief_complaint",
      label: "past medical history",
      keywords: ["pmh", "past", "medical", "hospitalization", "surgery", "chronic"],
      hint: "Hospitalizations, surgeries and chronic problems",
      text: "Past medical history:\nHospitalizations:\nSurgical history:\nChronic medical problems: hypertension, diabetes, coronary heart disease, cerebrovascular disease, asthma/COPD, arthritis, gout, renal disease, thyroid disease, other.",
      source: "medbrains_soap_template",
    },
    {
      id: "s-psychiatric-immunization",
      section: "chief_complaint",
      label: "psych/immunization",
      keywords: ["psychiatric", "depression", "anxiety", "immunization", "allergy", "transfusion"],
      hint: "Mental health, immunizations, transfusions and allergies",
      text: "Psychiatric history: depression, anxiety, substance abuse, other.\nImmunizations:\nChildhood illnesses:\nTransfusions:\nAllergies:",
      source: "medbrains_soap_template",
    },
    {
      id: "s-family-history",
      section: "chief_complaint",
      label: "family history",
      keywords: ["family", "genogram", "cancer", "hypertension", "diabetes", "stroke"],
      hint: "Family/genetic risk history",
      text: "Family history/genogram:\nCancer:\nHypertension:\nHyperlipidemia:\nDiabetes type II:\nCoronary artery disease:\nStroke:\nAlzheimer's:\nDepression:\nOsteoporosis:\nDomestic violence:",
      source: "medbrains_soap_template",
    },
  ],
  examination: [
    {
      id: "o-vitals-line",
      section: "examination",
      label: "vitals block",
      keywords: ["vitals", "bp", "pulse", "temperature", "spo2", "weight", "height"],
      hint: "Vitals in objective format",
      text: "Vitals: height ___, weight ___, temperature ___, BP ___, pulse ___, RR ___, SpO2 ___.",
      source: "medbrains_soap_template",
    },
    {
      id: "o-general-normal",
      section: "examination",
      label: "general normal",
      keywords: ["general", "appearance", "oriented", "distress", "ambulating"],
      hint: "General examination line",
      text: "General: well appearing, well nourished, no distress. Oriented x3, normal mood and affect. Ambulating without difficulty.",
      source: "medbrains_soap_template",
    },
    {
      id: "o-skin-hair-nails",
      section: "examination",
      label: "skin hair nails",
      keywords: ["skin", "hair", "nails", "rash", "turgor", "bruising"],
      hint: "Skin, hair and nail findings",
      text: "Skin: good turgor, no rash, unusual bruising or prominent lesions.\nHair: normal texture and distribution.\nNails: normal color, no deformities.",
      source: "medbrains_soap_template",
    },
    {
      id: "o-heent",
      section: "examination",
      label: "HEENT normal",
      keywords: ["heent", "head", "eyes", "ears", "nose", "mouth", "pharynx"],
      hint: "Head, eyes, ears, nose, mouth and pharynx",
      text: "HEENT:\nHead: normocephalic, atraumatic.\nEyes: conjunctiva clear, sclera non-icteric, EOM intact, PERRL.\nEars: canals clear, tympanic membranes mobile, hearing intact.\nNose: mucosa non-inflamed, septum and turbinates normal.\nMouth/pharynx: mucous membranes moist, no mucosal lesions or exudate.",
      source: "medbrains_soap_template",
    },
    {
      id: "o-neck-heart-lungs",
      section: "examination",
      label: "neck heart lungs",
      keywords: ["neck", "heart", "cardio", "lungs", "respiratory", "chest"],
      hint: "Neck and cardiorespiratory examination",
      text: "Neck: supple, no lesions, bruits or adenopathy; thyroid non-enlarged and non-tender.\nHeart: regular rate and rhythm, no murmur or gallop.\nLungs: clear to auscultation and percussion.",
      source: "medbrains_soap_template",
    },
    {
      id: "o-abdomen-back",
      section: "examination",
      label: "abdomen back",
      keywords: ["abdomen", "back", "bowel", "cva", "gastro"],
      hint: "Abdomen and back examination",
      text: "Abdomen: bowel sounds normal, no tenderness, organomegaly, masses or hernia.\nBack: spine normal without deformity or tenderness; no CVA tenderness.",
      source: "medbrains_soap_template",
    },
    {
      id: "o-msk-neuro",
      section: "examination",
      label: "MSK/neuro",
      keywords: ["msk", "musculoskeletal", "neuro", "gait", "spine", "reflex"],
      hint: "Musculoskeletal and neurological examination",
      text: "Musculoskeletal: normal gait and station, no deformity, focal tenderness, effusion, instability or abnormal tone.\nNeurologic: cranial nerves grossly intact, sensation intact, reflexes appropriate.",
      source: "medbrains_soap_template",
    },
    {
      id: "o-gendered-exam",
      section: "examination",
      label: "GU/pelvic/breast",
      keywords: ["gu", "pelvic", "breast", "rectal", "genitourinary"],
      hint: "Use only when examined and clinically relevant",
      text: "Rectal/GU/pelvic/breast examination: findings documented as examined, with chaperone/consent status if applicable.",
      source: "medbrains_soap_template",
    },
  ],
  history: [
    {
      id: "a-assessment",
      section: "history",
      label: "assessment scaffold",
      keywords: ["assessment", "impression", "diagnosis", "differential", "risk"],
      hint: "Clinical impression and differential",
      text: "Assessment:\nHealth status and lifestyle risks:\nPrimary diagnosis:\nDifferential diagnosis:\nSeverity/risk:",
      source: "medbrains_soap_template",
    },
    {
      id: "a-problem-list",
      section: "history",
      label: "problem list",
      keywords: ["problem", "problems", "status", "evidence"],
      hint: "Problem-oriented assessment",
      text: "Problem list:\n1. ___ - status ___ - evidence ___.\n2. ___ - status ___ - evidence ___.",
      source: "medbrains_soap_template",
    },
    {
      id: "a-differential",
      section: "history",
      label: "differential reasoning",
      keywords: ["differential", "ddx", "likely", "because"],
      hint: "Why this diagnosis is most likely",
      text: "Differential diagnoses considered: ___. Most likely diagnosis is ___ based on ___.",
      source: "medbrains_soap_template",
    },
    {
      id: "a-red-flags",
      section: "history",
      label: "red flags",
      keywords: ["red", "flag", "emergency", "urgent", "safety"],
      hint: "Safety escalation statement",
      text: "Red flags reviewed. No immediate emergency features identified today. Patient advised to return urgently for ___.",
      source: "medbrains_soap_template",
    },
  ],
  plan: [
    {
      id: "p-labs-xray",
      section: "plan",
      label: "labs/imaging",
      keywords: ["lab", "labs", "xray", "x-ray", "imaging", "investigation"],
      hint: "Investigation orders",
      text: "Laboratory:\nX-rays/imaging:\nOther investigations:",
      source: "medbrains_soap_template",
    },
    {
      id: "p-meds",
      section: "plan",
      label: "medication plan",
      keywords: ["med", "meds", "medicine", "drug", "dose", "rx"],
      hint: "Medicine dose, duration and reconciliation",
      text: "Medications:\nDose/frequency/duration:\nAllergy and interaction risk reviewed:\nMedication reconciliation updated:",
      source: "medbrains_soap_template",
    },
    {
      id: "p-education",
      section: "plan",
      label: "patient education",
      keywords: ["education", "counsel", "warning", "advice", "explain"],
      hint: "Patient education and warning signs",
      text: "Patient education: diagnosis explained, warning signs discussed, medicine use explained, questions answered.",
      source: "medbrains_soap_template",
    },
    {
      id: "p-followup",
      section: "plan",
      label: "follow-up",
      keywords: ["follow", "review", "return", "days", "weeks"],
      hint: "Follow-up and earlier return criteria",
      text: "Follow-up: review in ___ days/weeks, earlier if ___.",
      source: "medbrains_soap_template",
    },
  ],
};

export function searchSoapKeywordSuggestions(
  sectionKey: SoapSectionKey,
  token: string,
  limit = 5,
): SoapKeywordSuggestion[] {
  const normalized = token.trim().toLowerCase();
  if (normalized.length < 2) return [];

  return SOAP_KEYWORD_SUGGESTIONS[sectionKey]
    .map((entry) => {
      const labelHit = entry.label.includes(normalized);
      const keywordStart = entry.keywords.some((keyword) => keyword.startsWith(normalized));
      const keywordInside = entry.keywords.some((keyword) => keyword.includes(normalized));
      const score = labelHit ? 3 : keywordStart ? 2 : keywordInside ? 1 : 0;
      return { entry, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label))
    .slice(0, limit)
    .map((candidate) => candidate.entry);
}
