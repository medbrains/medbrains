import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { MrdRetentionCreateInput } from "@medbrains/schemas";
import { mrdRetentionCreateSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { CreateMrdRetentionPolicyRequest, MrdRetentionPolicy } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";

const RETENTION_DEFAULTS: MrdRetentionCreateInput = {
  record_type: "opd",
  category: "",
  retention_years: 5,
};

export function RetentionTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.MRD.RECORDS_MANAGE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["mrd-retention"],
    queryFn: () => mrdService.listMrdRetentionPolicies(),
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MrdRetentionCreateInput>({
    resolver: zodResolver(mrdRetentionCreateSchema),
    defaultValues: RETENTION_DEFAULTS,
    mode: "onTouched",
  });

  const createMut = useMutation({
    mutationFn: (body: CreateMrdRetentionPolicyRequest) =>
      mrdService.createMrdRetentionPolicy(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-retention"] });
      reset(RETENTION_DEFAULTS);
      closeCreate();
      notifications.show({
        title: "Created",
        message: "Retention policy created",
        color: "success",
      });
    },
  });

  const submit = handleSubmit((values) => {
    createMut.mutate({
      record_type: values.record_type,
      category: values.category.trim(),
      retention_years: values.retention_years,
      legal_reference: values.legal_reference?.trim() || undefined,
      destruction_method: values.destruction_method,
    });
  });

  const columns: Column<MrdRetentionPolicy>[] = [
    { key: "record_type", label: "Record Type", render: (r) => <Text>{r.record_type}</Text> },
    { key: "category", label: "Category", render: (r) => <Text>{r.category}</Text> },
    {
      key: "retention_years",
      label: "Years",
      render: (r) => <Text fw={600}>{r.retention_years}</Text>,
    },
    {
      key: "legal_reference",
      label: "Legal Ref",
      render: (r) => <Text size="sm">{r.legal_reference ?? "—"}</Text>,
    },
    {
      key: "destruction_method",
      label: "Destruction",
      render: (r) => <Text size="sm">{r.destruction_method ?? "—"}</Text>,
    },
    {
      key: "is_active",
      label: "Active",
      render: (r) =>
        r.is_active ? <Badge tone="success">Yes</Badge> : <Badge tone="neutral">No</Badge>,
    },
  ];

  return (
    <>
      <Group justify="flex-end" mb="md">
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add Policy
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={policies} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Add Retention Policy"
        position="right"
        size="xl"
      >
        <Stack>
          <Controller
            control={control}
            name="record_type"
            render={({ field }) => (
              <Select
                label="Record Type"
                data={["opd", "ipd", "emergency", "maternity", "mlc", "pediatric"]}
                required
                value={field.value ?? null}
                onChange={field.onChange}
                error={errors.record_type?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <TextInput
                label="Category"
                required
                placeholder="e.g., adult_opd"
                value={field.value ?? ""}
                onChange={field.onChange}
                error={errors.category?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="retention_years"
            render={({ field }) => (
              <NumberInput
                label="Retention Years"
                required
                value={field.value ?? ""}
                onChange={(v) => field.onChange(v === "" ? undefined : Number(v))}
                error={errors.retention_years?.message}
                min={1}
              />
            )}
          />
          <Controller
            control={control}
            name="legal_reference"
            render={({ field }) => (
              <TextInput
                label="Legal Reference"
                value={field.value ?? ""}
                onChange={field.onChange}
                error={errors.legal_reference?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="destruction_method"
            render={({ field }) => (
              <Select
                label="Destruction Method"
                data={["shredding", "incineration"]}
                value={field.value ?? null}
                onChange={(v) => field.onChange(v ?? undefined)}
                error={errors.destruction_method?.message}
                clearable
              />
            )}
          />
          <Button tone="primary" onClick={() => void submit()} loading={createMut.isPending}>
            Create
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}
