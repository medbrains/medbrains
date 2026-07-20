import { Group, Select, Stack } from "@mantine/core";
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
import { AeModal } from "./clinical-trials/ae-modal";
import { CandidatesModal } from "./clinical-trials/candidates-modal";
import { ConsentsModal } from "./clinical-trials/consents-modal";
import { CreateTrialModal } from "./clinical-trials/create-trial-modal";
import { IrbModal } from "./clinical-trials/irb-modal";
import { RandomizationModal } from "./clinical-trials/randomization-modal";
import { STATUSES } from "./clinical-trials/shared";
import { VisitsModal } from "./clinical-trials/visits-modal";

function statusTone(s: string): BadgeTone {
  if (s === "active" || s === "recruiting") return "success";
  if (s === "terminated" || s === "suspended") return "danger";
  if (s === "completed") return "info";
  return "neutral";
}

export function ClinicalTrialsPage() {
  useRequirePermission("specialty.clinical_trials.list");
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string | null>(null);
  const [modalOpen, modal] = useDisclosure(false);
  const [candidatesTrial, setCandidatesTrial] = useState<ClinicalTrial | null>(null);
  const [consentsTrial, setConsentsTrial] = useState<ClinicalTrial | null>(null);
  const [visitsTrial, setVisitsTrial] = useState<ClinicalTrial | null>(null);
  const [aeTrial, setAeTrial] = useState<ClinicalTrial | null>(null);
  const [randTrial, setRandTrial] = useState<ClinicalTrial | null>(null);
  const [irbTrial, setIrbTrial] = useState<ClinicalTrial | null>(null);

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

  const exportM = useMutation({
    mutationFn: (trial: ClinicalTrial) =>
      clinicalTrialsService.exportTrial(trial.id).then((data) => ({ data, trial })),
    onSuccess: ({ data, trial }) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trial-${trial.protocol_number}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded", { title: "Clinical trials" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Export failed" }),
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
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap="xs">
          <Button size="xs" tone="secondary" onClick={() => setCandidatesTrial(r)}>
            Candidates
          </Button>
          <Button size="xs" tone="secondary" onClick={() => setConsentsTrial(r)}>
            Consents
          </Button>
          <Button size="xs" tone="secondary" onClick={() => setVisitsTrial(r)}>
            Visits
          </Button>
          <Button size="xs" tone="secondary" onClick={() => setAeTrial(r)}>
            AEs
          </Button>
          <Button size="xs" tone="secondary" onClick={() => setRandTrial(r)}>
            Randomize
          </Button>
          <Button size="xs" tone="secondary" onClick={() => setIrbTrial(r)}>
            Ethics
          </Button>
          <Button
            size="xs"
            tone="ghost"
            loading={exportM.isPending}
            onClick={() => exportM.mutate(r)}
          >
            Export
          </Button>
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
      {candidatesTrial && (
        <CandidatesModal trial={candidatesTrial} onClose={() => setCandidatesTrial(null)} />
      )}
      {consentsTrial && (
        <ConsentsModal trial={consentsTrial} onClose={() => setConsentsTrial(null)} />
      )}
      {visitsTrial && <VisitsModal trial={visitsTrial} onClose={() => setVisitsTrial(null)} />}
      {aeTrial && <AeModal trial={aeTrial} onClose={() => setAeTrial(null)} />}
      {randTrial && <RandomizationModal trial={randTrial} onClose={() => setRandTrial(null)} />}
      {irbTrial && <IrbModal trial={irbTrial} onClose={() => setIrbTrial(null)} />}
    </Stack>
  );
}
