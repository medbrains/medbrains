import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type { NhcxFoundClaim } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, Badge, Card, SegmentedControl, Table } from "@/components/ui";
import { rupees } from "./claimNhcx";
import { NhcxSearchForm } from "./NhcxSearchForm";
import { nhcxStatusLabel } from "./nhcxSummary";

const POLL_MS = 15_000;

type OutcomeFilter = "all" | "complete" | "partial" | "queued" | "error";

const OUTCOMES: { value: OutcomeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "complete", label: "Decided" },
  { value: "partial", label: "Part-decided" },
  { value: "queued", label: "Pending" },
  { value: "error", label: "Error" },
];

/**
 * Search a payer's records through NHCX (`hcx/search`) by date range, and
 * read its answer. The NRCeS search Task takes a date range and claim
 * number only, so the status filter applies to the payer's answer here.
 */
export function NhcxSearchPanel() {
  const canSubmit = useHasPermission(P.INSURANCE.NHCX.SUBMIT);
  const canView = useHasPermission(P.INSURANCE.NHCX.VIEW);
  const [outcome, setOutcome] = useState<OutcomeFilter>("all");
  const searches = useQuery({
    queryKey: ["nhcx-searches"],
    queryFn: () => api.listNhcxSearches(),
    enabled: canView,
    refetchInterval: (q) => (q.state.data?.some((s) => !s.result) ? POLL_MS : false),
  });
  const latest = searches.data?.[0];
  // The payer's list may name a claim twice; its position keeps rows apart.
  const found = useMemo<(NhcxFoundClaim & { rowKey: string })[]>(
    () =>
      (latest?.result?.claims ?? [])
        .map((c, at) => ({ ...c, rowKey: `${c.claim_ref ?? "claim"}-${at}` }))
        .filter((c) => outcome === "all" || c.outcome === outcome),
    [latest, outcome],
  );
  if (!canSubmit && !canView) return null;
  const sent = nhcxStatusLabel(latest?.nhcx_status ?? null);
  return (
    <Card withBorder padding="sm" mt="lg">
      <Stack gap="sm">
        <Text fw={600}>Search a payer's claims (NHCX)</Text>
        {canSubmit && <NhcxSearchForm />}
        {canView && searches.isError && (
          <Alert tone="warning" title="Could not load the searches">
            Whether the payer has answered is unknown right now — try again in a minute.
          </Alert>
        )}
        {canView && latest && (
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm">
                {latest.recipient_code}: {latest.request.from_date} to {latest.request.to_date}
                {latest.request.claim_number ? ` · claim ${latest.request.claim_number}` : ""}
              </Text>
              <Badge tone={sent.tone}>{latest.result ? "Payer answered" : sent.label}</Badge>
            </Group>
            {latest.result?.error && (
              <Alert tone="danger" title="The payer returned an error">
                {latest.result.error}
              </Alert>
            )}
            <SegmentedControl
              size="xs"
              value={outcome}
              onChange={(v) => setOutcome(v as OutcomeFilter)}
              data={OUTCOMES}
            />
            {!latest.result ? (
              <Text size="sm" c="dimmed">
                Waiting for the payer's answer.
              </Text>
            ) : found.length === 0 ? (
              <Text size="sm" c="dimmed">
                The payer listed no claims{outcome === "all" ? "" : " with this status"}.
              </Text>
            ) : (
              <Table verticalSpacing={4} fz="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Payer's claim number</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Claimed</Table.Th>
                    <Table.Th>Approved</Table.Th>
                    <Table.Th>Payer's note</Table.Th>
                    <Table.Th>Here</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {found.map((c) => (
                    <Table.Tr key={c.rowKey}>
                      <Table.Td>{c.claim_ref ?? "—"}</Table.Td>
                      <Table.Td>{c.outcome ?? "—"}</Table.Td>
                      <Table.Td>{rupees(c.submitted)}</Table.Td>
                      <Table.Td>{rupees(c.approved)}</Table.Td>
                      <Table.Td>{c.disposition ?? "—"}</Table.Td>
                      <Table.Td>
                        <Badge size="xs" tone={c.matched_claim_id ? "success" : "warning"}>
                          {c.matched_claim_id ? "Matched" : "Not found here"}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
