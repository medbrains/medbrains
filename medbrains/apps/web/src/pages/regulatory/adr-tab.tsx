// REGULATORY AdrTab — split from regulatory.tsx (pure move).

import { Drawer, Group, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  AdrReport,
  CreateAdrRequest,
  CreateMvRequest,
  MateriovigilanceReport,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconSend } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { Badge, type BadgeTone, Button, IconButton, toast } from "@/components/ui";
import { regulatoryService } from "@/services/regulatory.service";

const severityColors: Record<string, BadgeTone> = {
  mild: "primary",
  moderate: "warning",
  severe: "warning",
  fatal: "danger",
};

const eventStatusColors: Record<string, BadgeTone> = {
  draft: "neutral",
  submitted: "primary",
  under_review: "warning",
  closed: "success",
  withdrawn: "neutral",
};

export function AdrTab() {
  const canCreateAdr = useHasPermission(P.REGULATORY.ADR_CREATE);
  const canCreateMv = useHasPermission(P.REGULATORY.MATERIOVIGILANCE_CREATE);
  const qc = useQueryClient();
  const [adrOpened, { open: openAdr, close: closeAdr }] = useDisclosure(false);
  const [mvOpened, { open: openMv, close: closeMv }] = useDisclosure(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: adrReports = [], isLoading: adrLoading } = useQuery<AdrReport[]>({
    queryKey: ["regulatory-adr", statusFilter],
    queryFn: () =>
      regulatoryService.listAdrReports(statusFilter ? { status: statusFilter } : undefined),
  });

  const { data: mvReports = [], isLoading: mvLoading } = useQuery<MateriovigilanceReport[]>({
    queryKey: ["regulatory-mv", statusFilter],
    queryFn: () =>
      regulatoryService.listMvReports(statusFilter ? { status: statusFilter } : undefined),
  });

  const [adrForm, setAdrForm] = useState<CreateAdrRequest>({
    drug_name: "",
    reaction_description: "",
    reaction_date: new Date().toISOString().slice(0, 10),
    severity: "moderate",
  });

  const [mvForm, setMvForm] = useState<CreateMvRequest>({
    device_name: "",
    event_description: "",
    event_date: new Date().toISOString().slice(0, 10),
    severity: "moderate",
  });

  const createAdrMut = useMutation({
    mutationFn: (data: CreateAdrRequest) => regulatoryService.createAdrReport(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["regulatory-adr"] });
      toast.success("", { title: "ADR Report created" });
      closeAdr();
    },
  });

  const createMvMut = useMutation({
    mutationFn: (data: CreateMvRequest) => regulatoryService.createMvReport(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["regulatory-mv"] });
      toast.success("", { title: "Materiovigilance Report created" });
      closeMv();
    },
  });

  const submitAdrMut = useMutation({
    mutationFn: (id: string) => regulatoryService.submitAdrToPvpi(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["regulatory-adr"] });
      toast.info("", { title: "Submitted to PvPI" });
    },
  });

  const submitMvMut = useMutation({
    mutationFn: (id: string) => regulatoryService.submitMvToCdsco(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["regulatory-mv"] });
      toast.info("", { title: "Submitted to CDSCO" });
    },
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="Adverse Event Reports"
        subtitle="ADR (PvPI) and Materiovigilance (CDSCO) reporting"
        actions={
          <Group>
            {canCreateAdr && (
              <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openAdr}>
                New ADR Report
              </Button>
            )}
            {canCreateMv && (
              <Button tone="secondary" leftSection={<IconPlus size={16} />} onClick={openMv}>
                New Device Report
              </Button>
            )}
          </Group>
        }
      />

      <Group>
        <Select
          placeholder="Filter by status"
          clearable
          value={statusFilter}
          onChange={setStatusFilter}
          data={[
            { value: "draft", label: "Draft" },
            { value: "submitted", label: "Submitted" },
            { value: "under_review", label: "Under Review" },
            { value: "closed", label: "Closed" },
          ]}
        />
      </Group>

      <Text fw={600}>ADR Reports (Adverse Drug Reactions)</Text>
      <DataTable
        data={adrReports}
        rowKey={(r) => r.id}
        loading={adrLoading}
        columns={[
          {
            key: "report_number",
            label: "Report #",
            render: (r) => (
              <Text size="sm" fw={500}>
                {r.report_number}
              </Text>
            ),
          },
          { key: "drug_name", label: "Drug", render: (r) => <Text size="sm">{r.drug_name}</Text> },
          {
            key: "reaction_description",
            label: "Reaction",
            render: (r) => (
              <Text size="sm" lineClamp={1}>
                {r.reaction_description}
              </Text>
            ),
          },
          {
            key: "severity",
            label: "Severity",
            render: (r) => <Badge tone={severityColors[r.severity]}>{r.severity}</Badge>,
          },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <Badge tone={eventStatusColors[r.status]}>{r.status.replace(/_/g, " ")}</Badge>
            ),
          },
          {
            key: "pvpi",
            label: "PvPI",
            render: (r) =>
              r.submitted_to_pvpi ? (
                <Badge tone="success" size="sm">
                  Submitted
                </Badge>
              ) : r.status === "draft" && canCreateAdr ? (
                <IconButton
                  tone="primary"
                  onClick={() => submitAdrMut.mutate(r.id)}
                  aria-label="Send"
                >
                  <IconSend size={14} />
                </IconButton>
              ) : (
                <Text size="sm" c="dimmed">
                  -
                </Text>
              ),
          },
          { key: "date", label: "Date", render: (r) => <Text size="sm">{r.reaction_date}</Text> },
        ]}
      />

      <Text fw={600} mt="md">
        Materiovigilance Reports (Medical Devices)
      </Text>
      <DataTable
        data={mvReports}
        rowKey={(r) => r.id}
        loading={mvLoading}
        columns={[
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
            key: "device_name",
            label: "Device",
            render: (r) => <Text size="sm">{r.device_name}</Text>,
          },
          {
            key: "event_description",
            label: "Event",
            render: (r) => (
              <Text size="sm" lineClamp={1}>
                {r.event_description}
              </Text>
            ),
          },
          {
            key: "severity",
            label: "Severity",
            render: (r) => <Badge tone={severityColors[r.severity]}>{r.severity}</Badge>,
          },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <Badge tone={eventStatusColors[r.status]}>{r.status.replace(/_/g, " ")}</Badge>
            ),
          },
          {
            key: "cdsco",
            label: "CDSCO",
            render: (r) =>
              r.submitted_to_cdsco ? (
                <Badge tone="success" size="sm">
                  Submitted
                </Badge>
              ) : r.status === "draft" && canCreateMv ? (
                <IconButton
                  tone="primary"
                  onClick={() => submitMvMut.mutate(r.id)}
                  aria-label="Send"
                >
                  <IconSend size={14} />
                </IconButton>
              ) : (
                <Text size="sm" c="dimmed">
                  -
                </Text>
              ),
          },
          { key: "date", label: "Date", render: (r) => <Text size="sm">{r.event_date}</Text> },
        ]}
      />

      {/* ADR Create Drawer */}
      <Drawer
        opened={adrOpened}
        onClose={closeAdr}
        title="New ADR Report"
        position="right"
        size="xl"
      >
        <Stack gap="sm">
          <TextInput
            label="Drug Name"
            required
            value={adrForm.drug_name}
            onChange={(e) => setAdrForm({ ...adrForm, drug_name: e.currentTarget.value })}
          />
          <TextInput
            label="Generic Name"
            value={adrForm.drug_generic_name ?? ""}
            onChange={(e) => setAdrForm({ ...adrForm, drug_generic_name: e.currentTarget.value })}
          />
          <TextInput
            label="Batch Number"
            value={adrForm.drug_batch_number ?? ""}
            onChange={(e) => setAdrForm({ ...adrForm, drug_batch_number: e.currentTarget.value })}
          />
          <TextInput
            label="Manufacturer"
            value={adrForm.manufacturer ?? ""}
            onChange={(e) => setAdrForm({ ...adrForm, manufacturer: e.currentTarget.value })}
          />
          <Textarea
            label="Reaction Description"
            required
            value={adrForm.reaction_description}
            onChange={(e) =>
              setAdrForm({ ...adrForm, reaction_description: e.currentTarget.value })
            }
          />
          <DateInput
            label="Reaction Date"
            required
            value={new Date(adrForm.reaction_date)}
            onChange={(d) =>
              setAdrForm({
                ...adrForm,
                reaction_date: d ? new Date(d).toISOString().slice(0, 10) : "",
              })
            }
          />
          <Select
            label="Severity"
            required
            value={adrForm.severity}
            onChange={(v) =>
              setAdrForm({
                ...adrForm,
                severity: (v ?? "moderate") as CreateAdrRequest["severity"],
              })
            }
            data={[
              { value: "mild", label: "Mild" },
              { value: "moderate", label: "Moderate" },
              { value: "severe", label: "Severe" },
              { value: "fatal", label: "Fatal" },
            ]}
          />
          <Select
            label="Causality Assessment"
            value={adrForm.causality_assessment ?? null}
            onChange={(v) => setAdrForm({ ...adrForm, causality_assessment: v ?? undefined })}
            data={[
              { value: "certain", label: "Certain" },
              { value: "probable", label: "Probable" },
              { value: "possible", label: "Possible" },
              { value: "unlikely", label: "Unlikely" },
              { value: "unclassifiable", label: "Unclassifiable" },
            ]}
          />
          <Button
            tone="primary"
            onClick={() => createAdrMut.mutate(adrForm)}
            loading={createAdrMut.isPending}
          >
            Submit ADR Report
          </Button>
        </Stack>
      </Drawer>

      {/* MV Create Drawer */}
      <Drawer
        opened={mvOpened}
        onClose={closeMv}
        title="New Device Adverse Event"
        position="right"
        size="xl"
      >
        <Stack gap="sm">
          <TextInput
            label="Device Name"
            required
            value={mvForm.device_name}
            onChange={(e) => setMvForm({ ...mvForm, device_name: e.currentTarget.value })}
          />
          <TextInput
            label="Manufacturer"
            value={mvForm.device_manufacturer ?? ""}
            onChange={(e) => setMvForm({ ...mvForm, device_manufacturer: e.currentTarget.value })}
          />
          <TextInput
            label="Model"
            value={mvForm.device_model ?? ""}
            onChange={(e) => setMvForm({ ...mvForm, device_model: e.currentTarget.value })}
          />
          <TextInput
            label="Batch/Lot"
            value={mvForm.device_batch ?? ""}
            onChange={(e) => setMvForm({ ...mvForm, device_batch: e.currentTarget.value })}
          />
          <Textarea
            label="Event Description"
            required
            value={mvForm.event_description}
            onChange={(e) => setMvForm({ ...mvForm, event_description: e.currentTarget.value })}
          />
          <DateInput
            label="Event Date"
            required
            value={new Date(mvForm.event_date)}
            onChange={(d) =>
              setMvForm({ ...mvForm, event_date: d ? new Date(d).toISOString().slice(0, 10) : "" })
            }
          />
          <Select
            label="Severity"
            required
            value={mvForm.severity}
            onChange={(v) =>
              setMvForm({ ...mvForm, severity: (v ?? "moderate") as CreateMvRequest["severity"] })
            }
            data={[
              { value: "mild", label: "Mild" },
              { value: "moderate", label: "Moderate" },
              { value: "severe", label: "Severe" },
              { value: "fatal", label: "Fatal" },
            ]}
          />
          <Select
            label="Device Action"
            value={mvForm.device_action ?? null}
            onChange={(v) => setMvForm({ ...mvForm, device_action: v ?? undefined })}
            data={[
              { value: "none", label: "None" },
              { value: "returned", label: "Returned to manufacturer" },
              { value: "quarantined", label: "Quarantined" },
              { value: "destroyed", label: "Destroyed" },
            ]}
          />
          <Button
            tone="primary"
            onClick={() => createMvMut.mutate(mvForm)}
            loading={createMvMut.isPending}
          >
            Submit Device Report
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  PCPNDT Forms Tab
// ══════════════════════════════════════════════════════════
