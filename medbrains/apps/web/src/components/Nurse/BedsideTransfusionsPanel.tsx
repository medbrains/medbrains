import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type { BedsideTransfusion } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconActivity, IconDroplet, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { PrintDocumentIconMenu } from "@/components/Print/PrintDocumentIconMenu";
import { Alert, Badge, Button, Modal, NumberField, toast } from "@/components/ui";
import { TransfusionMonitorDrawer } from "@/pages/blood-bank/TransfusionMonitorDrawer";
import { ipdService } from "@/services/ipd.service";
import { StartTransfusionModal } from "./StartTransfusionModal";

interface Props {
  admissionId: string;
}

const formatTime = (value: string | null) => (value ? new Date(value).toLocaleString() : "—");

/**
 * Units hung at this bed — start (with the two-person check), watch through
 * the monitoring drawer, take down. Reads the bedside `transfusions` chart,
 * not the blood bank's issue register.
 */
export function BedsideTransfusionsPanel({ admissionId }: Props) {
  const qc = useQueryClient();
  const canView = useHasPermission(P.NURSE.TRANSFUSION_VIEW);
  const canAdminister = useHasPermission(P.NURSE.TRANSFUSION_ADMINISTER);
  const [startOpen, start] = useDisclosure(false);
  const [monitorId, setMonitorId] = useState<string | null>(null);
  const [completing, setCompleting] = useState<BedsideTransfusion | null>(null);
  const [infusedMl, setInfusedMl] = useState<number | "">("");

  const queryKey = ["bedside-transfusions", admissionId];
  const {
    data = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () => ipdService.listBedsideTransfusions(admissionId),
    enabled: canView,
  });

  const completeMut = useMutation({
    mutationFn: (t: BedsideTransfusion) =>
      ipdService.completeBedsideTransfusion(t.id, {
        total_volume_infused_ml: infusedMl === "" ? undefined : infusedMl,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey });
      toast.success("Transfusion completed — record the completion observation");
      setCompleting(null);
      setInfusedMl("");
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not complete transfusion" }),
  });

  if (!canView) return null;

  const columns = [
    {
      key: "bag_number",
      label: "Bag",
      render: (t: BedsideTransfusion) => (
        <Text size="sm" ff="monospace">
          {t.bag_number ?? "—"}
        </Text>
      ),
    },
    {
      key: "product_type",
      label: "Product",
      render: (t: BedsideTransfusion) =>
        `${(t.product_type ?? "—").toUpperCase()} · ${t.blood_group ?? "?"}${t.rh_factor ?? ""}`,
    },
    {
      key: "transfusion_start_time",
      label: "Started",
      render: (t: BedsideTransfusion) => formatTime(t.transfusion_start_time),
    },
    {
      key: "transfusion_end_time",
      label: "Status",
      render: (t: BedsideTransfusion) => (
        <Group gap={4}>
          {t.transfusion_end_time ? (
            <Badge tone="neutral">Completed {formatTime(t.transfusion_end_time)}</Badge>
          ) : (
            <Badge tone="success">Running</Badge>
          )}
          {t.adverse_reaction && <Badge tone="danger">Reaction: {t.reaction_type ?? "yes"}</Badge>}
        </Group>
      ),
    },
    {
      key: "id",
      label: "Actions",
      render: (t: BedsideTransfusion) => (
        <Group gap={4} wrap="nowrap">
          <Button
            tone="ghost"
            size="compact-xs"
            leftSection={<IconActivity size={14} />}
            onClick={() => setMonitorId(t.id)}
          >
            Monitor
          </Button>
          {canAdminister && !t.transfusion_end_time && (
            <Button tone="secondary" size="compact-xs" onClick={() => setCompleting(t)}>
              Complete
            </Button>
          )}
          <PrintDocumentIconMenu
            idKind="bedside_transfusion"
            recordId={t.id}
            recordLabel={`transfusion ${t.bag_number ?? ""}`.trim()}
          />
        </Group>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group gap="xs">
          <IconDroplet size={18} />
          <Text fw={600}>Blood transfusions</Text>
        </Group>
        {canAdminister && (
          <Button
            size="xs"
            tone="primary"
            leftSection={<IconPlus size={14} />}
            onClick={start.open}
          >
            Start transfusion
          </Button>
        )}
      </Group>
      {isError ? (
        <Alert tone="danger" title="Transfusions could not be loaded">
          This is a fault, not an empty chart. Do not assume no unit is running on this patient.
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          data={data}
          loading={isLoading}
          rowKey={(t) => t.id}
          emptyTitle="No transfusions on this admission"
        />
      )}

      <StartTransfusionModal admissionId={admissionId} opened={startOpen} onClose={start.close} />
      <TransfusionMonitorDrawer transfusionId={monitorId} onClose={() => setMonitorId(null)} />
      <Modal
        opened={completing !== null}
        onClose={() => setCompleting(null)}
        title="Complete transfusion"
        primaryAction={{
          label: "Unit is down",
          onClick: () => completing && completeMut.mutate(completing),
          loading: completeMut.isPending,
        }}
        secondaryAction={{ label: "Cancel", onClick: () => setCompleting(null) }}
      >
        <NumberField
          label="Total volume infused (ml)"
          value={infusedMl}
          onChange={(v) => setInfusedMl(v === "" ? "" : Number(v))}
          min={0}
        />
      </Modal>
    </Stack>
  );
}
