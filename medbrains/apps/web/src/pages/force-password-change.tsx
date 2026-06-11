import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Paper, PasswordInput, Stack, Text, Title } from "@mantine/core";
import { api } from "@medbrains/api";
import { useAuthStore } from "@medbrains/stores";
import { IconLock } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router";
import { z } from "zod";

const forcePasswordChangeSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z.string().min(8, "New password must be at least 8 characters"),
    confirm_password: z.string().min(1, "Confirm the new password"),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  })
  .refine((values) => values.new_password !== values.current_password, {
    message: "New password must differ from the current password",
    path: ["new_password"],
  });

type ForcePasswordChangeInput = z.infer<typeof forcePasswordChangeSchema>;

/**
 * Mandatory password rotation screen for seeded/provisioned accounts
 * (users.must_change_password). ProtectedRoute redirects here; the user
 * cannot reach the app until the password is changed.
 */
export function ForcePasswordChangePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const form = useForm<ForcePasswordChangeInput>({
    resolver: zodResolver(forcePasswordChangeSchema),
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  });

  const changeMutation = useMutation({
    mutationFn: (values: ForcePasswordChangeInput) =>
      api.changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      }),
    onSuccess: () => {
      // Password change revokes every refresh token server-side —
      // a fresh login is required.
      useAuthStore.getState().clearAuth();
      navigate("/login", { replace: true });
    },
  });

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Stack align="center" justify="center" mih="100vh" p="md">
      <Paper withBorder shadow="sm" p="xl" radius="md" maw={420} w="100%">
        <form onSubmit={form.handleSubmit((values) => changeMutation.mutate(values))}>
          <Stack>
            <Title order={3}>Set a new password</Title>
            <Text size="sm" c="dimmed">
              This account was provisioned with a temporary password. Choose a new one to
              continue.
            </Text>
            {changeMutation.isError && (
              <Alert color="red" title="Password change failed">
                {changeMutation.error instanceof Error
                  ? changeMutation.error.message
                  : "Please check the current password and try again."}
              </Alert>
            )}
            <Controller
              control={form.control}
              name="current_password"
              render={({ field, fieldState }) => (
                <PasswordInput
                  {...field}
                  label="Current password"
                  leftSection={<IconLock size={16} />}
                  error={fieldState.error?.message}
                  autoComplete="current-password"
                />
              )}
            />
            <Controller
              control={form.control}
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
              control={form.control}
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
            <Button type="submit" loading={changeMutation.isPending}>
              Change password
            </Button>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
