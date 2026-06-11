import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Anchor, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { api } from "@medbrains/api";
import { IconKey, IconLock, IconUser } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";

const requestSchema = z.object({
  username: z.string().min(3, "Enter your username"),
});

const confirmSchema = z
  .object({
    otp: z.string().length(6, "Enter the 6-digit code"),
    new_password: z.string().min(8, "New password must be at least 8 characters"),
    confirm_password: z.string().min(1, "Confirm the new password"),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

type RequestInput = z.infer<typeof requestSchema>;
type ConfirmInput = z.infer<typeof confirmSchema>;

/**
 * Self-service reset: username → SMS OTP → new password. If the
 * account has no phone on file, staff must ask a hospital admin
 * (admin-mediated reset on the Users page).
 */
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState<string | null>(null);

  const requestForm = useForm<RequestInput>({
    resolver: zodResolver(requestSchema),
    defaultValues: { username: "" },
  });
  const confirmForm = useForm<ConfirmInput>({
    resolver: zodResolver(confirmSchema),
    defaultValues: { otp: "", new_password: "", confirm_password: "" },
  });

  const requestMutation = useMutation({
    mutationFn: (values: RequestInput) => api.requestPasswordReset(values),
    onSuccess: (_data, values) => setUsername(values.username),
  });

  const confirmMutation = useMutation({
    mutationFn: (values: ConfirmInput) =>
      api.confirmPasswordReset({
        username: username ?? "",
        otp: values.otp,
        new_password: values.new_password,
      }),
    onSuccess: () => navigate("/login", { replace: true }),
  });

  return (
    <Stack align="center" justify="center" mih="100vh" p="md">
      <Paper withBorder shadow="sm" p="xl" radius="md" maw={420} w="100%">
        {username === null ? (
          <form onSubmit={requestForm.handleSubmit((values) => requestMutation.mutate(values))}>
            <Stack>
              <Title order={3}>Reset password</Title>
              <Text size="sm" c="dimmed">
                Enter your username. If a phone number is on file, a 6-digit code will be sent
                by SMS. No phone on file? Ask your hospital admin to reset it.
              </Text>
              {requestMutation.isError && (
                <Alert color="red" title="Request failed">
                  Could not reach the server. Try again.
                </Alert>
              )}
              <Controller
                control={requestForm.control}
                name="username"
                render={({ field, fieldState }) => (
                  <TextInput
                    {...field}
                    label="Username"
                    leftSection={<IconUser size={16} />}
                    error={fieldState.error?.message}
                    autoComplete="username"
                  />
                )}
              />
              <Button type="submit" loading={requestMutation.isPending}>
                Send reset code
              </Button>
              <Anchor component={Link} to="/login" size="sm" ta="center">
                Back to login
              </Anchor>
            </Stack>
          </form>
        ) : (
          <form onSubmit={confirmForm.handleSubmit((values) => confirmMutation.mutate(values))}>
            <Stack>
              <Title order={3}>Enter the code</Title>
              <Text size="sm" c="dimmed">
                If the account exists, a code was sent to the phone on file. It is valid for 10
                minutes.
              </Text>
              {confirmMutation.isError && (
                <Alert color="red" title="Reset failed">
                  {confirmMutation.error instanceof Error
                    ? confirmMutation.error.message
                    : "Invalid or expired code."}
                </Alert>
              )}
              <Controller
                control={confirmForm.control}
                name="otp"
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
              <Controller
                control={confirmForm.control}
                name="new_password"
                render={({ field, fieldState }) => (
                  <PasswordInput
                    {...field}
                    label="New password"
                    leftSection={<IconLock size={16} />}
                    error={fieldState.error?.message}
                    autoComplete="new-password"
                  />
                )}
              />
              <Controller
                control={confirmForm.control}
                name="confirm_password"
                render={({ field, fieldState }) => (
                  <PasswordInput
                    {...field}
                    label="Confirm new password"
                    leftSection={<IconLock size={16} />}
                    error={fieldState.error?.message}
                    autoComplete="new-password"
                  />
                )}
              />
              <Button type="submit" loading={confirmMutation.isPending}>
                Set new password
              </Button>
              <Anchor size="sm" ta="center" onClick={() => setUsername(null)}>
                Use a different username
              </Anchor>
            </Stack>
          </form>
        )}
      </Paper>
    </Stack>
  );
}
