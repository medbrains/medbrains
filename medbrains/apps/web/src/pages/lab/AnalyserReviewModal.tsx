/**
 * Resolve one held analyser message: read what the analyser sent and why it
 * was held, then attach it to the right order or dismiss it with a reason.
 */
import { Code, Group, Stack, Text } from "@mantine/core";
import type { HeldAnalyserMessage } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Input, Modal, Select, Table, TextArea } from "@/components/ui";
import { labService } from "@/services/lab.service";

interface AnalyserReviewModalProps {
  message: HeldAnalyserMessage | null;
  onClose: () => void;
}

export function AnalyserReviewModal({ message, onClose }: AnalyserReviewModalProps) {
  const queryClient = useQueryClient();
  const [barcode, setBarcode] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const candidates = useQuery({
    queryKey: ["analyser-review-candidates", message?.id, barcode],
    queryFn: () => labService.listAnalyserCandidateOrders(message?.id ?? "", barcode || undefined),
    enabled: message !== null,
  });
  const done = () => {
    void queryClient.invalidateQueries({ queryKey: ["analyser-review"] });
    setOrderId(null);
    setReason("");
    setBarcode("");
    onClose();
  };
  const attach = useMutation({
    mutationFn: () => labService.attachAnalyserResults(message?.id ?? "", orderId ?? ""),
    onSuccess: done,
  });
  const dismiss = useMutation({
    mutationFn: () => labService.dismissAnalyserResults(message?.id ?? "", reason.trim()),
    onSuccess: done,
  });
  const results = message?.mapped_data?.results ?? [];
  const ids = message?.mapped_data?.identifiers;
  const failure = (attach.error ?? dismiss.error) as Error | null;

  return (
    <Modal opened={message !== null} onClose={onClose} title="Held analyser results" fullScreen>
      {message && (
        <Stack gap="md">
          <Alert tone="warning" title="Why these were held">
            {message.reason ?? "No reason was recorded."}
          </Alert>
          <Text size="sm">
            {message.device_name} · sample {ids?.sample_barcode ?? "with no barcode"} · patient{" "}
            {ids?.patient_id ?? "not named"}
          </Text>
          <Table aria-label="Results the analyser sent">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Test</Table.Th>
                <Table.Th>Value</Table.Th>
                <Table.Th>Unit</Table.Th>
                <Table.Th>Reference range</Table.Th>
                <Table.Th>Analyser flag</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Notes</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {results.map((r) => (
                <Table.Tr key={r.test_code}>
                  <Table.Td>
                    {r.test_name ? `${r.test_code} (${r.test_name})` : r.test_code}
                  </Table.Td>
                  <Table.Td>{r.value}</Table.Td>
                  <Table.Td>{r.unit ?? "—"}</Table.Td>
                  <Table.Td>{r.reference_range ?? "—"}</Table.Td>
                  <Table.Td>{r.abnormal_flag ?? "—"}</Table.Td>
                  <Table.Td>{r.status ?? "—"}</Table.Td>
                  <Table.Td>{r.notes ?? ""}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {results.length === 0 && <Text size="sm">The message carried no results.</Text>}

          <Stack gap="xs">
            <Text fw={600}>Attach to an order</Text>
            <Input
              label="Search by sample barcode"
              description="Orders with the message's barcode or for its patient are listed."
              value={barcode}
              onChange={(e) => setBarcode(e.currentTarget.value)}
            />
            {candidates.isError && (
              <Alert tone="danger" title="Orders could not be loaded">
                {(candidates.error as Error).message}
              </Alert>
            )}
            <Select
              label="Lab order"
              placeholder={
                candidates.data?.length === 0 ? "No open order matches" : "Choose the order"
              }
              data={(candidates.data ?? []).map((o) => ({
                value: o.order_id,
                label: `${o.sample_barcode ?? "no barcode"} · ${o.test_name} · ${o.patient_name} (${o.uhid}) · ${o.status}`,
              }))}
              value={orderId}
              onChange={setOrderId}
              disabled={candidates.isLoading}
            />
            <Group>
              <Button
                tone="primary"
                disabled={!orderId}
                loading={attach.isPending}
                onClick={() => attach.mutate()}
              >
                Attach results to this order
              </Button>
            </Group>
          </Stack>

          <Stack gap="xs">
            <Text fw={600}>Or dismiss</Text>
            <TextArea
              label="Reason"
              description="For example: QC run, rerun under a new barcode."
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
            />
            <Group>
              <Button
                tone="danger"
                disabled={reason.trim().length < 3}
                loading={dismiss.isPending}
                onClick={() => dismiss.mutate()}
              >
                Dismiss without posting
              </Button>
            </Group>
          </Stack>

          {failure && (
            <Alert tone="danger" title="That did not work">
              {failure.message}
            </Alert>
          )}
          {message.raw && (
            <Stack gap="xs">
              <Text fw={600}>As the analyser sent it</Text>
              <Code block>{message.raw.replaceAll("\r", "\n")}</Code>
            </Stack>
          )}
        </Stack>
      )}
    </Modal>
  );
}
