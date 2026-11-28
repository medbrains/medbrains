// PatientSearchBox — the patient search box with a "Search by" choice in front.

import { Group, TextInput } from "@mantine/core";
import { useAuthStore, useHasAnyPermission } from "@medbrains/stores";
import type { PatientSearchBy } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconSearch } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { patientsService } from "@/services/patients.service";
import { PatientSearchBySelect, SEARCH_BY } from "./PatientSearchBySelect";

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
 * hospital's default, else all. Also says whether OPD numbers are offered and
 * whether the hospital's patient list shows only the basic columns.
 * `onChange` runs after the desk picks another field (to go back to page one).
 * `settingsFailed` says the hospital's search settings did not load: search
 * still works across all fields, and the box says so rather than hiding it.
 */
export function usePatientSearchBy(onChange?: () => void) {
  const userId = useAuthStore((s) => s.user?.id);
  const canSearch = useHasAnyPermission([P.PATIENTS.LIST, P.PATIENTS.FIND]);
  const { data, isError } = useQuery({
    queryKey: ["registration-search-settings"],
    queryFn: () => patientsService.getSearchSettings(),
    enabled: canSearch,
    staleTime: 300_000,
  });
  const key = storageKey(userId);
  const [chosen, setChosen] = useState<PatientSearchBy | null>(() => rememberedBy(key));
  const opdOn = data?.opd_number_enabled === true;
  const fallback = data?.default_by ?? "all";
  const wanted = chosen ?? fallback;
  const by: PatientSearchBy = wanted === "opd_number" && !opdOn ? "all" : wanted;
  /** Pick a field, remember it for this user, and tell the caller. */
  const setBy = (next: PatientSearchBy) => {
    setChosen(next);
    onChange?.();
    try {
      localStorage.setItem(key, next);
    } catch {
      // Not remembered this time; the choice still applies.
    }
  };
  return {
    by,
    setBy,
    opdOn,
    basic: data?.patient_list_columns === "basic",
    settingsFailed: isError,
  };
}

/**
 * Characters a patient search needs before it is sent, per field. UHIDs and
 * OPD numbers can be plain numbers ("1"), so they go from one character and
 * the server matches them exactly; one or two bare digits under All are that
 * same exact lookup. A phone needs three digits; names and other All terms
 * keep `nameFloor` (the caller's anti-browse minimum).
 */
export function patientSearchMinChars(
  by: PatientSearchBy,
  query: string,
  nameFloor: number,
): number {
  if (by === "uhid" || by === "opd_number") return 1;
  if (by === "phone") return 3;
  if (by === "all" && /^\d{1,2}$/.test(query)) return 1;
  return nameFloor;
}

interface PatientSearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  by: PatientSearchBy;
  onByChange: (by: PatientSearchBy) => void;
  opdOn: boolean;
  settingsFailed?: boolean;
  className?: string;
}

/** "Search by" in front of the box; the placeholder follows the choice. */
export function PatientSearchBox({
  value,
  onChange,
  by,
  onByChange,
  opdOn,
  settingsFailed,
  className,
}: PatientSearchBoxProps) {
  const { t } = useTranslation("patients");
  const current = SEARCH_BY.find((o) => o.value === by) ?? SEARCH_BY[0];
  return (
    <Group gap={4} wrap="nowrap" className={className}>
      <PatientSearchBySelect {...{ by, onByChange, opdOn, settingsFailed }} />
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
