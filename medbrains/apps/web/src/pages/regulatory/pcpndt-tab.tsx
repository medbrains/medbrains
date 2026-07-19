// REGULATORY PcpndtTab — split from regulatory.tsx (pure move).

import { Drawer, NumberInput, Paper, Select, Stack, Text, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { CreatePcpndtRequest, PcpndtForm } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { DoctorSearchSelect } from "@/components/DoctorSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, toast } from "@/components/ui";
import { regulatoryService } from "@/services/regulatory.service";
import { statusColorTone } from "./shared";

export function PcpndtTab() {
  const canCreate = useHasPermission(P.REGULATORY.PCPNDT_CREATE);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);

  const { data: forms = [], isLoading } = useQuery<PcpndtForm[]>({
    queryKey: ["regulatory-pcpndt"],
    queryFn: () => regulatoryService.listPcpndtForms(),
  });

  const [form, setForm] = useState<CreatePcpndtRequest>({
    patient_id: "",
    performing_doctor_id: "",
    procedure_type: "ultrasound",
    indication: "",
  });

  const createMut = useMutation({
    mutationFn: (data: CreatePcpndtRequest) => regulatoryService.createPcpndtForm(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["regulatory-pcpndt"] });
      toast.success("Gender disclosure blocked by default", { title: "PCPNDT Form created" });
      close();
    },
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="PCPNDT Form F"
        subtitle="Pre-Conception and Pre-Natal Diagnostic Techniques Act compliance"
        actions={
          canCreate ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
              New Form F
            </Button>
          ) : undefined
        }
      />

      <Paper p="sm" withBorder bg="red.0">
        <Text size="sm" c="red.8" fw={600}>
          PCPNDT Act Compliance: Gender disclosure is permanently blocked on all forms. Violations
          are punishable under law.
        </Text>
      </Paper>

      <DataTable
        data={forms}
        rowKey={(r) => r.id}
        loading={isLoading}
        columns={[
          {
            key: "form_number",
            label: "Form #",
            render: (r) => (
              <Text size="sm" fw={500}>
                {r.form_number}
              </Text>
            ),
          },
          {
            key: "procedure_type",
            label: "Procedure",
            render: (r) => (
              <Text size="sm" tt="capitalize">
                {r.procedure_type}
              </Text>
            ),
          },
          {
            key: "indication",
            label: "Indication",
            render: (r) => (
              <Text size="sm" lineClamp={1}>
                {r.indication}
              </Text>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r) => <Badge tone={statusColorTone(r.status)}>{r.status}</Badge>,
          },
          {
            key: "gender_blocked",
            label: "Gender Blocked",
            render: (r) => (
              <Badge tone={r.gender_disclosure_blocked ? "success" : "danger"}>
                {r.gender_disclosure_blocked ? "Yes" : "VIOLATION"}
              </Badge>
            ),
          },
          {
            key: "gestational_age",
            label: "Gest. Age",
            render: (r) => (
              <Text size="sm">{r.gestational_age_weeks ? `${r.gestational_age_weeks}w` : "-"}</Text>
            ),
          },
          {
            key: "quarterly",
            label: "In Quarterly",
            render: (r) => (
              <Badge tone={r.quarterly_report_included ? "success" : "neutral"} size="sm">
                {r.quarterly_report_included ? "Yes" : "No"}
              </Badge>
            ),
          },
          {
            key: "date",
            label: "Created",
            render: (r) => <Text size="sm">{r.created_at.slice(0, 10)}</Text>,
          },
        ]}
      />

      <Drawer opened={opened} onClose={close} title="New PCPNDT Form F" position="right" size="xl">
        <Stack gap="sm">
          <PatientSearchSelect
            value={form.patient_id}
            onChange={(id) => setForm({ ...form, patient_id: id })}
            required
          />
          <DoctorSearchSelect
            label="Performing Doctor"
            value={form.performing_doctor_id}
            onChange={(id) => setForm({ ...form, performing_doctor_id: id })}
            required
          />
          <DoctorSearchSelect
            label="Referral Doctor"
            value={form.referral_doctor_id ?? ""}
            onChange={(id) => setForm({ ...form, referral_doctor_id: id || undefined })}
          />
          <Select
            label="Procedure Type"
            required
            value={form.procedure_type}
            onChange={(v) => setForm({ ...form, procedure_type: v ?? "ultrasound" })}
            data={[
              { value: "ultrasound", label: "Ultrasound" },
              { value: "amniocentesis", label: "Amniocentesis" },
              { value: "cvs", label: "Chorionic Villus Sampling" },
              { value: "other", label: "Other" },
            ]}
          />
          <Textarea
            label="Medical Indication"
            required
            value={form.indication}
            onChange={(e) => setForm({ ...form, indication: e.currentTarget.value })}
            placeholder="Medical indication as per PCPNDT Act (not gender determination)"
          />
          <NumberInput
            label="Gestational Age (weeks)"
            value={form.gestational_age_weeks ?? undefined}
            onChange={(v) =>
              setForm({ ...form, gestational_age_weeks: typeof v === "number" ? v : undefined })
            }
          />
          <Textarea
            label="Doctor's Declaration"
            value={form.declaration_text ?? ""}
            onChange={(e) => setForm({ ...form, declaration_text: e.currentTarget.value })}
            placeholder="Statutory declaration text"
          />
          <Paper p="sm" withBorder bg="yellow.0">
            <Text size="xs" c="yellow.9" fw={600}>
              Gender disclosure will be permanently blocked on this form per PCPNDT Act.
            </Text>
          </Paper>
          <Button
            tone="primary"
            onClick={() => createMut.mutate(form)}
            loading={createMut.isPending}
          >
            Create Form F
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Compliance Calendar Tab
// ══════════════════════════════════════════════════════════
