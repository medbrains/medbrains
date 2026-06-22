import { Card, Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconWorld } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { oauthService } from "@/services/oauth.service";

const REDIRECT_PATH = "/oauth/callback";

const STATUS_TONE: Record<string, BadgeTone> = {
  connected: "success",
  expired: "warning",
  error: "danger",
  revoked: "neutral",
};

/**
 * Connect Google / Microsoft for the tenant — enables calendar-based
 * telemedicine (Google Meet / MS Teams) and calendar invites via the common
 * OAuth token module. Starts the consent flow; tokens are exchanged + stored
 * (AEAD-encrypted) on the callback.
 */
export function OAuthIntegrationsSettings() {
  const canManage = useHasPermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const queryClient = useQueryClient();

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ["oauth-providers"],
    queryFn: () => oauthService.listOAuthProviders(),
  });

  const connect = useMutation({
    mutationFn: (provider: string) =>
      oauthService.getOAuthAuthorizeUrl(provider, `${window.location.origin}${REDIRECT_PATH}`),
    onSuccess: (res, provider) => {
      // Echoed back on the callback to defeat CSRF.
      sessionStorage.setItem("oauth_state", res.state);
      sessionStorage.setItem("oauth_provider", provider);
      window.location.href = res.authorize_url;
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not start connection" }),
  });

  const disconnect = useMutation({
    mutationFn: (provider: string) => oauthService.disconnectOAuth(provider),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["oauth-providers"] });
      toast.success("Account disconnected", { title: "Integrations" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not disconnect" }),
  });

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Connect a Google or Microsoft account for this hospital to enable calendar-based
        telemedicine (Google Meet / Microsoft Teams) and calendar invites.
      </Text>

      {!isLoading && providers.length === 0 && (
        <Text size="sm" c="dimmed">
          No OAuth providers are configured on the server.
        </Text>
      )}

      {providers.map((p) => (
        <Card key={p.provider} withBorder padding="md">
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <IconWorld size={22} />
              <Stack gap={2}>
                <Text fw={600}>{p.label}</Text>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {p.connected && p.external_account_id ? p.external_account_id : p.scopes}
                </Text>
              </Stack>
            </Group>
            <Group gap="xs" wrap="nowrap">
              {p.connected && (
                <Badge tone={STATUS_TONE[p.status ?? "connected"] ?? "neutral"}>
                  {p.status ?? "connected"}
                </Badge>
              )}
              {p.connected ? (
                <Button
                  tone="danger"
                  disabled={!canManage}
                  loading={disconnect.isPending && disconnect.variables === p.provider}
                  onClick={() => disconnect.mutate(p.provider)}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  tone="primary"
                  disabled={!canManage}
                  loading={connect.isPending && connect.variables === p.provider}
                  onClick={() => connect.mutate(p.provider)}
                >
                  Connect
                </Button>
              )}
            </Group>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
