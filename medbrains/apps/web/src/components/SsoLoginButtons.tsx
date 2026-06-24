import { Center, Divider, Group, Loader, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { IconLockSquareRounded } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * "Sign in with <IdP>" buttons for the login page — Okta-style: a clean divider,
 * one button per active provider, and a redirecting interstitial while the
 * browser hands off to the identity provider. Renders nothing if no SSO is set up.
 */
export function SsoLoginButtons({ returnTo = "/dashboard" }: { returnTo?: string }) {
  const [redirectingTo, setRedirectingTo] = useState<string | null>(null);

  const { data: providers = [] } = useQuery({
    queryKey: ["sso-active-providers"],
    queryFn: () => api.listActiveSsoProviders(window.location.hostname),
    staleTime: 300_000,
    retry: false,
  });

  if (providers.length === 0) return null;

  if (redirectingTo) {
    return (
      <Center py="lg">
        <Stack align="center" gap="xs">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Redirecting to {redirectingTo}…
          </Text>
        </Stack>
      </Center>
    );
  }

  const start = (id: string, name: string) => {
    setRedirectingTo(name);
    // Hand off to the IdP; the callback sets the session cookie and returns to returnTo.
    window.location.href = api.ssoAuthorizeUrl(id, returnTo);
  };

  return (
    <Stack gap="sm" mt="md">
      <Divider
        label={
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
            Or continue with
          </Text>
        }
        labelPosition="center"
      />
      {providers.map((p) => (
        <Button
          key={p.id}
          tone="secondary"
          fullWidth
          size="md"
          onClick={() => start(p.id, p.name)}
          leftSection={
            <Group gap={6}>
              <IconLockSquareRounded size={16} />
            </Group>
          }
        >
          Sign in with {p.name}
        </Button>
      ))}
    </Stack>
  );
}
