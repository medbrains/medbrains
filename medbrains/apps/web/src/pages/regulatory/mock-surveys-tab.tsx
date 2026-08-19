// REGULATORY MockSurveysTab — split from regulatory.tsx (pure move).

import { Drawer, Select, Stack, Text, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { ComplianceChecklist, CreateChecklistRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { Badge, Button, toast } from "@/components/ui";
import { regulatoryService } from "@/services/regulatory.service";
import { checklistStatusColors } from "./shared";

export function MockSurveysTab() {
  const canManage = useHasPermission(P.REGULATORY.CHECKLISTS_CREATE);
  // Reading the surveys carries the list code, which the tab never held.
  // Refused, the table renders empty and reads as a hospital that has run
  // no mock surveys — the opposite of what an accreditation reviewer wants
  // to conclude from this screen.
  const canList = useHasPermission(P.REGULATORY.CHECKLISTS_LIST);
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ["regulatory-mock-surveys"],
    queryFn: () => regulatoryService.listMockSurveys(),
    enabled: canList,
  });

  const [form, setForm] = useState<CreateChecklistRequest>({
    accreditation_body: "nabh",
    standard_code: "",
    name: "",
    assessment_period_start: "",
    assessment_period_end: "",
  });

  const createMut = useMutation({
    mutationFn: (data: CreateChecklistRequest) => regulatoryService.createMockSurvey(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["regulatory-mock-surveys"] });
      toast.success("", { title: "Mock survey created" });
      close();
    },
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="Mock Surveys"
        subtitle="Simulate accreditation surveys for readiness assessment"
        actions={
          canManage ? (
            <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
              New Mock Survey
            </Button>
          ) : undefined
        }
      />

      <DataTable
        data={surveys}
        rowKey={(r) => r.id}
        loading={isLoading}
        columns={[
          {
            key: "name",
            label: "Name",
            render: (r: ComplianceChecklist) => (
              <Text size="sm" fw={500}>
                {r.name}
              </Text>
            ),
          },
          {
            key: "accreditation_body",
            label: "Body",
            render: (r: ComplianceChecklist) => (
              <Badge tone="neutral" size="sm" tt="uppercase">
                {r.accreditation_body}
              </Badge>
            ),
          },
          {
            key: "standard_code",
            label: "Standard",
            render: (r: ComplianceChecklist) => <Text size="sm">{r.standard_code}</Text>,
          },
          {
            key: "overall_status",
            label: "Status",
            render: (r: ComplianceChecklist) => (
              <Badge tone={checklistStatusColors[r.overall_status]}>
                {r.overall_status.replace(/_/g, " ")}
              </Badge>
            ),
          },
          {
            key: "compliance_score",
            label: "Score",
            render: (r: ComplianceChecklist) =>
              r.compliance_score != null ? (
                <Badge
                  tone={
                    r.compliance_score >= 80
                      ? "success"
                      : r.compliance_score >= 60
                        ? "warning"
                        : "danger"
                  }
                >
                  {r.compliance_score}%
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">
                  -
                </Text>
              ),
          },
          {
            key: "items",
            label: "Items",
            render: (r: ComplianceChecklist) => (
              <Text size="sm">
                {r.compliant_items}/{r.total_items}
              </Text>
            ),
          },
          {
            key: "period",
            label: "Period",
            render: (r: ComplianceChecklist) => (
              <Text size="sm">
                {r.assessment_period_start} — {r.assessment_period_end}
              </Text>
            ),
          },
        ]}
      />

      <Drawer opened={opened} onClose={close} title="New Mock Survey" position="right" size="xl">
        <Stack gap="sm">
          <TextInput
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })}
          />
          <Select
            label="Accreditation Body"
            required
            value={form.accreditation_body}
            onChange={(v) => setForm({ ...form, accreditation_body: v ?? "nabh" })}
            data={[
              { value: "nabh", label: "NABH" },
              { value: "nmc", label: "NMC" },
              { value: "nabl", label: "NABL" },
              { value: "jci", label: "JCI" },
              { value: "abdm", label: "ABDM" },
              { value: "other", label: "Other" },
            ]}
          />
          <TextInput
            label="Standard Code"
            required
            value={form.standard_code}
            onChange={(e) => setForm({ ...form, standard_code: e.currentTarget.value })}
          />
          <DateInput
            label="Assessment Start"
            required
            value={form.assessment_period_start ? new Date(form.assessment_period_start) : null}
            onChange={(d) =>
              setForm({
                ...form,
                assessment_period_start: d ? new Date(d).toISOString().slice(0, 10) : "",
              })
            }
          />
          <DateInput
            label="Assessment End"
            required
            value={form.assessment_period_end ? new Date(form.assessment_period_end) : null}
            onChange={(d) =>
              setForm({
                ...form,
                assessment_period_end: d ? new Date(d).toISOString().slice(0, 10) : "",
              })
            }
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate(form)}
            loading={createMut.isPending}
          >
            Create Mock Survey
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  Staff Credentials Tab
// ══════════════════════════════════════════════════════════
