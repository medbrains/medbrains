/**
 * Beside the map: what a switch change does to the route and who it affects
 * now, then "Propose" — a knowledge change set that a quality officer (and,
 * for a clinical flow, the medical superintendent) must approve.
 */
import { Anchor, Group, List, Loader, Stack, Text } from "@mantine/core";
import type { FlowImpactReport } from "@medbrains/types";
import { IconSend, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Link } from "react-router";
import { Alert, Badge, Button, Panel, TextArea } from "@/components/ui";

const SEVERITY = {
  safety: { label: "Safety", tone: "danger" },
  money: { label: "Money", tone: "warning" },
  info: { label: "Info", tone: "info" },
} as const;

export interface PreviewPanelProps {
  report: FlowImpactReport | undefined;
  isLoading: boolean;
  error: Error | null;
  clinical: boolean;
  canPropose: boolean;
  proposing: boolean;
  onRetry: () => void;
  onPropose: (reason: string) => void;
  onClose: () => void;
}

export function PreviewPanel(props: PreviewPanelProps) {
  const { report, isLoading, error, clinical, canPropose, proposing } = props;
  const [reason, setReason] = useState("");
  return (
    <Panel
      title="Preview"
      description="Nothing changes until the proposal is approved and applied."
      actions={
        <Button tone="ghost" size="xs" leftSection={<IconX size={16} />} onClick={props.onClose}>
          Close preview
        </Button>
      }
    >
      {isLoading && <Loader size="sm" aria-label="Working out the impact" />}
      {error && (
        <Alert tone="danger" title="Could not work out the impact">
          <Stack gap="xs">
            <Text size="sm">{error.message}</Text>
            <Button tone="secondary" size="xs" onClick={props.onRetry}>
              Try again
            </Button>
          </Stack>
        </Alert>
      )}
      {report && (
        <Stack gap="sm">
          <Stack gap={4}>
            <Text fw={600}>Route</Text>
            {report.route_changes.length === 0 ? (
              <Text size="sm">The route stays the same.</Text>
            ) : (
              <List size="sm">
                {report.route_changes.map((c) => (
                  <List.Item key={c}>{c}</List.Item>
                ))}
              </List>
            )}
          </Stack>
          {report.entries.map((e) => (
            <Stack gap={4} key={e.relation}>
              <Group gap="xs">
                <Badge tone={SEVERITY[e.severity].tone}>{SEVERITY[e.severity].label}</Badge>
                <Text size="sm">{e.summary}</Text>
              </Group>
              {e.examples.length > 0 && (
                <List size="sm" aria-label="Patients">
                  {e.examples.map((x) => (
                    <List.Item key={x.href ?? x.label}>
                      {x.href ? (
                        <Anchor component={Link} to={x.href}>
                          {x.label}
                        </Anchor>
                      ) : (
                        x.label
                      )}
                    </List.Item>
                  ))}
                  {e.truncated && <List.Item>…and more</List.Item>}
                </List>
              )}
            </Stack>
          ))}
          {canPropose ? (
            <Stack gap="xs">
              <TextArea
                label="Why change it?"
                description={`Required. ${clinical ? "A quality officer and the medical superintendent" : "A quality officer"} will see it when approving.`}
                value={reason}
                onChange={(e) => setReason(e.currentTarget.value)}
                autosize
                minRows={2}
                required
              />
              <Group>
                <Button
                  tone="primary"
                  leftSection={<IconSend size={16} />}
                  disabled={reason.trim().length === 0}
                  loading={proposing}
                  onClick={() => props.onPropose(reason.trim())}
                >
                  Propose
                </Button>
              </Group>
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              You can preview but not propose switch changes.
            </Text>
          )}
        </Stack>
      )}
    </Panel>
  );
}
