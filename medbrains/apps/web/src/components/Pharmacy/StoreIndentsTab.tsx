import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type {
  CreateStoreIndentRequest,
  PharmacyStoreIndent,
  PharmacyStoreIndentStatus,
} from "@medbrains/types";
import {
  IconCheck,
  IconPackageExport,
  IconPackageImport,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "../DataTable";

const statusColors: Record<PharmacyStoreIndentStatus, string> = {
  pending: "yellow",
  approved: "blue",
  issued: "teal",
  received: "green",
  rejected: "red",
  cancelled: "red",
};

interface IndentItem {
  item_id: string;
  name: string;
  quantity: number;
  unit: string;
}

const emptyItem = (): IndentItem => ({ item_id: "", name: "", quantity: 1, unit: "pieces" });

const UNIT_OPTIONS = [
  { value: "pieces", label: "Pieces" },
  { value: "box", label: "Box" },
  { value: "pack", label: "Pack" },
  { value: "kg", label: "Kg" },
  { value: "litre", label: "Litre" },
];

export function StoreIndentsTab() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const params: Record<string, string> = {};
  if (filterStatus !== "all") params.status = filterStatus;

  const { data: indents = [], isLoading } = useQuery({
    queryKey: ["pharmacy-store-indents", params],
    queryFn: () => api.listPharmacyStoreIndents(params),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approvePharmacyStoreIndent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-store-indents"] });
      notifications.show({ title: "Approved", message: "Store indent approved", color: "green" });
    },
  });

  const issueMutation = useMutation({
    mutationFn: (id: string) => api.issuePharmacyStoreIndent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-store-indents"] });
      notifications.show({ title: "Issued", message: "Store indent issued", color: "teal" });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: (id: string) => api.receivePharmacyStoreIndent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-store-indents"] });
      notifications.show({ title: "Received", message: "Store indent received", color: "green" });
    },
  });

  const columns = [
    {
      key: "indent_number",
      label: "Indent #",
      render: (row: PharmacyStoreIndent) => (
        <Text size="sm" ff="JetBrains Mono, monospace">
          {row.indent_number}
        </Text>
      ),
    },
    {
      key: "from_store_id",
      label: "From Store",
      render: (row: PharmacyStoreIndent) => (
        <Text size="sm">{row.from_store_id?.slice(0, 8) ?? "-"}</Text>
      ),
    },
    {
      key: "to_store_id",
      label: "To Store",
      render: (row: PharmacyStoreIndent) => (
        <Text size="sm">{row.to_store_id?.slice(0, 8) ?? "-"}</Text>
      ),
    },
    {
      key: "total_items",
      label: "Items",
      render: (row: PharmacyStoreIndent) => <Text size="sm">{row.total_items}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: PharmacyStoreIndent) => (
        <Badge size="xs" color={statusColors[row.status]}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: "requested_by",
      label: "Requested By",
      render: (row: PharmacyStoreIndent) => (
        <Text size="sm">{row.requested_by?.slice(0, 8) ?? "-"}</Text>
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (row: PharmacyStoreIndent) => (
        <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: PharmacyStoreIndent) => (
        <Group gap="xs">
          {row.status === "pending" && (
            <Tooltip label="Approve">
              <ActionIcon
                variant="subtle"
                color="blue"
                size="sm"
                aria-label="Approve indent"
                onClick={() => approveMutation.mutate(row.id)}
              >
                <IconCheck size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {row.status === "approved" && (
            <Tooltip label="Issue">
              <ActionIcon
                variant="subtle"
                color="teal"
                size="sm"
                aria-label="Issue indent"
                onClick={() => issueMutation.mutate(row.id)}
              >
                <IconPackageExport size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {row.status === "issued" && (
            <Tooltip label="Receive">
              <ActionIcon
                variant="subtle"
                color="green"
                size="sm"
                aria-label="Receive indent"
                onClick={() => receiveMutation.mutate(row.id)}
              >
                <IconPackageImport size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <SegmentedControl
          size="xs"
          value={filterStatus}
          onChange={setFilterStatus}
          data={[
            { label: "All", value: "all" },
            { label: "Pending", value: "pending" },
            { label: "Approved", value: "approved" },
            { label: "Issued", value: "issued" },
            { label: "Received", value: "received" },
          ]}
        />
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
          New Request
        </Button>
      </Group>
      <DataTable columns={columns} data={indents} loading={isLoading} rowKey={(row) => row.id} />
      <CreateStoreIndentModal opened={createOpened} onClose={closeCreate} />
    </Stack>
  );
}

function CreateStoreIndentModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [fromStoreId, setFromStoreId] = useState<string | null>(null);
  const [toStoreId, setToStoreId] = useState<string | null>(null);
  const [items, setItems] = useState<IndentItem[]>([emptyItem()]);
  const [notes, setNotes] = useState("");

  const { data: storeLocations = [] } = useQuery({
    queryKey: ["store-locations"],
    queryFn: () => api.listStoreLocations(),
    staleTime: 300_000,
  });

  // All stores available for both from/to (bidirectional)
  const allStoreOptions = storeLocations.map((s) => ({
    value: s.id,
    label: `${s.name} (${s.code})`,
    group: s.location_type?.replace(/_/g, " ").toUpperCase() ?? "OTHER",
  }));

  // Store catalog for item autocomplete
  const { data: storeCatalog = [] } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => api.listStoreCatalog(),
    staleTime: 300_000,
  });

  const catalogOptions = storeCatalog.map((c) => ({
    value: c.id,
    label: `${c.name} (${c.code})`,
  }));

  const createMutation = useMutation({
    mutationFn: (data: CreateStoreIndentRequest) => api.createPharmacyStoreIndent(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-store-indents"] });
      notifications.show({ title: "Created", message: "Store indent created", color: "green" });
      resetAndClose();
    },
  });

  function resetAndClose() {
    setFromStoreId(null);
    setToStoreId(null);
    setItems([emptyItem()]);
    setNotes("");
    onClose();
  }

  function updateItem(index: number, field: keyof IndentItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    const payload: CreateStoreIndentRequest = {
      from_store_id: fromStoreId ?? undefined,
      to_store_id: toStoreId ?? undefined,
      items: items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      })),
      notes: notes || undefined,
    };
    createMutation.mutate(payload);
  }

  return (
    <Modal opened={opened} onClose={resetAndClose} title="New Store Indent" size="lg">
      <Stack>
        <Group grow>
          <Select
            label="From Store"
            placeholder="Select source store"
            data={allStoreOptions}
            value={fromStoreId}
            onChange={setFromStoreId}
            searchable
            clearable
          />
          <Select
            label="To Store"
            placeholder="Select destination store"
            data={allStoreOptions}
            value={toStoreId}
            onChange={setToStoreId}
            searchable
            clearable
          />
        </Group>

        <Text fw={600} size="sm">
          Items
        </Text>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item Name</Table.Th>
              <Table.Th>Quantity</Table.Th>
              <Table.Th>Unit</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item, index) => (
              <Table.Tr key={`indent-item-${index}`}>
                <Table.Td>
                  <Select
                    size="xs"
                    data={catalogOptions}
                    value={item.item_id || null}
                    onChange={(v) => {
                      const cat = storeCatalog.find((c) => c.id === v);
                      if (cat) {
                        updateItem(index, "item_id", cat.id);
                        updateItem(index, "name", cat.name);
                        updateItem(index, "unit", cat.unit ?? "pieces");
                      }
                    }}
                    searchable
                    placeholder="Select item"
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    min={1}
                    value={item.quantity}
                    onChange={(val) => updateItem(index, "quantity", Number(val))}
                    w={80}
                  />
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    data={UNIT_OPTIONS}
                    value={item.unit}
                    onChange={(v) => updateItem(index, "unit", v ?? "pieces")}
                    w={110}
                  />
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    size="sm"
                    color="red"
                    variant="light"
                    aria-label="Remove item"
                    disabled={items.length <= 1}
                    onClick={() => removeItem(index)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Button
          variant="light"
          size="xs"
          leftSection={<IconPlus size={14} />}
          onClick={() => setItems((prev) => [...prev, emptyItem()])}
          style={{ alignSelf: "flex-start" }}
        >
          Add Item
        </Button>

        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />

        <Group justify="flex-end">
          <Button variant="default" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending}
            disabled={items.length === 0 || items.every((i) => !i.name)}
          >
            Create Indent
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
