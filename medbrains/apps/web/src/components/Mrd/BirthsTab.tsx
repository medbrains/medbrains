import { zodResolver } from "@hookform/resolvers/zod";
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
import type { MrdBirthCreateInput } from "@medbrains/schemas";
import { mrdBirthCreateSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateMrdBirthRequest, MrdBirthRegister } from "@medbrains/types";
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

const BIRTH_DEFAULTS: MrdBirthCreateInput = {
  patient_id: "",
  birth_date: "",
  baby_gender: "male",
  birth_type: "normal",
};

export function BirthsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.MRD.BIRTHS_CREATE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();

  const { data: births = [], isLoading } = useQuery({
    queryKey: ["mrd-births"],
    queryFn: () => mrdService.listMrdBirths(),
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MrdBirthCreateInput>({
    resolver: zodResolver(mrdBirthCreateSchema),
    defaultValues: BIRTH_DEFAULTS,
    mode: "onTouched",
  });

  const patientId = useWatch({ control, name: "patient_id" });

  const createMut = useMutation({
    mutationFn: (body: CreateMrdBirthRequest) => mrdService.createMrdBirth(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-births"] });
      reset(BIRTH_DEFAULTS);
      closeCreate();
      notifications.show({ title: "Registered", message: "Birth registered", color: "success" });
    },
  });

  const submit = handleSubmit((values) => {
    createMut.mutate({
      patient_id: values.patient_id,
      birth_date: values.birth_date.trim(),
      baby_gender: values.baby_gender,
      baby_weight_grams: values.baby_weight_grams,
      birth_type: values.birth_type,
      apgar_1min: values.apgar_1min,
      apgar_5min: values.apgar_5min,
      father_name: values.father_name?.trim() || undefined,
      mother_age: values.mother_age,
      complications: values.complications?.trim() || undefined,
    });
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
          <Controller
            control={control}
            name="patient_id"
            render={({ field }) => (
              <PatientSearchSelect
                label="Mother Patient"
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
            name="birth_date"
            render={({ field }) => (
              <TextInput
                label="Birth Date"
                required
                placeholder="YYYY-MM-DD"
                value={field.value ?? ""}
                onChange={field.onChange}
                error={errors.birth_date?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="baby_gender"
            render={({ field }) => (
              <Select
                label="Baby Gender"
                data={["male", "female", "ambiguous"]}
                required
                value={field.value ?? null}
                onChange={field.onChange}
                error={errors.baby_gender?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="baby_weight_grams"
            render={({ field }) => (
              <NumberInput
                label="Baby Weight (grams)"
                value={field.value ?? ""}
                onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                error={errors.baby_weight_grams?.message}
                min={0}
              />
            )}
          />
          <Controller
            control={control}
            name="birth_type"
            render={({ field }) => (
              <Select
                label="Birth Type"
                data={["normal", "cesarean", "assisted", "vacuum", "forceps"]}
                value={field.value ?? null}
                onChange={field.onChange}
                error={errors.birth_type?.message}
              />
            )}
          />
          <Group grow>
            <Controller
              control={control}
              name="apgar_1min"
              render={({ field }) => (
                <NumberInput
                  label="APGAR 1min"
                  value={field.value ?? ""}
                  onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                  error={errors.apgar_1min?.message}
                  min={0}
                  max={10}
                />
              )}
            />
            <Controller
              control={control}
              name="apgar_5min"
              render={({ field }) => (
                <NumberInput
                  label="APGAR 5min"
                  value={field.value ?? ""}
                  onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                  error={errors.apgar_5min?.message}
                  min={0}
                  max={10}
                />
              )}
            />
          </Group>
          <Controller
            control={control}
            name="father_name"
            render={({ field }) => (
              <TextInput
                label="Father Name"
                value={field.value ?? ""}
                onChange={field.onChange}
                error={errors.father_name?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="mother_age"
            render={({ field }) => (
              <NumberInput
                label="Mother Age"
                value={field.value ?? ""}
                onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                error={errors.mother_age?.message}
                min={0}
              />
            )}
          />
          <Controller
            control={control}
            name="complications"
            render={({ field }) => (
              <Textarea
                label="Complications"
                value={field.value ?? ""}
                onChange={field.onChange}
                error={errors.complications?.message}
              />
            )}
          />
          <Button tone="primary" onClick={() => void submit()} loading={createMut.isPending}>
            Register
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}
