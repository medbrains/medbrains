import { Drawer, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { CreateMrdDeathRequest, MrdDeathRegister } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";
import { fmt } from "./mrdShared";

export function DeathsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.MRD.DEATHS_CREATE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();

  const { data: deaths = [], isLoading } = useQuery({
    queryKey: ["mrd-deaths"],
    queryFn: () => mrdService.listMrdDeaths(),
  });

  const [form, setForm] = useState<CreateMrdDeathRequest>({
    patient_id: "",
    death_date: "",
  });

  const createMut = useMutation({
    mutationFn: (body: CreateMrdDeathRequest) => mrdService.createMrdDeath(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-deaths"] });
      closeCreate();
      notifications.show({ title: "Registered", message: "Death registered", color: "success" });
    },
  });

  const columns: Column<MrdDeathRegister>[] = [
    {
      key: "register_number",
      label: "Reg #",
      render: (r) => <Text fw={600}>{r.register_number}</Text>,
    },
    { key: "death_date", label: "Date", render: (r) => <Text>{fmt(r.death_date)}</Text> },
    {
      key: "cause_of_death",
      label: "Cause",
      render: (r) => <Text lineClamp={1}>{r.cause_of_death ?? "—"}</Text>,
    },
    {
      key: "manner_of_death",
      label: "Manner",
      render: (r) => <Badge tone="neutral">{r.manner_of_death}</Badge>,
    },
    {
      key: "is_medico_legal",
      label: "MLC",
      render: (r) =>
        r.is_medico_legal ? <Badge tone="danger">MLC</Badge> : <Text size="sm">No</Text>,
    },
    {
      key: "cert",
      label: "Certificate",
      render: (r) =>
        r.certificate_issued ? (
          <Badge tone="success">Issued</Badge>
        ) : (
          <Badge tone="neutral">Pending</Badge>
        ),
    },
    {
      key: "municipality",
      label: "Reported",
      render: (r) =>
        r.reported_to_municipality ? (
          <Badge tone="success">Yes</Badge>
        ) : (
          <Badge tone="warning">No</Badge>
        ),
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Register Death
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={deaths} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Register Death"
        position="right"
        size="xl"
      >
        <Stack>
          <PatientSearchSelect
            value={form.patient_id}
            onChange={(v) => setForm({ ...form, patient_id: v })}
            required
          />
          <PatientContextBanner patientId={form.patient_id} hideLoadingState />
          <TextInput
            label="Death Date"
            required
            placeholder="YYYY-MM-DD"
            value={form.death_date}
            onChange={(e) => setForm({ ...form, death_date: e.currentTarget.value })}
          />
          <TextInput
            label="Cause of Death"
            value={form.cause_of_death ?? ""}
            onChange={(e) => setForm({ ...form, cause_of_death: e.currentTarget.value })}
          />
          <TextInput
            label="Immediate Cause"
            value={form.immediate_cause ?? ""}
            onChange={(e) => setForm({ ...form, immediate_cause: e.currentTarget.value })}
          />
          <TextInput
            label="Antecedent Cause"
            value={form.antecedent_cause ?? ""}
            onChange={(e) => setForm({ ...form, antecedent_cause: e.currentTarget.value })}
          />
          <TextInput
            label="Underlying Cause"
            value={form.underlying_cause ?? ""}
            onChange={(e) => setForm({ ...form, underlying_cause: e.currentTarget.value })}
          />
          <Select
            label="Manner of Death"
            data={["natural", "accident", "suicide", "homicide", "undetermined", "pending"]}
            value={form.manner_of_death ?? "natural"}
            onChange={(v) => setForm({ ...form, manner_of_death: v ?? "natural" })}
          />
          <Group grow>
            <Select
              label="Medico-Legal?"
              data={[
                { value: "true", label: "Yes" },
                { value: "false", label: "No" },
              ]}
              value={String(form.is_medico_legal ?? false)}
              onChange={(v) => setForm({ ...form, is_medico_legal: v === "true" })}
            />
            <Select
              label="Brought Dead?"
              data={[
                { value: "true", label: "Yes" },
                { value: "false", label: "No" },
              ]}
              value={String(form.is_brought_dead ?? false)}
              onChange={(v) => setForm({ ...form, is_brought_dead: v === "true" })}
            />
          </Group>
          <Button
            tone="primary"
            onClick={() => createMut.mutate(form)}
            loading={createMut.isPending}
          >
            Register
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}
