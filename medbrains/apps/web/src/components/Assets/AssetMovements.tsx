/**
 * Asset movement ledger + inter-department request workflow.
 *
 * `MoveAssetModal` records a movement for one asset — either a direct
 * transfer (custodian relocates it now) or a request another department
 * raises for the custodian to satisfy. `AssetMovementsTab` is the ledger /
 * worklist: open requests can be completed (relocates the asset) or rejected.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { AssetMovement, UnifiedAsset } from "@medbrains/types";
import { IconArrowRight, IconCheck, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import type { Column } from "@/components/DataTable";
import { DataTable } from "@/components/DataTable";
import {
  Badge,
  type BadgeTone,
  Button,
  IconButton,
  Input,
  Modal,
  Select,
  TextArea,
} from "@/components/ui";
import { assetsService } from "@/services/assets.service";

const MOVEMENT_TYPES = [
  { value: "transfer", label: "Transfer (department → department)" },
  { value: "issue", label: "Issue (out to a department)" },
  { value: "return", label: "Return (back to store)" },
  { value: "repair", label: "Send for repair" },
  { value: "disposal", label: "Disposal / condemnation" },
];

const STATUS_TONE: Record<AssetMovement["status"], BadgeTone> = {
  requested: "warning",
  completed: "success",
  rejected: "danger",
  cancelled: "neutral",
};

const schema = z.object({
  movement_type: z.string().min(1),
  to_department_id: z.string().optional(),
  to_location: z.string().optional(),
  reason: z.string().optional(),
  complete_now: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function MoveAssetModal({
  asset,
  opened,
  canManage,
  onClose,
}: {
  asset: UnifiedAsset | null;
  opened: boolean;
  canManage: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: departments = [] } = useQuery({
    queryKey: ["assets-departments"],
    queryFn: () => assetsService.listDepartments(),
    staleTime: 300_000,
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { movement_type: "transfer", complete_now: canManage },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!asset) throw new Error("no asset");
      return assetsService.createAssetMovement({
        source_type: asset.source_type,
        source_id: asset.source_id,
        movement_type: values.movement_type,
        to_department_id: values.to_department_id || undefined,
        to_location: values.to_location?.trim() || undefined,
        reason: values.reason?.trim() || undefined,
        complete_now: values.complete_now,
      });
    },
    onSuccess: async (row) => {
      notifications.show({
        color: "green",
        message: row.status === "completed" ? "Asset moved" : "Movement requested",
      });
      reset({ movement_type: "transfer", complete_now: canManage });
      onClose();
      await qc.invalidateQueries({ queryKey: ["asset-movements"] });
      await qc.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const deptOptions = departments.map((d) => ({ value: d.id, label: d.name }));

  return (
    <Modal opened={opened} onClose={onClose} title={asset ? `Move — ${asset.name}` : "Move asset"}>
      <Stack gap="sm">
        <Controller
          control={control}
          name="movement_type"
          render={({ field }) => (
            <Select
              label="Movement type"
              data={MOVEMENT_TYPES}
              value={field.value}
              onChange={(v) => field.onChange(v ?? "transfer")}
              error={errors.movement_type?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="to_department_id"
          render={({ field }) => (
            <Select
              label="To department"
              placeholder="Select destination department"
              data={deptOptions}
              searchable
              clearable
              value={field.value ?? null}
              onChange={(v) => field.onChange(v ?? undefined)}
            />
          )}
        />
        <Controller
          control={control}
          name="to_location"
          render={({ field }) => (
            <Input
              label="To location (optional)"
              placeholder="e.g. Ward 3, Room 12"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.currentTarget.value)}
            />
          )}
        />
        <Controller
          control={control}
          name="reason"
          render={({ field }) => (
            <TextArea
              label="Reason"
              autosize
              minRows={2}
              placeholder="Why is this asset being moved / requested?"
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.currentTarget.value)}
            />
          )}
        />
        {canManage && (
          <Controller
            control={control}
            name="complete_now"
            render={({ field }) => (
              <Select
                label="Action"
                data={[
                  { value: "now", label: "Move now (relocate immediately)" },
                  { value: "request", label: "Raise as a request to satisfy later" },
                ]}
                value={field.value ? "now" : "request"}
                onChange={(v) => field.onChange(v === "now")}
              />
            )}
          />
        )}
        <Button
          tone="primary"
          loading={mutation.isPending}
          onClick={() => void handleSubmit((v) => mutation.mutate(v))()}
        >
          {canManage ? "Save movement" : "Raise request"}
        </Button>
      </Stack>
    </Modal>
  );
}

export function AssetMovementsTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["asset-movements"],
    queryFn: () => assetsService.listAssetMovements(),
    refetchInterval: 60_000,
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => assetsService.completeAssetMovement(id),
    onSuccess: async () => {
      notifications.show({ color: "green", message: "Movement completed — asset relocated" });
      await qc.invalidateQueries({ queryKey: ["asset-movements"] });
      await qc.invalidateQueries({ queryKey: ["assets"] });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });
  const rejectMutation = useMutation({
    mutationFn: (id: string) => assetsService.rejectAssetMovement(id, {}),
    onSuccess: async () => {
      notifications.show({ color: "orange", message: "Movement rejected" });
      await qc.invalidateQueries({ queryKey: ["asset-movements"] });
    },
    onError: (e: Error) => notifications.show({ color: "red", message: e.message }),
  });

  const columns: Column<AssetMovement>[] = [
    {
      key: "asset",
      label: "Asset",
      render: (r) => (
        <Stack gap={0}>
          <Text size="sm" fw={600} lineClamp={1}>
            {r.asset_name ?? "—"}
          </Text>
          {r.asset_code && (
            <Text size="xs" c="dimmed" ff="monospace">
              {r.asset_code}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "type",
      label: "Type",
      render: (r) => (
        <Badge size="xs" tone="info">
          {r.movement_type}
        </Badge>
      ),
    },
    {
      key: "route",
      label: "From → To",
      render: (r) => (
        <Group gap={6} wrap="nowrap">
          <Text size="sm">{r.from_department_name ?? r.from_location ?? "—"}</Text>
          <IconArrowRight size={14} stroke={1.5} />
          <Text size="sm" fw={600}>
            {r.to_department_name ?? r.to_location ?? "—"}
          </Text>
        </Group>
      ),
    },
    {
      key: "reason",
      label: "Reason",
      render: (r) => (
        <Text size="xs" lineClamp={2}>
          {r.reason ?? r.rejection_reason ?? "—"}
        </Text>
      ),
    },
    {
      key: "by",
      label: "Requested by",
      render: (r) => <Text size="xs">{r.requested_by_name ?? "—"}</Text>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge size="xs" tone={STATUS_TONE[r.status]}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "action",
      label: "",
      render: (r) =>
        canManage && r.status === "requested" ? (
          <Group gap={4} wrap="nowrap">
            <IconButton
              tone="primary"
              size="sm"
              aria-label="Complete movement"
              loading={completeMutation.isPending}
              onClick={() => completeMutation.mutate(r.id)}
            >
              <IconCheck size={15} />
            </IconButton>
            <IconButton
              tone="danger"
              size="sm"
              aria-label="Reject movement"
              loading={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate(r.id)}
            >
              <IconX size={15} />
            </IconButton>
          </Group>
        ) : null,
    },
  ];

  return (
    <DataTable<AssetMovement>
      columns={columns}
      data={movements}
      loading={isLoading}
      rowKey={(r) => r.id}
      searchable
      searchPlaceholder="Search asset, department, reason"
      filters={[
        {
          key: "status",
          label: "Status",
          options: [
            { value: "requested", label: "Open requests" },
            { value: "completed", label: "Completed" },
            { value: "rejected", label: "Rejected" },
          ],
          matches: (r, v) => r.status === v,
        },
      ]}
      emptyIcon={<IconArrowRight size={28} stroke={1.5} />}
      emptyTitle="No asset movements yet"
    />
  );
}
