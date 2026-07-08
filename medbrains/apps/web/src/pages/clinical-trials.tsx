import { Group, Modal, NumberInput, Select, Stack, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { ClinicalTrial } from "@medbrains/types";
import { IconFlask2, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { clinicalTrialsService } from "@/services/clinicalTrials.service";

const STATUSES = ["planned", "recruiting", "active", "completed", "terminated", "suspended"];

function statusTone(s: string): BadgeTone {
  if (s === "active" || s === "recruiting") return "success";
  if (s === "terminated" || s === "suspended") return "danger";
  if (s === "completed") return "info";
  return "neutral";
}

function CreateTrialModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [protocol, setProtocol] = useState("");
  const [title, setTitle] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [phase, setPhase] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>("planned");
  const [pi, setPi] = useState("");
  const [enroll, setEnroll] = useState<number | "">("");

  const create = useMutation({
    mutationFn: () =>
      clinicalTrialsService.createClinicalTrial({
        protocol_number: protocol,
        title,
        sponsor: sponsor || undefined,
        phase: phase ?? undefined,
        status: status ?? undefined,
        principal_investigator: pi || undefined,
        target_enrollment: typeof enroll === "number" ? enroll : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clinical-trials"] });
      toast.success("Trial registered", { title: "Clinical trials" });
      onClose();
      setProtocol("");
      setTitle("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Register failed" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Register clinical trial" size="lg">
      <Stack gap="sm">
        <Group grow>
          <TextInput
            label="Protocol number"
            value={protocol}
            onChange={(e) => setProtocol(e.currentTarget.value)}
            required
          />
          <Select
            label="Phase"
            data={["I", "II", "III", "IV"].map((v) => ({ value: v, label: `Phase ${v}` }))}
            value={phase}
            onChange={setPhase}
            clearable
          />
        </Group>
        <TextInput
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          required
        />
        <Group grow>
          <TextInput
            label="Sponsor"
            value={sponsor}
            onChange={(e) => setSponsor(e.currentTarget.value)}
          />
          <TextInput
            label="Principal investigator"
            value={pi}
            onChange={(e) => setPi(e.currentTarget.value)}
          />
        </Group>
        <Group grow>
          <Select
            label="Status"
            data={STATUSES.map((v) => ({ value: v, label: v }))}
            value={status}
            onChange={setStatus}
          />
          <NumberInput
            label="Target enrollment"
            value={enroll}
            onChange={(v) => setEnroll(typeof v === "number" ? v : "")}
            min={0}
          />
        </Group>
        <Button
          onClick={() => create.mutate()}
          loading={create.isPending}
          disabled={!protocol.trim() || !title.trim()}
        >
          Register
        </Button>
      </Stack>
    </Modal>
  );
}

export function ClinicalTrialsPage() {
  useRequirePermission("specialty.clinical_trials.list");
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string | null>(null);
  const [modalOpen, modal] = useDisclosure(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["clinical-trials", filter],
    queryFn: () => clinicalTrialsService.listClinicalTrials(filter ?? undefined),
  });

  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      clinicalTrialsService.updateClinicalTrial(v.id, { status: v.status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["clinical-trials"] });
      toast.success("Status updated", { title: "Clinical trials" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Update failed" }),
  });

  const columns: Column<ClinicalTrial>[] = [
    { key: "protocol_number", label: "Protocol", render: (r) => r.protocol_number },
    { key: "title", label: "Title", render: (r) => r.title },
    { key: "sponsor", label: "Sponsor", render: (r) => r.sponsor || "—" },
    { key: "phase", label: "Phase", render: (r) => (r.phase ? `Phase ${r.phase}` : "—") },
    {
      key: "target_enrollment",
      label: "Target",
      render: (r) => r.target_enrollment ?? "—",
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Group gap="xs">
          <Badge tone={statusTone(r.status)}>{r.status}</Badge>
          <Select
            size="xs"
            w={130}
            data={STATUSES.map((v) => ({ value: v, label: v }))}
            value={r.status}
            onChange={(v) => v && update.mutate({ id: r.id, status: v })}
            aria-label="Change status"
          />
        </Group>
      ),
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Clinical trials"
        subtitle="Research trial registry — recruiting, active & completed"
        icon={<IconFlask2 size={20} />}
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={modal.open}>
            Register trial
          </Button>
        }
      />
      <Select
        placeholder="All statuses"
        data={STATUSES.map((v) => ({ value: v, label: v }))}
        value={filter}
        onChange={setFilter}
        clearable
        maw={220}
        aria-label="Filter by status"
      />
      <DataTable
        columns={columns}
        data={data}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No clinical trials registered."
      />
      <CreateTrialModal opened={modalOpen} onClose={modal.close} />
    </Stack>
  );
}
