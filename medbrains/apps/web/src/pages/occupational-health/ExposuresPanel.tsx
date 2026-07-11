import { Drawer, Group, Stack, Text } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { CreateStaffExposureRequest, ExposureType, OccHealthExposure } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, Button, Input, Select, Switch, TextArea, toast } from "@/components/ui";
import { occupationalHealthService } from "@/services/occupationalHealth.service";

const EXPOSURE_TYPES = [
  { value: "needlestick", label: "Needlestick" },
  { value: "sharps_cut", label: "Sharps cut" },
  { value: "mucocutaneous", label: "Mucocutaneous splash" },
  { value: "other", label: "Other" },
];

const SEROSTATUS = [
  { value: "unknown", label: "Unknown" },
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Negative" },
];

const TYPE_LABEL: Record<string, string> = {
  needlestick: "Needlestick",
  sharps_cut: "Sharps cut",
  mucocutaneous: "Mucocutaneous",
  other: "Other",
};

interface ExposureForm {
  employee_id: string;
  exposure_at: Date | null;
  exposure_type: ExposureType;
  device: string;
  body_site: string;
  source_patient_id: string;
  source_known: boolean;
  source_hiv: "positive" | "negative" | "unknown";
  source_hbv: "positive" | "negative" | "unknown";
  source_hcv: "positive" | "negative" | "unknown";
  first_aid_done: boolean;
  pep_started: boolean;
  pep_details: string;
  notes: string;
}

const EMPTY: ExposureForm = {
  employee_id: "",
  exposure_at: null,
  exposure_type: "needlestick",
  device: "",
  body_site: "",
  source_patient_id: "",
  source_known: false,
  source_hiv: "unknown",
  source_hbv: "unknown",
  source_hcv: "unknown",
  first_aid_done: false,
  pep_started: false,
  pep_details: "",
  notes: "",
};

function serostatusSummary(o: OccHealthExposure): string {
  return `HIV ${o.source_hiv} · HBV ${o.source_hbv} · HCV ${o.source_hcv}`;
}

/** Occupational blood & body-fluid / sharps (needlestick) exposure reporting. The server computes
 *  pep_recommended from the source HIV status + route so a time-critical PEP decision is surfaced
 *  at report time (HIV PEP is most effective within 2h, must start within 72h). */
export function ExposuresPanel() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.OCC_HEALTH.INJURIES_CREATE);
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<ExposureForm>(EMPTY);

  const { data: exposures, isLoading } = useQuery({
    queryKey: ["occ-health", "exposures"],
    queryFn: () => occupationalHealthService.listExposures(),
  });

  const createMut = useMutation({
    mutationFn: (payload: CreateStaffExposureRequest) =>
      occupationalHealthService.createExposure(payload),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: ["occ-health", "exposures"] });
      close();
      setForm(EMPTY);
      if (created.pep_recommended && !created.pep_started) {
        toast.warning("HIV PEP is recommended — start within 2 hours if possible (72h max).", {
          title: "PEP recommended",
        });
      } else {
        toast.success("Exposure reported");
      }
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not report exposure" }),
  });

  const submit = () => {
    if (!form.employee_id || !form.exposure_at) {
      toast.error("Employee and exposure time are required");
      return;
    }
    createMut.mutate({
      employee_id: form.employee_id,
      exposure_at: form.exposure_at.toISOString(),
      exposure_type: form.exposure_type,
      device: form.device || undefined,
      body_site: form.body_site || undefined,
      source_patient_id: form.source_patient_id || undefined,
      source_known: form.source_known,
      source_hiv: form.source_hiv,
      source_hbv: form.source_hbv,
      source_hcv: form.source_hcv,
      first_aid_done: form.first_aid_done,
      pep_started: form.pep_started,
      pep_details: form.pep_details || undefined,
      notes: form.notes || undefined,
    });
  };

  const columns: Column<OccHealthExposure>[] = [
    {
      key: "exposure_at",
      label: "When",
      render: (o) => new Date(o.exposure_at).toLocaleString(),
    },
    {
      key: "exposure_type",
      label: "Type",
      render: (o) => <Badge tone="neutral">{TYPE_LABEL[o.exposure_type] ?? o.exposure_type}</Badge>,
    },
    {
      key: "source_hiv",
      label: "Source status",
      render: (o) => <Text size="xs">{serostatusSummary(o)}</Text>,
    },
    {
      key: "pep_recommended",
      label: "PEP",
      render: (o) =>
        o.pep_recommended ? (
          <Badge tone={o.pep_started ? "success" : "danger"}>
            {o.pep_started ? "Started" : "Recommended"}
          </Badge>
        ) : (
          <Badge tone="neutral">Not indicated</Badge>
        ),
    },
  ];

  return (
    <Stack>
      {canCreate && (
        <Group>
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Report Exposure
          </Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={exposures ?? []}
        loading={isLoading}
        rowKey={(o) => o.id}
      />

      <Drawer opened={opened} onClose={close} title="Report exposure" position="right" size="lg">
        <Stack gap="sm">
          <EmployeeSearchSelect
            label="Exposed employee"
            required
            value={form.employee_id}
            onChange={(id) => setForm({ ...form, employee_id: id })}
          />
          <DateTimePicker
            label="Exposure date & time"
            required
            value={form.exposure_at}
            onChange={(d) => setForm({ ...form, exposure_at: d ? new Date(d) : null })}
          />
          <Select
            label="Exposure type"
            required
            data={EXPOSURE_TYPES}
            value={form.exposure_type}
            onChange={(v) =>
              setForm({ ...form, exposure_type: (v as ExposureType) ?? "needlestick" })
            }
          />
          <Group grow>
            <Input
              label="Device"
              value={form.device}
              onChange={(e) => setForm({ ...form, device: e.currentTarget.value })}
            />
            <Input
              label="Body site"
              value={form.body_site}
              onChange={(e) => setForm({ ...form, body_site: e.currentTarget.value })}
            />
          </Group>
          <PatientSearchSelect
            label="Source patient (if known)"
            value={form.source_patient_id}
            onChange={(id) => setForm({ ...form, source_patient_id: id, source_known: !!id })}
          />
          <Group grow>
            <Select
              label="Source HIV"
              data={SEROSTATUS}
              value={form.source_hiv}
              onChange={(v) =>
                setForm({ ...form, source_hiv: (v as ExposureForm["source_hiv"]) ?? "unknown" })
              }
            />
            <Select
              label="Source HBV"
              data={SEROSTATUS}
              value={form.source_hbv}
              onChange={(v) =>
                setForm({ ...form, source_hbv: (v as ExposureForm["source_hbv"]) ?? "unknown" })
              }
            />
            <Select
              label="Source HCV"
              data={SEROSTATUS}
              value={form.source_hcv}
              onChange={(v) =>
                setForm({ ...form, source_hcv: (v as ExposureForm["source_hcv"]) ?? "unknown" })
              }
            />
          </Group>
          <Switch
            label="First aid done (wash / irrigate)"
            checked={form.first_aid_done}
            onChange={(e) => setForm({ ...form, first_aid_done: e.currentTarget.checked })}
          />
          <Switch
            label="PEP started"
            checked={form.pep_started}
            onChange={(e) => setForm({ ...form, pep_started: e.currentTarget.checked })}
          />
          <TextArea
            label="PEP details"
            value={form.pep_details}
            onChange={(e) => setForm({ ...form, pep_details: e.currentTarget.value })}
          />
          <TextArea
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.currentTarget.value })}
          />
          <Alert tone="info">
            HIV PEP recommendation is computed from the source HIV status and exposure route once
            you submit. If recommended, start PEP within 2 hours where possible.
          </Alert>
          <Button tone="primary" loading={createMut.isPending} onClick={submit} w="fit-content">
            Report exposure
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}
