// Nurse roster — the maker screen for nurse_shift_assignments.
//
// The table has carried a ward's staffing since it was created and never had
// a way to write a row. The care-view board reads it, so a ward nobody had
// rostered rendered as a ward with nobody on it, and the 24-hour
// initial-assessment pipeline, finding no nurse, raised nothing.

import { Group, Stack, Text } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useHasPermission } from "@medbrains/stores";
import type { NurseRosterEntry } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/DataTable";
import type { Column } from "@/components/data-table-types";
import { Badge, Button, Checkbox, Select, toast } from "@/components/ui";
import { WardSelect } from "@/components/WardSelect";
import { nurseActivitiesService } from "@/services/nurseActivities.service";

const SHIFTS = [
  { value: "day", label: "Day" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
] as const;
type Shift = (typeof SHIFTS)[number]["value"];

/** Local calendar date, not UTC — a night shift rostered at 23:30 IST is today's. */
export function toIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function RosterTab() {
  const canView = useHasPermission(P.NURSE.ROSTER_VIEW);
  const canManage = useHasPermission(P.NURSE.ROSTER_MANAGE);
  const qc = useQueryClient();

  const [wardId, setWardId] = useState("");
  // Mantine's picker speaks ISO date strings; so does the API. Only the
  // default needs a Date, and it is the LOCAL day — see toIsoDate.
  const [shiftDate, setShiftDate] = useState(() => toIsoDate(new Date()));

  const roster = useQuery({
    queryKey: ["nurse-roster", wardId, shiftDate],
    queryFn: () =>
      nurseActivitiesService.listNurseRoster({
        ...(wardId ? { ward_id: wardId } : {}),
        shift_date: shiftDate,
      }),
    enabled: canView,
  });

  const candidates = useQuery({
    queryKey: ["nurse-roster-candidates"],
    queryFn: () => nurseActivitiesService.listNurseRosterCandidates(),
    enabled: canManage,
    staleTime: 300_000,
  });
  const candidateOptions = useMemo(
    () => (candidates.data ?? []).map((c) => ({ value: c.id, label: c.full_name })),
    [candidates.data],
  );

  const [nurseId, setNurseId] = useState<string | null>(null);
  const [shift, setShift] = useState<Shift>("day");
  const [isCharge, setIsCharge] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["nurse-roster"] });

  const add = useMutation({
    mutationFn: () =>
      nurseActivitiesService.createNurseRosterEntry({
        nurse_user_id: nurseId ?? "",
        ward_id: wardId,
        shift_type: shift,
        shift_date: shiftDate,
        is_charge: isCharge,
      }),
    onSuccess: () => {
      setNurseId(null);
      setIsCharge(false);
      void invalidate();
    },
    // 409 is the unique index: same nurse, same shift. Say so in words.
    onError: (e: Error) => toast.error(e.message, { title: "Could not roster" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => nurseActivitiesService.deleteNurseRosterEntry(id),
    onSuccess: () => void invalidate(),
    onError: (e: Error) => toast.error(e.message, { title: "Could not remove" }),
  });

  const columns = useMemo<Column<NurseRosterEntry>[]>(
    () => [
      { key: "nurse", label: "Nurse", render: (r) => r.nurse_name },
      { key: "ward", label: "Ward", render: (r) => r.ward_name ?? "—" },
      {
        key: "shift",
        label: "Shift",
        render: (r) => SHIFTS.find((s) => s.value === r.shift_type)?.label ?? r.shift_type,
      },
      {
        key: "role",
        label: "Role",
        render: (r) =>
          r.is_charge ? (
            <Badge tone="primary">Charge nurse</Badge>
          ) : r.primary_assigned ? (
            <Badge tone="neutral">Primary</Badge>
          ) : (
            <Badge tone="neutral">Relief</Badge>
          ),
      },
      { key: "patients", label: "Patients", render: (r) => String(r.patient_count) },
      {
        key: "actions",
        label: "",
        render: (r) =>
          canManage ? (
            <Button
              tone="danger-ghost"
              size="xs"
              onClick={() => remove.mutate(r.id)}
              loading={remove.isPending && remove.variables === r.id}
              aria-label={`Take ${r.nurse_name} off the ${r.shift_type} shift`}
            >
              Remove
            </Button>
          ) : null,
      },
    ],
    [canManage, remove],
  );

  if (!canView) {
    return (
      <Text size="sm" c="dimmed">
        Viewing the roster needs the roster view permission.
      </Text>
    );
  }

  return (
    <Stack>
      <Group align="flex-end" gap="sm">
        <WardSelect value={wardId} onChange={setWardId} label="Ward" />
        <DatePickerInput
          label="Date"
          value={shiftDate}
          onChange={(v) => v && setShiftDate(v)}
          valueFormat="DD MMM YYYY"
        />
      </Group>

      {canManage && (
        <Group align="flex-end" gap="sm" wrap="wrap">
          <Select
            label="Nurse"
            placeholder={candidateOptions.length ? "Pick a nurse" : "No active nurses"}
            data={candidateOptions}
            value={nurseId}
            onChange={setNurseId}
            searchable
            nothingFoundMessage="No nurse by that name"
            style={{ minWidth: 240 }}
          />
          <Select
            label="Shift"
            data={SHIFTS.map((s) => ({ value: s.value, label: s.label }))}
            value={shift}
            onChange={(v) => v && setShift(v as Shift)}
            allowDeselect={false}
          />
          <Checkbox
            label="Charge nurse"
            checked={isCharge}
            onChange={(e) => setIsCharge(e.currentTarget.checked)}
          />
          <Button
            tone="primary"
            onClick={() => add.mutate()}
            loading={add.isPending}
            disabled={!wardId || !nurseId}
          >
            Roster
          </Button>
        </Group>
      )}
      {canManage && !wardId && (
        <Text size="xs" c="dimmed">
          Choose a ward to roster onto it.
        </Text>
      )}

      {/* An outage must not read as an unrostered ward — they are different
          facts and a charge nurse acts differently on each. */}
      {roster.isError ? (
        <Text c="red">Could not load the roster. Do not read this as nobody rostered.</Text>
      ) : (
        <DataTable<NurseRosterEntry>
          columns={columns}
          data={roster.data ?? []}
          loading={roster.isLoading}
          rowKey={(r) => r.id}
          emptyTitle="Nobody rostered"
          emptyDescription={
            wardId
              ? "No nurse is on this ward for this date. The care-view board will show it as unstaffed until someone is."
              : "No nurse is rostered anywhere for this date."
          }
          caption={`Nurse roster for ${shiftDate}`}
          captionVisuallyHidden
        />
      )}
    </Stack>
  );
}
