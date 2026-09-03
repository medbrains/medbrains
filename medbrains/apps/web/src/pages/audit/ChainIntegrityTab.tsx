import { Group, Stack, Text } from "@mantine/core";
import type { AuditChainVerification } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, Table } from "@/components/ui";
import { auditService } from "@/services/audit.service";

/**
 * Whether the audit log can still be trusted.
 *
 * Every audit row carries a SHA-256 over its canonical payload, and a nightly
 * job walks the chain and records the verdict. That verdict has been written
 * to `audit_chain_verifications` since the feature shipped and read by
 * nothing — so a broken chain, the one event the mechanism exists to detect,
 * reached stderr and a table with no reader.
 *
 * An audit log nobody can attest to is not evidence.
 */
export function ChainIntegrityTab() {
  const {
    data: runs = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["audit-chain-verifications"],
    queryFn: () => auditService.listAuditChainVerifications(),
  });

  // "No runs recorded" and "we could not ask" must not look the same. On this
  // screen especially: the second is indistinguishable from a silenced alarm.
  if (isError) {
    return (
      <Alert tone="danger" title="Chain status could not be read">
        The verification history is unavailable. This is not a statement that the audit log is
        intact — it means we could not check. Treat the log as unverified until this loads.
      </Alert>
    );
  }

  const latest = runs[0];
  const broken = runs.filter((run) => !run.valid);

  return (
    <Stack>
      {broken.length > 0 ? (
        <Alert tone="danger" title="The audit chain failed verification">
          {broken.length === 1
            ? "One run found a break in the hash chain."
            : `${broken.length} runs found a break in the hash chain.`}{" "}
          A break means an audit row was altered or removed after it was written. Preserve the
          database as it stands and escalate — do not run maintenance that rewrites rows.
        </Alert>
      ) : null}

      {!isLoading && runs.length === 0 ? (
        <Alert tone="warning" title="The chain has never been verified">
          No verification has been recorded. The nightly job either has not run or cannot reach this
          tenant, so nothing has attested to the audit log's integrity.
        </Alert>
      ) : null}

      {latest ? (
        <Group gap="lg">
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Last verified
            </Text>
            <Text size="sm">
              {latest.completed_at ? new Date(latest.completed_at).toLocaleString() : "—"}
            </Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Rows checked
            </Text>
            <Text size="sm">{latest.rows_checked.toLocaleString()}</Text>
          </Stack>
          <Stack gap={2}>
            <Text size="xs" c="dimmed">
              Status
            </Text>
            <Badge tone={latest.valid ? "success" : "danger"}>
              {latest.valid ? "Chain intact" : "Chain broken"}
            </Badge>
          </Stack>
        </Group>
      ) : null}

      <Table>
        <thead>
          <tr>
            <th>Completed</th>
            <th>Result</th>
            <th>Rows checked</th>
            <th>Took</th>
            <th>Trigger</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run: AuditChainVerification) => (
            <tr key={run.id}>
              <td>{run.completed_at ? new Date(run.completed_at).toLocaleString() : "—"}</td>
              <td>
                <Badge tone={run.valid ? "success" : "danger"}>
                  {run.valid ? "Intact" : "Broken"}
                </Badge>
              </td>
              <td>{run.rows_checked.toLocaleString()}</td>
              <td>{run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "—"}</td>
              <td>{run.triggered_by}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Stack>
  );
}
