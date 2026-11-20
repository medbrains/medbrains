// OpdAutoCloseSelect — the hospital's "close started OPD visits on their own" setting.

import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Select } from "@/components/ui";
import { opdService } from "@/services/opd.service";
import { OpdRegistrationPolicyToggle } from "./registration-policy-toggle";

const PRESET_MINUTES = [30, 45, 60, 90, 120, 180, 240];
const QUERY_KEY = ["opd-auto-close"];

/**
 * Off, the presets, and a stored value that is not one of them (set through
 * the API), so the select never shows a hospital's real setting as blank.
 */
export function autoCloseOptions(
  current: number | null,
  minutesLabel: (count: number) => string,
  offLabel: string,
) {
  const minutes =
    current && !PRESET_MINUTES.includes(current) ? [...PRESET_MINUTES, current] : PRESET_MINUTES;
  return [
    { value: "0", label: offLabel },
    ...[...minutes]
      .sort((a, b) => a - b)
      .map((m) => ({ value: String(m), label: minutesLabel(m) })),
  ];
}

/**
 * Close OPD visits automatically N minutes after the patient is called in.
 * Admin-only, like the registration lock beside it; a failed read says so
 * rather than showing "Off".
 */
export function OpdAutoCloseSelect() {
  const { t } = useTranslation("opd");
  const canManage = useHasPermission(P.ADMIN.SETTINGS.GENERAL_MANAGE);
  const queryClient = useQueryClient();
  const { data, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => opdService.getOpdAutoClose(),
    enabled: canManage,
  });
  const mutation = useMutation({
    mutationFn: (after_minutes: number | null) => opdService.updateOpdAutoClose({ after_minutes }),
    onSuccess: (saved) => queryClient.setQueryData(QUERY_KEY, saved),
  });
  if (!canManage) return null;
  const current = data?.after_minutes ?? null;
  const error = isError
    ? t("autoClose.loadFailed", "Could not load this setting")
    : mutation.isError
      ? t("autoClose.saveFailed", "Not saved. Try again.")
      : undefined;
  return (
    <Select
      label={t("autoClose.label", "Close OPD visits automatically after")}
      data={autoCloseOptions(
        current,
        (count) => t("autoClose.minutes", { count, defaultValue: `${count} minutes` }),
        t("autoClose.off", "Off"),
      )}
      value={data ? String(current ?? 0) : null}
      onChange={(value) => mutation.mutate(value && value !== "0" ? Number(value) : null)}
      disabled={!data || mutation.isPending}
      allowDeselect={false}
      error={error}
    />
  );
}

/** The OPD page header's admin policies: the registration lock and auto-close. */
export function OpdHeaderPolicies() {
  return (
    <>
      <OpdRegistrationPolicyToggle />
      <OpdAutoCloseSelect />
    </>
  );
}
