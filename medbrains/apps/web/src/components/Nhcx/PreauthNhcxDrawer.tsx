import { Group, SimpleGrid, Stack, Text, Timeline } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type { NhcxParticipant, NhcxRequestStage, PreauthNhcxView } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, Modal, SegmentedControl, toast } from "@/components/ui";
import { nhcxSettingsService } from "@/services/nhcxSettings.service";
import { NhcxPayerSelect } from "./NhcxPayerSelect";
import { NhcxSetupAlert } from "./NhcxSetupAlert";
import { NhcxSlaBadge } from "./NhcxSlaBadge";
import { nhcxStatusLabel } from "./nhcxSummary";
import { PayerQueryList } from "./PayerQueryList";
import { PreauthStatusCheck } from "./PreauthStatusCheck";

interface PreauthNhcxDrawerProps {
  priorAuthId: string | null;
  paNumber: string;
  onClose: () => void;
}

const POLL_MS = 15_000;
const STAGES: { value: NhcxRequestStage; label: string }[] = [
  { value: "initial", label: "Admission" },
  { value: "enhancement", label: "Enhancement" },
  { value: "discharge", label: "Discharge" },
];

function SendSection({ priorAuthId }: { priorAuthId: string }) {
  const queryClient = useQueryClient();
  const [recipient, setRecipient] = useState<string | null>(null);
  const [payer, setPayer] = useState<NhcxParticipant | undefined>();
  const [stage, setStage] = useState<NhcxRequestStage>("initial");
  const status = useQuery({ queryKey: ["nhcx", "status"], queryFn: nhcxSettingsService.status });
  const send = useMutation({
    mutationFn: () =>
      api.submitPreauthToNhcx(priorAuthId, {
        recipient_code: recipient ?? "",
        request_stage: stage,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["preauth-nhcx", priorAuthId] });
      void queryClient.invalidateQueries({ queryKey: ["nhcx-sla"] });
      void queryClient.invalidateQueries({ queryKey: ["ipd-prior-auth"] });
      toast.success("The payer's decision will appear here.", { title: "Pre-auth sent" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Pre-auth not sent" }),
  });
  return (
    <Card withBorder padding="sm">
      <Stack gap="xs">
        <Text fw={600} size="sm">
          Send to the payer through NHCX
        </Text>
        <NhcxSetupAlert status={status.data} isError={status.isError} />
        <NhcxPayerSelect
          value={recipient}
          onChange={(code, chosen) => {
            setRecipient(code);
            setPayer(chosen);
          }}
        />
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            Stage — a discharge request has 3 hours, the others 1 hour (IRDAI)
          </Text>
          <SegmentedControl
            value={stage}
            onChange={(v) => setStage(v as NhcxRequestStage)}
            data={STAGES}
          />
        </Stack>
        <Group justify="flex-end">
          <Button
            size="xs"
            loading={send.isPending}
            disabled={status.data?.ready !== true || !payer?.has_encryption_cert}
            onClick={() => send.mutate()}
          >
            Send pre-auth
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

function ExchangeSummary({ view }: { view: PreauthNhcxView }) {
  const sent = nhcxStatusLabel(view.nhcx_status);
  const money = (v: string | null) => (v ? `₹${v}` : "—");
  return (
    <Stack gap="xs">
      <Group gap="xs">
        <Badge tone={sent.tone}>{sent.label}</Badge>
        <NhcxSlaBadge sla={view.sla} />
      </Group>
      {view.nhcx_status === "send_failed" && view.nhcx_disposition && (
        <Alert tone="danger" title="NHCX did not accept the pre-auth">
          {view.nhcx_disposition}
        </Alert>
      )}
      <SimpleGrid cols={2} spacing="xs">
        <Text size="xs" c="dimmed">
          Estimated
        </Text>
        <Text size="sm">{money(view.estimated_cost)}</Text>
        <Text size="xs" c="dimmed">
          Approved
        </Text>
        <Text size="sm">{money(view.approved_amount)}</Text>
        <Text size="xs" c="dimmed">
          Payer's reference
        </Text>
        <Text size="sm">{view.auth_number ?? "—"}</Text>
        <Text size="xs" c="dimmed">
          Correlation ID
        </Text>
        <Text size="xs" ff="monospace">
          {view.nhcx_correlation_id ?? "—"}
        </Text>
      </SimpleGrid>
    </Stack>
  );
}

function PreauthTimeline({ view }: { view: PreauthNhcxView }) {
  if (view.timeline.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Nothing has happened on this pre-auth yet.
      </Text>
    );
  }
  return (
    <Timeline active={view.timeline.length - 1} bulletSize={16} lineWidth={2}>
      {view.timeline.map((e) => (
        <Timeline.Item key={`${e.kind}-${e.at}`} title={e.label}>
          <Text size="xs" c="dimmed">
            {new Date(e.at).toLocaleString()}
            {e.amount ? ` · ₹${e.amount}` : ""}
          </Text>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

/** One pre-authorisation's NHCX exchange: send it, follow it, answer the payer. */
export function PreauthNhcxDrawer({ priorAuthId, paNumber, onClose }: PreauthNhcxDrawerProps) {
  const canView = useHasPermission(P.INSURANCE.NHCX.VIEW);
  const canSubmit = useHasPermission(P.INSURANCE.NHCX.SUBMIT);
  const view = useQuery({
    queryKey: ["preauth-nhcx", priorAuthId],
    queryFn: () => api.getPreauthNhcx(priorAuthId ?? ""),
    enabled: canView && !!priorAuthId,
    refetchInterval: (q) => (q.state.data?.sla.state === "running" ? POLL_MS : false),
  });
  return (
    <Modal
      opened={!!priorAuthId}
      onClose={onClose}
      fullScreen
      title={`Pre-auth ${paNumber} — NHCX`}
    >
      {priorAuthId && (
        <Stack gap="md">
          {canSubmit && <SendSection priorAuthId={priorAuthId} />}
          {!canView ? null : view.isError ? (
            <Alert tone="warning" title="Could not load the exchange">
              Where this pre-auth stands is unknown right now — try again in a minute.
            </Alert>
          ) : view.data ? (
            <>
              <ExchangeSummary view={view.data} />
              {canSubmit && view.data.nhcx_recipient_code && (
                <PreauthStatusCheck priorAuthId={priorAuthId} />
              )}
              <Text fw={600} size="sm">
                Timeline
              </Text>
              <PreauthTimeline view={view.data} />
              <Text fw={600} size="sm">
                Payer queries
              </Text>
              <PayerQueryList
                priorAuthId={priorAuthId}
                queries={view.data.queries}
                documents={view.data.documents}
              />
            </>
          ) : (
            <Text size="sm" c="dimmed">
              Loading…
            </Text>
          )}
        </Stack>
      )}
    </Modal>
  );
}
