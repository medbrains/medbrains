// IPD StockTab — split from pharmacy.tsx (pure move).

import { Group, Loader, Modal, NumberInput, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useFieldAccess } from "@medbrains/stores";
import type { CreatePharmacyBatchRequest, PharmacyBatch, PharmacyCatalog } from "@medbrains/types";
import { IconCheck, IconEye, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable, TableValueBadge, useClinicalEmit } from "@/components";
import { DrugSearchSelect } from "@/components/DrugSearchSelect";
import { Alert, Badge, Button, IconButton, Table, toast } from "@/components/ui";
import { pharmacyService } from "@/services/pharmacy.service";
import {
  canEditPharmacyField,
  ExpiryCell,
  renderPharmacySensitiveCurrency,
  renderPharmacySensitiveIdentifier,
  renderPharmacySensitiveValue,
} from "./shared";

type BulkBatchLine = {
  id: string;
  catalog_item_id: string;
  product_name: string;
  tax_percent: number;
  current_stock: number;
  reorder_level: number;
  batch_number: string;
  supplier_batch_number: string;
  expiry_date: string;
  manufacture_date: string;
  grn_reference: string;
  storage_conditions: string;
  rack_bin: string;
  purchase_rate: number | "";
  mrp: number | "";
  paid_quantity: number | "";
  free_quantity: number | "";
};

type BulkBatchHeader = {
  invoice_mode: "cash" | "credit";
  invoice_date: string;
  invoice_number: string;
  invoice_amount: number | "";
  supplier_name: string;
  store_location_id: string;
  payment_terms: string;
};

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function newBulkBatchHeader(): BulkBatchHeader {
  return {
    invoice_mode: "credit",
    invoice_date: todayInputDate(),
    invoice_number: "",
    invoice_amount: "",
    supplier_name: "",
    store_location_id: "",
    payment_terms: "",
  };
}

function newBulkBatchLine(): BulkBatchLine {
  return {
    id: crypto.randomUUID(),
    catalog_item_id: "",
    product_name: "",
    tax_percent: 0,
    current_stock: 0,
    reorder_level: 0,
    batch_number: "",
    supplier_batch_number: "",
    expiry_date: "",
    manufacture_date: "",
    grn_reference: "",
    storage_conditions: "",
    rack_bin: "",
    purchase_rate: "",
    mrp: "",
    paid_quantity: 0,
    free_quantity: 0,
  };
}

function batchLineNumber(value: number | "") {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function batchLineTotalQuantity(row: BulkBatchLine) {
  return batchLineNumber(row.paid_quantity) + batchLineNumber(row.free_quantity);
}

function batchLineTaxableAmount(row: BulkBatchLine) {
  return batchLineNumber(row.paid_quantity) * batchLineNumber(row.purchase_rate);
}

function batchLineTaxAmount(row: BulkBatchLine) {
  return batchLineTaxableAmount(row) * (row.tax_percent / 100);
}

function isBatchLineBelowReorder(row: BulkBatchLine) {
  return row.catalog_item_id.trim().length > 0 && row.current_stock <= row.reorder_level;
}

function isBatchLinePriceValid(row: BulkBatchLine) {
  return row.purchase_rate === "" || row.mrp === "" || row.purchase_rate <= row.mrp;
}

function isBulkBatchLineReady(row: BulkBatchLine) {
  return (
    row.catalog_item_id.trim().length > 0 &&
    row.batch_number.trim().length > 0 &&
    row.expiry_date.trim().length > 0 &&
    batchLineTotalQuantity(row) > 0 &&
    isBatchLinePriceValid(row)
  );
}

function buildBatchPayload(
  row: BulkBatchLine,
  header: BulkBatchHeader,
  access: { canWriteSource: boolean },
): CreatePharmacyBatchRequest {
  const paidQty = batchLineNumber(row.paid_quantity);
  const freeQty = batchLineNumber(row.free_quantity);
  const sourceParts = access.canWriteSource
    ? [
        `Invoice mode: ${header.invoice_mode}`,
        header.invoice_date ? `Invoice date: ${header.invoice_date}` : null,
        header.invoice_number.trim() ? `Invoice: ${header.invoice_number.trim()}` : null,
        header.invoice_amount !== "" ? `Invoice amount: ${header.invoice_amount}` : null,
        header.supplier_name.trim() ? `Supplier: ${header.supplier_name.trim()}` : null,
        header.store_location_id.trim() ? `Store: ${header.store_location_id.trim()}` : null,
        header.payment_terms.trim() ? `Payment terms: ${header.payment_terms.trim()}` : null,
        row.grn_reference.trim() ? `GRN/source: ${row.grn_reference.trim()}` : null,
        row.supplier_batch_number.trim()
          ? `Supplier batch: ${row.supplier_batch_number.trim()}`
          : null,
        row.storage_conditions.trim() ? `Storage: ${row.storage_conditions.trim()}` : null,
        row.rack_bin.trim() ? `Rack/bin: ${row.rack_bin.trim()}` : null,
        `Paid qty: ${paidQty}`,
        `Free qty: ${freeQty}`,
        row.mrp !== "" ? `MRP: ${row.mrp}` : null,
        `GST: ${row.tax_percent}%`,
      ].filter(Boolean)
    : [];
  const sourceInfo = sourceParts.join(" | ");
  return {
    catalog_item_id: row.catalog_item_id,
    batch_number: row.batch_number.trim(),
    expiry_date: row.expiry_date,
    manufacture_date: row.manufacture_date || undefined,
    quantity_received: paidQty + freeQty,
    store_location_id: header.store_location_id.trim() || undefined,
    supplier_info: access.canWriteSource && sourceInfo ? sourceInfo : undefined,
    invoice_number: access.canWriteSource
      ? header.invoice_number.trim() || row.grn_reference.trim() || undefined
      : undefined,
    supplier_batch_number: row.supplier_batch_number.trim() || undefined,
    purchase_rate: row.purchase_rate === "" ? undefined : row.purchase_rate,
    selling_rate: row.mrp === "" ? undefined : row.mrp,
  };
}

export function StockTab({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [batchModalOpened, batchModalHandlers] = useDisclosure(false);
  const [bulkBatchOpened, bulkBatchHandlers] = useDisclosure(false);
  const [bulkStep, setBulkStep] = useState<"edit" | "verify">("edit");
  const [selectedStockItem, setSelectedStockItem] = useState<PharmacyCatalog | null>(null);
  const [bulkHeader, setBulkHeader] = useState<BulkBatchHeader>(newBulkBatchHeader());
  const [bulkRows, setBulkRows] = useState<BulkBatchLine[]>([newBulkBatchLine()]);
  const batchNumberAccess = useFieldAccess("pharmacy.batches.batch_number");
  const purchaseRateAccess = useFieldAccess("pharmacy.batches.purchase_rate");
  const sellingRateAccess = useFieldAccess("pharmacy.batches.selling_rate");
  const sourceAccess = useFieldAccess("pharmacy.batches.source");
  const canEditBatchNumbers = canEditPharmacyField(batchNumberAccess);
  const canEditBatchPrices =
    canEditPharmacyField(purchaseRateAccess) && canEditPharmacyField(sellingRateAccess);
  const canEditBatchSource = canEditPharmacyField(sourceAccess);

  const { data: myPharms = [] } = useQuery({
    queryKey: ["my-pharmacies"],
    queryFn: () => pharmacyService.myPharmacies(),
    staleTime: 10 * 60 * 1000,
  });
  // Default the stock view to the user's home pharmacy; `undefined` override means
  // "use default", `null` means the user explicitly chose all locations.
  const defaultPharmacyId = useMemo(
    () => myPharms.find((p) => p.is_default)?.id ?? myPharms[0]?.id ?? null,
    [myPharms],
  );
  const [locationOverride, setLocationOverride] = useState<string | null | undefined>(undefined);
  const stockLocationId = locationOverride !== undefined ? locationOverride : defaultPharmacyId;
  const {
    data: stock = [],
    isLoading,
    isError: stockFailed,
  } = useQuery({
    queryKey: ["pharmacy-stock", stockLocationId],
    queryFn: () =>
      pharmacyService.listStock(
        stockLocationId ? { store_location_id: stockLocationId } : undefined,
      ),
  });
  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ["pharmacy-batches"],
    queryFn: () => pharmacyService.listPharmacyBatches(),
  });
  const { data: storeLocations = [] } = useQuery({
    queryKey: ["store-locations"],
    queryFn: () => pharmacyService.listStoreLocations(),
    staleTime: 10 * 60 * 1000,
  });

  const emit = useClinicalEmit();

  const selectedBatches = useMemo(
    () =>
      selectedStockItem
        ? batches.filter((batch) => batch.catalog_item_id === selectedStockItem.id)
        : [],
    [batches, selectedStockItem],
  );
  const readyBulkRows = useMemo(() => bulkRows.filter(isBulkBatchLineReady), [bulkRows]);
  const storeLocationOptions = useMemo(
    () =>
      storeLocations.map((store) => ({
        value: store.id,
        label: [store.name, store.location_type, store.code].filter(Boolean).join(" - "),
      })),
    [storeLocations],
  );
  const storeLocationById = useMemo(
    () => new Map(storeLocations.map((store) => [store.id, store])),
    [storeLocations],
  );
  const storeSelectionRequired = storeLocations.length > 0;
  const canVerifyBulkRows =
    canEditBatchPrices &&
    canEditBatchNumbers &&
    readyBulkRows.length > 0 &&
    (!storeSelectionRequired || bulkHeader.store_location_id.trim().length > 0);

  const updateBulkRow = (id: string, patch: Partial<BulkBatchLine>) => {
    setBulkRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeBulkRow = (id: string) => {
    setBulkRows((rows) => (rows.length === 1 ? rows : rows.filter((row) => row.id !== id)));
  };

  const resetBulkRows = () => {
    setBulkHeader(newBulkBatchHeader());
    setBulkRows([newBulkBatchLine()]);
    setBulkStep("edit");
  };

  const bulkBatchMutation = useMutation({
    mutationFn: async (rows: BulkBatchLine[]) => {
      const created: PharmacyBatch[] = [];
      for (const row of rows) {
        created.push(
          await pharmacyService.createPharmacyBatch(
            buildBatchPayload(row, bulkHeader, { canWriteSource: canEditBatchSource }),
          ),
        );
      }
      return created;
    },
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-stock"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-catalog"] });
      void queryClient.invalidateQueries({ queryKey: ["pharmacy-batches"] });
      toast.success(`${created.length} batch row(s) verified and posted`, {
        title: "Batches added",
      });
      emit("pharmacy.stock.movement.created", {
        batch_count: created.length,
        batch_ids: created.map((batch) => batch.id),
        source_record_id: created[0]?.id,
        transaction_type: "bulk_batch_receipt",
        quantity: readyBulkRows.reduce((sum, row) => sum + batchLineTotalQuantity(row), 0),
      });
      bulkBatchHandlers.close();
      resetBulkRows();
    },
  });

  const columns = [
    {
      key: "code",
      label: "Code",
      sortable: true,
      searchable: true,
      accessor: (row: PharmacyCatalog) => row.code,
      render: (row: PharmacyCatalog) => <Text fw={500}>{row.code}</Text>,
    },
    {
      key: "name",
      label: "Drug Name",
      sortable: true,
      searchable: true,
      accessor: (row: PharmacyCatalog) => row.name,
      render: (row: PharmacyCatalog) => <Text size="sm">{row.name}</Text>,
    },
    {
      key: "current_stock",
      label: "Current Stock",
      sortable: true,
      sortValue: (row: PharmacyCatalog) => row.current_stock,
      accessor: (row: PharmacyCatalog) => row.current_stock,
      render: (row: PharmacyCatalog) => (
        <TableValueBadge
          value={row.current_stock < row.reorder_level ? "low_stock" : "stock"}
          kind="stock"
          color={row.current_stock < row.reorder_level ? "danger" : "success"}
          label={String(row.current_stock)}
        />
      ),
    },
    {
      key: "reorder_level",
      label: "Reorder Level",
      sortable: true,
      sortValue: (row: PharmacyCatalog) => row.reorder_level,
      accessor: (row: PharmacyCatalog) => row.reorder_level,
      render: (row: PharmacyCatalog) => <Text size="sm">{row.reorder_level}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (row: PharmacyCatalog) =>
        row.current_stock < row.reorder_level ? (
          <TableValueBadge
            value="low_stock"
            kind="stock"
            color="danger"
            label="Low Stock"
            variant="filled"
          />
        ) : (
          <TableValueBadge value="ready" kind="status" color="success" label="OK" />
        ),
    },
    {
      key: "batches",
      label: "Batches",
      render: (row: PharmacyCatalog) => {
        const activeBatches = batches.filter((batch) => batch.catalog_item_id === row.id);
        const earliest = activeBatches[0];
        return (
          <Button
            size="compact-xs"
            tone="secondary"
            leftSection={<IconEye size={12} />}
            onClick={() => {
              setSelectedStockItem(row);
              batchModalHandlers.open();
            }}
          >
            {activeBatches.length} batch{activeBatches.length === 1 ? "" : "es"}
            {earliest?.expiry_date ? ` · FEFO ${earliest.expiry_date}` : ""}
          </Button>
        );
      },
    },
  ];

  return (
    <Stack>
      {canManage && (!canEditBatchPrices || !canEditBatchNumbers) && (
        <Alert tone="warning">
          Stock intake requires editable batch identifiers plus purchase and selling rate access.
        </Alert>
      )}
      {canManage && canEditBatchPrices && canEditBatchNumbers && (
        <Group>
          <Button
            size="xs"
            tone="primary"
            leftSection={<IconPlus size={14} />}
            onClick={() => {
              resetBulkRows();
              bulkBatchHandlers.open();
            }}
          >
            Add stock intake
          </Button>
        </Group>
      )}
      <Group>
        <Select
          label="Stock at pharmacy"
          placeholder="All locations (tenant total)"
          clearable
          searchable
          data={storeLocations.map((l) => ({ value: l.id, label: l.name }))}
          value={stockLocationId}
          onChange={setLocationOverride}
          w={280}
        />
      </Group>
      {/* An empty stock list is read as "we do not hold this", and a
          pharmacist acts on it by turning a patient away or ordering
          against stock that is actually there. On a failed read `stock` is
          [] and says the same thing. */}
      {stockFailed && (
        <Alert tone="danger">
          Stock could not be read. This is a fault, not an empty shelf — do not treat it as what the
          pharmacy holds.
        </Alert>
      )}
      <DataTable
        columns={columns}
        data={stock}
        loading={isLoading}
        rowKey={(row) => row.id}
        searchable
        searchPlaceholder="Search stock"
        exportable
        exportFileName="pharmacy-stock"
      />
      <Modal
        opened={batchModalOpened}
        onClose={batchModalHandlers.close}
        title={selectedStockItem ? `${selectedStockItem.name} batches` : "Batch details"}
        size="xl"
      >
        <Stack gap="sm">
          {batchesLoading ? (
            <Loader size="sm" />
          ) : selectedBatches.length === 0 ? (
            <Text size="sm" c="dimmed">
              No active batch stock recorded for this product.
            </Text>
          ) : (
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Batch</Table.Th>
                  <Table.Th>Expiry</Table.Th>
                  <Table.Th>Qty</Table.Th>
                  <Table.Th>Purchase</Table.Th>
                  <Table.Th>MRP</Table.Th>
                  <Table.Th>GRN / Source</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {selectedBatches.map((batch) => (
                  <Table.Tr key={batch.id}>
                    <Table.Td>
                      {renderPharmacySensitiveValue(batchNumberAccess, batch.batch_number)}
                    </Table.Td>
                    <Table.Td>
                      <ExpiryCell date={batch.expiry_date} />
                    </Table.Td>
                    <Table.Td>
                      {batch.quantity_on_hand} / {batch.quantity_received}
                    </Table.Td>
                    <Table.Td>
                      {renderPharmacySensitiveCurrency(purchaseRateAccess, batch.purchase_rate)}
                    </Table.Td>
                    <Table.Td>
                      {renderPharmacySensitiveCurrency(sellingRateAccess, batch.selling_rate)}
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">
                        {renderPharmacySensitiveValue(
                          sourceAccess,
                          batch.grn_id ??
                            batch.supplier_info ??
                            batch.invoice_number ??
                            "Manual intake",
                        )}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      </Modal>
      <Modal
        opened={bulkBatchOpened}
        onClose={bulkBatchHandlers.close}
        title="Bulk batch intake"
        size="100%"
      >
        <Stack gap="sm">
          {bulkStep === "edit" ? (
            <>
              <Text size="sm" c="dimmed">
                Add multiple received batches in one table, then verify before stock is posted.
              </Text>
              {!canEditBatchSource && (
                <Alert tone="neutral">
                  Supplier, invoice, GRN, and storage-source details are restricted for this role
                  and will not be posted with the batch.
                </Alert>
              )}
              <Stack gap="xs">
                <Group grow>
                  <TextInput
                    label="Supplier name"
                    disabled={!canEditBatchSource}
                    value={bulkHeader.supplier_name}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setBulkHeader((header) => ({
                        ...header,
                        supplier_name: value,
                      }));
                    }}
                    placeholder="Supplier / distributor"
                  />
                  <TextInput
                    label="Supplier invoice number"
                    disabled={!canEditBatchSource}
                    value={bulkHeader.invoice_number}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setBulkHeader((header) => ({
                        ...header,
                        invoice_number: value,
                      }));
                    }}
                    placeholder="Invoice no."
                  />
                </Group>
                <Group grow>
                  <Select
                    label="Receiving store"
                    data={storeLocationOptions}
                    value={bulkHeader.store_location_id}
                    onChange={(value) =>
                      setBulkHeader((header) => ({
                        ...header,
                        store_location_id: value ?? "",
                      }))
                    }
                    placeholder={
                      storeLocationOptions.length > 0 ? "Select store" : "No store configured"
                    }
                    required={storeSelectionRequired}
                    searchable
                  />
                  <Select
                    label="Invoice mode"
                    disabled={!canEditBatchSource}
                    data={[
                      { value: "credit", label: "Credit invoice" },
                      { value: "cash", label: "Cash invoice" },
                    ]}
                    value={bulkHeader.invoice_mode}
                    onChange={(value) =>
                      setBulkHeader((header) => ({
                        ...header,
                        invoice_mode: value === "cash" ? "cash" : "credit",
                      }))
                    }
                  />
                  <TextInput
                    label="Invoice date"
                    type="date"
                    disabled={!canEditBatchSource}
                    value={bulkHeader.invoice_date}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setBulkHeader((header) => ({
                        ...header,
                        invoice_date: value,
                      }));
                    }}
                  />
                </Group>
                <Group grow>
                  <NumberInput
                    label="Invoice amount"
                    min={0}
                    decimalScale={2}
                    disabled={!canEditBatchPrices || !canEditBatchSource}
                    value={bulkHeader.invoice_amount}
                    onChange={(value) =>
                      setBulkHeader((header) => ({
                        ...header,
                        invoice_amount: typeof value === "number" ? value : "",
                      }))
                    }
                  />
                  <TextInput
                    label="Payment terms"
                    disabled={!canEditBatchSource}
                    value={bulkHeader.payment_terms}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setBulkHeader((header) => ({
                        ...header,
                        payment_terms: value,
                      }));
                    }}
                    placeholder="Credit days / cash / sponsor / payable note"
                  />
                </Group>
              </Stack>
              {storeSelectionRequired && !bulkHeader.store_location_id && (
                <Alert tone="warning">
                  Select the receiving store before verification so stock is posted to the correct
                  pharmacy location.
                </Alert>
              )}
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Product</Table.Th>
                    <Table.Th>Reorder</Table.Th>
                    <Table.Th>Batch</Table.Th>
                    <Table.Th>Supplier batch</Table.Th>
                    <Table.Th>Expiry</Table.Th>
                    <Table.Th>Mfg</Table.Th>
                    <Table.Th>GRN / Source</Table.Th>
                    <Table.Th>Storage</Table.Th>
                    <Table.Th>Rack / bin</Table.Th>
                    <Table.Th>Purchase rate</Table.Th>
                    <Table.Th>MRP</Table.Th>
                    <Table.Th>Tax</Table.Th>
                    <Table.Th>Paid qty</Table.Th>
                    <Table.Th>Free qty</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {bulkRows.map((row) => (
                    <Table.Tr key={row.id}>
                      <Table.Td miw={220}>
                        <DrugSearchSelect
                          value={row.catalog_item_id}
                          onChange={(id, selectedDrug) =>
                            updateBulkRow(row.id, {
                              catalog_item_id: id ?? "",
                              product_name: selectedDrug?.name ?? "",
                              tax_percent: Number(selectedDrug?.tax_percent ?? 0),
                              current_stock: selectedDrug?.current_stock ?? 0,
                              reorder_level: selectedDrug?.reorder_level ?? 0,
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        {row.catalog_item_id ? (
                          <Badge
                            variant={isBatchLineBelowReorder(row) ? "filled" : "light"}
                            tone={isBatchLineBelowReorder(row) ? "danger" : "success"}
                          >
                            {isBatchLineBelowReorder(row) ? "Reorder" : "OK"} {row.current_stock}/
                            {row.reorder_level}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={row.batch_number}
                          disabled={!canEditBatchNumbers}
                          onChange={(event) =>
                            updateBulkRow(row.id, { batch_number: event.currentTarget.value })
                          }
                          placeholder="Batch no."
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={row.supplier_batch_number}
                          disabled={!canEditBatchNumbers}
                          onChange={(event) =>
                            updateBulkRow(row.id, {
                              supplier_batch_number: event.currentTarget.value,
                            })
                          }
                          placeholder="Supplier batch"
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          type="date"
                          value={row.expiry_date}
                          onChange={(event) =>
                            updateBulkRow(row.id, { expiry_date: event.currentTarget.value })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          type="date"
                          value={row.manufacture_date}
                          onChange={(event) =>
                            updateBulkRow(row.id, { manufacture_date: event.currentTarget.value })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={row.grn_reference}
                          disabled={!canEditBatchSource}
                          onChange={(event) =>
                            updateBulkRow(row.id, { grn_reference: event.currentTarget.value })
                          }
                          placeholder="GRN / invoice"
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={row.storage_conditions}
                          disabled={!canEditBatchSource}
                          onChange={(event) =>
                            updateBulkRow(row.id, {
                              storage_conditions: event.currentTarget.value,
                            })
                          }
                          placeholder="Ambient / cold chain"
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          value={row.rack_bin}
                          disabled={!canEditBatchSource}
                          onChange={(event) =>
                            updateBulkRow(row.id, { rack_bin: event.currentTarget.value })
                          }
                          placeholder="Rack / shelf"
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          min={0}
                          value={row.purchase_rate}
                          disabled={!canEditBatchPrices}
                          error={!isBatchLinePriceValid(row) ? "Cannot exceed MRP" : undefined}
                          onChange={(value) =>
                            updateBulkRow(row.id, {
                              purchase_rate: typeof value === "number" ? value : "",
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          min={0}
                          value={row.mrp}
                          disabled={!canEditBatchPrices}
                          error={
                            !isBatchLinePriceValid(row) ? "MRP must be >= purchase" : undefined
                          }
                          onChange={(value) =>
                            updateBulkRow(row.id, { mrp: typeof value === "number" ? value : "" })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          min={0}
                          max={100}
                          value={row.tax_percent}
                          suffix="%"
                          onChange={(value) =>
                            updateBulkRow(row.id, {
                              tax_percent: typeof value === "number" ? value : 0,
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          min={0}
                          value={row.paid_quantity}
                          onChange={(value) =>
                            updateBulkRow(row.id, {
                              paid_quantity: typeof value === "number" ? value : "",
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <NumberInput
                          min={0}
                          value={row.free_quantity}
                          onChange={(value) =>
                            updateBulkRow(row.id, {
                              free_quantity: typeof value === "number" ? value : "",
                            })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <IconButton
                          tone="danger"
                          onClick={() => removeBulkRow(row.id)}
                          disabled={bulkRows.length === 1}
                          aria-label="Remove batch row"
                        >
                          <IconTrash size={14} />
                        </IconButton>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Stack gap="xs">
                <Button
                  tone="secondary"
                  fullWidth
                  leftSection={<IconPlus size={14} />}
                  onClick={() => setBulkRows((rows) => [...rows, newBulkBatchLine()])}
                >
                  Add another batch line
                </Button>
                <Group justify="flex-end">
                  <Button tone="secondary" onClick={bulkBatchHandlers.close}>
                    Cancel
                  </Button>
                  <Button
                    tone="primary"
                    disabled={!canVerifyBulkRows}
                    onClick={() => setBulkStep("verify")}
                  >
                    Verify {readyBulkRows.length} row{readyBulkRows.length === 1 ? "" : "s"}
                  </Button>
                </Group>
              </Stack>
            </>
          ) : (
            <>
              <Alert tone="info">
                Verify product, batch, expiry, paid quantity, and free quantity before posting. This
                will increase pharmacy stock immediately. Purchase rate must be equal to or less
                than MRP.
              </Alert>
              <Table striped withTableBorder>
                <Table.Caption>
                  {bulkHeader.invoice_mode === "cash" ? "Cash invoice" : "Credit invoice"} ·{" "}
                  {bulkHeader.invoice_date || "No date"} ·{" "}
                  {bulkHeader.invoice_number || "No invoice no."} · Supplier{" "}
                  {bulkHeader.supplier_name || "not recorded"} · Store{" "}
                  {storeLocationById.get(bulkHeader.store_location_id)?.name || "not selected"}
                  {bulkHeader.invoice_amount !== "" && (
                    <>
                      {" "}
                      · Invoice amount{" "}
                      {renderPharmacySensitiveCurrency(
                        purchaseRateAccess,
                        bulkHeader.invoice_amount,
                      )}
                    </>
                  )}
                </Table.Caption>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Product</Table.Th>
                    <Table.Th>Reorder</Table.Th>
                    <Table.Th>Batch</Table.Th>
                    <Table.Th>Supplier batch</Table.Th>
                    <Table.Th>Expiry</Table.Th>
                    <Table.Th>Mfg</Table.Th>
                    <Table.Th>Storage / rack</Table.Th>
                    <Table.Th>Paid</Table.Th>
                    <Table.Th>Free</Table.Th>
                    <Table.Th>Total</Table.Th>
                    <Table.Th>Purchase</Table.Th>
                    <Table.Th>MRP</Table.Th>
                    <Table.Th>Tax</Table.Th>
                    <Table.Th>Taxable</Table.Th>
                    <Table.Th>GST</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {readyBulkRows.map((row) => (
                    <Table.Tr key={row.id}>
                      <Table.Td>{row.product_name || row.catalog_item_id}</Table.Td>
                      <Table.Td>
                        <Badge tone={isBatchLineBelowReorder(row) ? "danger" : "success"}>
                          {isBatchLineBelowReorder(row) ? "Below reorder" : "Above reorder"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {renderPharmacySensitiveIdentifier(batchNumberAccess, row.batch_number)}
                      </Table.Td>
                      <Table.Td>
                        {renderPharmacySensitiveIdentifier(
                          batchNumberAccess,
                          row.supplier_batch_number,
                        )}
                      </Table.Td>
                      <Table.Td>{row.expiry_date}</Table.Td>
                      <Table.Td>{row.manufacture_date || "—"}</Table.Td>
                      <Table.Td>
                        {renderPharmacySensitiveValue(
                          sourceAccess,
                          [row.storage_conditions, row.rack_bin].filter(Boolean).join(" · "),
                        )}
                      </Table.Td>
                      <Table.Td>{batchLineNumber(row.paid_quantity)}</Table.Td>
                      <Table.Td>{batchLineNumber(row.free_quantity)}</Table.Td>
                      <Table.Td>{batchLineTotalQuantity(row)}</Table.Td>
                      <Table.Td>
                        {renderPharmacySensitiveCurrency(purchaseRateAccess, row.purchase_rate)}
                      </Table.Td>
                      <Table.Td>
                        {renderPharmacySensitiveCurrency(sellingRateAccess, row.mrp)}
                      </Table.Td>
                      <Table.Td>{row.tax_percent}%</Table.Td>
                      <Table.Td>
                        {renderPharmacySensitiveCurrency(
                          purchaseRateAccess,
                          batchLineTaxableAmount(row),
                        )}
                      </Table.Td>
                      <Table.Td>
                        {renderPharmacySensitiveCurrency(
                          purchaseRateAccess,
                          batchLineTaxAmount(row),
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
              <Group justify="space-between">
                <Button tone="secondary" onClick={() => setBulkStep("edit")}>
                  Back to edit
                </Button>
                <Button
                  tone="primary"
                  leftSection={<IconCheck size={14} />}
                  loading={bulkBatchMutation.isPending}
                  onClick={() => bulkBatchMutation.mutate(readyBulkRows)}
                >
                  Submit verified batches
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}

// ══════════════════════════════════════════════════════════
//  NDPS Register Tab
// ══════════════════════════════════════════════════════════
