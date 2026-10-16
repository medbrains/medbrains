import type { RecordTtiRequest, TtiMarker, TtiPanel, TtiResultValue } from "@medbrains/types";

/** The statutory panel, in the order the register lists it. */
export const TTI_MARKERS: { value: TtiMarker; label: string }[] = [
  { value: "hiv", label: "HIV 1/2" },
  { value: "hbsag", label: "HBsAg" },
  { value: "hcv", label: "HCV" },
  { value: "syphilis", label: "Syphilis" },
  { value: "malaria", label: "Malaria" },
];

export const TTI_RESULT_OPTIONS: { value: TtiResultValue; label: string }[] = [
  { value: "non_reactive", label: "Non-reactive" },
  { value: "reactive", label: "Reactive" },
  { value: "indeterminate", label: "Indeterminate" },
];

export type TtiFormValues = Partial<Record<TtiMarker, TtiResultValue | "">> & {
  method?: string;
  kit_lot?: string;
};

/** Only the markers the technician entered; a blank is "not tested yet". */
export function toTtiRequest(values: TtiFormValues): RecordTtiRequest {
  const method = values.method?.trim() || undefined;
  const kit_lot = values.kit_lot?.trim() || undefined;
  return {
    results: TTI_MARKERS.flatMap(({ value: marker }) => {
      const result = values[marker];
      return result ? [{ marker, result, method, kit_lot }] : [];
    }),
  };
}

export function markerLabels(markers: TtiMarker[]): string {
  return markers.map((m) => TTI_MARKERS.find((x) => x.value === m)?.label ?? m).join(", ");
}

/** What the screen says about a donation's screening, in words. */
export function ttiSummary(panel: TtiPanel): string {
  if (panel.status === "withheld") return "Screening results are restricted for your role.";
  if (panel.status === "cleared") return "All five markers non-reactive — units may be released.";
  if (panel.status === "reactive") {
    const lookback =
      panel.transfused_units > 0
        ? ` ${panel.transfused_units} unit(s) already transfused — start a lookback.`
        : "";
    return `Reactive for ${markerLabels(panel.outstanding)}. Units are quarantined for discard and the donor is deferred.${lookback}`;
  }
  return `Not yet non-reactive: ${markerLabels(panel.outstanding)}. Units stay in quarantine.`;
}
