import { zodResolver } from "@hookform/resolvers/zod";
import { Group, MultiSelect, SimpleGrid, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { type Column, DataTable } from "@/components/DataTable";
import { Badge, Button, Input, Modal, Select, Switch } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";

// The hub-and-spoke pharmacy kinds (constrains the free-text store_locations.location_type
// to real pharmacy roles without a schema change).
const PHARMACY_TYPES = [
  { value: "main_pharmacy", label: "Main / Central pharmacy" },
  { value: "ip_pharmacy", label: "Inpatient (IP)" },
  { value: "op_pharmacy", label: "Outpatient (OP)" },
  { value: "ward_pharmacy", label: "Ward / Satellite" },
  { value: "ot_pharmacy", label: "Operating theatre (OT)" },
  { value: "er_pharmacy", label: "Emergency / Casualty" },
  { value: "onco_pharmacy", label: "Oncology / Chemo" },
];
const TYPE_LABEL = new Map(PHARMACY_TYPES.map((t) => [t.value, t.label]));

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().optional(),
  location_type: z.string().min(1, "Type is required"),
  department_id: z.string().optional(),
  is_central: z.boolean(),
  serves_departments: z.array(z.string()),
});
type FormValues = z.infer<typeof schema>;
const EMPTY: FormValues = {
  name: "",
  code: "",
  location_type: "op_pharmacy",
  is_central: false,
  serves_departments: [],
};

function codeFromName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
}

interface PharmacyRow {
  assignmentId: string;
  name: string;
  type: string;
  isCentral: boolean;
  servesCount: number;
  active: boolean;
}

/**
 * Pharmacy registry + creator (MP1). A pharmacy is a `store_location` of a pharmacy
 * kind, plus a `pharmacy_store_assignment` (central hub vs spoke, departments served).
 * Reuses the existing create/list endpoints — no new backend.
 */
export function PharmacyRegistry() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.PHARMACY.STORES_MANAGE);
  const [opened, { open, close }] = useDisclosure(false);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["pharmacy-store-assignments"],
    queryFn: () => pharmacyService.listPharmacyStoreAssignments(),
  });
  const { data: locations = [] } = useQuery({
    queryKey: ["store-locations"],
    queryFn: () => pharmacyService.listStoreLocations(),
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => pharmacyService.listDepartments(),
  });

  const locById = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);
  const deptOptions = useMemo(
    () => departments.map((d) => ({ value: d.id, label: d.name })),
    [departments],
  );

  const rows = useMemo<PharmacyRow[]>(
    () =>
      assignments.map((a) => {
        const loc = locById.get(a.store_location_id);
        return {
          assignmentId: a.id,
          name: loc?.name ?? a.store_location_id.slice(0, 8),
          type: loc?.location_type ?? "—",
          isCentral: a.is_central,
          servesCount: a.serves_departments?.length ?? 0,
          active: loc?.is_active ?? true,
        };
      }),
    [assignments, locById],
  );

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const loc = await pharmacyService.createStoreLocation({
        code: values.code?.trim() || codeFromName(values.name),
        name: values.name,
        location_type: values.location_type,
        department_id: values.department_id || undefined,
      });
      await pharmacyService.createPharmacyStoreAssignment({
        store_location_id: loc.id,
        is_central: values.is_central,
        serves_departments: values.serves_departments,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pharmacy-store-assignments"] });
      qc.invalidateQueries({ queryKey: ["store-locations"] });
      notifications.show({
        title: "Pharmacy created",
        message: "Ready to stock and staff",
        color: "success",
      });
      form.reset(EMPTY);
      close();
    },
    onError: () =>
      notifications.show({
        title: "Error",
        message: "Could not create the pharmacy",
        color: "danger",
      }),
  });

  const columns: Column<PharmacyRow>[] = [
    {
      key: "name",
      label: "Pharmacy",
      render: (r) => (
        <Text fw={600} size="sm">
          {r.name}
        </Text>
      ),
    },
    {
      key: "type",
      label: "Type",
      render: (r) => <Badge tone="neutral">{TYPE_LABEL.get(r.type) ?? r.type}</Badge>,
    },
    {
      key: "isCentral",
      label: "Role",
      render: (r) =>
        r.isCentral ? <Badge tone="primary">Central hub</Badge> : <Text size="sm">Spoke</Text>,
    },
    {
      key: "servesCount",
      label: "Serves",
      render: (r) => <Text size="sm">{r.servesCount} depts</Text>,
    },
    {
      key: "active",
      label: "Status",
      render: (r) => (
        <Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Inactive"}</Badge>
      ),
    },
  ];

  return (
    <Stack gap="md">
      {canManage && (
        <Group justify="flex-end">
          <Button tone="primary" leftSection={<IconPlus size={15} />} onClick={open}>
            Add pharmacy
          </Button>
        </Group>
      )}
      <DataTable
        columns={columns}
        data={rows}
        loading={isLoading}
        rowKey={(r) => r.assignmentId}
        searchable
        searchPlaceholder="Search pharmacies"
      />

      <Modal opened={opened} onClose={close} title="Add pharmacy" size="lg">
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
          <Stack gap="md">
            <Input
              label="Name"
              required
              {...form.register("name")}
              error={form.formState.errors.name?.message}
            />
            <SimpleGrid cols={2}>
              <Input
                label="Code"
                description="Auto-generated from name if blank"
                {...form.register("code")}
              />
              <Controller
                control={form.control}
                name="location_type"
                render={({ field }) => (
                  <Select
                    label="Type"
                    required
                    data={PHARMACY_TYPES}
                    value={field.value}
                    onChange={(v) => field.onChange(v ?? "")}
                    error={form.formState.errors.location_type?.message}
                  />
                )}
              />
            </SimpleGrid>
            <Controller
              control={form.control}
              name="department_id"
              render={({ field }) => (
                <Select
                  label="Department"
                  placeholder="(optional)"
                  searchable
                  clearable
                  data={deptOptions}
                  value={field.value ?? null}
                  onChange={(v) => field.onChange(v ?? undefined)}
                />
              )}
            />
            <Controller
              control={form.control}
              name="serves_departments"
              render={({ field }) => (
                <MultiSelect
                  label="Serves departments"
                  placeholder="Departments this pharmacy dispenses to"
                  searchable
                  data={deptOptions}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              control={form.control}
              name="is_central"
              render={({ field }) => (
                <Switch
                  label="Central hub (procures + supplies other pharmacies)"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.currentTarget.checked)}
                />
              )}
            />
            <Group justify="flex-end">
              <Button tone="secondary" onClick={close}>
                Cancel
              </Button>
              <Button tone="primary" type="submit" loading={mutation.isPending}>
                Create pharmacy
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
