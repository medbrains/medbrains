import { Anchor, Card, Code, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import { IconMail, IconWorld } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { Alert, Badge, Button, Input, Select, Table } from "@/components/ui";
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

  const isSmtp = value.provider === "smtp" || value.provider === "stalwart";
  const domain = tenant?.custom_domain ?? "";

  return (
    <Stack>
      <PageHeader
        title="Domains & Email"
        subtitle="Your hospital's custom domain and the mail server that sends verification, invites and notifications."
      />

      <Card withBorder padding="lg">
        <Group gap="xs" mb="xs">
          <IconWorld size={18} />
          <Text fw={600}>Domain & DNS</Text>
        </Group>
        {domain ? (
          <>
            <Text size="sm" c="dimmed" mb="sm">
              Add these records at your DNS provider for <Code>{domain}</Code>. The app + mail share
              the domain; mail needs SPF/DKIM/DMARC to land in inboxes (see RFC-MAIL-STALWART.md).
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
                {dnsRecords(domain).map((r) => (
                  <Table.Tr key={`${r.type}-${r.host}`}>
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
    </Stack>
  );
}
