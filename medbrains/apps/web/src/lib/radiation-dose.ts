import type { RadiationDoseRecord, RadiationDoseSource } from "@medbrains/types";

/** Where a dose figure came from, as a reader needs to weigh it. */
export const DOSE_SOURCE_LABEL: Record<RadiationDoseSource, string> = {
  manual: "Entered",
  rdsr: "Scanner dose report",
  dicom_header: "Image headers",
};

const unit = (value: string | number | null, suffix: string) =>
  value === null ? null : `${Number(value)} ${suffix}`;

/** The figures a record holds, each with its unit; blanks left out. */
export function doseFigures(d: RadiationDoseRecord): string[] {
  const technique =
    d.kvp !== null || d.mas !== null
      ? [unit(d.kvp, "kVp"), unit(d.mas, "mAs")].filter(Boolean).join(" / ")
      : null;
  return [
    unit(d.ctdi_vol, "mGy CTDIvol"),
    unit(d.dlp, "mGy·cm DLP"),
    unit(d.dap, "Gy·cm² DAP"),
    unit(d.fluoroscopy_time_seconds, "s screening"),
    d.exposure_count === null
      ? null
      : `${d.exposure_count} exposure${d.exposure_count === 1 ? "" : "s"}`,
    technique,
  ].filter((f): f is string => f !== null);
}
