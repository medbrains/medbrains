import { Group, Modal, NumberInput, Select, Stack, TextInput } from "@mantine/core";
import { DateInput, TimeInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { HomeVisit } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconRoute } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { homeHealthService } from "@/services/homeHealth.service";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusTone(s: string): BadgeTone {
  if (s === "completed") return "success";
  if (s === "cancelled" || s === "missed") return "danger";
  if (s === "en_route") return "info";
  return "neutral";
}

function ScheduleVisitModal({
  date,
  opened,
  onClose,
}: {
  date: string;
  opened: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [patientId, setPatientId] = useState("");
  const [nurseId, setNurseId] = useState("");
  const [time, setTime] = useState("");
  const [purpose, setPurpose] = useState("");
  const [order, setOrder] = useState<number | "">("");

  const create = useMutation({
    mutationFn: () =>
      homeHealthService.scheduleHomeVisit({
        patient_id: patientId,
        nurse_id: nurseId || undefined,
        scheduled_date: date,
        scheduled_time: time ? (time.length === 5 ? `${time}:00` : time) : undefined,
        purpose: purpose || undefined,
        visit_order: typeof order === "number" ? order : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["home-visits"] });
      toast.success("Visit scheduled", { title: "Home visits" });
      onClose();
      setPatientId("");
      setPurpose("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Schedule failed" }),
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Schedule home visit">
      <Stack gap="sm">
        <PatientSearchSelect value={patientId} onChange={setPatientId} />
        <EmployeeSearchSelect value={nurseId} onChange={setNurseId} label="Assign nurse" />
        <Group grow>
          <TimeInput label="Time" value={time} onChange={(e) => setTime(e.currentTarget.value)} />
          <NumberInput
            label="Visit order"
            value={order}
            onChange={(v) => setOrder(typeof v === "number" ? v : "")}
            min={1}
          />
        </Group>
        <TextInput
          label="Purpose"
          value={purpose}
          onChange={(e) => setPurpose(e.currentTarget.value)}
          placeholder="IV antibiotics / wound dressing"
        />
        <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!patientId}>
          Schedule
        </Button>
      </Stack>
    </Modal>
  );
}

function DocumentModal({ visit, onClose }: { visit: HomeVisit; onClose: () => void }) {
  const qc = useQueryClient();
  const v = (visit.vitals ?? {}) as Record<string, unknown>;
  const [bp, setBp] = useState(v.bp ? String(v.bp) : "");
  const [pulse, setPulse] = useState(v.pulse ? String(v.pulse) : "");
  const [spo2, setSpo2] = useState(v.spo2 ? String(v.spo2) : "");
  const [temp, setTemp] = useState(v.temp ? String(v.temp) : "");
  const [compliance, setCompliance] = useState<string | null>(visit.medication_compliance ?? null);
  const [photo, setPhoto] = useState(visit.wound_photo_url ?? "");

  const save = useMutation({
    mutationFn: () =>
      homeHealthService.documentHomeVisit(visit.id, {
        vitals: {
          ...(bp && { bp }),
          ...(pulse && { pulse }),
          ...(spo2 && { spo2 }),
          ...(temp && { temp }),
        },
        medication_compliance: compliance ?? undefined,
        wound_photo_url: photo || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["home-visits"] });
      toast.success("Visit documented", { title: "Home visits" });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Save failed" }),
  });

  return (
    <Modal opened onClose={onClose} title="Document visit" size="lg">
      <Stack gap="sm">
        <Group grow>
          <TextInput
            label="BP"
            value={bp}
            onChange={(e) => setBp(e.currentTarget.value)}
            placeholder="120/80"
          />
          <TextInput
            label="Pulse"
            value={pulse}
            onChange={(e) => setPulse(e.currentTarget.value)}
          />
          <TextInput label="SpO₂" value={spo2} onChange={(e) => setSpo2(e.currentTarget.value)} />
          <TextInput label="Temp" value={temp} onChange={(e) => setTemp(e.currentTarget.value)} />
        </Group>
        <Select
          label="Medication compliance"
          data={["good", "partial", "poor"].map((c) => ({ value: c, label: c }))}
          value={compliance}
          onChange={setCompliance}
          clearable
        />
        <TextInput
          label="Wound photo URL"
          value={photo}
          onChange={(e) => setPhoto(e.currentTarget.value)}
          placeholder="Uploaded image reference"
        />
        <Button onClick={() => save.mutate()} loading={save.isPending}>
          Save documentation
        </Button>
      </Stack>
    </Modal>
  );
}

export function HomeVisitsPage() {
  useRequirePermission(P.IPD.MAR_LIST);
  const canManage = useHasPermission(P.IPD.MAR_CREATE);
  const qc = useQueryClient();
  const [date, setDate] = useState<string | null>(today());
  const [modalOpen, modal] = useDisclosure(false);
  const [docVisit, setDocVisit] = useState<HomeVisit | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["home-visits", date],
    queryFn: () => homeHealthService.listHomeVisits({ date: date ?? undefined }),
  });

  const update = useMutation({
    mutationFn: (v: { id: string; status: string }) =>
      homeHealthService.updateHomeVisit(v.id, { status: v.status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["home-visits"] });
      toast.success("Visit updated", { title: "Home visits" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Update failed" }),
  });

  const bill = useMutation({
    mutationFn: (id: string) => homeHealthService.billHomeVisit(id),
    onSuccess: () => toast.success("Visit billed", { title: "Home visits" }),
    onError: (e: Error) => toast.error(e.message, { title: "Bill failed" }),
  });

  const act = (id: string, status: string, label: string, tone: "primary" | "danger") => (
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

  const columns: Column<HomeVisit>[] = [
    { key: "visit_order", label: "#", render: (r) => r.visit_order ?? "—" },
    {
      key: "patient",
      label: "Patient",
      render: (r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "—",
    },
    { key: "nurse", label: "Nurse", render: (r) => r.nurse_name ?? "Unassigned" },
    { key: "time", label: "Time", render: (r) => r.scheduled_time?.slice(0, 5) ?? "—" },
    { key: "purpose", label: "Purpose", render: (r) => r.purpose ?? "—" },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge tone={statusTone(r.status)}>{r.status.replace("_", " ")}</Badge>,
    },
    {
      key: "actions",
      label: "",
      render: (r) => {
        if (!canManage) return null;
        const actions = [];
        if (r.status === "scheduled") actions.push(act(r.id, "en_route", "En route", "primary"));
        if (r.status === "scheduled" || r.status === "en_route") {
          actions.push(act(r.id, "completed", "Complete", "primary"));
          actions.push(act(r.id, "missed", "Missed", "danger"));
        }
        actions.push(
          <Button key="document" size="xs" tone="secondary" onClick={() => setDocVisit(r)}>
            Document
          </Button>,
        );
        actions.push(
          <Button
            key="bill"
            size="xs"
            tone="ghost"
            loading={bill.isPending}
            onClick={() => bill.mutate(r.id)}
          >
            Bill
          </Button>,
        );
        return actions.length > 0 ? <Group gap="xs">{actions}</Group> : null;
      },
    },
  ];

  return (
    <Stack gap="md">
      <PageHeader
        title="Home visits"
        subtitle="Daily home-care round — schedule, assign nurses & track"
        icon={<IconRoute size={20} />}
        actions={
          canManage ? (
            <Button leftSection={<IconPlus size={16} />} onClick={modal.open}>
              Schedule visit
            </Button>
          ) : undefined
        }
      />
      <DateInput label="Date" value={date} onChange={setDate} maw={220} />
      <DataTable
        columns={columns}
        data={data}
        loading={isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No home visits scheduled for this date."
      />
      {date && <ScheduleVisitModal date={date} opened={modalOpen} onClose={modal.close} />}
      {docVisit && <DocumentModal visit={docVisit} onClose={() => setDocVisit(null)} />}
    </Stack>
  );
}
