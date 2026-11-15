/**
 * HPR sign-in for one onboarding header: the facility manager (basic
 * information and submit) or the verifying professional (submit). The
 * password goes to the server once, encrypted on to HPR there, and is never
 * kept; the browser only learns who is signed in and until when.
 */

import { Group, Stack, Text } from "@mantine/core";
import type { HprRole, HprSessionView } from "@medbrains/types";
import { IconCircleCheck } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Input, PasswordField, ThemeIcon } from "@/components/ui";
import { abdmRegistryService } from "@/services/abdmRegistry.service";

const ROLE_LABEL: Record<HprRole, string> = {
  manager: "Facility manager",
  verifier: "Verifier",
};

const ROLE_HINT: Record<HprRole, string> = {
  manager: "The facility manager's HPR sign-in saves the details and submits them.",
  verifier: "A second registered professional confirms the submission with their HPR sign-in.",
};

interface HprSignInPanelProps {
  hprRole: HprRole;
  session: HprSessionView | undefined;
  onSignedIn: (view: HprSessionView) => void;
}

/** Signed-in summary, or the HPR ID + password form. */
export function HprSignInPanel({ hprRole: role, session, onSignedIn }: HprSignInPanelProps) {
  const [hprId, setHprId] = useState("");
  const [password, setPassword] = useState("");
  const signIn = useMutation({
    mutationFn: () => abdmRegistryService.signInHpr({ role, hpr_id: hprId.trim(), password }),
    onSuccess: (view) => {
      setPassword("");
      onSignedIn(view);
    },
  });

  if (session) {
    const until = new Date(session.expires_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <Group gap="xs">
        <ThemeIcon tone="success" size="sm" aria-hidden>
          <IconCircleCheck size={16} />
        </ThemeIcon>
        <Text size="sm">
          {ROLE_LABEL[role]} signed in to HPR as <strong>{session.hpr_id}</strong>, until {until}
        </Text>
      </Group>
    );
  }

  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>
        {ROLE_LABEL[role]}: sign in to HPR
      </Text>
      <Text size="sm" c="dimmed">
        {ROLE_HINT[role]}
      </Text>
      <Group align="flex-end" grow>
        <Input
          label="HPR ID"
          placeholder="name@hpr.abdm or 14 digits"
          value={hprId}
          onChange={(e) => setHprId(e.currentTarget.value)}
          autoComplete="username"
        />
        <PasswordField
          label="HPR password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          autoComplete="current-password"
        />
        <Button
          tone="primary"
          loading={signIn.isPending}
          disabled={hprId.trim() === "" || password === ""}
          onClick={() => signIn.mutate()}
        >
          Sign in to HPR
        </Button>
      </Group>
      {signIn.isError && <Alert tone="danger">{signIn.error.message}</Alert>}
    </Stack>
  );
}
