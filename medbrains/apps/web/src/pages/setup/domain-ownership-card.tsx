/**
 * Proving the hospital controls its custom domain. Until the TXT record is
 * found, sign-in does not follow the domain and no certificate is issued
 * for it — anyone could otherwise point a domain they don't own at the
 * hospital's records.
 */
import { Code, Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { IconShieldCheck } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card } from "@/components/ui";

export function DomainOwnershipCard() {
  const qc = useQueryClient();
  const ownership = useQuery({
    queryKey: ["domain-ownership"],
    queryFn: api.getDomainOwnership,
    retry: false,
  });
  const verify = useMutation({
    mutationFn: api.verifyDomainOwnership,
    onSuccess: (data) => qc.setQueryData(["domain-ownership"], data),
  });
  // No domain set yet: the Domain & DNS card below says what to do.
  if (!ownership.data) return null;
  const { domain, record_name, token, verified_at } = ownership.data;
  return (
    <Card withBorder padding="lg" data-testid="domain-ownership">
      <Group justify="space-between" mb="xs">
        <Group gap="xs">
          <IconShieldCheck size={18} />
          <Text fw={600}>Prove you own {domain}</Text>
        </Group>
        <Badge tone={verified_at ? "success" : "warning"}>
          {verified_at ? "Proven" : "Not proven yet"}
        </Badge>
      </Group>
      {verified_at ? (
        <Text size="sm" c="dimmed">
          Proven on {new Date(verified_at).toLocaleDateString()}. Sign-in and the security
          certificate follow this domain.
        </Text>
      ) : (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            Add this TXT record at your DNS provider, then press Verify. Until then sign-in won't
            follow the domain and no certificate is issued for it.
          </Text>
          <Text size="sm">
            Name <Code>{record_name}</Code>
          </Text>
          <Text size="sm">
            Value <Code>{token}</Code>
          </Text>
          {verify.isError && <Alert tone="warning">{verify.error.message}</Alert>}
          <Group>
            <Button tone="primary" loading={verify.isPending} onClick={() => verify.mutate()}>
              Verify
            </Button>
          </Group>
        </Stack>
      )}
    </Card>
  );
}
