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
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type {
  CreatePharmacyCreditNoteRequest,
  PharmacyCreditNote,
  PharmacyCreditNoteStatus,
  PharmacyCreditNoteType,
} from "@medbrains/types";
import { IconCheck, IconLock, IconPlus, IconSearch, IconTrash, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "../DataTable";
import { PatientSearchSelect } from "../PatientSearchSelect";

const statusColors: Record<PharmacyCreditNoteStatus, string> = {
  draft: "gray",
  approved: "blue",
  settled: "green",
  cancelled: "red",
};

const typeColors: Record<PharmacyCreditNoteType, string> = {
  customer_return: "blue",
  supplier_return: "orange",
  expiry_write_off: "red",
  damage: "gray",
};

const typeLabels: Record<PharmacyCreditNoteType, string> = {
  customer_return: "Customer Return",
  supplier_return: "Supplier Return",
  expiry_write_off: "Expiry Write-off",
  damage: "Damage",
};

interface CreditNoteItem {
  drug_id: string;
  drug_name: string;
  batch_number: string;
  quantity: number;
  unit_price: number;
  amount: number;
  reason: string;
}

const emptyItem = (): CreditNoteItem => ({
  drug_id: "",
  drug_name: "",
  batch_number: "",
  quantity: 1,
  unit_price: 0,
  amount: 0,
  reason: "",
});

export function CreditNotesTab() {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const params: Record<string, string> = {};
  if (filterStatus !== "all") params.status = filterStatus;

  const { data: creditNotes = [], isLoading } = useQuery({
    queryKey: ["pharmacy-credit-notes", params],
    queryFn: () => api.listPharmacyCreditNotes(params),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approvePharmacyCreditNote(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-credit-notes"] });
      notifications.show({ title: "Approved", message: "Credit note approved", color: "green" });
    },
  });

  const settleMutation = useMutation({
    mutationFn: (id: string) => api.settlePharmacyCreditNote(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-credit-notes"] });
      notifications.show({ title: "Settled", message: "Credit note settled", color: "green" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelPharmacyCreditNote(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-credit-notes"] });
      notifications.show({ title: "Cancelled", message: "Credit note cancelled", color: "orange" });
    },
  });

  const columns = [
    {
      key: "credit_note_number",
      label: "Number",
      render: (row: PharmacyCreditNote) => (
        <Text size="sm" ff="JetBrains Mono, monospace">
          {row.credit_note_number}
        </Text>
      ),
    },
    {
      key: "note_type",
      label: "Type",
      render: (row: PharmacyCreditNote) => (
        <Badge size="xs" variant="light" color={typeColors[row.note_type]}>
          {typeLabels[row.note_type]}
        </Badge>
      ),
    },
    {
      key: "party",
      label: "Patient / Vendor",
      render: (row: PharmacyCreditNote) => (
        <Text size="sm">{row.patient_id?.slice(0, 8) ?? row.vendor_id?.slice(0, 8) ?? "-"}</Text>
      ),
    },
    {
      key: "items_count",
      label: "Items",
      render: (row: PharmacyCreditNote) => <Text size="sm">{row.items.length}</Text>,
    },
    {
      key: "net_amount",
      label: "Amount",
      render: (row: PharmacyCreditNote) => (
        <Text size="sm" fw={700} ff="Fraunces, serif">
          {"\u20B9"}
          {Number(row.net_amount).toLocaleString()}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: PharmacyCreditNote) => (
        <Badge size="xs" color={statusColors[row.status]}>
          {row.status}
        </Badge>
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (row: PharmacyCreditNote) => (
        <Text size="sm">{new Date(row.created_at).toLocaleDateString()}</Text>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: PharmacyCreditNote) => (
        <Group gap="xs">
          {row.status === "draft" && (
            <Tooltip label="Approve">
              <ActionIcon
                variant="subtle"
                color="blue"
                size="sm"
                aria-label="Approve credit note"
                onClick={() => approveMutation.mutate(row.id)}
              >
                <IconCheck size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {row.status === "approved" && (
            <Tooltip label="Settle">
              <ActionIcon
                variant="subtle"
                color="green"
                size="sm"
                aria-label="Settle credit note"
                onClick={() => settleMutation.mutate(row.id)}
              >
                <IconLock size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {(row.status === "draft" || row.status === "approved") && (
            <Tooltip label="Cancel">
              <ActionIcon
                variant="subtle"
                color="red"
                size="sm"
                aria-label="Cancel credit note"
                onClick={() => cancelMutation.mutate(row.id)}
              >
                <IconX size={14} />
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
            { label: "Draft", value: "draft" },
            { label: "Approved", value: "approved" },
            { label: "Settled", value: "settled" },
            { label: "Cancelled", value: "cancelled" },
          ]}
        />
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
          New Credit Note
        </Button>
      </Group>
      <DataTable
        columns={columns}
        data={creditNotes}
        loading={isLoading}
        rowKey={(row) => row.id}
      />
      <CreateCreditNoteModal opened={createOpened} onClose={closeCreate} />
    </Stack>
  );
}

function CreateCreditNoteModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [noteType, setNoteType] = useState<PharmacyCreditNoteType>("customer_return");
  const [patientId, setPatientId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [items, setItems] = useState<CreditNoteItem[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [receiptSearch, setReceiptSearch] = useState("");

  function lookupReceipt() {
    api.lookupPosSale(receiptSearch).then((sale) => {
      const saleItems = (typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items) as Array<Record<string, unknown>>;
      setItems(saleItems.filter((i) => !i.is_cancelled).map((i) => ({
        drug_id: (i.catalog_item_id as string) ?? "",
        drug_name: (i.drug_name as string) ?? "",
        batch_number: "",
        quantity: (i.quantity as number) ?? 1,
        unit_price: Number(i.unit_price ?? 0),
        amount: Number(i.total_price ?? 0),
        reason: "",
      })));
      setPatientId("");
    }).catch(() => {
      notifications.show({ title: "Not found", message: "No sale found with that receipt number", color: "red" });
    });
  }

  // Fetch drug catalog for drug selector
  const { data: drugs } = useQuery({
    queryKey: ["pharmacy", "catalog"],
    queryFn: () => api.listPharmacyCatalog(),
  });

  const drugOptions = useMemo(() => {
    if (!drugs) return [];
    return drugs.map((d) => ({ value: d.id, label: `${d.name} (${d.generic_name ?? d.code})` }));
  }, [drugs]);

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
    [items],
  );

  const createMutation = useMutation({
    mutationFn: (data: CreatePharmacyCreditNoteRequest) => api.createPharmacyCreditNote(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-credit-notes"] });
      notifications.show({ title: "Created", message: "Credit note created", color: "green" });
      resetAndClose();
    },
  });

  function resetAndClose() {
    setNoteType("customer_return");
    setPatientId("");
    setVendorId("");
    setItems([emptyItem()]);
    setNotes("");
    setReceiptSearch("");
    onClose();
  }

  function updateItem(index: number, field: keyof CreditNoteItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        updated.amount = updated.quantity * updated.unit_price;
        return updated;
      }),
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    const payload: CreatePharmacyCreditNoteRequest = {
      note_type: noteType,
      items: items.map((item) => ({
        ...item,
        amount: item.quantity * item.unit_price,
      })),
      total_amount: totalAmount,
      notes: notes || undefined,
      patient_id: noteType === "customer_return" && patientId ? patientId : undefined,
      vendor_id: noteType === "supplier_return" && vendorId ? vendorId : undefined,
    };
    createMutation.mutate(payload);
  }

  return (
    <Modal opened={opened} onClose={resetAndClose} title="New Credit Note" size="xl">
      <Stack>
        <Group grow>
          <Select
            label="Note Type"
            data={[
              { value: "customer_return", label: "Customer Return" },
              { value: "supplier_return", label: "Supplier Return" },
              { value: "expiry_write_off", label: "Expiry Write-off" },
              { value: "damage", label: "Damage" },
            ]}
            value={noteType}
            onChange={(v) => setNoteType((v ?? "customer_return") as PharmacyCreditNoteType)}
          />
          {noteType === "customer_return" && (
            <PatientSearchSelect
              label="Patient"
              value={patientId}
              onChange={setPatientId}
              placeholder="Search patient..."
              size="sm"
            />
          )}
          {noteType === "supplier_return" && (
            <VendorSelect value={vendorId} onChange={setVendorId} />
          )}
        </Group>

        {noteType === "customer_return" && (
          <TextInput
            label="Or lookup by Receipt #"
            placeholder="Enter POS receipt number"
            size="xs"
            value={receiptSearch}
            onChange={(e) => setReceiptSearch(e.currentTarget.value)}
            rightSection={
              receiptSearch && (
                <ActionIcon size="xs" onClick={lookupReceipt} aria-label="Search receipt">
                  <IconSearch size={12} />
                </ActionIcon>
              )
            }
          />
        )}

        {noteType === "customer_return" && patientId && (
          <OrderLookupSection
            patientId={patientId}
            onSelectItems={(orderItems) => {
              setItems(orderItems.map(oi => ({
                drug_id: oi.catalog_item_id ?? "",
                drug_name: oi.drug_name,
                batch_number: oi.batch_number ?? "",
                quantity: oi.quantity,
                unit_price: Number(oi.unit_price),
                amount: Number(oi.total_price),
                reason: "",
              })));
            }}
          />
        )}

        <Text fw={600} size="sm">
          Items
        </Text>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Drug Name</Table.Th>
              <Table.Th>Batch</Table.Th>
              <Table.Th>Qty</Table.Th>
              <Table.Th>Unit Price</Table.Th>
              <Table.Th>Amount</Table.Th>
              <Table.Th>Reason</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item, index) => (
              <Table.Tr key={`item-${index}`}>
                <Table.Td>
                  <Select
                    size="xs"
                    data={drugOptions}
                    value={item.drug_id || null}
                    onChange={(v) => {
                      const drug = drugs?.find((d) => d.id === v);
                      if (drug) {
                        updateItem(index, "drug_id", drug.id);
                        updateItem(index, "drug_name", drug.name);
                        updateItem(index, "unit_price", Number(drug.base_price ?? 0));
                      }
                    }}
                    searchable
                    placeholder="Select drug"
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    size="xs"
                    value={item.batch_number}
                    onChange={(e) => updateItem(index, "batch_number", e.currentTarget.value)}
                    placeholder="Batch #"
                    w={100}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    min={1}
                    value={item.quantity}
                    onChange={(val) => updateItem(index, "quantity", Number(val))}
                    w={70}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    size="xs"
                    min={0}
                    decimalScale={2}
                    prefix={"\u20B9"}
                    value={item.unit_price}
                    onChange={(val) => updateItem(index, "unit_price", Number(val))}
                    w={100}
                  />
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={600}>
                    {"\u20B9"}
                    {(item.quantity * item.unit_price).toFixed(2)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Select
                    size="xs"
                    data={[
                      { value: "allergy", label: "Allergy" },
                      { value: "wrong_drug", label: "Wrong Drug" },
                      { value: "expired", label: "Expired" },
                      { value: "damaged", label: "Damaged" },
                      { value: "doctor_changed", label: "Doctor Changed Rx" },
                      { value: "patient_refused", label: "Patient Refused" },
                      { value: "other", label: "Other" },
                    ]}
                    value={item.reason || null}
                    onChange={(v) => updateItem(index, "reason", v ?? "")}
                    placeholder="Reason"
                    w={130}
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

        <Group justify="space-between" align="flex-end">
          <Textarea
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            w={300}
          />
          <Stack gap={4} align="flex-end">
            <Text size="sm">
              Total:{" "}
              <Text component="span" fw={700} ff="Fraunces, serif">
                {"\u20B9"}
                {totalAmount.toFixed(2)}
              </Text>
            </Text>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending}
              disabled={items.length === 0 || totalAmount <= 0}
            >
              Create Credit Note
            </Button>
          </Stack>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Order lookup for customer returns — shows recent patient orders to auto-fill items. */
function OrderLookupSection({ patientId, onSelectItems }: {
  patientId: string;
  onSelectItems: (items: Array<{catalog_item_id: string; drug_name: string; batch_number: string; quantity: number; unit_price: string; total_price: string}>) => void;
}) {
  const { data: orders } = useQuery({
    queryKey: ["pharmacy", "patient-orders", patientId],
    queryFn: () => api.listPatientOrdersForReturn(patientId),
    enabled: Boolean(patientId),
  });

  if (!orders?.length) return <Text size="xs" c="dimmed">No recent orders found</Text>;

  return (
    <Stack gap={4}>
      <Text size="xs" fw={600} tt="uppercase" c="dimmed">Recent Orders — click to auto-fill</Text>
      {orders.map((order) => (
        <Button
          key={order.order_id}
          size="compact-xs"
          variant="light"
          fullWidth
          justify="space-between"
          onClick={() => {
            const parsed = (typeof order.items === 'string' ? JSON.parse(order.items) : order.items) as Array<Record<string, unknown>>;
            onSelectItems(parsed.map(i => ({
              catalog_item_id: (i.catalog_item_id as string) ?? "",
              drug_name: (i.drug_name as string) ?? "",
              batch_number: (i.batch_number as string) ?? "",
              quantity: (i.quantity as number) ?? 1,
              unit_price: String(i.unit_price ?? "0"),
              total_price: String(i.total_price ?? "0"),
            })));
          }}
        >
          <Text size="xs">{new Date(order.order_date).toLocaleDateString()} — {order.status}</Text>
          <Badge size="xs">{Array.isArray(order.items) ? order.items.length : 0} items</Badge>
        </Button>
      ))}
    </Stack>
  );
}

/** Vendor select dropdown for supplier returns. */
function VendorSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: vendors } = useQuery({
    queryKey: ["procurement", "vendors"],
    queryFn: () => api.listVendors(),
  });

  const options = useMemo(() => {
    if (!vendors) return [];
    return vendors.map((v) => ({
      value: v.id,
      label: `${v.name} (${v.code})`,
    }));
  }, [vendors]);

  return (
    <Select
      label="Vendor"
      data={options}
      value={value || null}
      onChange={(v) => onChange(v ?? "")}
      searchable
      clearable
      placeholder="Select vendor..."
      size="sm"
    />
  );
}
