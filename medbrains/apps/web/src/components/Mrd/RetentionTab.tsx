import { Drawer, Group, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { CreateMrdRetentionPolicyRequest, MrdRetentionPolicy } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button } from "@/components/ui";
import { mrdService } from "@/services/mrd.service";

export function RetentionTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.MRD.RECORDS_MANAGE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure();

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["mrd-retention"],
    queryFn: () => mrdService.listMrdRetentionPolicies(),
  });

  const [form, setForm] = useState<CreateMrdRetentionPolicyRequest>({
    record_type: "",
    category: "",
    retention_years: 5,
  });

  const createMut = useMutation({
    mutationFn: (body: CreateMrdRetentionPolicyRequest) =>
      mrdService.createMrdRetentionPolicy(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mrd-retention"] });
      closeCreate();
      notifications.show({
        title: "Created",
        message: "Retention policy created",
        color: "success",
      });
    },
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
          <Select
            label="Record Type"
            data={["opd", "ipd", "emergency", "maternity", "mlc", "pediatric"]}
            required
            value={form.record_type}
            onChange={(v) => setForm({ ...form, record_type: v ?? "" })}
          />
          <TextInput
            label="Category"
            required
            placeholder="e.g., adult_opd"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.currentTarget.value })}
          />
          <NumberInput
            label="Retention Years"
            required
            value={form.retention_years}
            onChange={(v) => setForm({ ...form, retention_years: Number(v) })}
            min={1}
          />
          <TextInput
            label="Legal Reference"
            value={form.legal_reference ?? ""}
            onChange={(e) => setForm({ ...form, legal_reference: e.currentTarget.value })}
          />
          <Select
            label="Destruction Method"
            data={["shredding", "incineration"]}
            value={form.destruction_method ?? null}
            onChange={(v) => setForm({ ...form, destruction_method: v ?? undefined })}
            clearable
          />
          <Button
            tone="primary"
            onClick={() => createMut.mutate(form)}
            loading={createMut.isPending}
          >
            Create
          </Button>
        </Stack>
      </Drawer>
    </>
  );
}
