import {
  Drawer,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { CreateMrdBirthRequest, MrdBirthRegister } from "@medbrains/types";
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

export function BirthsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.MRD.BIRTHS_CREATE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();

  const { data: births = [], isLoading } = useQuery({
    queryKey: ["mrd-births"],
    queryFn: () => mrdService.listMrdBirths(),
  });

  const [form, setForm] = useState<CreateMrdBirthRequest>({
    patient_id: "",
    birth_date: "",
    baby_gender: "",
  });

  const createMut = useMutation({
    mutationFn: (body: CreateMrdBirthRequest) => mrdService.createMrdBirth(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-births"] });
      closeCreate();
      notifications.show({ title: "Registered", message: "Birth registered", color: "success" });
    },
  });

  const columns: Column<MrdBirthRegister>[] = [
    {
      key: "register_number",
      label: "Reg #",
      render: (r) => <Text fw={600}>{r.register_number}</Text>,
    },
    { key: "birth_date", label: "Date", render: (r) => <Text>{fmt(r.birth_date)}</Text> },
    {
      key: "baby_gender",
      label: "Gender",
      render: (r) => <Badge tone="neutral">{r.baby_gender}</Badge>,
    },
    {
      key: "baby_weight_grams",
      label: "Weight (g)",
      render: (r) => <Text>{r.baby_weight_grams ?? "—"}</Text>,
    },
    { key: "birth_type", label: "Type", render: (r) => <Text>{r.birth_type}</Text> },
    {
      key: "apgar",
      label: "APGAR",
      render: (r) => <Text>{r.apgar_1min != null ? `${r.apgar_1min}/${r.apgar_5min}` : "—"}</Text>,
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
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Register Birth
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={births} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Register Birth"
        position="right"
        size="xl"
      >
        <Stack>
          <PatientSearchSelect
            label="Mother Patient"
            value={form.patient_id}
            onChange={(v) => setForm({ ...form, patient_id: v })}
            required
          />
          <PatientContextBanner patientId={form.patient_id} hideLoadingState />
          <TextInput
            label="Birth Date"
            required
            placeholder="YYYY-MM-DD"
            value={form.birth_date}
            onChange={(e) => setForm({ ...form, birth_date: e.currentTarget.value })}
          />
          <Select
            label="Baby Gender"
            data={["male", "female", "ambiguous"]}
            required
            value={form.baby_gender}
            onChange={(v) => setForm({ ...form, baby_gender: v ?? "" })}
          />
          <NumberInput
            label="Baby Weight (grams)"
            value={form.baby_weight_grams ?? undefined}
            onChange={(v) => setForm({ ...form, baby_weight_grams: v ? Number(v) : undefined })}
          />
          <Select
            label="Birth Type"
            data={["normal", "cesarean", "assisted", "vacuum", "forceps"]}
            value={form.birth_type ?? "normal"}
            onChange={(v) => setForm({ ...form, birth_type: v ?? "normal" })}
          />
          <Group grow>
            <NumberInput
              label="APGAR 1min"
              value={form.apgar_1min ?? undefined}
              onChange={(v) => setForm({ ...form, apgar_1min: v != null ? Number(v) : undefined })}
              min={0}
              max={10}
            />
            <NumberInput
              label="APGAR 5min"
              value={form.apgar_5min ?? undefined}
              onChange={(v) => setForm({ ...form, apgar_5min: v != null ? Number(v) : undefined })}
              min={0}
              max={10}
            />
          </Group>
          <TextInput
            label="Father Name"
            value={form.father_name ?? ""}
            onChange={(e) => setForm({ ...form, father_name: e.currentTarget.value })}
          />
          <NumberInput
            label="Mother Age"
            value={form.mother_age ?? undefined}
            onChange={(v) => setForm({ ...form, mother_age: v ? Number(v) : undefined })}
          />
          <Textarea
            label="Complications"
            value={form.complications ?? ""}
            onChange={(e) => setForm({ ...form, complications: e.currentTarget.value })}
          />
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
