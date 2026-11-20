// PatientSearchBox — the patient search box with a "Search by" choice in front.

import { Group, TextInput } from "@mantine/core";
import { useAuthStore, useHasAnyPermission } from "@medbrains/stores";
import type { PatientSearchBy } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "@/components/ui";
import { patientsService } from "@/services/patients.service";

const SEARCH_BY: { value: PatientSearchBy; label: string; placeholder: string }[] = [
  { value: "all", label: "All", placeholder: "Search by name, phone, UHID or Aadhaar" },
  { value: "phone", label: "Phone", placeholder: "Phone number" },
  { value: "uhid", label: "UHID", placeholder: "UHID" },
  { value: "name", label: "Name", placeholder: "Name" },
  { value: "opd_number", label: "OPD number", placeholder: "OPD number" },
];

/** The browser key that remembers this user's last choice. */
function storageKey(userId: string | undefined): string {
  return `patient-search-by:${userId ?? "anon"}`;
}

/** This user's last choice, if the browser kept one. Storage can be blocked. */
function rememberedBy(key: string): PatientSearchBy | null {
  try {
    const stored = localStorage.getItem(key);
    return SEARCH_BY.some((o) => o.value === stored) ? (stored as PatientSearchBy) : null;
  } catch {
    return null;
  }
}

/**
 * The field the search box searches: this user's last choice, else the
 * hospital's default, else all. Also says whether OPD numbers are offered.
 * `onChange` runs after the desk picks another field (to go back to page one).
 */
export function usePatientSearchBy(onChange?: () => void) {
  const userId = useAuthStore((s) => s.user?.id);
  const canSearch = useHasAnyPermission([P.PATIENTS.LIST, P.PATIENTS.FIND]);
  const { data } = useQuery({
    queryKey: ["registration-search-settings"],
    queryFn: () => patientsService.getSearchSettings(),
    enabled: canSearch,
    staleTime: 300_000,
  });
  const key = storageKey(userId);
  const [chosen, setChosen] = useState<PatientSearchBy | null>(() => rememberedBy(key));
  const opdOn = data?.opd_number_enabled ?? false;
  const fallback = data?.default_by ?? "all";
  const wanted = chosen ?? fallback;
  const by: PatientSearchBy = wanted === "opd_number" && !opdOn ? "all" : wanted;
  const setBy = (next: PatientSearchBy) => {
    setChosen(next);
    onChange?.();
    try {
      localStorage.setItem(key, next);
    } catch {
      // Not remembered this time; the choice still applies.
    }
  };
  return { by, setBy, opdOn };
}

interface PatientSearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  by: PatientSearchBy;
  onByChange: (by: PatientSearchBy) => void;
  opdOn: boolean;
  className?: string;
}

/** "Search by" in front of the box; the placeholder follows the choice. */
export function PatientSearchBox({
  value,
  onChange,
  by,
  onByChange,
  opdOn,
  className,
}: PatientSearchBoxProps) {
  const { t } = useTranslation("patients");
  const options = SEARCH_BY.filter((o) => o.value !== "opd_number" || opdOn);
  const current = SEARCH_BY.find((o) => o.value === by) ?? SEARCH_BY[0];
  return (
    <Group gap={4} wrap="nowrap" className={className}>
      <Select
        aria-label={t("directory.searchBy", "Search by")}
        data={options.map(({ value: v, label }) => ({ value: v, label }))}
        value={by}
        onChange={(v) => onByChange((v as PatientSearchBy | null) ?? "all")}
        allowDeselect={false}
        size="sm"
        w={140}
        data-testid="patient-search-by"
      />
      <TextInput
        placeholder={current?.placeholder}
        leftSection={<IconSearch size={16} />}
        aria-label={t("directory.searchLabel")}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        size="sm"
        flex={1}
        data-testid="patient-search-input"
      />
    </Group>
  );
}
