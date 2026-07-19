// BLOOD-BANK InventoryTab — split from blood-bank.tsx (pure move).

import {
  Divider,
  Drawer,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { BloodComponent, CreateComponentRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable, StatusDot } from "@/components";
import { Badge, Button, IconButton, toast } from "@/components/ui";
import { bloodBankService } from "@/services/bloodBank.service";

const bagStatusColors: Record<string, string> = {
  collected: "slate",
  processing: "primary",
  tested: "info",
  available: "success",
  reserved: "warning",
  crossmatched: "orange",
  issued: "teal",
  transfused: "violet",
  returned: "danger",
  expired: "danger",
  discarded: "dark",
};

const discardReasonLabels: Record<string, string> = {
  expired: "Expired",
  contaminated: "Contaminated",
  tti_positive: "TTI Positive",
  processing_failure: "Processing Failure",
  storage_failure: "Storage Failure",
  damaged: "Damaged",
  other: "Other",
};

function CreateComponentForm({ onSubmit }: { onSubmit: (d: CreateComponentRequest) => void }) {
  const [donationId, setDonationId] = useState("");
  const [componentType, setComponentType] = useState<string | null>("prbc");
  const [bagNumber, setBagNumber] = useState("");
  const [bloodGroup, setBloodGroup] = useState<string | null>(null);
  const [volumeMl, setVolumeMl] = useState<number>(300);
  const [expiryAt, setExpiryAt] = useState("");
  const [storageLocation, setStorageLocation] = useState("");

  return (
    <Stack>
      <TextInput
        label="Donation ID"
        required
        value={donationId}
        onChange={(e) => setDonationId(e.currentTarget.value)}
        placeholder="UUID of the donation"
      />
      <Select
        label="Component Type"
        required
        data={[
          { value: "whole_blood", label: "Whole Blood" },
          { value: "prbc", label: "PRBC" },
          { value: "ffp", label: "FFP" },
          { value: "platelets", label: "Platelets" },
          { value: "cryoprecipitate", label: "Cryoprecipitate" },
          { value: "granulocytes", label: "Granulocytes" },
        ]}
        value={componentType}
        onChange={setComponentType}
      />
      <TextInput
        label="Bag Number"
        required
        value={bagNumber}
        onChange={(e) => setBagNumber(e.currentTarget.value)}
      />
      <Select
        label="Blood Group"
        required
        data={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]}
        value={bloodGroup}
        onChange={setBloodGroup}
      />
      <NumberInput
        label="Volume (ml)"
        value={volumeMl}
        onChange={(v) => setVolumeMl(Number(v))}
        min={50}
        max={600}
      />
      <TextInput
        label="Expiry Date"
        required
        placeholder="YYYY-MM-DD"
        value={expiryAt}
        onChange={(e) => setExpiryAt(e.currentTarget.value)}
      />
      <TextInput
        label="Storage Location"
        value={storageLocation}
        onChange={(e) => setStorageLocation(e.currentTarget.value)}
      />
      <Button
        tone="primary"
        onClick={() => {
          if (!donationId || !componentType || !bagNumber || !bloodGroup || !expiryAt) return;
          onSubmit({
            donation_id: donationId,
            component_type: componentType as CreateComponentRequest["component_type"],
            bag_number: bagNumber,
            blood_group: bloodGroup,
            volume_ml: volumeMl,
            expiry_at: expiryAt,
            storage_location: storageLocation || undefined,
          });
        }}
      >
        Add Component
      </Button>
    </Stack>
  );
}

function DiscardComponentForm({
  component,
  onSubmit,
  loading,
}: {
  component: BloodComponent;
  onSubmit: (reason: string, notes: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  return (
    <Stack>
      <Paper p="sm" withBorder>
        <Text size="sm" c="dimmed">
          Component: <strong>{component.bag_number}</strong> (
          {component.component_type.toUpperCase()})
        </Text>
        <Text size="sm" c="dimmed">
          Blood Group: <strong>{component.blood_group}</strong> | Volume:{" "}
          <strong>{component.volume_ml} ml</strong>
        </Text>
        <Text size="sm" c="dimmed">
          Expiry: {new Date(component.expiry_at).toLocaleDateString()}
        </Text>
      </Paper>
      <Select
        label="Discard Reason"
        required
        data={[
          { value: "expired", label: "Expired" },
          { value: "contaminated", label: "Contaminated" },
          { value: "tti_positive", label: "TTI Positive" },
          { value: "processing_failure", label: "Processing Failure" },
          { value: "storage_failure", label: "Storage Failure" },
          { value: "damaged", label: "Damaged" },
          { value: "other", label: "Other" },
        ]}
        value={reason}
        onChange={setReason}
      />
      <Textarea
        label="Notes"
        placeholder="Additional details about the discard..."
        value={notes}
        onChange={(e) => setNotes(e.currentTarget.value)}
        minRows={3}
      />
      <Button
        tone="danger"
        leftSection={<IconTrash size={16} />}
        onClick={() => {
          if (!reason) return;
          onSubmit(reason, notes);
        }}
        loading={loading}
      >
        Confirm Discard
      </Button>
    </Stack>
  );
}

export function InventoryTab() {
  const qc = useQueryClient();
  const canManage = useHasPermission(P.BLOOD_BANK.INVENTORY_MANAGE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [discardComponent, setDiscardComponent] = useState<BloodComponent | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [bgFilter, setBgFilter] = useState<string | null>(null);
  const [ctFilter, setCtFilter] = useState<string | null>(null);
  const [inventoryView, setInventoryView] = useState("active");

  const params: Record<string, string> = {};
  if (statusFilter) params.status = statusFilter;
  if (bgFilter) params.blood_group = bgFilter;
  if (ctFilter) params.component_type = ctFilter;

  const { data: components, isLoading } = useQuery({
    queryKey: ["blood-bank", "components", params],
    queryFn: () => bloodBankService.listBloodComponents(params),
  });

  // Also fetch all components (unfiltered) for the discard report
  const { data: allComponents } = useQuery({
    queryKey: ["blood-bank", "components", {}],
    queryFn: () => bloodBankService.listBloodComponents(),
  });

  const discardedComponents = useMemo(
    () => (allComponents ?? []).filter((c) => c.discarded_at !== null),
    [allComponents],
  );

  const discardStats = useMemo(() => {
    const stats: Record<string, number> = {};
    for (const c of discardedComponents) {
      const reason = c.discard_reason ?? "unknown";
      stats[reason] = (stats[reason] ?? 0) + 1;
    }
    return stats;
  }, [discardedComponents]);

  const statusMut = useMutation({
    mutationFn: ({
      id,
      status,
      discard_reason,
    }: {
      id: string;
      status: string;
      discard_reason?: string;
    }) =>
      bloodBankService.updateComponentStatus(id, {
        status: status as BloodComponent["status"],
        discard_reason,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blood-bank", "components"] });
      setDiscardComponent(null);
      toast.success("Component status changed", { title: "Status updated" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Status change blocked" }),
  });

  const canDiscard = (c: BloodComponent) => c.status !== "transfused" && c.status !== "discarded";

  const columns = [
    { key: "bag_number" as const, label: "Bag #", render: (c: BloodComponent) => c.bag_number },
    {
      key: "component_type" as const,
      label: "Component",
      render: (c: BloodComponent) => c.component_type.toUpperCase(),
    },
    {
      key: "blood_group" as const,
      label: "Group",
      render: (c: BloodComponent) => <Badge tone="danger">{c.blood_group}</Badge>,
    },
    {
      key: "volume_ml" as const,
      label: "Volume",
      render: (c: BloodComponent) => `${c.volume_ml} ml`,
    },
    {
      key: "status" as const,
      label: "Status",
      render: (c: BloodComponent) => (
        <StatusDot label={c.status} color={bagStatusColors[c.status] ?? "slate"} />
      ),
    },
    {
      key: "expiry_at" as const,
      label: "Expiry",
      render: (c: BloodComponent) => new Date(c.expiry_at).toLocaleDateString(),
    },
    ...(canManage
      ? [
          {
            key: "id" as const,
            label: "Actions",
            render: (c: BloodComponent) => (
              <Group gap={4}>
                {c.status === "collected" && (
                  <Button
                    tone="secondary"
                    size="compact-xs"
                    onClick={() => statusMut.mutate({ id: c.id, status: "available" })}
                  >
                    Mark Available
                  </Button>
                )}
                {c.status === "available" && (
                  <Button
                    tone="secondary"
                    size="compact-xs"
                    onClick={() => statusMut.mutate({ id: c.id, status: "reserved" })}
                  >
                    Reserve
                  </Button>
                )}
                {canDiscard(c) && (
                  <Tooltip label="Discard component">
                    <IconButton
                      tone="danger"
                      size="sm"
                      onClick={() => setDiscardComponent(c)}
                      aria-label="Delete"
                    >
                      <IconTrash size={14} />
                    </IconButton>
                  </Tooltip>
                )}
              </Group>
            ),
          },
        ]
      : []),
  ];

  const discardColumns = [
    { key: "bag_number" as const, label: "Bag #", render: (c: BloodComponent) => c.bag_number },
    {
      key: "component_type" as const,
      label: "Component",
      render: (c: BloodComponent) => c.component_type.toUpperCase(),
    },
    {
      key: "blood_group" as const,
      label: "Group",
      render: (c: BloodComponent) => <Badge tone="danger">{c.blood_group}</Badge>,
    },
    {
      key: "volume_ml" as const,
      label: "Volume",
      render: (c: BloodComponent) => `${c.volume_ml} ml`,
    },
    {
      key: "discard_reason" as const,
      label: "Reason",
      render: (c: BloodComponent) => (
        <Badge tone="neutral">
          {discardReasonLabels[c.discard_reason ?? ""] ?? c.discard_reason ?? "—"}
        </Badge>
      ),
    },
    {
      key: "discarded_at" as const,
      label: "Discarded On",
      render: (c: BloodComponent) =>
        c.discarded_at ? new Date(c.discarded_at).toLocaleDateString() : "—",
    },
  ];

  return (
    <Stack mt="md">
      <SegmentedControl
        value={inventoryView}
        onChange={setInventoryView}
        data={[
          { value: "active", label: "Active Inventory" },
          { value: "discards", label: `Discard Report (${discardedComponents.length})` },
        ]}
        w={360}
      />

      {inventoryView === "active" && (
        <>
          <Group>
            <Select
              placeholder="Status"
              data={[
                "collected",
                "processing",
                "tested",
                "available",
                "reserved",
                "crossmatched",
                "issued",
                "expired",
              ]}
              clearable
              value={statusFilter}
              onChange={setStatusFilter}
              w={160}
            />
            <Select
              placeholder="Blood group"
              data={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]}
              clearable
              value={bgFilter}
              onChange={setBgFilter}
              w={140}
            />
            <Select
              placeholder="Component"
              data={[
                { value: "whole_blood", label: "Whole Blood" },
                { value: "prbc", label: "PRBC" },
                { value: "ffp", label: "FFP" },
                { value: "platelets", label: "Platelets" },
                { value: "cryoprecipitate", label: "Cryo" },
              ]}
              clearable
              value={ctFilter}
              onChange={setCtFilter}
              w={160}
            />
            {canManage && (
              <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
                Add Component
              </Button>
            )}
          </Group>

          <DataTable
            columns={columns}
            data={components ?? []}
            loading={isLoading}
            rowKey={(c) => c.id}
          />
        </>
      )}

      {inventoryView === "discards" && (
        <>
          {Object.keys(discardStats).length > 0 && (
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }}>
              {Object.entries(discardStats).map(([reason, count]) => (
                <Paper key={reason} p="sm" withBorder>
                  <Text size="xs" c="dimmed">
                    {discardReasonLabels[reason] ?? reason}
                  </Text>
                  <Title order={4}>{count}</Title>
                </Paper>
              ))}
              <Paper p="sm" withBorder>
                <Text size="xs" c="dimmed">
                  Total Discarded
                </Text>
                <Title order={4} c="danger">
                  {discardedComponents.length}
                </Title>
              </Paper>
            </SimpleGrid>
          )}
          <Divider />
          <DataTable
            columns={discardColumns}
            data={discardedComponents}
            loading={isLoading}
            rowKey={(c) => c.id}
          />
          {discardedComponents.length === 0 && (
            <Text c="dimmed" size="sm" ta="center">
              No discarded components found
            </Text>
          )}
        </>
      )}

      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Add Blood Component"
        position="right"
        size="xl"
      >
        <CreateComponentForm
          onSubmit={(d) => {
            bloodBankService.createBloodComponent(d).then(() => {
              void qc.invalidateQueries({ queryKey: ["blood-bank", "components"] });
              closeCreate();
              toast.success("Blood component registered", { title: "Component added" });
            });
          }}
        />
      </Drawer>

      <Drawer
        opened={!!discardComponent}
        onClose={() => setDiscardComponent(null)}
        title="Discard Blood Component"
        position="right"
        size="md"
      >
        {discardComponent && (
          <DiscardComponentForm
            component={discardComponent}
            onSubmit={(reason, notes) =>
              statusMut.mutate({
                id: discardComponent.id,
                status: "discarded",
                discard_reason: notes ? `${reason}: ${notes}` : reason,
              })
            }
            loading={statusMut.isPending}
          />
        )}
      </Drawer>
    </Stack>
  );
}
