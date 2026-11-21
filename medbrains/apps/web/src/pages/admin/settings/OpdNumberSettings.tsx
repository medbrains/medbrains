// OpdNumberSettings — the hospital's own OPD number: off, typed or automatic.

import { Group, Input, NumberInput, Stack, Text, TextInput } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type {
  OpdNumberMode,
  OpdNumberPolicy,
  OpdNumberScope,
  OpdNumberView,
  PatientSearchBy,
  PatientSearchSettings,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { OPD_NUMBER_QUERY_KEY } from "@/components/Patient/OpdNumberRow";
import { Alert, Button, SegmentedControl, Select, Switch, toast } from "@/components/ui";
import { patientsService } from "@/services/patients.service";

const MODES: { value: OpdNumberMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "manual", label: "Typed at the desk" },
  { value: "auto", label: "Automatic" },
];

const SCOPES: { value: OpdNumberScope; label: string }[] = [
  { value: "patient", label: "One per patient" },
  { value: "visit", label: "One per visit" },
];

/** The policy fields of a view, as the form edits them. */
function policyOf(view: OpdNumberView): OpdNumberPolicy {
  const { mode, scope, prefix, start, allow_backdate } = view;
  return { mode, scope, prefix, start, allow_backdate };
}

/**
 * The settings panel. Loads the hospital's policy, then hands it to the form,
 * keyed on the saved value so a save shows what the server stored.
 */
export function OpdNumberSettings() {
  const canManage = useHasPermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const { data, isError, isLoading } = useQuery({
    queryKey: OPD_NUMBER_QUERY_KEY,
    queryFn: () => patientsService.getOpdNumber(),
    enabled: canManage,
  });
  if (!canManage) return null;
  if (isError)
    return <Alert tone="danger">Could not load the OPD number setting. Try again.</Alert>;
  if (isLoading || !data) return <Text c="dimmed">Loading…</Text>;
  return (
    <Stack gap="xl">
      <OpdNumberPolicyForm key={JSON.stringify(policyOf(data))} view={data} />
      <SearchDefaultSelect />
    </Stack>
  );
}

const LIST_COLUMNS = [
  { value: "full", label: "Every column" },
  { value: "basic", label: "Basic columns" },
];

const SEARCH_DEFAULTS: { value: PatientSearchBy; label: string }[] = [
  { value: "all", label: "All fields" },
  { value: "phone", label: "Phone" },
  { value: "uhid", label: "UHID" },
  { value: "name", label: "Name" },
  { value: "opd_number", label: "OPD number" },
];

/**
 * The patient list's columns and the field its search box starts on at this
 * hospital; a desk's own search choice wins.
 */
function SearchDefaultSelect() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["registration-search-settings"],
    queryFn: () => patientsService.getSearchSettings(),
  });
  const save = useMutation({
    mutationFn: (
      change: Partial<Pick<PatientSearchSettings, "default_by" | "patient_list_columns">>,
    ) => patientsService.updateSearchSettings(change),
    onSuccess: (saved) => {
      queryClient.setQueryData(["registration-search-settings"], saved);
      toast.success("Saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <Stack gap="md" maw={560}>
      <Select
        label="Patient list shows"
        description="Basic: UHID, name, age and sex, blood group, phone and OPD number."
        data={LIST_COLUMNS}
        value={data?.patient_list_columns ?? null}
        onChange={(v) => v && save.mutate({ patient_list_columns: v as "full" | "basic" })}
        disabled={!data || save.isPending}
        allowDeselect={false}
      />
      <Select
        label="Patient search starts with"
        description="Each desk can still pick another field; its last choice is remembered."
        data={SEARCH_DEFAULTS}
        value={data?.default_by ?? null}
        onChange={(v) => v && save.mutate({ default_by: v as PatientSearchBy })}
        disabled={!data || save.isPending}
        allowDeselect={false}
      />
    </Stack>
  );
}

/** The form: mode, what the number belongs to, prefix, start and backdating. */
function OpdNumberPolicyForm({ view }: { view: OpdNumberView }) {
  const queryClient = useQueryClient();
  const [policy, setPolicy] = useState<OpdNumberPolicy>(() => policyOf(view));
  /** Change some fields of the policy being edited. */
  const set = (patch: Partial<OpdNumberPolicy>) => setPolicy((p) => ({ ...p, ...patch }));
  const save = useMutation({
    mutationFn: () => patientsService.updateOpdNumberPolicy(policy),
    onSuccess: (saved) => {
      queryClient.setQueryData(OPD_NUMBER_QUERY_KEY, saved);
      toast.success("OPD number setting saved");
    },
  });
  const isOn = policy.mode !== "off";
  return (
    <Stack gap="md" maw={560}>
      <Text fw={600} size="lg">
        Hospital OPD number
      </Text>
      <Text size="sm" c="dimmed">
        The hospital's own OPD number, kept beside the UHID: the number on the paper card and
        register. Off keeps registration as it is.
      </Text>
      <Input.Wrapper label="OPD number">
        <SegmentedControl
          data={MODES}
          value={policy.mode}
          onChange={(mode) => set({ mode: mode as OpdNumberMode })}
          fullWidth
        />
      </Input.Wrapper>
      {isOn && (
        <>
          <Input.Wrapper label="Belongs to" description="Per patient: typed once at registration.">
            <SegmentedControl
              data={SCOPES}
              value={policy.scope}
              onChange={(scope) => set({ scope: scope as OpdNumberScope })}
              fullWidth
            />
          </Input.Wrapper>
          <TextInput
            label="Prefix"
            description="Leave empty for plain numbers: 1, 2, 3."
            value={policy.prefix}
            onChange={(e) => set({ prefix: e.currentTarget.value })}
            maxLength={12}
          />
          <NumberInput
            label="Start at"
            description="The first number, when none is used yet."
            value={policy.start}
            onChange={(start) => set({ start: Number(start) || 1 })}
            min={1}
            allowDecimal={false}
          />
          {policy.scope === "patient" && (
            <Switch
              label="Allow an earlier OPD date"
              description="For entering old paper records. Needs the backdate permission."
              checked={policy.allow_backdate}
              onChange={(e) => set({ allow_backdate: e.currentTarget.checked })}
            />
          )}
          <Text size="sm">
            Next number: <strong>{`${policy.prefix}${view.next.slice(view.prefix.length)}`}</strong>
            {view.previous ? ` · last used ${view.previous}` : ""}
          </Text>
        </>
      )}
      {save.isError && <Alert tone="danger">{save.error.message}</Alert>}
      <Group>
        <Button onClick={() => save.mutate()} loading={save.isPending}>
          Save
        </Button>
      </Group>
    </Stack>
  );
}
