// PatientSearchBySelect — the "Search by" choice, shared by the patient list's
// search box and the patient picker (one list of fields, one behaviour).

import type { PatientSearchBy } from "@medbrains/types";
import { useTranslation } from "react-i18next";
import { Select } from "@/components/ui";

export const SEARCH_BY: { value: PatientSearchBy; label: string; placeholder: string }[] = [
  { value: "all", label: "All", placeholder: "Search by name, phone, UHID or Aadhaar" },
  { value: "phone", label: "Phone", placeholder: "Phone number" },
  { value: "uhid", label: "UHID", placeholder: "UHID" },
  { value: "name", label: "Name", placeholder: "Name" },
  { value: "opd_number", label: "OPD number", placeholder: "OPD number" },
];

interface PatientSearchBySelectProps {
  by: PatientSearchBy;
  onByChange: (by: PatientSearchBy) => void;
  opdOn: boolean;
  settingsFailed?: boolean;
  size?: string;
}

/**
 * The field a patient search searches. OPD number is offered only when the
 * hospital keeps one; settings that failed to load are said, not hidden.
 */
export function PatientSearchBySelect({
  by,
  onByChange,
  opdOn,
  settingsFailed,
  size = "sm",
}: PatientSearchBySelectProps) {
  const { t } = useTranslation("patients");
  const options = SEARCH_BY.filter((o) => o.value !== "opd_number" || opdOn);
  return (
    <Select
      aria-label={t("directory.searchBy", "Search by")}
      data={options.map(({ value, label }) => ({ value, label }))}
      value={by}
      onChange={(v) => onByChange((v as PatientSearchBy | null) ?? "all")}
      allowDeselect={false}
      error={
        settingsFailed ? t("directory.searchSettingsFailed", "Settings did not load") : undefined
      }
      size={size}
      w={140}
      data-testid="patient-search-by"
    />
  );
}
