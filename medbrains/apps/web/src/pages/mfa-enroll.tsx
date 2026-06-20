import { zodResolver } from "@hookform/resolvers/zod";
import { Code, CopyButton, Group, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { api } from "@medbrains/api";
import { useAuthStore } from "@medbrains/stores";
import { IconKey, IconShieldCheck } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router";
import { z } from "zod";
import { Alert, Button } from "@/components/ui";

const activateSchema = z.object({
  code: z.string().length(6, "Enter the 6-digit code from your authenticator app"),
});
type ActivateInput = z.infer<typeof activateSchema>;

/**
 * TOTP enrollment. Reached voluntarily from settings or forced by
 * ProtectedRoute when tenant policy (security.mfa_required_roles)
 * mandates MFA for the user's role.
 */
export function MfaEnrollPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const enrollment = useQuery({
    queryKey: ["mfa-enroll"],
    queryFn: () => api.enrollMfa(),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  const form = useForm<ActivateInput>({
    resolver: zodResolver(activateSchema),
    defaultValues: { code: "" },
  });

  const activateMutation = useMutation({
    mutationFn: (values: ActivateInput) => api.activateMfa(values),
    onSuccess: (data) => setRecoveryCodes(data.recovery_codes),
  });

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Stack align="center" justify="center" mih="100vh" p="md">
      <Paper withBorder shadow="sm" p="xl" radius="md" maw={460} w="100%">
        {recoveryCodes === null ? (
          <form onSubmit={form.handleSubmit((values) => activateMutation.mutate(values))}>
            <Stack>
              <Group gap="xs">
                <IconShieldCheck size={22} />
                <Title order={3}>Set up two-factor authentication</Title>
              </Group>
              <Text size="sm" c="dimmed">
                Scan the QR code with an authenticator app (Google Authenticator, Aegis,
                1Password…), then enter the 6-digit code it shows.
              </Text>
              {enrollment.isError && (
                <Alert tone="danger" title="Could not start enrollment">
                  Reload the page to try again.
                </Alert>
              )}
              {enrollment.data && (
                <Stack align="center" gap="xs">
                  <img
                    src={`data:image/png;base64,${enrollment.data.qr_png_base64}`}
                    alt="Authenticator QR code"
                    width={200}
                    height={200}
                  />
                  <Text size="xs" c="dimmed">
                    Can't scan? Enter manually: <Code>{enrollment.data.secret}</Code>
                  </Text>
                </Stack>
              )}
              {activateMutation.isError && (
                <Alert tone="danger" title="Activation failed">
                  {activateMutation.error instanceof Error
                    ? activateMutation.error.message
                    : "Invalid code."}
                </Alert>
              )}
              <Controller
                control={form.control}
                name="code"
                render={({ field, fieldState }) => (
                  <TextInput
                    {...field}
                    label="6-digit code"
                    leftSection={<IconKey size={16} />}
                    error={fieldState.error?.message}
                    inputMode="numeric"
                    maxLength={6}
                  />
                )}
              />
              <Button
                tone="primary"
                type="submit"
                loading={activateMutation.isPending}
                disabled={!enrollment.data}
              >
                Activate
              </Button>
            </Stack>
          </form>
        ) : (
          <Stack>
            <Title order={3}>Save your recovery codes</Title>
            <Text size="sm" c="dimmed">
              Each code works once if you lose your authenticator. Store them somewhere safe — they
              are shown only now.
            </Text>
            <Code block>{recoveryCodes.join("\n")}</Code>
            <Group justify="space-between">
              <CopyButton value={recoveryCodes.join("\n")}>
                {({ copied, copy }) => (
                  <Button tone="secondary" onClick={copy}>
                    {copied ? "Copied" : "Copy codes"}
                  </Button>
                )}
              </CopyButton>
              <Button tone="primary" onClick={() => navigate("/dashboard", { replace: true })}>
                Done
              </Button>
            </Group>
          </Stack>
        )}
      </Paper>
    </Stack>
  );
}
