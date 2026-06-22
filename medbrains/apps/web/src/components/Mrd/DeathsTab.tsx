import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { MrdDeathCreateInput } from "@medbrains/schemas";
import { mrdDeathCreateSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateMrdDeathRequest, MrdDeathRegister } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { PatientContextBanner } from "@/components/Patient/PatientContextBanner";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";
import { fmt } from "./mrdShared";

const DEATH_DEFAULTS: MrdDeathCreateInput = {
  patient_id: "",
  death_date: "",
  manner_of_death: "natural",
  is_medico_legal: false,
  is_brought_dead: false,
};

export function DeathsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.MRD.DEATHS_CREATE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();

  const { data: deaths = [], isLoading } = useQuery({
    queryKey: ["mrd-deaths"],
    queryFn: () => mrdService.listMrdDeaths(),
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MrdDeathCreateInput>({
    resolver: zodResolver(mrdDeathCreateSchema),
    defaultValues: DEATH_DEFAULTS,
    mode: "onTouched",
  });

  const patientId = useWatch({ control, name: "patient_id" });

  const createMut = useMutation({
    mutationFn: (body: CreateMrdDeathRequest) => mrdService.createMrdDeath(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-deaths"] });
      reset(DEATH_DEFAULTS);
      closeCreate();
      notifications.show({ title: "Registered", message: "Death registered", color: "success" });
    },
  });

  const submit = handleSubmit((values) => {
    createMut.mutate({
      patient_id: values.patient_id,
      death_date: values.death_date.trim(),
      cause_of_death: values.cause_of_death?.trim() || undefined,
      immediate_cause: values.immediate_cause?.trim() || undefined,
      antecedent_cause: values.antecedent_cause?.trim() || undefined,
      underlying_cause: values.underlying_cause?.trim() || undefined,
      manner_of_death: values.manner_of_death,
      is_medico_legal: values.is_medico_legal,
      is_brought_dead: values.is_brought_dead,
    });
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
          <Controller
            control={control}
            name="patient_id"
            render={({ field }) => (
              <PatientSearchSelect
                value={field.value}
                onChange={field.onChange}
                error={errors.patient_id?.message}
                required
              />
            )}
          />
          <PatientContextBanner patientId={patientId} hideLoadingState />
          <Controller
            control={control}
            name="death_date"
            render={({ field }) => (
              <TextInput
                label="Death Date"
                required
                placeholder="YYYY-MM-DD"
                value={field.value ?? ""}
                onChange={field.onChange}
                error={errors.death_date?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="cause_of_death"
            render={({ field }) => (
              <TextInput
                label="Cause of Death"
                value={field.value ?? ""}
                onChange={field.onChange}
                error={errors.cause_of_death?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="immediate_cause"
            render={({ field }) => (
              <TextInput
                label="Immediate Cause"
                value={field.value ?? ""}
                onChange={field.onChange}
                error={errors.immediate_cause?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="antecedent_cause"
            render={({ field }) => (
              <TextInput
                label="Antecedent Cause"
                value={field.value ?? ""}
                onChange={field.onChange}
                error={errors.antecedent_cause?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="underlying_cause"
            render={({ field }) => (
              <TextInput
                label="Underlying Cause"
                value={field.value ?? ""}
                onChange={field.onChange}
                error={errors.underlying_cause?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="manner_of_death"
            render={({ field }) => (
              <Select
                label="Manner of Death"
                data={["natural", "accident", "suicide", "homicide", "undetermined", "pending"]}
                value={field.value ?? null}
                onChange={field.onChange}
                error={errors.manner_of_death?.message}
              />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="is_medico_legal"
              render={({ field }) => (
                <Select
                  label="Medico-Legal?"
                  data={[
                    { value: "true", label: "Yes" },
                    { value: "false", label: "No" },
                  ]}
                  value={String(field.value ?? false)}
                  onChange={(v) => field.onChange(v === "true")}
                />
              )}
            />
            <Controller
              control={control}
              name="is_brought_dead"
              render={({ field }) => (
                <Select
                  label="Brought Dead?"
                  data={[
                    { value: "true", label: "Yes" },
                    { value: "false", label: "No" },
                  ]}
                  value={String(field.value ?? false)}
                  onChange={(v) => field.onChange(v === "true")}
                />
              )}
            />
          </Group>
          <Button tone="primary" onClick={() => void submit()} loading={createMut.isPending}>
            Register
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}
