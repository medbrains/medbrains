// IPD SchedulesTab — split from housekeeping.tsx (pure move).

import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type {
  CleaningSchedule,
  CreateCleaningScheduleRequest,
  CreatePestControlLogRequest,
  CreatePestControlScheduleRequest,
  PestControlLog,
  PestControlSchedule,
} from "@medbrains/types";
import { IconBug, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, Button } from "@/components/ui";
import { housekeepingService } from "@/services/housekeeping.service";
import { AREA_TYPES } from "./shared";

const PEST_TYPES = [
  { value: "rodent", label: "Rodents (Rats/Mice)" },
  { value: "cockroach", label: "Cockroaches" },
  { value: "mosquito", label: "Mosquitoes" },
  { value: "flies", label: "Flies" },
  { value: "bed_bugs", label: "Bed Bugs" },
  { value: "ants", label: "Ants" },
  { value: "termites", label: "Termites" },
  { value: "other", label: "Other" },
];

const PEST_TREATMENT_TYPES = [
  { value: "spraying", label: "Spraying" },
  { value: "fogging", label: "Fogging" },
  { value: "baiting", label: "Baiting" },
  { value: "trapping", label: "Trapping" },
  { value: "fumigation", label: "Fumigation" },
  { value: "gel_treatment", label: "Gel Treatment" },
  { value: "inspection", label: "Inspection Only" },
  { value: "other", label: "Other" },
];

export function SchedulesTab({
  canCreate,
  canListPest,
  canManagePest,
}: {
  canCreate: boolean;
  canListPest: boolean;
  canManagePest: boolean;
}) {
  const qc = useQueryClient();
  const [schedDrawer, schedDrawerH] = useDisclosure(false);
  const [pestDrawer, pestDrawerH] = useDisclosure(false);
  const [pestLogDrawer, pestLogDrawerH] = useDisclosure(false);

  const [schedForm, setSchedForm] = useState<CreateCleaningScheduleRequest>({ area_type: "ward" });
  const [pestForm, setPestForm] = useState<CreatePestControlScheduleRequest>({ pest_type: "" });
  const [pestLogForm, setPestLogForm] = useState<CreatePestControlLogRequest>({
    treatment_date: "",
    treatment_type: "",
  });

  const schedulesQ = useQuery({
    queryKey: ["housekeeping", "schedules"],
    queryFn: () => housekeepingService.listCleaningSchedules(),
  });
  const pestSchedulesQ = useQuery({
    queryKey: ["housekeeping", "pest-schedules"],
    queryFn: () => housekeepingService.listPestControlSchedules(),
    enabled: canListPest,
  });
  const pestLogsQ = useQuery({
    queryKey: ["housekeeping", "pest-logs"],
    queryFn: () => housekeepingService.listPestControlLogs(),
    enabled: canListPest,
  });

  const createSchedM = useMutation({
    mutationFn: (data: CreateCleaningScheduleRequest) =>
      housekeepingService.createCleaningSchedule(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "schedules"] });
      schedDrawerH.close();
      notifications.show({
        title: "Schedule Created",
        message: "Cleaning schedule created",
        color: "success",
      });
    },
  });

  const createPestM = useMutation({
    mutationFn: (data: CreatePestControlScheduleRequest) =>
      housekeepingService.createPestControlSchedule(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "pest-schedules"] });
      pestDrawerH.close();
    },
  });

  const createPestLogM = useMutation({
    mutationFn: (data: CreatePestControlLogRequest) =>
      housekeepingService.createPestControlLog(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping", "pest-logs"] });
      pestLogDrawerH.close();
    },
  });

  return (
    <Stack gap="lg">
      {/* Cleaning Schedules */}
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Cleaning Schedules
        </Text>
        {canCreate && (
          <Button
            tone="primary"
            leftSection={<IconPlus size={16} />}
            size="xs"
            onClick={schedDrawerH.open}
          >
            New Schedule
          </Button>
        )}
      </Group>
      <DataTable
        data={schedulesQ.data ?? []}
        loading={schedulesQ.isLoading}
        rowKey={(r: CleaningSchedule) => r.id}
        columns={[
          {
            key: "area_type",
            label: "Area",
            render: (r: CleaningSchedule) => <Badge variant="outline">{r.area_type}</Badge>,
          },
          {
            key: "frequency_hours",
            label: "Frequency",
            render: (r: CleaningSchedule) => `Every ${r.frequency_hours}h`,
          },
          {
            key: "is_active",
            label: "Status",
            render: (r: CleaningSchedule) => (
              <Badge tone={r.is_active ? "success" : "neutral"}>
                {r.is_active ? "Active" : "Inactive"}
              </Badge>
            ),
          },
          { key: "notes", label: "Notes", render: (r: CleaningSchedule) => r.notes ?? "-" },
        ]}
      />

      {/* Pest Control */}
      {canListPest && (
        <>
          <Group justify="space-between">
            <Text fw={600} size="lg">
              Pest Control Schedules
            </Text>
            {canManagePest && (
              <Group gap="xs">
                <Button
                  tone="primary"
                  leftSection={<IconPlus size={16} />}
                  size="xs"
                  onClick={pestDrawerH.open}
                >
                  New Schedule
                </Button>
                <Button
                  tone="secondary"
                  leftSection={<IconBug size={16} />}
                  size="xs"
                  onClick={pestLogDrawerH.open}
                >
                  Record Treatment
                </Button>
              </Group>
            )}
          </Group>
          <DataTable
            data={pestSchedulesQ.data ?? []}
            loading={pestSchedulesQ.isLoading}
            rowKey={(r: PestControlSchedule) => r.id}
            columns={[
              {
                key: "pest_type",
                label: "Pest Type",
                render: (r: PestControlSchedule) => r.pest_type,
              },
              {
                key: "frequency_months",
                label: "Frequency",
                render: (r: PestControlSchedule) => `Every ${r.frequency_months} months`,
              },
              {
                key: "last_done",
                label: "Last Done",
                render: (r: PestControlSchedule) => r.last_done ?? "-",
              },
              {
                key: "next_due",
                label: "Next Due",
                render: (r: PestControlSchedule) =>
                  r.next_due ? (
                    <Badge tone={new Date(r.next_due) < new Date() ? "danger" : "success"}>
                      {r.next_due}
                    </Badge>
                  ) : (
                    "-"
                  ),
              },
              {
                key: "vendor_name",
                label: "Vendor",
                render: (r: PestControlSchedule) => r.vendor_name ?? "-",
              },
            ]}
          />

          <Text fw={600} size="lg">
            Pest Control Logs
          </Text>
          <DataTable
            data={pestLogsQ.data ?? []}
            loading={pestLogsQ.isLoading}
            rowKey={(r: PestControlLog) => r.id}
            columns={[
              {
                key: "treatment_date",
                label: "Date",
                render: (r: PestControlLog) => r.treatment_date,
              },
              {
                key: "treatment_type",
                label: "Type",
                render: (r: PestControlLog) => r.treatment_type,
              },
              {
                key: "chemicals_used",
                label: "Chemicals",
                render: (r: PestControlLog) => r.chemicals_used ?? "-",
              },
              {
                key: "certificate_no",
                label: "Certificate",
                render: (r: PestControlLog) => r.certificate_no ?? "-",
              },
              {
                key: "vendor_name",
                label: "Vendor",
                render: (r: PestControlLog) => r.vendor_name ?? "-",
              },
            ]}
          />
        </>
      )}

      {/* Drawers */}
      <Drawer
        opened={schedDrawer}
        onClose={schedDrawerH.close}
        title="New Cleaning Schedule"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Area Type"
            data={AREA_TYPES}
            value={schedForm.area_type}
            onChange={(v) => setSchedForm({ ...schedForm, area_type: v ?? "ward" })}
          />
          <NumberInput
            label="Frequency (hours)"
            value={schedForm.frequency_hours ?? 24}
            onChange={(v) => setSchedForm({ ...schedForm, frequency_hours: Number(v) })}
            min={1}
          />
          <Textarea
            label="Notes"
            value={schedForm.notes ?? ""}
            onChange={(e) => setSchedForm({ ...schedForm, notes: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createSchedM.mutate(schedForm)}
            loading={createSchedM.isPending}
          >
            Create Schedule
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={pestDrawer}
        onClose={pestDrawerH.close}
        title="New Pest Control Schedule"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Pest Type"
            data={PEST_TYPES}
            value={pestForm.pest_type || null}
            onChange={(v) => setPestForm({ ...pestForm, pest_type: v ?? "" })}
            searchable
          />
          <NumberInput
            label="Frequency (months)"
            value={pestForm.frequency_months ?? 3}
            onChange={(v) => setPestForm({ ...pestForm, frequency_months: Number(v) })}
            min={1}
          />
          <TextInput
            label="Vendor Name"
            value={pestForm.vendor_name ?? ""}
            onChange={(e) => setPestForm({ ...pestForm, vendor_name: e.target.value })}
          />
          <Textarea
            label="Notes"
            value={pestForm.notes ?? ""}
            onChange={(e) => setPestForm({ ...pestForm, notes: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createPestM.mutate(pestForm)}
            loading={createPestM.isPending}
          >
            Create Schedule
          </Button>
        </Stack>
      </Drawer>

      <Drawer
        opened={pestLogDrawer}
        onClose={pestLogDrawerH.close}
        title="Record Pest Control Treatment"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Treatment Date"
            type="date"
            value={pestLogForm.treatment_date}
            onChange={(e) => setPestLogForm({ ...pestLogForm, treatment_date: e.target.value })}
          />
          <Select
            label="Treatment Type"
            data={PEST_TREATMENT_TYPES}
            value={pestLogForm.treatment_type || null}
            onChange={(v) => setPestLogForm({ ...pestLogForm, treatment_type: v ?? "" })}
            searchable
          />
          <TextInput
            label="Chemicals Used"
            value={pestLogForm.chemicals_used ?? ""}
            onChange={(e) => setPestLogForm({ ...pestLogForm, chemicals_used: e.target.value })}
          />
          <TextInput
            label="Vendor Name"
            value={pestLogForm.vendor_name ?? ""}
            onChange={(e) => setPestLogForm({ ...pestLogForm, vendor_name: e.target.value })}
          />
          <TextInput
            label="Certificate No"
            value={pestLogForm.certificate_no ?? ""}
            onChange={(e) => setPestLogForm({ ...pestLogForm, certificate_no: e.target.value })}
          />
          <Button
            tone="primary"
            onClick={() => createPestLogM.mutate(pestLogForm)}
            loading={createPestLogM.isPending}
          >
            Record
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 3: Linen & Laundry
// ══════════════════════════════════════════════════════════
