// INDENT PatientConsumablesPanel — split from indent.tsx (pure move).

import { Drawer, Group, NumberInput, Select, Stack, Switch, Text, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { IssueToPatientRequest, PatientConsumableIssue } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, toast } from "@/components/ui";
import { indentService } from "@/services/indent.service";

function IssueToPatientForm({ onSuccess }: { onSuccess: () => void }) {
  const [patientId, setPatientId] = useState("");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isChargeable, setIsChargeable] = useState(true);
  const [notes, setNotes] = useState("");

  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => indentService.listStoreCatalog({ active_only: "true" }),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: IssueToPatientRequest = {
        patient_id: patientId,
        catalog_item_id: catalogItemId,
        quantity,
        is_chargeable: isChargeable,
        notes: notes || undefined,
      };
      return indentService.issueToPatient(payload);
    },
    onSuccess: () => {
      toast.success("Consumable issued to patient", { title: "Issued" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  return (
    <Stack>
      <PatientSearchSelect value={patientId} onChange={setPatientId} required />
      <Select
        label="Catalog Item"
        placeholder="Select item"
        data={(catalog ?? []).map((c) => ({
          value: c.id,
          label: `${c.code} - ${c.name} (Stock: ${c.current_stock})`,
        }))}
        value={catalogItemId}
        onChange={(v) => setCatalogItemId(v ?? "")}
        searchable
        required
      />
      <NumberInput
        label="Quantity"
        value={quantity}
        onChange={(v) => setQuantity(Number(v))}
        min={1}
        required
      />
      <Switch
        label="Chargeable to patient"
        checked={isChargeable}
        onChange={(e) => setIsChargeable(e.currentTarget.checked)}
      />
      <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
      <Button
        tone="primary"
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
        disabled={!patientId || !catalogItemId}
      >
        Issue Consumable
      </Button>
    </Stack>
  );
}

export function PatientConsumablesPanel() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(P.INDENT.CONSUMABLES_MANAGE);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["patient-consumables"],
    queryFn: () => indentService.listPatientConsumables(),
  });

  const columns = [
    {
      key: "catalog_item_id",
      label: "Catalog Item",
      render: (row: PatientConsumableIssue) => (
        <Text size="sm" truncate>
          {row.catalog_item_id}
        </Text>
      ),
    },
    {
      key: "patient_id",
      label: "Patient",
      render: (row: PatientConsumableIssue) => (
        <PatientNameCell patientId={row.patient_id} showUhid={false} />
      ),
    },
    { key: "quantity", label: "Qty", render: (row: PatientConsumableIssue) => row.quantity },
    {
      key: "returned_qty",
      label: "Returned",
      render: (row: PatientConsumableIssue) => row.returned_qty,
    },
    {
      key: "unit_price",
      label: "Unit Price",
      render: (row: PatientConsumableIssue) => `\u20B9${row.unit_price}`,
    },
    {
      key: "status",
      label: "Status",
      render: (row: PatientConsumableIssue) => (
        <Badge
          tone={
            row.status === "issued" ? "primary" : row.status === "returned" ? "warning" : "success"
          }
          size="sm"
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: "is_chargeable",
      label: "Chargeable",
      render: (row: PatientConsumableIssue) =>
        row.is_chargeable ? (
          <Badge tone="accent" size="sm">
            Yes
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            No
          </Text>
        ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (row: PatientConsumableIssue) => new Date(row.created_at).toLocaleDateString(),
    },
  ];

  return (
    <>
      {canManage && (
        <Group justify="flex-end" mb="md">
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Issue to Patient
          </Button>
        </Group>
      )}
      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No patient consumable issues"
      />
      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Issue to Patient"
        position="right"
        size="xl"
      >
        <IssueToPatientForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["patient-consumables"] });
            closeCreate();
          }}
        />
      </Drawer>
    </>
  );
}
