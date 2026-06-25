import { Anchor, Card, Code, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import { type MailDnsRecord, P } from "@medbrains/types";
import { IconCheck, IconClock, IconMail, IconWorld } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { Alert, Badge, type BadgeTone, Button, Input, Select, Table } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";

const PROVIDERS = [
  { value: "stalwart", label: "Stalwart (self-hosted)" },
  { value: "smtp", label: "SMTP (Zoho / Workspace / relay)" },
  { value: "sendgrid", label: "SendGrid (managed)" },
];

/** DNS records the hospital must add for the app + self-hosted mail. */
function dnsRecords(domain: string): Array<{ type: string; host: string; value: string }> {
  return [
    { type: "A / CNAME", host: domain, value: "→ your MedBrains edge (app)" },
    { type: "A", host: `mail.${domain}`, value: "→ your Stalwart mail server IP" },
    { type: "MX", host: domain, value: `10 mail.${domain}` },
    { type: "TXT (SPF)", host: domain, value: "v=spf1 mx -all" },
    { type: "TXT (DKIM)", host: "<selector>._domainkey", value: "copy the key from Stalwart's UI" },
    {
      type: "TXT (DMARC)",
      host: `_dmarc.${domain}`,
      value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`,
    },
  ];
}

export function DomainsEmailPage() {
  useRequirePermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const queryClient = useQueryClient();

  const { data: tenant } = useQuery({ queryKey: ["tenant"], queryFn: () => api.getTenant() });
  const { data: email } = useQuery({
    queryKey: ["email-settings"],
    queryFn: () => api.getEmailSettings(),
  });
  const hasDomain = Boolean(tenant?.custom_domain);
  // Live DNS verification — polls every 8s while records are still propagating.
  const {
    data: status,
    refetch: recheck,
    isFetching: checking,
  } = useQuery({
    queryKey: ["domain-status"],
    queryFn: () => api.getDomainStatus(),
    enabled: hasDomain,
    refetchInterval: (query) => (query.state.data && !query.state.data.all_ok ? 8000 : false),
  });

  const [form, setForm] = useState({
    provider: "stalwart",
    smtp_host: "",
    smtp_port: "587",
    smtp_tls: "starttls",
    from_address: "",
    from_name: "",
    smtp_username: "",
    smtp_password_secret: "",
  });

  // Sync the form to loaded settings once (TanStack provides the data).
  const synced = email
    ? {
        provider: email.provider,
        smtp_host: email.smtp_host,
        smtp_port: email.smtp_port || "587",
        smtp_tls: email.smtp_tls || "starttls",
        from_address: email.from_address,
        from_name: email.from_name,
        smtp_username: email.smtp_username,
        smtp_password_secret: email.smtp_password_secret ?? "",
      }
    : null;
  const value = synced && form.from_address === "" && form.smtp_host === "" ? synced : form;
  const set = (patch: Partial<typeof form>) => setForm({ ...value, ...patch });

  const save = useMutation({
    mutationFn: () => api.updateEmailSettings(value),
    onSuccess: () => {
      notifications.show({ title: "Email settings saved", message: "Updated.", color: "success" });
      void queryClient.invalidateQueries({ queryKey: ["email-settings"] });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Save failed", message: err.message, color: "danger" }),
  });

  const [provisioned, setProvisioned] = useState<MailDnsRecord[] | null>(null);
  const provision = useMutation({
    mutationFn: () => api.provisionMailDomain(tenant?.custom_domain ?? ""),
    onSuccess: (res) => {
      setProvisioned(res.dns_records);
      notifications.show({
        title: "Domain provisioned",
        message: `${res.domain} created in the mail server. DKIM and DNS records are below.`,
        color: "success",
      });
      void recheck();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Provisioning failed", message: err.message, color: "danger" }),
  });

  const isSmtp = value.provider === "smtp" || value.provider === "stalwart";
  const domain = tenant?.custom_domain ?? "";
  const mailHost = domain ? `mail.${domain}` : "mail.<your-domain>";

  const [testTo, setTestTo] = useState("");
  const { data: log = [] } = useQuery({
    queryKey: ["email-log"],
    queryFn: () => api.getEmailLog(),
  });
  const test = useMutation({
    mutationFn: () => api.sendEmailTest(testTo),
    onSuccess: () => {
      notifications.show({ title: "Test queued", message: `Sent to ${testTo}.`, color: "success" });
      setTestTo("");
      void queryClient.invalidateQueries({ queryKey: ["email-log"] });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Could not send", message: err.message, color: "danger" }),
  });
  const statusTone = (s: string): BadgeTone =>
    s === "sent" ? "success" : s === "failed" || s === "dlq" ? "danger" : "info";

  return (
    <Stack>
      <PageHeader
        title="Domains & Email"
        subtitle="Your hospital's custom domain and the mail server that sends verification, invites and notifications."
      />

      <Card withBorder padding="lg">
        <Group justify="space-between" mb="xs">
          <Group gap="xs">
            <IconWorld size={18} />
            <Text fw={600}>Domain & DNS</Text>
          </Group>
          {domain && (
            <Button size="xs" loading={provision.isPending} onClick={() => provision.mutate()}>
              Provision in mail server
            </Button>
          )}
        </Group>
        {domain ? (
          <>
            <Text size="sm" c="dimmed" mb="sm">
              {provisioned
                ? "Live records from the mail server (real DKIM). Add them at your DNS provider for "
                : "Add these records at your DNS provider for "}
              <Code>{domain}</Code>. The app + mail share the domain; mail needs SPF/DKIM/DMARC to
              land in inboxes (see RFC-MAIL-STALWART.md).
            </Text>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Host</Table.Th>
                  <Table.Th>Value</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(provisioned
                  ? provisioned.map((r) => ({ type: r.record_type, host: r.host, value: r.value }))
                  : dnsRecords(domain)
                ).map((r) => (
                  <Table.Tr key={`${r.type}-${r.host}-${r.value}`}>
                    <Table.Td>
                      <Badge tone="neutral" size="sm">
                        {r.type}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Code>{r.host}</Code>
                    </Table.Td>
                    <Table.Td>
                      <Code>{r.value}</Code>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </>
        ) : (
          <Alert tone="info" title="No custom domain yet">
            Set a custom domain in <Anchor href="/admin/settings">Settings → Organization</Anchor>{" "}
            to see the DNS records for the app and mail.
          </Alert>
        )}
      </Card>

      {hasDomain && status && (
        <Card withBorder padding="lg">
          <Group justify="space-between" mb="sm">
            <Group gap="xs">
              <Text fw={600}>DNS verification</Text>
              {status.all_ok ? (
                <Badge tone="success" size="sm">
                  All records live
                </Badge>
              ) : (
                <Badge tone="warning" size="sm">
                  Waiting for DNS…
                </Badge>
              )}
            </Group>
            <Button tone="ghost" size="xs" onClick={() => recheck()} loading={checking}>
              Re-check
            </Button>
          </Group>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Record</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Detail</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {status.records.map((r) => (
                <Table.Tr key={r.kind}>
                  <Table.Td>
                    <Badge tone="neutral" size="sm">
                      {r.kind}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {r.ok ? (
                      <Badge tone="success" size="sm" leftSection={<IconCheck size={11} />}>
                        Verified
                      </Badge>
                    ) : (
                      <Badge tone="warning" size="sm" leftSection={<IconClock size={11} />}>
                        Pending
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {r.detail}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Text size="xs" c="dimmed" mt="xs">
            DKIM is verified in Stalwart's own admin UI (per selector). DNS changes can take up to a
            few hours to propagate — this checks automatically.
          </Text>
        </Card>
      )}

      <Card withBorder padding="lg">
        <Group gap="xs" mb="xs">
          <IconMail size={18} />
          <Text fw={600}>Email / Mail server</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="md">
          {email?.env_fallback
            ? "An environment fallback is configured, so email works even without the fields below."
            : "Configure how MedBrains sends transactional email."}
        </Text>

        <Stack gap="sm" maw={560}>
          <Select
            label="Provider"
            data={PROVIDERS}
            value={value.provider}
            onChange={(v) => set({ provider: v ?? "stalwart" })}
            allowDeselect={false}
          />
          <Input
            label="From address"
            placeholder="noreply@hospital.example"
            value={value.from_address}
            onChange={(e) => set({ from_address: e.currentTarget.value })}
          />
          <Input
            label="From name"
            placeholder="Apollo Hospital"
            value={value.from_name}
            onChange={(e) => set({ from_name: e.currentTarget.value })}
          />
          {isSmtp && (
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Input
                label="SMTP host"
                placeholder="mail.hospital.example"
                value={value.smtp_host}
                onChange={(e) => set({ smtp_host: e.currentTarget.value })}
              />
              <Input
                label="SMTP port"
                placeholder="587"
                value={value.smtp_port}
                onChange={(e) => set({ smtp_port: e.currentTarget.value })}
              />
              <Select
                label="TLS"
                data={["starttls", "implicit", "none"]}
                value={value.smtp_tls}
                onChange={(v) => set({ smtp_tls: v ?? "starttls" })}
                allowDeselect={false}
              />
              <Input
                label="SMTP username"
                placeholder="noreply@hospital.example"
                value={value.smtp_username}
                onChange={(e) => set({ smtp_username: e.currentTarget.value })}
              />
              <Input
                label="Password reference"
                placeholder="SMTP_PASSWORD"
                description="A key in the secrets backend — not the password itself."
                value={value.smtp_password_secret}
                onChange={(e) => set({ smtp_password_secret: e.currentTarget.value })}
              />
            </SimpleGrid>
          )}
          <Group justify="flex-end">
            <Button tone="primary" onClick={() => save.mutate()} loading={save.isPending}>
              Save email settings
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="lg">
        <Group gap="xs" mb="xs">
          <IconMail size={18} />
          <Text fw={600}>Connect a mail client</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="sm">
          Staff use their own mail app (Outlook, Apple Mail, Thunderbird…). Point it at your mail
          server with these settings — username is the full email address; the password is the one
          set in Stalwart.
        </Text>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Purpose</Table.Th>
              <Table.Th>Server</Table.Th>
              <Table.Th>Port</Table.Th>
              <Table.Th>Security</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>Incoming (IMAP)</Table.Td>
              <Table.Td>
                <Code>{mailHost}</Code>
              </Table.Td>
              <Table.Td>993</Table.Td>
              <Table.Td>SSL/TLS</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>Incoming (JMAP, modern)</Table.Td>
              <Table.Td>
                <Code>https://{mailHost}/jmap</Code>
              </Table.Td>
              <Table.Td>443</Table.Td>
              <Table.Td>HTTPS</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>Outgoing (SMTP)</Table.Td>
              <Table.Td>
                <Code>{mailHost}</Code>
              </Table.Td>
              <Table.Td>587</Table.Td>
              <Table.Td>STARTTLS</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Card>

      <Card withBorder padding="lg">
        <Text fw={600} mb="xs">
          Mail activity
        </Text>
        <Group align="flex-end" gap="md" mb="md" maw={520}>
          <Input
            label="Send a test email"
            placeholder="you@hospital.example"
            value={testTo}
            onChange={(e) => setTestTo(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Button
            tone="secondary"
            onClick={() => test.mutate()}
            loading={test.isPending}
            disabled={!testTo.includes("@")}
          >
            Send test
          </Button>
        </Group>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Recipient</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>When</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {log.length > 0 ? (
              log.map((entry) => (
                <Table.Tr key={entry.id}>
                  <Table.Td>{entry.recipient ?? "—"}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {entry.event_type.replace("email.", "")}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge tone={statusTone(entry.status)} size="sm">
                      {entry.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {new Date(entry.created_at).toLocaleString()}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))
            ) : (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text c="dimmed" ta="center" py="md">
                    No email sent yet.
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
