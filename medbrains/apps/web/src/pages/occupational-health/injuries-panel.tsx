// IPD InjuriesPanel — split from occupational-health.tsx (pure move).

import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateInjuryRequest,
  OccHealthInjuryReport,
  UpdateInjuryRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPencil, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Badge, Button, IconButton } from "@/components/ui";
import { occupationalHealthService } from "@/services/occupationalHealth.service";
import { statusColorTone } from "./shared";

const INJURY_TYPES = [
  { value: "needlestick", label: "Needlestick" },
  { value: "slip_fall", label: "Slip/Fall" },
  { value: "strain", label: "Strain" },
  { value: "chemical", label: "Chemical Exposure" },
  { value: "other", label: "Other" },
];

const RTW_STATUS_OPTIONS = [
  { value: "pending_evaluation", label: "Pending Evaluation" },
  { value: "cleared_full", label: "Cleared — Full Duty" },
  { value: "cleared_with_restrictions", label: "Cleared — Restrictions" },
  { value: "not_cleared", label: "Not Cleared" },
  { value: "follow_up_required", label: "Follow-up Required" },
];

export function InjuriesPanel() {
  const canCreate = useHasPermission(P.OCC_HEALTH.INJURIES_CREATE);
  const canManage = useHasPermission(P.OCC_HEALTH.INJURIES_MANAGE);
  const qc = useQueryClient();
  const [createOpen, createHandlers] = useDisclosure(false);
  const [editOpen, editHandlers] = useDisclosure(false);
  const [selected, setSelected] = useState<OccHealthInjuryReport | null>(null);
  const [rtwFilter, setRtwFilter] = useState<string | null>(null);

  const { data: injuries = [], isLoading } = useQuery({
    queryKey: ["occ-injuries", rtwFilter],
    queryFn: () =>
      occupationalHealthService.listInjuries(rtwFilter ? { rtw_status: rtwFilter } : undefined),
  });

  const [form, setForm] = useState<CreateInjuryRequest>({
    employee_id: "",
    injury_date: "",
    injury_type: "other",
  });
  const [formOsha, setFormOsha] = useState(false);

  const [editForm, setEditForm] = useState<UpdateInjuryRequest>({});

  const createMut = useMutation({
    mutationFn: () =>
      occupationalHealthService.createInjury({
        ...form,
        is_osha_recordable: formOsha,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occ-injuries"] });
      createHandlers.close();
      setForm({ employee_id: "", injury_date: "", injury_type: "other" });
      setFormOsha(false);
      notifications.show({
        title: "Injury Report Created",
        message: "Workplace injury report created successfully",
        color: "success",
      });
    },
  });

  const updateMut = useMutation({
    mutationFn: () => {
      if (!selected) return Promise.reject(new Error("No injury selected"));
      return occupationalHealthService.updateInjury(selected.id, editForm);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["occ-injuries"] });
      editHandlers.close();
      setSelected(null);
      notifications.show({
        title: "Injury Updated",
        message: "Injury report and RTW status updated successfully",
        color: "success",
      });
    },
  });

  const columns: Column<OccHealthInjuryReport>[] = [
    {
      key: "report_number",
      label: "Report #",
      render: (r) => (
        <Text size="sm" fw={500}>
          {r.report_number}
        </Text>
      ),
    },
    {
      key: "employee_id",
      label: "Employee",
      render: (r) => (
        <Text size="sm" truncate style={{ maxWidth: 120 }}>
          {r.employee_id}
        </Text>
      ),
    },
    {
      key: "injury_date",
      label: "Injury Date",
      render: (r) => r.injury_date,
    },
    {
      key: "injury_type",
      label: "Type",
      render: (r) => INJURY_TYPES.find((t) => t.value === r.injury_type)?.label ?? r.injury_type,
    },
    {
      key: "is_osha_recordable",
      label: "OSHA",
      render: (r) => (
        <Badge tone={r.is_osha_recordable ? "danger" : "neutral"} variant="filled" size="sm">
          {r.is_osha_recordable ? "Recordable" : "Non-Rec."}
        </Badge>
      ),
    },
    {
      key: "rtw_status",
      label: "RTW Status",
      render: (r) => (
        <Badge tone={statusColorTone(r.rtw_status)} variant="filled" size="sm">
          {RTW_STATUS_OPTIONS.find((s) => s.value === r.rtw_status)?.label ?? r.rtw_status}
        </Badge>
      ),
    },
    {
      key: "lost_work_days",
      label: "Lost Days",
      render: (r) => r.lost_work_days.toString(),
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          {canManage && (
            <IconButton
              tone="default"
              size="sm"
              onClick={() => {
                setSelected(r);
                setEditForm({
                  injury_description: r.injury_description ?? "",
                  is_osha_recordable: r.is_osha_recordable,
                  lost_work_days: r.lost_work_days,
                  restricted_days: r.restricted_days,
                  workers_comp_claim_number: r.workers_comp_claim_number ?? "",
                  workers_comp_status: r.workers_comp_status ?? "",
                  rtw_status: r.rtw_status,
                  employer_access_notes: r.employer_access_notes ?? "",
                });
                editHandlers.open();
              }}
              aria-label="Edit"
            >
              <IconPencil size={14} />
            </IconButton>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group justify="space-between" mb="md">
        <Select
          placeholder="Filter by RTW status"
          clearable
          data={RTW_STATUS_OPTIONS}
          value={rtwFilter}
          onChange={setRtwFilter}
          w={240}
        />
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={createHandlers.open}>
            Report Injury
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={injuries} loading={isLoading} rowKey={(r) => r.id} />

      {/* Create Drawer */}
      <Drawer
        opened={createOpen}
        onClose={createHandlers.close}
        title="Report Workplace Injury"
        position="right"
        size="md"
      >
        <Stack>
          <EmployeeSearchSelect
            label="Employee"
            required
            value={form.employee_id}
            onChange={(employeeId) => setForm({ ...form, employee_id: employeeId })}
          />
          <DateInput
            label="Injury Date"
            required
            value={form.injury_date ? new Date(form.injury_date) : null}
            onChange={(d) =>
              setForm({ ...form, injury_date: d ? new Date(d).toISOString().slice(0, 10) : "" })
            }
          />
          <Select
            label="Injury Type"
            required
            data={INJURY_TYPES}
            value={form.injury_type}
            onChange={(v) => setForm({ ...form, injury_type: v ?? "other" })}
          />
          <TextInput
            label="Body Part Affected"
            value={form.body_part_affected ?? ""}
            onChange={(e) =>
              setForm({ ...form, body_part_affected: e.currentTarget.value || undefined })
            }
          />
          <TextInput
            label="Location of Incident"
            value={form.location_of_incident ?? ""}
            onChange={(e) =>
              setForm({ ...form, location_of_incident: e.currentTarget.value || undefined })
            }
          />
          <Textarea
            label="Injury Description"
            value={form.injury_description ?? ""}
            onChange={(e) =>
              setForm({ ...form, injury_description: e.currentTarget.value || undefined })
            }
          />
          <Switch
            label="OSHA Recordable"
            checked={formOsha}
            onChange={(e) => setFormOsha(e.currentTarget.checked)}
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate()}
            loading={createMut.isPending}
            disabled={!form.employee_id || !form.injury_date}
          >
            Submit Report
          </Button>
        </Stack>
      </Drawer>

      {/* Edit / RTW Drawer */}
      <Drawer
        opened={editOpen}
        onClose={editHandlers.close}
        title="Manage Injury & Return-to-Work"
        position="right"
        size="md"
      >
        <Stack>
          <Select
            label="RTW Status"
            data={RTW_STATUS_OPTIONS}
            value={editForm.rtw_status ?? ""}
            onChange={(v) =>
              setEditForm({
                ...editForm,
                rtw_status: (v as OccHealthInjuryReport["rtw_status"]) ?? undefined,
              })
            }
          />
          <NumberInput
            label="Lost Work Days"
            min={0}
            value={editForm.lost_work_days ?? 0}
            onChange={(v) =>
              setEditForm({ ...editForm, lost_work_days: typeof v === "number" ? v : undefined })
            }
          />
          <NumberInput
            label="Restricted Days"
            min={0}
            value={editForm.restricted_days ?? 0}
            onChange={(v) =>
              setEditForm({
                ...editForm,
                restricted_days: typeof v === "number" ? v : undefined,
              })
            }
          />
          <Switch
            label="OSHA Recordable"
            checked={editForm.is_osha_recordable ?? false}
            onChange={(e) =>
              setEditForm({ ...editForm, is_osha_recordable: e.currentTarget.checked })
            }
          />
          <TextInput
            label="Workers Comp Claim Number"
            value={editForm.workers_comp_claim_number ?? ""}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                workers_comp_claim_number: e.currentTarget.value || undefined,
              })
            }
          />
          <TextInput
            label="Workers Comp Status"
            value={editForm.workers_comp_status ?? ""}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                workers_comp_status: e.currentTarget.value || undefined,
              })
            }
          />
          <Textarea
            label="Employer Access Notes"
            value={editForm.employer_access_notes ?? ""}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                employer_access_notes: e.currentTarget.value || undefined,
              })
            }
          />
          <Textarea
            label="Injury Description"
            value={editForm.injury_description ?? ""}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                injury_description: e.currentTarget.value || undefined,
              })
            }
          />
          <Button tone="primary" onClick={() => updateMut.mutate()} loading={updateMut.isPending}>
            Update Injury Report
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Tab 5 — Hazard Registry
// ══════════════════════════════════════════════════════════
