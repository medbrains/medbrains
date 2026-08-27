import {
  ActionIcon,
  Alert,
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
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateStoreIndentRequest,
  PharmacyStoreIndent,
  PharmacyStoreIndentStatus,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconCheck,
  IconPackageExport,
  IconPackageImport,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components/DataTable";
import { groupedSelectData } from "@/lib/select-groups";
import { pharmacyService } from "@/services/pharmacy.service";

const statusColors: Record<PharmacyStoreIndentStatus, string> = {
  pending: "yellow",
  approved: "blue",
  issued: "teal",
  received: "green",
  rejected: "red",
  cancelled: "red",
};

interface IndentItem {
  client_id: string;
  item_id: string;
  name: string;
  quantity: number;
  unit: string;
}

let indentItemCounter = 0;

const emptyItem = (): IndentItem => {
  indentItemCounter += 1;
  return {
    client_id: `indent-item-${indentItemCounter}`,
    item_id: "",
    name: "",
    quantity: 1,
    unit: "pieces",
  };
};

const UNIT_OPTIONS = [
  { value: "pieces", label: "Pieces" },
  { value: "box", label: "Box" },
  { value: "pack", label: "Pack" },
  { value: "kg", label: "Kg" },
  { value: "litre", label: "Litre" },
];

export function StoreIndentsTab({
  canViewQueue: parentCanViewQueue,
  canManage: parentCanManage,
}: {
  canViewQueue: boolean;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const hasStoreList = useHasPermission(P.PHARMACY.STORES_LIST);
  const hasStoreManage = useHasPermission(P.PHARMACY.STORES_MANAGE);
  const canViewQueue = parentCanViewQueue && (hasStoreList || hasStoreManage);
  const canManage = parentCanManage && hasStoreManage;
  const [filterStatus, setFilterStatus] = useState("all");
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const params: Record<string, string> = {};
  if (filterStatus !== "all") params.status = filterStatus;

  const { data: indents = [], isLoading } = useQuery({
    queryKey: ["pharmacy-store-indents", params],
    queryFn: () => pharmacyService.listPharmacyStoreIndents(params),
    enabled: canViewQueue,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => pharmacyService.approvePharmacyStoreIndent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-store-indents"] });
      notifications.show({ title: "Approved", message: "Store indent approved", color: "green" });
    },
  });

  const issueMutation = useMutation({
    mutationFn: (id: string) => pharmacyService.issuePharmacyStoreIndent(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-store-indents"] });
      notifications.show({ title: "Issued", message: "Store indent issued", color: "teal" });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: (id: string) => pharmacyService.receivePharmacyStoreIndent(id),
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
          {canManage && row.status === "pending" && (
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
          {canManage && row.status === "approved" && (
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
          {canManage && row.status === "issued" && (
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
        {canManage && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
            New Request
          </Button>
        )}
      </Group>
      {canViewQueue ? (
        <DataTable columns={columns} data={indents} loading={isLoading} rowKey={(row) => row.id} />
      ) : (
        <Alert color="warning" variant="light">
          Store indent queue requires `pharmacy.stores.list` or `pharmacy.stores.manage`.
        </Alert>
      )}
      {canManage && <CreateStoreIndentModal opened={createOpened} onClose={closeCreate} />}
    </Stack>
  );
}

function CreateStoreIndentModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const canManageStores = useHasPermission(P.PHARMACY.STORES_MANAGE);
  const [fromStoreId, setFromStoreId] = useState<string | null>(null);
  const [toStoreId, setToStoreId] = useState<string | null>(null);
  const [items, setItems] = useState<IndentItem[]>([emptyItem()]);
  const [notes, setNotes] = useState("");

  const { data: storeLocations = [] } = useQuery({
    queryKey: ["store-locations"],
    queryFn: () => pharmacyService.listStoreLocations(),
    enabled: canManageStores,
    staleTime: 300_000,
  });

  // All stores available for both from/to (bidirectional), filed under their
  // location type. Grouped through the helper because Mantine v7 reads a flat
  // `{ value, label, group }` as a group and maps its missing `items`, which
  // crashed this tab on open.
  const allStoreOptions = groupedSelectData(
    storeLocations.map((s) => ({
      value: s.id,
      label: `${s.name} (${s.code})`,
      group: s.location_type?.replace(/_/g, " ").toUpperCase() ?? "OTHER",
    })),
  );

  // Store catalog for item autocomplete
  const { data: storeCatalog = [] } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => pharmacyService.listStoreCatalog(),
    enabled: canManageStores,
    staleTime: 300_000,
  });

  const catalogOptions = storeCatalog.map((c) => ({
    value: c.id,
    label: `${c.name} (${c.code})`,
  }));

  const createMutation = useMutation({
    mutationFn: (data: CreateStoreIndentRequest) => pharmacyService.createPharmacyStoreIndent(data),
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
    if (!canManageStores) return;
    const payload: CreateStoreIndentRequest = {
      from_store_id: fromStoreId ?? undefined,
      to_store_id: toStoreId ?? undefined,
      items: items.map((item) => ({
        // Persist the catalog linkage the picker already captured — the indent
        // records WHICH catalog item was requested (enables stock movement + reporting),
        // not just a free-text name.
        item_id: item.item_id || undefined,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      })),
      notes: notes || undefined,
    };
    createMutation.mutate(payload);
  }

  return (
    <Modal opened={opened} onClose={resetAndClose} title="New Store Indent" size="xl">
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
            disabled={!canManageStores}
          />
          <Select
            label="To Store"
            placeholder="Select destination store"
            data={allStoreOptions}
            value={toStoreId}
            onChange={setToStoreId}
            searchable
            clearable
            disabled={!canManageStores}
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
              <Table.Tr key={item.client_id}>
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
                    disabled={!canManageStores}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    min={1}
                    value={item.quantity}
                    onChange={(val) => updateItem(index, "quantity", Number(val))}
                    w={80}
                    disabled={!canManageStores}
                  />
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    data={UNIT_OPTIONS}
                    value={item.unit}
                    onChange={(v) => updateItem(index, "unit", v ?? "pieces")}
                    w={110}
                    disabled={!canManageStores}
                  />
                </Table.Td>
                <Table.Td>
                  <ActionIcon
                    size="sm"
                    color="red"
                    variant="light"
                    aria-label="Remove item"
                    disabled={!canManageStores || items.length <= 1}
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
          disabled={!canManageStores}
        >
          Add Item
        </Button>

        <Textarea
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          disabled={!canManageStores}
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending}
            disabled={!canManageStores || items.length === 0 || items.every((i) => !i.name)}
          >
            Create Indent
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
