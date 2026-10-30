import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type StoreReturnRow } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DataTable } from "@/components";
import { Alert, Badge, Button, Checkbox, Modal, TextArea, toast } from "@/components/ui";
import { storefrontService } from "@/services/storefront.service";
import { quarantineReasonLabel, RETURN_REASONS } from "../store/storefront-p2";

const STATUS_TONE = {
  requested: "warning",
  acknowledged: "info",
  received: "success",
  refused: "neutral",
} as const;

/**
 * Online returns as grievances: acknowledged within 48 hours, resolved
 * within 30 days. Receiving a return records whether each pack is sealed;
 * the law decides whether it goes back on the shelf or to quarantine.
 */
export function OnlineReturns() {
  const canHandle = useHasPermission(P.PHARMACY.STOREFRONT.RETURNS);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<StoreReturnRow | null>(null);
  const queue = useQuery({
    queryKey: ["storefront-returns"],
    queryFn: () => storefrontService.listStorefrontReturns(),
    enabled: canHandle,
  });
  const patients = useMemo(
    () => new Map((queue.data?.patients ?? []).map((p) => [p.id, p])),
    [queue.data?.patients],
  );
  const acknowledge = useMutation({
    mutationFn: (id: string) => storefrontService.acknowledgeStorefrontReturn(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["storefront-returns"] }),
    onError: (e: Error) => toast.error(e.message, { title: "Not acknowledged" }),
  });
  if (!canHandle) return null;
  if (queue.isError) {
    return (
      <Alert tone="danger" title="Returns could not be loaded">
        This is not an empty list. Try again in a moment.
      </Alert>
    );
  }
  const columns = [
    {
      key: "patient",
      label: "Patient",
      render: (r: StoreReturnRow) => (
        <Stack gap={0}>
          <Text size="sm" fw={600}>
            {patients.get(r.patient_id)?.full_name ?? "Patient"}
          </Text>
          <Text size="xs" c="dimmed">
            {r.complaint_code}
          </Text>
        </Stack>
      ),
    },
    {
      key: "what",
      label: "Coming back",
      render: (r: StoreReturnRow) => (
        <Text size="sm">
          {RETURN_REASONS.find((x) => x.value === r.reason)?.label}:{" "}
          {r.lines.map((l) => `${l.drug_name} × ${l.quantity}`).join(", ")}
        </Text>
      ),
    },
    {
      key: "due",
      label: "Due",
      render: (r: StoreReturnRow) => {
        const late = !r.acknowledged_at && new Date(r.ack_due_at).getTime() < Date.now();
        return (
          <Text size="xs" c={late ? "red" : undefined}>
            {r.acknowledged_at
              ? `Resolve by ${new Date(r.resolve_due_at).toLocaleDateString()}`
              : `Acknowledge by ${new Date(r.ack_due_at).toLocaleString()}`}
          </Text>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (r: StoreReturnRow) => (
        <Badge size="sm" tone={STATUS_TONE[r.status]}>
          {r.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (r: StoreReturnRow) =>
        r.status === "requested" || r.status === "acknowledged" ? (
          <Group gap="xs" wrap="nowrap">
            {r.status === "requested" && (
              <Button size="xs" tone="secondary" onClick={() => acknowledge.mutate(r.id)}>
                Acknowledge
              </Button>
            )}
            <Button size="xs" tone="primary" onClick={() => setOpen(r)}>
              Receive
            </Button>
          </Group>
        ) : (
          <Text size="xs">
            {r.lines
              .filter((l) => l.disposition)
              .map(
                (l) =>
                  `${l.drug_name}: ${l.disposition === "restocked" ? "back to stock" : `quarantined (${l.reasons.map(quarantineReasonLabel).join(", ")})`}`,
              )
              .join("; ")}
          </Text>
        ),
    },
  ];
  return (
    <>
      <DataTable
        columns={columns}
        data={queue.data?.returns ?? []}
        loading={queue.isLoading}
        rowKey={(r) => r.id}
        emptyTitle="No returns"
      />
      <ReceiveReturn row={open} onClose={() => setOpen(null)} />
    </>
  );
}

function ReceiveReturn({ row, onClose }: { row: StoreReturnRow | null; onClose: () => void }) {
  return (
    <Modal opened={row !== null} onClose={onClose} title="Receive the return">
      {row && <ReceiveBody key={row.id} row={row} onDone={onClose} />}
    </Modal>
  );
}

function ReceiveBody({ row, onDone }: { row: StoreReturnRow; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [sealed, setSealed] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ["storefront-returns"] });
    void queryClient.invalidateQueries({ queryKey: ["storefront-refunds"] });
    onDone();
  };
  const receive = useMutation({
    mutationFn: () =>
      storefrontService.receiveStorefrontReturn(row.id, {
        lines: row.lines.map((l) => ({ line_id: l.id, sealed: sealed[l.id] ?? false })),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: (r) => {
      toast.success(`Credit note ${r.credit_note_number}. The refund is in the refunds list.`, {
        title: "Return received",
      });
      done();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not received" }),
  });
  const refuse = useMutation({
    mutationFn: () => storefrontService.refuseStorefrontReturn(row.id, note),
    onSuccess: () => {
      toast.success("The patient sees your reason.", { title: "Return refused" });
      done();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not refused" }),
  });
  return (
    <Stack gap="sm">
      <Text size="sm">
        Tick each pack whose manufacturer's seal is unbroken. Only a sealed, in-date pack that was
        never refrigerated or controlled goes back on the shelf; the rest is quarantined for
        destruction.
      </Text>
      {row.lines.map((l) => (
        <Checkbox
          key={l.id}
          label={`${l.drug_name} × ${l.quantity}: seal unbroken`}
          checked={sealed[l.id] ?? false}
          onChange={(e) => setSealed((s) => ({ ...s, [l.id]: e.currentTarget.checked }))}
        />
      ))}
      <TextArea
        label="Note"
        description="Required to refuse: the patient is told it"
        value={note}
        onChange={(e) => setNote(e.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button
          tone="secondary"
          disabled={!note.trim()}
          loading={refuse.isPending}
          onClick={() => refuse.mutate()}
        >
          Refuse
        </Button>
        <Button tone="primary" loading={receive.isPending} onClick={() => receive.mutate()}>
          Receive and refund
        </Button>
      </Group>
    </Stack>
  );
}
