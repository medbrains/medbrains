import type {
  IcuBundleCheckFormInput,
  IcuDeviceFormInput,
  IcuDeviceTypeFormValue,
  IcuFlowsheetFormInput,
  IcuNeonatalFormInput,
  IcuNutritionFormInput,
  IcuNutritionRouteFormValue,
  IcuScoreFormInput,
  IcuScoreTypeFormValue,
  IcuVentilatorFormInput,
  IcuVentilatorModeFormValue,
} from "@medbrains/schemas";
import {
  numberFromFormValue,
  optionalNumberFromFormValue,
  optionalTextFromFormValue,
} from "@medbrains/schemas";
import type {
  CreateIcuBundleCheckRequest,
  CreateIcuDeviceRequest,
  CreateIcuFlowsheetRequest,
  CreateIcuNeonatalRequest,
  CreateIcuNutritionRequest,
  CreateIcuScoreRequest,
  CreateIcuVentilatorRequest,
} from "@medbrains/types";

export const ICU_VENTILATOR_MODE_OPTIONS: Array<{
  value: IcuVentilatorModeFormValue;
  label: string;
}> = [
  { value: "cmv", label: "CMV" },
  { value: "acv", label: "ACV" },
  { value: "simv", label: "SIMV" },
  { value: "psv", label: "PSV" },
  { value: "cpap", label: "CPAP" },
  { value: "bipap", label: "BiPAP" },
  { value: "hfov", label: "HFOV" },
  { value: "aprv", label: "APRV" },
  { value: "niv", label: "NIV" },
  { value: "other", label: "Other" },
];

export const ICU_SCORE_TYPE_OPTIONS: Array<{
  value: IcuScoreTypeFormValue;
  label: string;
}> = [
  { value: "apache_ii", label: "APACHE II" },
  { value: "apache_iv", label: "APACHE IV" },
  { value: "sofa", label: "SOFA" },
  { value: "gcs", label: "GCS" },
  { value: "prism", label: "PRISM" },
  { value: "snappe", label: "SNAPPE" },
  { value: "rass", label: "RASS" },
  { value: "cam_icu", label: "CAM-ICU" },
];

export const ICU_DEVICE_TYPE_OPTIONS: Array<{
  value: IcuDeviceTypeFormValue;
  label: string;
}> = [
  { value: "central_line", label: "Central Line" },
  { value: "urinary_catheter", label: "Urinary Catheter" },
  { value: "ventilator", label: "Ventilator" },
  { value: "arterial_line", label: "Arterial Line" },
  { value: "peripheral_iv", label: "Peripheral IV" },
  { value: "nasogastric_tube", label: "NG Tube" },
  { value: "chest_tube", label: "Chest Tube" },
  { value: "tracheostomy", label: "Tracheostomy" },
];

export const ICU_NUTRITION_ROUTE_OPTIONS: Array<{
  value: IcuNutritionRouteFormValue;
  label: string;
}> = [
  { value: "enteral", label: "Enteral" },
  { value: "parenteral", label: "Parenteral" },
  { value: "oral", label: "Oral" },
  { value: "npo", label: "NPO" },
];

export const DEFAULT_ICU_FLOWSHEET_FORM_VALUES: IcuFlowsheetFormInput = {
  heart_rate: "",
  systolic_bp: "",
  diastolic_bp: "",
  mean_arterial_bp: "",
  respiratory_rate: "",
  spo2: "",
  temperature: "",
  cvp: "",
  intake_ml: "",
  output_ml: "",
  urine_ml: "",
  drain_ml: "",
  notes: "",
};

export const DEFAULT_ICU_VENTILATOR_FORM_VALUES: IcuVentilatorFormInput = {
  mode: "cmv",
  fio2: "",
  peep: "",
  tidal_volume: "",
  respiratory_rate: "",
  pip: "",
  plateau_pressure: "",
  ph: "",
  pao2: "",
  paco2: "",
  hco3: "",
  sao2: "",
  lactate: "",
  notes: "",
};

export const DEFAULT_ICU_SCORE_FORM_VALUES: IcuScoreFormInput = {
  score_type: "sofa",
  score_value: 0,
  predicted_mortality: "",
  notes: "",
};

export const DEFAULT_ICU_DEVICE_FORM_VALUES: IcuDeviceFormInput = {
  device_type: "central_line",
  site: "",
  notes: "",
};

export const DEFAULT_ICU_BUNDLE_CHECK_FORM_VALUES: IcuBundleCheckFormInput = {
  is_compliant: true,
  still_needed: true,
  notes: "",
};

export const DEFAULT_ICU_NUTRITION_FORM_VALUES: IcuNutritionFormInput = {
  route: "enteral",
  formula_name: "",
  rate_ml_hr: "",
  volume_ml: "",
  calories_kcal: "",
  protein_gm: "",
  notes: "",
};

export const DEFAULT_ICU_NEONATAL_FORM_VALUES: IcuNeonatalFormInput = {
  gestational_age_weeks: "",
  birth_weight_gm: "",
  current_weight_gm: "",
  bilirubin_total: "",
  bilirubin_direct: "",
  phototherapy_active: false,
  phototherapy_hours: "",
  breast_milk_type: "",
  breast_milk_volume_ml: "",
  hearing_screen_result: "",
  sepsis_screen_result: "",
  mother_patient_id: "",
  notes: "",
};

export function normalizeIcuVentilatorMode(value: string | null): IcuVentilatorModeFormValue {
  return ICU_VENTILATOR_MODE_OPTIONS.find((option) => option.value === value)?.value ?? "cmv";
}

export function normalizeIcuScoreType(value: string | null): IcuScoreTypeFormValue {
  return ICU_SCORE_TYPE_OPTIONS.find((option) => option.value === value)?.value ?? "sofa";
}

export function normalizeIcuDeviceType(value: string | null): IcuDeviceTypeFormValue {
  return ICU_DEVICE_TYPE_OPTIONS.find((option) => option.value === value)?.value ?? "central_line";
}

export function normalizeIcuNutritionRoute(value: string | null): IcuNutritionRouteFormValue {
  return ICU_NUTRITION_ROUTE_OPTIONS.find((option) => option.value === value)?.value ?? "enteral";
}

export function toCreateIcuFlowsheetRequest(
  values: IcuFlowsheetFormInput,
): CreateIcuFlowsheetRequest {
  return {
    heart_rate: optionalNumberFromFormValue(values.heart_rate),
    systolic_bp: optionalNumberFromFormValue(values.systolic_bp),
    diastolic_bp: optionalNumberFromFormValue(values.diastolic_bp),
    mean_arterial_bp: optionalNumberFromFormValue(values.mean_arterial_bp),
    respiratory_rate: optionalNumberFromFormValue(values.respiratory_rate),
    spo2: optionalNumberFromFormValue(values.spo2),
    temperature: optionalNumberFromFormValue(values.temperature),
    cvp: optionalNumberFromFormValue(values.cvp),
    intake_ml: optionalNumberFromFormValue(values.intake_ml),
    output_ml: optionalNumberFromFormValue(values.output_ml),
    urine_ml: optionalNumberFromFormValue(values.urine_ml),
    drain_ml: optionalNumberFromFormValue(values.drain_ml),
    notes: optionalTextFromFormValue(values.notes),
  };
}

export function toCreateIcuVentilatorRequest(
  values: IcuVentilatorFormInput,
): CreateIcuVentilatorRequest {
  return {
    mode: values.mode,
    fio2: optionalNumberFromFormValue(values.fio2),
    peep: optionalNumberFromFormValue(values.peep),
    tidal_volume: optionalNumberFromFormValue(values.tidal_volume),
    respiratory_rate: optionalNumberFromFormValue(values.respiratory_rate),
    pip: optionalNumberFromFormValue(values.pip),
    plateau_pressure: optionalNumberFromFormValue(values.plateau_pressure),
    ph: optionalNumberFromFormValue(values.ph),
    pao2: optionalNumberFromFormValue(values.pao2),
    paco2: optionalNumberFromFormValue(values.paco2),
    hco3: optionalNumberFromFormValue(values.hco3),
    sao2: optionalNumberFromFormValue(values.sao2),
    lactate: optionalNumberFromFormValue(values.lactate),
    notes: optionalTextFromFormValue(values.notes),
  };
}

export function toCreateIcuScoreRequest(values: IcuScoreFormInput): CreateIcuScoreRequest {
  return {
    score_type: values.score_type,
    score_value: numberFromFormValue(values.score_value, 0),
    predicted_mortality: optionalNumberFromFormValue(values.predicted_mortality),
    notes: optionalTextFromFormValue(values.notes),
  };
}

export function toCreateIcuDeviceRequest(values: IcuDeviceFormInput): CreateIcuDeviceRequest {
  return {
    device_type: values.device_type,
    site: optionalTextFromFormValue(values.site),
    notes: optionalTextFromFormValue(values.notes),
  };
}

export function toCreateIcuBundleCheckRequest(
  values: IcuBundleCheckFormInput,
): CreateIcuBundleCheckRequest {
  return {
    is_compliant: values.is_compliant,
    still_needed: values.still_needed,
    notes: optionalTextFromFormValue(values.notes),
  };
}

export function toCreateIcuNutritionRequest(
  values: IcuNutritionFormInput,
): CreateIcuNutritionRequest {
  return {
    route: values.route,
    formula_name: optionalTextFromFormValue(values.formula_name),
    rate_ml_hr: optionalNumberFromFormValue(values.rate_ml_hr),
    volume_ml: optionalNumberFromFormValue(values.volume_ml),
    calories_kcal: optionalNumberFromFormValue(values.calories_kcal),
    protein_gm: optionalNumberFromFormValue(values.protein_gm),
    notes: optionalTextFromFormValue(values.notes),
  };
}

export function toCreateIcuNeonatalRequest(values: IcuNeonatalFormInput): CreateIcuNeonatalRequest {
  return {
    gestational_age_weeks: optionalNumberFromFormValue(values.gestational_age_weeks),
    birth_weight_gm: optionalNumberFromFormValue(values.birth_weight_gm),
    current_weight_gm: optionalNumberFromFormValue(values.current_weight_gm),
    bilirubin_total: optionalNumberFromFormValue(values.bilirubin_total),
    bilirubin_direct: optionalNumberFromFormValue(values.bilirubin_direct),
    phototherapy_active: values.phototherapy_active,
    phototherapy_hours: optionalNumberFromFormValue(values.phototherapy_hours),
    breast_milk_type: optionalTextFromFormValue(values.breast_milk_type),
    breast_milk_volume_ml: optionalNumberFromFormValue(values.breast_milk_volume_ml),
    hearing_screen_result: optionalTextFromFormValue(values.hearing_screen_result),
    sepsis_screen_result: optionalTextFromFormValue(values.sepsis_screen_result),
    mother_patient_id: optionalTextFromFormValue(values.mother_patient_id),
    notes: optionalTextFromFormValue(values.notes),
  };
}
