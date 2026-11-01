import { Anchor, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { api } from "@medbrains/api";
import type { ConnectedApp, ConnectedAppDelivery } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components";
import { Badge, type BadgeTone, Card, Modal } from "@/components/ui";
import { formatDateTime } from "@/lib/date-utils";

const DELIVERY_TONE: Record<ConnectedAppDelivery["status"], BadgeTone> = {
  delivered: "success",
  retrying: "warning",
  failed: "danger",
};

/** Data classes that need a second look before approving (RFC-AUTHZ data classes). */
const CAREFUL = new Set(["sensitive", "restricted", "confidential", "sealed"]);

interface AppReviewModalProps {
  app: ConnectedApp | null;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <Stack gap="xs">
        <Text size="xs" tt="uppercase" ff="var(--mb-font-mono)" c="dimmed">
          {title}
        </Text>
        {children}
      </Stack>
    </Card>
  );
}

/** The privacy label: exactly what the manifest asks for, before anyone approves it. */
export function AppReviewModal({ app, onClose }: AppReviewModalProps) {
  const deliveries = useQuery({
    queryKey: ["connected-app-deliveries", app?.id],
    queryFn: () => api.listConnectedAppDeliveries(app?.id ?? ""),
    enabled: app?.has_webhook === true,
  });
  const m = app?.manifest;

  return (
    <Modal opened={app !== null} onClose={onClose} fullScreen title={app?.name ?? ""}>
      {app && m && (
        <Stack gap="md">
          <Stack gap={4}>
            <Title order={3}>{app.purpose}</Title>
            <Text size="sm" c="dimmed">
              {app.publisher} · version {app.version} · {m.kind}
              {m.publisher.url && (
                <>
                  {" · "}
                  <Anchor href={m.publisher.url} target="_blank" rel="noreferrer" size="sm">
                    {m.publisher.url}
                  </Anchor>
                </>
              )}
            </Text>
          </Stack>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Section title="Permissions it gets">
              <Group gap={6}>
                {app.permissions.map((p) => (
                  <Badge key={p} tone="neutral">
                    {p}
                  </Badge>
                ))}
              </Group>
              <Text size="xs" c="dimmed">
                Nothing else: no role, and per-patient access checks still apply.
              </Text>
            </Section>
            <Section title="Kinds of data it touches">
              <Group gap={6}>
                {m.dataClasses.map((c) => (
                  <Badge key={c} tone={CAREFUL.has(c) ? "warning" : "neutral"}>
                    {c}
                  </Badge>
                ))}
              </Group>
              <Text size="sm">
                Reads: {(m.reads ?? []).length ? (m.reads ?? []).join(", ") : "no FHIR resources"}
              </Text>
            </Section>
            <Section title="Where the data goes">
              {(m.sendsDataTo ?? []).length === 0 && (
                <Text size="sm">Nowhere outside the app.</Text>
              )}
              {(m.sendsDataTo ?? []).map((d) => (
                <Stack key={d.url} gap={0}>
                  <Text size="sm" fw={500}>
                    {d.name}
                  </Text>
                  <Text size="xs" ff="var(--mb-font-mono)">
                    {d.url}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {d.purpose}
                  </Text>
                </Stack>
              ))}
            </Section>
            <Section title="Events it is told about">
              <Text size="sm">
                {(m.events ?? []).length ? (m.events ?? []).join(", ") : "None"}
              </Text>
              {m.webhookUrl && (
                <Text size="xs" ff="var(--mb-font-mono)">
                  Signed webhooks to {m.webhookUrl}
                </Text>
              )}
            </Section>
          </SimpleGrid>
          <Section title="Sign-in">
            <Text size="sm" ff="var(--mb-font-mono)">
              {app.client_id} · secret {app.secret_prefix}…
            </Text>
            <Text size="xs" c="dimmed">
              {app.approved_at
                ? `Approved ${formatDateTime(app.approved_at)} by ${app.approved_by_name ?? "—"}`
                : "Not approved"}
              {app.revoked_at && ` · Revoked ${formatDateTime(app.revoked_at)}`}
              {app.revoke_reason && ` (${app.revoke_reason})`}
            </Text>
          </Section>
          {app.has_webhook && (
            <DataTable
              columns={[
                {
                  key: "at",
                  label: "When",
                  render: (d: ConnectedAppDelivery) => formatDateTime(d.created_at),
                },
                { key: "event", label: "Event", render: (d: ConnectedAppDelivery) => d.event_type },
                {
                  key: "attempt",
                  label: "Attempt",
                  render: (d: ConnectedAppDelivery) => d.attempt,
                },
                {
                  key: "status",
                  label: "Result",
                  render: (d: ConnectedAppDelivery) => (
                    <Badge tone={DELIVERY_TONE[d.status]}>
                      {d.status === "failed" ? "gave up" : d.status}
                      {d.response_status ? ` · ${d.response_status}` : ""}
                    </Badge>
                  ),
                },
                {
                  key: "error",
                  label: "Error",
                  render: (d: ConnectedAppDelivery) => d.error ?? "—",
                },
              ]}
              data={deliveries.data ?? []}
              loading={deliveries.isLoading}
              error={deliveries.error}
              onRetry={() => void deliveries.refetch()}
              rowKey={(d) => d.id}
              emptyTitle="No events sent yet"
            />
          )}
        </Stack>
      )}
    </Modal>
  );
}
