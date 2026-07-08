import { Group, Modal, Select, Stack, Tabs, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { PatientTransferDisplay, TransferStatus } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAmbulance, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { multiHospitalService } from "@/services/multiHospital.service";

function statusTone(s: TransferStatus): BadgeTone {
  switch (s) {
    case "received":
      return "success";
    case "rejected":
    case "cancelled":
      return "danger";
    case "in_transit":
    case "approved":
      return "info";
    default:
      return "neutral";
  }
}

const PRIORITIES = ["routine", "urgent", "emergency"].map((v) => ({ value: v, label: v }));
const TRANSPORT = ["ambulance", "als_ambulance", "own_vehicle", "air"].map((v) => ({
  value: v,
  label: v.replace(/_/g, " "),
}));

function RequestTransferModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [groupId, setGroupId] = useState<string | null>(null);
  const [destTenant, setDestTenant] = useState<string | null>(null);
  const [patientId, setPatientId] = useState("");
  const [reason, setReason] = useState("");
  const [summary, setSummary] = useState("");
  const [priority, setPriority] = useState<string | null>("routine");
  const [transport, setTransport] = useState<string | null>(null);

  const { data: groups = [] } = useQuery({
    queryKey: ["hospital-groups"],
    queryFn: () => multiHospitalService.listHospitalGroups(),
    enabled: opened,
  });
  const { data: hospitals = [] } = useQuery({
    queryKey: ["hospitals-in-group", groupId],
    queryFn: () => multiHospitalService.listHospitalsInGroup(groupId ?? ""),
    enabled: !!groupId,
  });

  const create = useMutation({
    mutationFn: () =>
      multiHospitalService.createPatientTransfer({
        dest_tenant_id: destTenant ?? "",
        patient_id: patientId,
        reason,
        clinical_summary: summary || undefined,
        priority: priority ?? undefined,
        transport_mode: transport ?? undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patient-transfers"] });
      toast.success("Transfer requested", { title: "Inter-hospital transfer" });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Request failed" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Request patient transfer" size="lg">
      <Stack gap="sm">
        <Select
          label="Group"
          data={groups.map((g) => ({ value: g.id, label: g.name }))}
          value={groupId}
          onChange={(v) => {
            setGroupId(v);
            setDestTenant(null);
          }}
          searchable
        />
        <Select
          label="Destination hospital"
          data={hospitals.map((h) => ({ value: h.id, label: h.name }))}
          value={destTenant}
          onChange={setDestTenant}
          disabled={!groupId}
          searchable
        />
        <PatientSearchSelect value={patientId} onChange={setPatientId} />
        <Textarea
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          minRows={2}
          required
        />
        <Textarea
          label="Clinical summary (handover)"
          value={summary}
          onChange={(e) => setSummary(e.currentTarget.value)}
          minRows={3}
        />
        <Group grow>
          <Select label="Priority" data={PRIORITIES} value={priority} onChange={setPriority} />
          <Select
            label="Transport"
            data={TRANSPORT}
            value={transport}
            onChange={setTransport}
            clearable
          />
        </Group>
        <Button
          onClick={() => create.mutate()}
          loading={create.isPending}
          disabled={!destTenant || !patientId || !reason.trim()}
        >
          Request transfer
        </Button>
      </Stack>
    </Modal>
  );
}

function TransfersTable({ direction }: { direction: "outgoing" | "incoming" }) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["patient-transfers", direction],
    queryFn: () =>
      direction === "outgoing"
        ? multiHospitalService.listOutgoingPatientTransfers()
        : multiHospitalService.listIncomingPatientTransfers(),
    refetchInterval: 30_000,
  });

  const update = useMutation({
    mutationFn: (vars: { id: string; status: TransferStatus }) =>
      multiHospitalService.updatePatientTransferStatus(vars.id, { status: vars.status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["patient-transfers"] });
      toast.success("Transfer updated", { title: "Transfer" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Update failed" }),
  });

  const act = (
    id: string,
    status: TransferStatus,
    label: string,
    tone: "primary" | "secondary" | "danger",
  ) => (
    <Button
      key={status}
      size="xs"
      tone={tone}
      loading={update.isPending}
      onClick={() => update.mutate({ id, status })}
    >
      {label}
    </Button>
  );

  const rowActions = (r: PatientTransferDisplay) => {
    if (direction === "incoming") {
      if (r.status === "requested")
        return [
          act(r.id, "approved", "Accept", "primary"),
          act(r.id, "rejected", "Reject", "danger"),
        ];
      if (r.status === "in_transit") return [act(r.id, "received", "Receive", "primary")];
    } else {
      if (r.status === "approved")
        return [
          act(r.id, "in_transit", "Depart", "primary"),
          act(r.id, "cancelled", "Cancel", "danger"),
        ];
      if (r.status === "requested") return [act(r.id, "cancelled", "Cancel", "danger")];
    }
    return null;
  };

  const columns: Column<PatientTransferDisplay>[] = [
    {
      key: "hospital",
      label: direction === "outgoing" ? "To" : "From",
      render: (r) => (direction === "outgoing" ? r.dest_hospital_name : r.source_hospital_name),
    },
    {
      key: "patient_name",
      label: "Patient",
      render: (r) => r.patient_name || r.uhid || "—",
    },
    { key: "reason", label: "Reason", render: (r) => r.reason },
    {
      key: "priority",
      label: "Priority",
      render: (r) => (
        <Badge tone={r.priority === "emergency" ? "danger" : "neutral"} size="sm">
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge>,
    },
    {
      key: "requested_at",
      label: "Requested",
      render: (r) => new Date(r.requested_at).toLocaleString(),
    },
    { key: "actions", label: "", render: (r) => <Group gap="xs">{rowActions(r)}</Group> },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={isLoading}
      rowKey={(r) => r.id}
      emptyTitle="No transfers."
    />
  );
}

export function InterHospitalTransfersPage() {
  useRequirePermission(P.IPD.TRANSFERS_CREATE);
  const [modalOpen, modal] = useDisclosure(false);

  return (
    <Stack gap="md">
      <PageHeader
        title="Inter-hospital transfers"
        subtitle="Refer and receive patients across hospitals in your group"
        icon={<IconAmbulance size={20} />}
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={modal.open}>
            Request transfer
          </Button>
        }
      />
      <Tabs defaultValue="outgoing">
        <Tabs.List>
          <Tabs.Tab value="outgoing">Outgoing</Tabs.Tab>
          <Tabs.Tab value="incoming">Incoming</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="outgoing" pt="md">
          <TransfersTable direction="outgoing" />
        </Tabs.Panel>
        <Tabs.Panel value="incoming" pt="md">
          <TransfersTable direction="incoming" />
        </Tabs.Panel>
      </Tabs>
      <RequestTransferModal opened={modalOpen} onClose={modal.close} />
    </Stack>
  );
}
