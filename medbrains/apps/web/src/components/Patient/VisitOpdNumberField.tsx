// VisitOpdNumberField — the hospital OPD number when an OPD visit is started.

import { Group, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { isoDay } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { OpdNumberView, PatientContext } from "@medbrains/types";
import { P } from "@medbrains/types";
import { type QueryClient, useQuery } from "@tanstack/react-query";
import { patientContextQueryKey, usePatientContext } from "@/hooks/usePatientContext";
import { patientsService } from "@/services/patients.service";
import { OpdNumberBadge } from "./OpdNumberBadge";
import { OPD_NUMBER_QUERY_KEY } from "./OpdNumberRow";

/** What the desk entered for the visit's OPD number; unset fields mean untouched. */
export interface VisitOpdEntry {
  number?: string;
  date?: string;
}

/**
 * Whether this visit asks for an OPD number: per visit, always; per patient,
 * only for a patient who has none yet (registered before the hospital turned
 * it on). Off: never.
 */
export function visitAsksForNumber(view: OpdNumberView | undefined, patientHas: boolean): boolean {
  if (!view || view.mode === "off") return false;
  return view.scope === "visit" || !patientHas;
}

/**
 * What the visit request carries: in manual mode what the field shows (typed,
 * else the pre-filled next number), so an untouched field saves the number the
 * desk saw; in auto mode nothing (the server picks). The date only per patient.
 */
export function visitOpdFields(
  view: OpdNumberView | undefined,
  patientHas: boolean,
  entry: VisitOpdEntry,
): { opd_number?: string; opd_date?: string } {
  if (!view || !visitAsksForNumber(view, patientHas)) return {};
  const typed = (entry.number ?? view.next).trim();
  return {
    opd_number: view.mode === "manual" ? typed || undefined : undefined,
    opd_date: view.scope === "patient" ? entry.date : undefined,
  };
}

/** [`visitOpdFields`] from what the field already loaded, for the submit. */
export function visitOpdFieldsFromCache(
  client: QueryClient,
  patientId: string,
  entry: VisitOpdEntry,
): { opd_number?: string; opd_date?: string } {
  const view = client.getQueryData<OpdNumberView>(OPD_NUMBER_QUERY_KEY);
  const context = client.getQueryData<PatientContext>(patientContextQueryKey(patientId));
  return visitOpdFields(view, Boolean(context?.opd_number), entry);
}

interface VisitOpdNumberFieldProps {
  patientId: string;
  entry: VisitOpdEntry;
  onChange: (entry: VisitOpdEntry) => void;
}

/**
 * The start-visit form's OPD number. A patient who already has one sees it;
 * one who needs it gets the field with the next free number and Previous/Next,
 * and per patient the register date, earlier only where the hospital allows
 * it and the desk may backdate.
 */
export function VisitOpdNumberField({ patientId, entry, onChange }: VisitOpdNumberFieldProps) {
  const canStart = useHasPermission(P.OPD.VISIT.CREATE);
  const canBackdate = useHasPermission(P.PATIENTS.OPD_NUMBER.BACKDATE);
  const { data: view } = useQuery({
    queryKey: OPD_NUMBER_QUERY_KEY,
    queryFn: () => patientsService.getOpdNumber(),
    enabled: canStart,
  });
  const { data: context } = usePatientContext(patientId || null);
  const patientHas = Boolean(context?.opd_number);
  if (view && view.mode !== "off" && view.scope === "patient" && patientHas) {
    return <OpdNumberBadge opd={context} />;
  }
  if (!patientId || !view || !visitAsksForNumber(view, patientHas)) return null;
  const manual = view.mode === "manual";
  const today = new Date();
  return (
    <Group grow align="flex-start">
      <TextInput
        label="OPD number"
        data-testid="field-visit-opd_number"
        description={
          manual
            ? `Previous: ${view.previous ?? "none"} · Next: ${view.next}`
            : "Given when you save"
        }
        required={manual}
        readOnly={!manual}
        inputMode="numeric"
        value={manual ? (entry.number ?? view.next) : view.next}
        onChange={(e) => onChange({ ...entry, number: e.currentTarget.value })}
      />
      {view.scope === "patient" && (
        <DatePickerInput
          label="OPD date"
          description={
            view.allow_backdate && canBackdate ? "The date in the paper register" : "Today"
          }
          value={entry.date ? new Date(entry.date) : today}
          onChange={(v) => onChange({ ...entry, date: v ? isoDay(new Date(v)) : undefined })}
          maxDate={today}
          readOnly={!(view.allow_backdate && canBackdate)}
          valueFormat="DD MMM YYYY"
        />
      )}
    </Group>
  );
}
