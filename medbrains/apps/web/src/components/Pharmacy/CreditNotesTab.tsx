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
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import type {
  CreatePharmacyCreditNoteRequest,
  FieldAccessLevel,
  PharmacyCreditNote,
  PharmacyCreditNoteStatus,
  PharmacyCreditNoteType,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import { IconCheck, IconLock, IconPlus, IconSearch, IconTrash, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { VendorSearchSelect } from "@/components/VendorSearchSelect";
import { pharmacyService } from "@/services/pharmacy.service";

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

function canEditBillingAmount(access: FieldAccessLevel) {
  return access === "edit";
}

function canViewBillingAmount(access: FieldAccessLevel) {
  return access !== "hidden";
}

function creditAmountText(access: FieldAccessLevel, value: string | number | null | undefined) {
  if (!canViewBillingAmount(access)) return "Restricted";
  if (value === null || value === undefined || value === "") return "-";
  return fieldAccessText(access, `₹${Number(value).toLocaleString()}`, "amount");
}

interface CreditNoteItem {
  rowId: string;
  drug_id: string;
  drug_name: string;
  batch_number: string;
  quantity: number;
  unit_price: number;
  amount: number;
  reason: string;
}

const createFormRowId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const emptyItem = (): CreditNoteItem => ({
  rowId: createFormRowId(),
  drug_id: "",
  drug_name: "",
  batch_number: "",
  quantity: 1,
  unit_price: 0,
  amount: 0,
  reason: "",
});

interface CreditNotesTabProps {
  canViewQueue: boolean;
  canCreate: boolean;
  canApprove: boolean;
  canSettle: boolean;
  canCancel: boolean;
  canViewPatientRecord: boolean;
}

export function CreditNotesTab({
  canViewQueue: parentCanViewQueue,
  canCreate: parentCanCreate,
  canApprove: parentCanApprove,
  canSettle: parentCanSettle,
  canCancel: parentCanCancel,
  canViewPatientRecord: parentCanViewPatientRecord,
}: CreditNotesTabProps) {
  const queryClient = useQueryClient();
  const billingAmountAccess = useFieldAccess("billing.amount");
  const hasReturnsList = useHasPermission(P.PHARMACY.RETURNS_LIST);
  const hasReturnsRequest = useHasPermission(P.PHARMACY.RETURNS_REQUEST);
  const hasReturnsApprove = useHasPermission(P.PHARMACY.RETURNS_APPROVE);
  const hasReturnsReject = useHasPermission(P.PHARMACY.RETURNS_REJECT);
  const hasBillingCreditManage = useHasPermission(P.BILLING.CREDIT_MANAGE);
  const hasPatientView = useHasPermission(P.PATIENTS.VIEW);
  const canViewQueue =
    parentCanViewQueue && (hasReturnsList || hasReturnsApprove || hasReturnsReject);
  const canCreate = parentCanCreate && hasReturnsRequest;
  const canApprove = parentCanApprove && hasReturnsApprove;
  const canSettle = parentCanSettle && hasReturnsApprove && hasBillingCreditManage;
  const canCancel = parentCanCancel && hasReturnsReject;
  const canViewPatientRecord = parentCanViewPatientRecord && hasPatientView;
  const canCreateWithAmountAccess = canCreate && canEditBillingAmount(billingAmountAccess);
  const [filterStatus, setFilterStatus] = useState("all");
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const params: Record<string, string> = {};
  if (filterStatus !== "all") params.status = filterStatus;

  const { data: creditNotes = [], isLoading } = useQuery({
    queryKey: ["pharmacy-credit-notes", params],
    queryFn: () => pharmacyService.listPharmacyCreditNotes(params),
    enabled: canViewQueue,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => pharmacyService.approvePharmacyCreditNote(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-credit-notes"] });
      notifications.show({ title: "Approved", message: "Credit note approved", color: "green" });
    },
  });

  const settleMutation = useMutation({
    mutationFn: (id: string) => pharmacyService.settlePharmacyCreditNote(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-credit-notes"] });
      notifications.show({ title: "Settled", message: "Credit note settled", color: "green" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => pharmacyService.cancelPharmacyCreditNote(id),
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
      render: (row: PharmacyCreditNote) =>
        row.patient_id ? (
          canViewPatientRecord ? (
            <PatientNameCell patientId={row.patient_id} showUhid={false} />
          ) : (
            <Text size="sm" c="dimmed">
              Patient restricted
            </Text>
          )
        ) : (
          <Text size="sm">{row.vendor_id?.slice(0, 8) ?? "-"}</Text>
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
          {creditAmountText(billingAmountAccess, row.net_amount)}
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
          {row.status === "draft" && canApprove && (
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
          {row.status === "approved" && canSettle && (
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
          {row.status === "draft" && canCancel && (
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
          disabled={!canViewQueue}
          data={[
            { label: "All", value: "all" },
            { label: "Draft", value: "draft" },
            { label: "Approved", value: "approved" },
            { label: "Settled", value: "settled" },
            { label: "Cancelled", value: "cancelled" },
          ]}
        />
        {canCreateWithAmountAccess && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openCreate}>
            New Return
          </Button>
        )}
      </Group>
      {canCreate && !canCreateWithAmountAccess && (
        <Alert color="yellow" variant="light">
          This role can request returns, but cannot create a credit note while billing amounts are
          view-only, masked, or hidden.
        </Alert>
      )}
      {!canCreate && !canApprove && !canSettle && !canCancel && (
        <Alert color="gray" variant="light">
          You can view credit notes, but no credit-note actions are available for this role.
        </Alert>
      )}
      {!canViewQueue && (
        <Alert color="gray" variant="light">
          Credit-note queue access requires a return list, approval, or rejection role. You can
          still create a new return credit note if that action is available.
        </Alert>
      )}
      <DataTable
        columns={columns}
        data={creditNotes}
        loading={canViewQueue && isLoading}
        rowKey={(row) => row.id}
      />
      {canCreateWithAmountAccess && (
        <CreateCreditNoteModal
          opened={createOpened}
          onClose={closeCreate}
          amountAccess={billingAmountAccess}
          canViewPatientRecord={canViewPatientRecord}
        />
      )}
    </Stack>
  );
}

function CreateCreditNoteModal({
  opened,
  onClose,
  amountAccess,
  canViewPatientRecord,
}: {
  opened: boolean;
  onClose: () => void;
  amountAccess: FieldAccessLevel;
  canViewPatientRecord: boolean;
}) {
  const queryClient = useQueryClient();
  const defaultNoteType = canViewPatientRecord ? "customer_return" : "supplier_return";
  const canEditAmounts = canEditBillingAmount(amountAccess);
  const [noteType, setNoteType] = useState<PharmacyCreditNoteType>(defaultNoteType);
  const [patientId, setPatientId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [items, setItems] = useState<CreditNoteItem[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [receiptSearch, setReceiptSearch] = useState("");

  function lookupReceipt() {
    if (!canViewPatientRecord) return;
    pharmacyService
      .lookupPosSale(receiptSearch)
      .then((sale) => {
        const saleItems = (
          typeof sale.items === "string" ? JSON.parse(sale.items) : sale.items
        ) as Array<Record<string, unknown>>;
        setItems(
          saleItems
            .filter((i) => !i.is_cancelled)
            .map((i) => ({
              rowId: createFormRowId(),
              drug_id: (i.catalog_item_id as string) ?? "",
              drug_name: (i.drug_name as string) ?? "",
              batch_number: "",
              quantity: (i.quantity as number) ?? 1,
              unit_price: Number(i.unit_price ?? 0),
              amount: Number(i.total_price ?? 0),
              reason: "",
            })),
        );
        setPatientId(sale.patient_id ?? "");
      })
      .catch(() => {
        notifications.show({
          title: "Not found",
          message: "No sale found with that receipt number",
          color: "red",
        });
      });
  }

  // Fetch drug catalog for drug selector
  const { data: drugs } = useQuery({
    queryKey: ["pharmacy", "catalog"],
    queryFn: () => pharmacyService.listPharmacyCatalog(),
  });

  const drugOptions = useMemo(() => {
    const base = drugs
      ? drugs.map((d) => ({ value: d.id, label: `${d.name} (${d.generic_name ?? d.code})` }))
      : [];
    // Auto-filled rows from past orders may carry a drug_id that isn't in
    // the catalog query slice (or the drug was de-listed). Synthesize an
    // option so the Select renders the drug_name instead of going blank.
    const known = new Set(base.map((o) => o.value));
    const extras = items
      .filter((i) => i.drug_id && !known.has(i.drug_id) && i.drug_name)
      .map((i) => ({ value: i.drug_id, label: i.drug_name }));
    return [...base, ...extras];
  }, [drugs, items]);

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
    [items],
  );

  const createMutation = useMutation({
    mutationFn: (data: CreatePharmacyCreditNoteRequest) =>
      pharmacyService.createPharmacyCreditNote(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-credit-notes"] });
      notifications.show({ title: "Created", message: "Credit note created", color: "green" });
      resetAndClose();
    },
  });

  function resetAndClose() {
    setNoteType(defaultNoteType);
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
    if (!canEditAmounts) return;
    const payload: CreatePharmacyCreditNoteRequest = {
      note_type: noteType,
      items: items.map((item) => ({
        drug_id: item.drug_id,
        drug_name: item.drug_name,
        batch_number: item.batch_number,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.quantity * item.unit_price,
        reason: item.reason,
      })),
      total_amount: totalAmount,
      notes: notes || undefined,
      patient_id: noteType === "customer_return" && patientId ? patientId : undefined,
      vendor_id: noteType === "supplier_return" && vendorId ? vendorId : undefined,
    };
    createMutation.mutate(payload);
  }

  const submitBlocked =
    !canEditAmounts ||
    items.length === 0 ||
    totalAmount <= 0 ||
    (noteType === "customer_return" && !patientId) ||
    (noteType === "supplier_return" && !vendorId);

  return (
    <Modal opened={opened} onClose={resetAndClose} title="New Return" size="xl">
      <Stack>
        <Group grow>
          <Select
            label="Note Type"
            data={[
              {
                value: "customer_return",
                label: "Customer Return",
                disabled: !canViewPatientRecord,
              },
              { value: "supplier_return", label: "Supplier Return" },
              { value: "expiry_write_off", label: "Expiry Write-off" },
              { value: "damage", label: "Damage" },
            ]}
            value={noteType}
            onChange={(v) => setNoteType((v ?? defaultNoteType) as PharmacyCreditNoteType)}
            disabled={!canEditAmounts}
          />
          {noteType === "customer_return" && canViewPatientRecord && (
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

        {noteType === "customer_return" && canViewPatientRecord && (
          <TextInput
            label="Or lookup by Receipt #"
            placeholder="Enter POS receipt number"
            size="xs"
            value={receiptSearch}
            onChange={(e) => setReceiptSearch(e.currentTarget.value)}
            rightSection={
              receiptSearch && (
                <ActionIcon
                  size="xs"
                  onClick={lookupReceipt}
                  aria-label="Search receipt"
                  disabled={!canEditAmounts}
                >
                  <IconSearch size={12} />
                </ActionIcon>
              )
            }
          />
        )}

        {noteType === "customer_return" && patientId && canViewPatientRecord && (
          <OrderLookupSection
            patientId={patientId}
            onSelectItems={(orderItems) => {
              setItems(
                orderItems.map((oi) => ({
                  rowId: createFormRowId(),
                  drug_id: oi.catalog_item_id ?? "",
                  drug_name: oi.drug_name,
                  batch_number: oi.batch_number ?? "",
                  quantity: oi.quantity,
                  unit_price: Number(oi.unit_price),
                  amount: Number(oi.total_price),
                  reason: "",
                })),
              );
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
              <Table.Tr key={item.rowId}>
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
                    placeholder="Select medicine"
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
                    {creditAmountText(amountAccess, item.quantity * item.unit_price)}
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
                {creditAmountText(amountAccess, totalAmount)}
              </Text>
            </Text>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending}
              disabled={submitBlocked}
            >
              Create Return
            </Button>
          </Stack>
        </Group>
      </Stack>
    </Modal>
  );
}

/** Order lookup for customer returns — shows recent patient orders to auto-fill items. */
function OrderLookupSection({
  patientId,
  onSelectItems,
}: {
  patientId: string;
  onSelectItems: (
    items: Array<{
      catalog_item_id: string;
      drug_name: string;
      batch_number: string;
      quantity: number;
      unit_price: string;
      total_price: string;
    }>,
  ) => void;
}) {
  const { data: orders } = useQuery({
    queryKey: ["pharmacy", "patient-orders", patientId],
    queryFn: () => pharmacyService.listPatientOrdersForReturn(patientId),
    enabled: Boolean(patientId),
  });

  if (!orders?.length)
    return (
      <Text size="xs" c="dimmed">
        No recent orders found
      </Text>
    );

  return (
    <Stack gap={4}>
      <Text size="xs" fw={600} tt="uppercase" c="dimmed">
        Recent Orders — click to auto-fill
      </Text>
      {orders.map((order) => (
        <Button
          key={order.order_id}
          size="compact-xs"
          variant="light"
          fullWidth
          justify="space-between"
          onClick={() => {
            const parsed = (
              typeof order.items === "string" ? JSON.parse(order.items) : order.items
            ) as Array<Record<string, unknown>>;
            onSelectItems(
              parsed.map((i) => ({
                catalog_item_id: (i.catalog_item_id as string) ?? "",
                drug_name: (i.drug_name as string) ?? "",
                batch_number: (i.batch_number as string) ?? "",
                quantity: (i.quantity as number) ?? 1,
                unit_price: String(i.unit_price ?? "0"),
                total_price: String(i.total_price ?? "0"),
              })),
            );
          }}
        >
          <Text size="xs">
            {new Date(order.order_date).toLocaleDateString()} — {order.status}
          </Text>
          <Badge size="xs">{Array.isArray(order.items) ? order.items.length : 0} items</Badge>
        </Button>
      ))}
    </Stack>
  );
}

/** Vendor select dropdown for supplier returns. */
function VendorSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <VendorSearchSelect
      value={value}
      onChange={onChange}
      placeholder="Select vendor..."
      size="sm"
    />
  );
}
