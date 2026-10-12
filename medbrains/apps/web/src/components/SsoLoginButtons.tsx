import { Center, Divider, Group, Loader, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import type { SsoPublicProvider } from "@medbrains/types";
import { IconLockSquareRounded } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * "Sign in with <IdP>" buttons for the login page — Okta-style: a clean divider,
 * one button per provider the hospital uses, and a redirecting interstitial
 * while the browser hands off to the identity provider. Renders nothing when
 * the hospital has none.
 */
export function SsoLoginButtons({
  providers,
  returnTo = "/dashboard",
  hideDivider = false,
  onStart,
}: {
  /** The signing-in hospital's own providers (from its sign-in options). */
  providers: SsoPublicProvider[];
  returnTo?: string;
  hideDivider?: boolean;
  /** Called as the hand-off starts, e.g. to remember the hospital. */
  onStart?: () => void;
}) {
  const [redirectingTo, setRedirectingTo] = useState<string | null>(null);

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
    onStart?.();
    setRedirectingTo(name);
    // Hand off to the IdP; the callback sets the session cookie and returns to returnTo.
    window.location.href = api.ssoAuthorizeUrl(id, returnTo);
  };

  return (
    <Stack gap="sm" mt="md">
      {!hideDivider && (
        <Divider
          label={
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Or continue with
            </Text>
          }
          labelPosition="center"
        />
      )}
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
