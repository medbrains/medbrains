import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { NhcxAttachableDocument, NhcxPayerQuery } from "@medbrains/types";
import { P } from "@medbrains/types";
import { Alert, Badge, Card } from "@/components/ui";
import { nhcxStatusLabel } from "./nhcxSummary";
import { PayerQueryAnswerForm } from "./PayerQueryAnswerForm";

interface PayerQueryListProps {
  priorAuthId: string;
  queries: NhcxPayerQuery[];
  documents: NhcxAttachableDocument[];
}

const when = (at: string) => new Date(at).toLocaleString();

function QueryCard({
  q,
  priorAuthId,
  documents,
}: { q: NhcxPayerQuery } & Omit<PayerQueryListProps, "queries">) {
  const canRespond = useHasPermission(P.INSURANCE.NHCX.RESPOND);
  const sendFailed = q.nhcx_status === "send_failed";
  const canAnswer = canRespond && (q.status === "open" || sendFailed);
  const sent = nhcxStatusLabel(q.nhcx_status);
  return (
    <Card withBorder padding="sm">
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Asked {when(q.received_at)}
            {q.due_at ? ` · answer by ${when(q.due_at)}` : " · no due time given"}
          </Text>
          <Badge tone={q.status === "open" ? "warning" : "success"}>
            {q.status === "open" ? "Waiting for our answer" : "Answered"}
          </Badge>
        </Group>
        <Text size="sm">{q.question}</Text>
        {q.requested_items.length > 0 && (
          <Text size="sm">Asked for: {q.requested_items.join(", ")}</Text>
        )}
        {q.answer_text && (
          <Stack gap={2}>
            <Group gap="xs">
              <Text size="xs" c="dimmed">
                Our answer{q.answered_at ? `, ${when(q.answered_at)}` : ""}
              </Text>
              <Badge size="sm" tone={sent.tone}>
                {sent.label}
              </Badge>
            </Group>
            <Text size="sm">{q.answer_text}</Text>
          </Stack>
        )}
        {sendFailed && q.nhcx_disposition && (
          <Alert tone="danger" title="NHCX did not accept the answer — send it again">
            {q.nhcx_disposition}
          </Alert>
        )}
        {canAnswer && (
          <PayerQueryAnswerForm queryId={q.id} priorAuthId={priorAuthId} documents={documents} />
        )}
      </Stack>
    </Card>
  );
}

/** The payer's questions on a pre-authorisation, open ones first. */
export function PayerQueryList({ priorAuthId, queries, documents }: PayerQueryListProps) {
  if (queries.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        The payer has not asked for anything.
      </Text>
    );
  }
  const sorted = [...queries].sort(
    (a, b) => Number(b.status === "open") - Number(a.status === "open"),
  );
  return (
    <Stack gap="sm">
      {sorted.map((q) => (
        <QueryCard key={q.id} q={q} priorAuthId={priorAuthId} documents={documents} />
      ))}
    </Stack>
  );
}
