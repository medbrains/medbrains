// INDENT AssetsImplantsPanel — split from indent.tsx (pure move).

import {
  Drawer,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  CreateCondemnationRequest,
  CreateImplantRequest,
  EquipmentCondemnation,
  ImplantRegistryEntry,
  UpdateCondemnationStatusRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconEye, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, DoctorSearchSelect } from "@/components";
import { PatientNameCell } from "@/components/PatientNameCell";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, Button, IconButton, toast } from "@/components/ui";
import { statusColor } from "@/lib/status-colors";
import { indentService } from "@/services/indent.service";
import { colorToBadgeTone } from "./shared";

function ImplantRegistryView() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(P.INDENT.IMPLANTS_MANAGE);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["implant-registry"],
    queryFn: () => indentService.listImplantRegistry(),
  });

  const columns = [
    {
      key: "catalog_item_id",
      label: "Catalog Item",
      render: (row: ImplantRegistryEntry) => (
        <Text size="sm" truncate>
          {row.catalog_item_id}
        </Text>
      ),
    },
    {
      key: "patient_id",
      label: "Patient",
      render: (row: ImplantRegistryEntry) => (
        <PatientNameCell patientId={row.patient_id} showUhid={false} />
      ),
    },
    {
      key: "serial_number",
      label: "Serial #",
      render: (row: ImplantRegistryEntry) => row.serial_number ?? "-",
    },
    {
      key: "implant_date",
      label: "Implant Date",
      render: (row: ImplantRegistryEntry) => new Date(row.implant_date).toLocaleDateString(),
    },
    {
      key: "implant_site",
      label: "Site",
      render: (row: ImplantRegistryEntry) => row.implant_site ?? "-",
    },
    {
      key: "manufacturer",
      label: "Manufacturer",
      render: (row: ImplantRegistryEntry) => row.manufacturer ?? "-",
    },
    {
      key: "model_number",
      label: "Model",
      render: (row: ImplantRegistryEntry) => row.model_number ?? "-",
    },
    {
      key: "warranty_expiry",
      label: "Warranty Expiry",
      render: (row: ImplantRegistryEntry) =>
        row.warranty_expiry ? new Date(row.warranty_expiry).toLocaleDateString() : "-",
    },
  ];

  return (
    <>
      {canManage && (
        <Group justify="flex-end" mb="md">
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Register Implant
          </Button>
        </Group>
      )}
      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No implant registry entries"
      />
      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Register Implant"
        position="right"
        size="xl"
      >
        <CreateImplantForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["implant-registry"] });
            closeCreate();
          }}
        />
      </Drawer>
    </>
  );
}

function CreateImplantForm({ onSuccess }: { onSuccess: () => void }) {
  const [catalogItemId, setCatalogItemId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [implantDate, setImplantDate] = useState("");
  const [implantSite, setImplantSite] = useState("");
  const [surgeonId, setSurgeonId] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [modelNumber, setModelNumber] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [notes, setNotes] = useState("");

  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => indentService.listStoreCatalog({ active_only: "true" }),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: CreateImplantRequest = {
        catalog_item_id: catalogItemId,
        patient_id: patientId,
        implant_date: implantDate,
        serial_number: serialNumber || undefined,
        implant_site: implantSite || undefined,
        surgeon_id: surgeonId || undefined,
        manufacturer: manufacturer || undefined,
        model_number: modelNumber || undefined,
        warranty_expiry: warrantyExpiry || undefined,
        notes: notes || undefined,
      };
      return indentService.createImplantEntry(payload);
    },
    onSuccess: () => {
      toast.success("Implant registered successfully", { title: "Registered" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  return (
    <Stack>
      <Select
        label="Catalog Item"
        placeholder="Select item"
        data={(catalog ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
        value={catalogItemId}
        onChange={(v) => setCatalogItemId(v ?? "")}
        searchable
        required
      />
      <PatientSearchSelect value={patientId} onChange={setPatientId} required />
      <TextInput
        label="Serial Number"
        value={serialNumber}
        onChange={(e) => setSerialNumber(e.currentTarget.value)}
      />
      <TextInput
        label="Implant Date"
        placeholder="YYYY-MM-DD"
        value={implantDate}
        onChange={(e) => setImplantDate(e.currentTarget.value)}
        required
      />
      <TextInput
        label="Implant Site"
        value={implantSite}
        onChange={(e) => setImplantSite(e.currentTarget.value)}
      />
      <DoctorSearchSelect label="Surgeon" value={surgeonId} onChange={setSurgeonId} />
      <TextInput
        label="Manufacturer"
        value={manufacturer}
        onChange={(e) => setManufacturer(e.currentTarget.value)}
      />
      <TextInput
        label="Model Number"
        value={modelNumber}
        onChange={(e) => setModelNumber(e.currentTarget.value)}
      />
      <TextInput
        label="Warranty Expiry"
        placeholder="YYYY-MM-DD"
        value={warrantyExpiry}
        onChange={(e) => setWarrantyExpiry(e.currentTarget.value)}
      />
      <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
      <Button
        tone="primary"
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
        disabled={!catalogItemId || !patientId || !implantDate}
      >
        Register Implant
      </Button>
    </Stack>
  );
}

function CondemnationsView() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(P.INDENT.CONDEMNATION_MANAGE);
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [statusItem, setStatusItem] = useState<EquipmentCondemnation | null>(null);
  const [statusOpened, { open: openStatus, close: closeStatus }] = useDisclosure(false);

  const { data, isLoading } = useQuery({
    queryKey: ["condemnations"],
    queryFn: () => indentService.listCondemnations(),
  });

  const columns = [
    {
      key: "condemnation_number",
      label: "Number",
      render: (row: EquipmentCondemnation) => (
        <Text fw={600} size="sm">
          {row.condemnation_number}
        </Text>
      ),
    },
    {
      key: "catalog_item_id",
      label: "Catalog Item",
      render: (row: EquipmentCondemnation) => (
        <Text size="sm" truncate>
          {row.catalog_item_id}
        </Text>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: EquipmentCondemnation) => (
        <Badge tone={colorToBadgeTone(statusColor(row.status))} variant="filled" size="sm">
          {row.status.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      key: "reason",
      label: "Reason",
      render: (row: EquipmentCondemnation) => (
        <Text size="sm" lineClamp={2}>
          {row.reason}
        </Text>
      ),
    },
    {
      key: "current_value",
      label: "Current Value",
      render: (row: EquipmentCondemnation) => `\u20B9${row.current_value}`,
    },
    {
      key: "purchase_value",
      label: "Purchase Value",
      render: (row: EquipmentCondemnation) => `\u20B9${row.purchase_value}`,
    },
    {
      key: "created_at",
      label: "Date",
      render: (row: EquipmentCondemnation) => new Date(row.created_at).toLocaleDateString(),
    },
    {
      key: "actions",
      label: "",
      render: (row: EquipmentCondemnation) =>
        canManage && !["condemned", "rejected"].includes(row.status) ? (
          <IconButton
            onClick={() => {
              setStatusItem(row);
              openStatus();
            }}
            aria-label="View details"
          >
            <IconEye size={16} />
          </IconButton>
        ) : null,
    },
  ];

  return (
    <>
      {canManage && (
        <Group justify="flex-end" mb="md">
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Initiate Condemnation
          </Button>
        </Group>
      )}
      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        emptyTitle="No condemnation records"
      />
      <Drawer
        opened={createOpened}
        onClose={closeCreate}
        title="Initiate Condemnation"
        position="right"
        size="xl"
      >
        <CreateCondemnationForm
          onSuccess={() => {
            void queryClient.invalidateQueries({ queryKey: ["condemnations"] });
            closeCreate();
          }}
        />
      </Drawer>
      <Drawer
        opened={statusOpened}
        onClose={closeStatus}
        title="Update Condemnation Status"
        position="right"
        size="xl"
      >
        {statusItem && (
          <UpdateCondemnationStatusForm
            item={statusItem}
            onSuccess={() => {
              void queryClient.invalidateQueries({ queryKey: ["condemnations"] });
              closeStatus();
            }}
          />
        )}
      </Drawer>
    </>
  );
}

function CreateCondemnationForm({ onSuccess }: { onSuccess: () => void }) {
  const [catalogItemId, setCatalogItemId] = useState("");
  const [reason, setReason] = useState("");
  const [currentValue, setCurrentValue] = useState(0);
  const [purchaseValue, setPurchaseValue] = useState(0);
  const [notes, setNotes] = useState("");

  const { data: catalog } = useQuery({
    queryKey: ["store-catalog"],
    queryFn: () => indentService.listStoreCatalog({ active_only: "true" }),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: CreateCondemnationRequest = {
        catalog_item_id: catalogItemId,
        reason,
        current_value: currentValue,
        purchase_value: purchaseValue,
        notes: notes || undefined,
      };
      return indentService.createCondemnation(payload);
    },
    onSuccess: () => {
      toast.success("Condemnation initiated", { title: "Created" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  return (
    <Stack>
      <Select
        label="Catalog Item"
        placeholder="Select item"
        data={(catalog ?? []).map((c) => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
        value={catalogItemId}
        onChange={(v) => setCatalogItemId(v ?? "")}
        searchable
        required
      />
      <Textarea
        label="Reason for Condemnation"
        value={reason}
        onChange={(e) => setReason(e.currentTarget.value)}
        required
        minRows={3}
      />
      <NumberInput
        label="Current Value"
        value={currentValue}
        onChange={(v) => setCurrentValue(Number(v))}
        decimalScale={2}
        min={0}
        prefix={"\u20B9"}
      />
      <NumberInput
        label="Purchase Value"
        value={purchaseValue}
        onChange={(v) => setPurchaseValue(Number(v))}
        decimalScale={2}
        min={0}
        prefix={"\u20B9"}
      />
      <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
      <Button
        tone="primary"
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
        disabled={!catalogItemId || !reason}
      >
        Initiate Condemnation
      </Button>
    </Stack>
  );
}

function UpdateCondemnationStatusForm({
  item,
  onSuccess,
}: {
  item: EquipmentCondemnation;
  onSuccess: () => void;
}) {
  const nextStatusMap: Record<string, string[]> = {
    initiated: ["committee_review", "rejected"],
    committee_review: ["approved", "rejected"],
    approved: ["condemned"],
  };

  const availableStatuses = nextStatusMap[item.status] ?? [];
  const [newStatus, setNewStatus] = useState<string>(availableStatuses[0] ?? "");
  const [committeeRemarks, setCommitteeRemarks] = useState("");
  const [disposalMethod, setDisposalMethod] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const payload: UpdateCondemnationStatusRequest = {
        status: newStatus as EquipmentCondemnation["status"],
        committee_remarks: committeeRemarks || undefined,
        disposal_method: disposalMethod || undefined,
      };
      return indentService.updateCondemnationStatus(item.id, payload);
    },
    onSuccess: () => {
      toast.success("Condemnation status updated", { title: "Updated" });
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message, { title: "Error" });
    },
  });

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Current status:{" "}
        <Badge tone="primary" size="sm">
          {item.status.replace(/_/g, " ")}
        </Badge>
      </Text>
      <Text size="sm">Condemnation #{item.condemnation_number}</Text>
      <Text size="sm">Reason: {item.reason}</Text>

      <Select
        label="New Status"
        data={availableStatuses.map((s) => ({ value: s, label: s.replace(/_/g, " ") }))}
        value={newStatus}
        onChange={(v) => setNewStatus(v ?? "")}
        required
      />
      <Textarea
        label="Committee Remarks"
        value={committeeRemarks}
        onChange={(e) => setCommitteeRemarks(e.currentTarget.value)}
      />
      {newStatus === "condemned" && (
        <Select
          label="Disposal Method"
          data={[
            { value: "auction", label: "Auction" },
            { value: "scrap", label: "Scrap" },
            { value: "donation", label: "Donation" },
            { value: "trade_in", label: "Trade-In" },
            { value: "destruction", label: "Destruction" },
          ]}
          value={disposalMethod}
          onChange={(v) => setDisposalMethod(v ?? "")}
        />
      )}
      <Button
        tone="primary"
        loading={mutation.isPending}
        onClick={() => mutation.mutate()}
        disabled={!newStatus}
      >
        Update Status
      </Button>
    </Stack>
  );
}

export function AssetsImplantsPanel() {
  const [subView, setSubView] = useState("implants");

  return (
    <Stack>
      <SegmentedControl
        value={subView}
        onChange={setSubView}
        data={[
          { label: "Implant Registry", value: "implants" },
          { label: "Condemnations", value: "condemnations" },
        ]}
      />
      {subView === "implants" && <ImplantRegistryView />}
      {subView === "condemnations" && <CondemnationsView />}
    </Stack>
  );
}

// ── Implant Registry ─────────────────────────────────────
