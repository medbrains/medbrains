import { Group, Modal, NumberInput, Select, Stack, Tabs, Text, Textarea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type {
  CreateStockTransferItem,
  PharmacyCatalog,
  StockTransfer,
  StockTransferStatus,
  TransferStatus,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPackages, IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import type { Column } from "@/components/DataTable";
import { DrugSearchSelect } from "@/components/DrugSearchSelect";
import { Badge, type BadgeTone, Button, IconButton, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { multiHospitalService } from "@/services/multiHospital.service";

function statusTone(s: StockTransferStatus): BadgeTone {
  if (s === "received") return "success";
  if (s === "cancelled") return "danger";
  if (s === "requested") return "neutral";
  return "info";
}

const PRIORITIES = ["routine", "urgent", "emergency"].map((v) => ({ value: v, label: v }));

type ItemRow = CreateStockTransferItem & { rowId: number };

function RequestStockModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [groupId, setGroupId] = useState<string | null>(null);
  const [destTenant, setDestTenant] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<string | null>("routine");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [nextId, setNextId] = useState(1);

  const { data: groups = [] } = useQuery({
    queryKey: ["hospital-groups"],
    queryFn: () => multiHospitalService.listHospitalGroups(),
    enabled: opened,
  });
  const { data: hospitals = [] } = useQuery({
    queryKey: ["hospitals-in-group", groupId],
    queryFn: () => multiHospitalService.listHospitalsInGroup(groupId ?? ""),
    enabled: !!groupId,
  });

  const create = useMutation({
    mutationFn: () =>
      multiHospitalService.createStockTransfer({
        dest_tenant_id: destTenant ?? "",
        request_reason: reason || undefined,
        priority: priority ?? undefined,
        items: items.map(({ rowId: _rowId, ...rest }) => rest),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["stock-transfers"] });
      toast.success("Stock transfer requested", { title: "Inter-hospital stock" });
      onClose();
      setItems([]);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Request failed" }),
  });

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      { rowId: nextId, item_id: "", item_code: "", item_name: "", requested_qty: 1, unit: "unit" },
    ]);
    setNextId((n) => n + 1);
  };
  const setDrug = (rowId: number, drugId: string, drug?: PharmacyCatalog) => {
    setItems((prev) =>
      prev.map((r) =>
        r.rowId === rowId
          ? {
              ...r,
              item_id: drugId,
              item_code: drug?.code ?? drugId,
              item_name: drug?.name ?? "",
              unit: drug?.unit ?? "unit",
            }
          : r,
      ),
    );
  };

  const valid =
    destTenant && items.length > 0 && items.every((i) => i.item_id && i.requested_qty > 0);

  return (
    <Modal opened={opened} onClose={onClose} title="Request stock transfer" size="xl">
      <Stack gap="sm">
        <Group grow>
          <Select
            label="Group"
            data={groups.map((g) => ({ value: g.id, label: g.name }))}
            value={groupId}
            onChange={(v) => {
              setGroupId(v);
              setDestTenant(null);
            }}
            searchable
          />
          <Select
            label="Destination hospital"
            data={hospitals.map((h) => ({ value: h.id, label: h.name }))}
            value={destTenant}
            onChange={setDestTenant}
            disabled={!groupId}
            searchable
          />
        </Group>

        <Group justify="space-between">
          <Text fw={600} size="sm">
            Items
          </Text>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={addRow}>
            Add item
          </Button>
        </Group>
        {items.map((row) => (
          <Group key={row.rowId} align="flex-end" gap="xs" wrap="nowrap">
            <DrugSearchSelect
              value={row.item_id}
              onChange={(id, drug) => setDrug(row.rowId, id, drug)}
            />
            <NumberInput
              label="Qty"
              value={row.requested_qty}
              onChange={(v) =>
                setItems((prev) =>
                  prev.map((r) =>
                    r.rowId === row.rowId
                      ? { ...r, requested_qty: typeof v === "number" ? v : 1 }
                      : r,
                  ),
                )
              }
              min={1}
              w={90}
            />
            <IconButton
              tone="danger"
              aria-label="Remove item"
              onClick={() => setItems((prev) => prev.filter((r) => r.rowId !== row.rowId))}
            >
              <IconTrash size={16} />
            </IconButton>
          </Group>
        ))}

        <Textarea
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          minRows={2}
        />
        <Select label="Priority" data={PRIORITIES} value={priority} onChange={setPriority} />
        <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!valid}>
          Request transfer
        </Button>
      </Stack>
    </Modal>
  );
}

function StockTransfersTable({ direction }: { direction: "outgoing" | "incoming" }) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["stock-transfers", direction],
    queryFn: () =>
      direction === "outgoing"
        ? multiHospitalService.listOutgoingStockTransfers()
        : multiHospitalService.listIncomingStockTransfers(),
    refetchInterval: 30_000,
  });

  const update = useMutation({
    mutationFn: (vars: { id: string; status: TransferStatus }) =>
      multiHospitalService.updateStockTransferStatus(vars.id, { status: vars.status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["stock-transfers"] });
      toast.success("Transfer updated", { title: "Stock transfer" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Update failed" }),
  });

  const act = (id: string, status: TransferStatus, label: string, tone: "primary" | "danger") => (
    <Button
      key={status}
      size="xs"
      tone={tone}
      loading={update.isPending}
      onClick={() => update.mutate({ id, status })}
    >
      {label}
    </Button>
  );

  const rowActions = (r: StockTransfer) => {
    const actions = [];
    if (direction === "incoming") {
      if (r.status === "requested") actions.push(act(r.id, "approved", "Accept", "primary"));
      if (r.status === "dispatched" || r.status === "in_transit")
        actions.push(act(r.id, "received", "Receive", "primary"));
    } else {
      if (r.status === "approved") actions.push(act(r.id, "in_transit", "Dispatch", "primary"));
      if (r.status === "requested" || r.status === "approved")
        actions.push(act(r.id, "cancelled", "Cancel", "danger"));
    }
    return actions.length > 0 ? actions : null;
  };

  const columns: Column<StockTransfer>[] = [
    { key: "transfer_number", label: "Transfer #", render: (r) => r.transfer_number },
    {
      key: "priority",
      label: "Priority",
      render: (r) => (
        <Badge tone={r.priority === "emergency" ? "danger" : "neutral"} size="sm">
          {r.priority}
        </Badge>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge>,
    },
    {
      key: "requested_at",
      label: "Requested",
      render: (r) => new Date(r.requested_at).toLocaleString(),
    },
    { key: "actions", label: "", render: (r) => <Group gap="xs">{rowActions(r)}</Group> },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      loading={isLoading}
      rowKey={(r) => r.id}
      emptyTitle="No stock transfers."
    />
  );
}

export function InterHospitalStockPage() {
  useRequirePermission(P.IPD.TRANSFERS_CREATE);
  const [modalOpen, modal] = useDisclosure(false);

  return (
    <Stack gap="md">
      <PageHeader
        title="Inter-hospital stock"
        subtitle="Move supplies between hospitals in your group"
        icon={<IconPackages size={20} />}
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={modal.open}>
            Request transfer
          </Button>
        }
      />
      <Tabs defaultValue="outgoing">
        <Tabs.List>
          <Tabs.Tab value="outgoing">Outgoing</Tabs.Tab>
          <Tabs.Tab value="incoming">Incoming</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="outgoing" pt="md">
          <StockTransfersTable direction="outgoing" />
        </Tabs.Panel>
        <Tabs.Panel value="incoming" pt="md">
          <StockTransfersTable direction="incoming" />
        </Tabs.Panel>
      </Tabs>
      <RequestStockModal opened={modalOpen} onClose={modal.close} />
    </Stack>
  );
}
