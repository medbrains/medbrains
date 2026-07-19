// PROCUREMENT StoreLocationPanel — split from procurement.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { ProcurementStoreLocationFormInput } from "@medbrains/schemas";
import { procurementStoreLocationFormSchema } from "@medbrains/schemas";
import type { StoreLocation } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable, TableValueBadge } from "@/components";
import { Button, toast } from "@/components/ui";
import { procurementService } from "@/services/procurement.service";
import { optionalText } from "./shared";

function StoreLocationForm({ onSuccess }: { onSuccess: () => void }) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProcurementStoreLocationFormInput>({
    resolver: zodResolver(procurementStoreLocationFormSchema),
    defaultValues: {
      code: "",
      name: "",
      location_type: "main_store",
      address: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: ProcurementStoreLocationFormInput) =>
      procurementService.createStoreLocation({
        code: values.code.trim(),
        name: values.name.trim(),
        location_type: values.location_type,
        address: optionalText(values.address),
      }),
    onSuccess: () => {
      toast.success("Store location created", { title: "Created" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  return (
    <Stack component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <TextInput label="Code" required error={errors.code?.message} {...register("code")} />
      <TextInput label="Name" required error={errors.name?.message} {...register("name")} />
      <Controller
        control={control}
        name="location_type"
        render={({ field }) => (
          <Select
            label="Type"
            data={[
              { value: "main_store", label: "Main Store" },
              { value: "sub_store", label: "Sub Store" },
              { value: "department_store", label: "Department Store" },
              { value: "pharmacy_store", label: "Pharmacy Store" },
              { value: "warehouse", label: "Warehouse" },
            ]}
            value={field.value}
            onChange={(value) => field.onChange(value ?? "main_store")}
            error={errors.location_type?.message}
          />
        )}
      />
      <Textarea label="Address" error={errors.address?.message} {...register("address")} />
      <Button tone="primary" loading={mutation.isPending} type="submit">
        Create Location
      </Button>
    </Stack>
  );
}

export function StoreLocationPanel({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data: locations, isLoading } = useQuery({
    queryKey: ["store-locations"],
    queryFn: () => procurementService.listStoreLocations(),
  });

  const columns = [
    {
      key: "code",
      label: "Code",
      render: (row: StoreLocation) => <Text fw={600}>{row.code}</Text>,
    },
    { key: "name", label: "Name", render: (row: StoreLocation) => row.name },
    {
      key: "location_type",
      label: "Type",
      render: (row: StoreLocation) => (
        <TableValueBadge value={row.location_type} kind="store" variant="outline" />
      ),
    },
    {
      key: "is_active",
      label: "Active",
      render: (row: StoreLocation) => (
        <TableValueBadge
          value={row.is_active ? "active" : "inactive"}
          label={row.is_active ? "Yes" : "No"}
          color={row.is_active ? "success" : "slate"}
          variant="filled"
        />
      ),
    },
    { key: "address", label: "Address", render: (row: StoreLocation) => row.address ?? "-" },
  ];

  return (
    <>
      {canManage && (
        <Group justify="flex-end" mb="md">
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add Location
          </Button>
        </Group>
      )}

      <DataTable
        columns={columns}
        data={locations ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No store locations"
      />

      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Add Store Location"
        closeButtonProps={{ "aria-label": "Close Add Store Location" }}
        position="right"
        size="xl"
      >
        <StoreLocationForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["store-locations"] });
            closeCreate();
          }}
        />
      </Drawer>
    </>
  );
}
