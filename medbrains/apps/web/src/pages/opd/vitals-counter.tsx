// OPD vitals counter — who is still waiting to have vitals taken, and the
// form to take them.
//
// A crowded OPD registers a patient in seconds and sends them on. This is the
// station in between: the nurse works a list, not a search box. Once vitals are
// recorded the patient drops off this list and the doctor sees them with
// numbers and a complaint already attached.

import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { CreateVitalRequest, QueueEntry } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconDeviceHeartMonitor } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Column } from "@/components";
import { DataTable, EmptyState, OperationalSignal, VitalsRecorder } from "@/components";
import { Button, Modal, toast } from "@/components/ui";
import { opdService } from "@/services/opd.service";
import { formatQueueToken } from "./shared";

/// A patient still waiting at the counter: in today's queue, no vitals yet, and
/// not already finished or gone.
function isAwaitingVitals(row: QueueEntry): boolean {
  return !row.has_vitals && row.status !== "completed" && row.status !== "no_show";
}

interface OpdVitalsCounterProps {
  departmentId?: string;
  date?: string;
}

export function OpdVitalsCounter({ departmentId, date }: OpdVitalsCounterProps) {
  const { t } = useTranslation("opd");
  const queryClient = useQueryClient();
  const canRecord = useHasPermission(P.OPD.VITALS.CREATE);
  const [active, setActive] = useState<QueueEntry | null>(null);

  const params = useMemo(() => {
    const next: Record<string, string> = {};
    if (departmentId) next.department_id = departmentId;
    if (date) next.date = date;
    return next;
  }, [departmentId, date]);

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["opd-queue", params],
    queryFn: () => opdService.listQueue(params),
  });

  const waiting = useMemo(() => queue.filter(isAwaitingVitals), [queue]);

  const record = useMutation({
    mutationFn: ({ encounterId, vitals }: { encounterId: string; vitals: CreateVitalRequest }) =>
      opdService.createVital(encounterId, vitals),
    onSuccess: () => {
      // The department's other screens are nudged over the live stream; this
      // one refreshes directly because it is the tab that just acted.
      void queryClient.invalidateQueries({ queryKey: ["opd-queue"] });
      toast.success(t("vitalsCounter.recorded"), { title: t("vitalsCounter.recordedTitle") });
      setActive(null);
    },
    onError: () => {
      toast.error(t("vitalsCounter.recordFailed"), { title: t("common.error") });
    },
  });

  const columns = [
    {
      key: "token_number",
      label: t("queueColumns.token"),
      sortable: true,
      sortValue: (row: QueueEntry) => row.token_number,
      accessor: (row: QueueEntry) => formatQueueToken(row.token_number),
      render: (row: QueueEntry) => (
        <OperationalSignal
          label={t("queueSignals.token")}
          shape="token"
          tone="ready"
          value={formatQueueToken(row.token_number)}
        />
      ),
    },
    {
      key: "patient_name",
      label: t("queueColumns.patient"),
      searchable: true,
      accessor: (row: QueueEntry) => row.patient_name ?? row.uhid ?? "",
      render: (row: QueueEntry) => (
        <Stack gap={2}>
          <Text size="sm" fw={600}>
            {row.patient_name ?? t("queueFallback.patient")}
          </Text>
          <Text size="xs" c="dimmed">
            {row.uhid ?? t("queueFallback.uhid")}
          </Text>
        </Stack>
      ),
    },
    {
      key: "chief_complaint",
      label: t("queueColumns.complaint"),
      searchable: true,
      accessor: (row: QueueEntry) => row.chief_complaint ?? "",
      render: (row: QueueEntry) =>
        row.chief_complaint ? (
          <Text size="sm" lineClamp={2}>
            {row.chief_complaint}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            {t("queue.noComplaint")}
          </Text>
        ),
    },
    {
      key: "actions",
      label: t("queueColumns.actions"),
      render: (row: QueueEntry) =>
        canRecord ? (
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconDeviceHeartMonitor size={16} />}
            onClick={() => setActive(row)}
          >
            {t("vitalsCounter.record")}
          </Button>
        ) : null,
    },
  ] satisfies Column<QueueEntry>[];

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed">
          {t("vitalsCounter.waitingCount", { count: waiting.length })}
        </Text>
      </Group>

      {!isLoading && waiting.length === 0 ? (
        <EmptyState
          icon={<IconDeviceHeartMonitor size={32} />}
          title={t("vitalsCounter.emptyTitle")}
          description={t("vitalsCounter.emptyBody")}
        />
      ) : (
        <DataTable
          columns={columns}
          data={waiting}
          loading={isLoading}
          rowKey={(row: QueueEntry) => row.id}
        />
      )}

      <Modal
        opened={active !== null}
        onClose={() => setActive(null)}
        title={
          active
            ? t("vitalsCounter.modalTitle", {
                token: formatQueueToken(active.token_number),
                patient: active.patient_name ?? t("queueFallback.patient"),
              })
            : ""
        }
        size="lg"
      >
        {active && (
          <VitalsRecorder
            isSubmitting={record.isPending}
            onCancel={() => setActive(null)}
            onSubmit={(vitals) => record.mutate({ encounterId: active.encounter_id, vitals })}
          />
        )}
      </Modal>
    </Stack>
  );
}
