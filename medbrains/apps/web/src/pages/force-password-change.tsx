import { zodResolver } from "@hookform/resolvers/zod";
import { Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { api } from "@medbrains/api";
import { useAuthStore } from "@medbrains/stores";
import { IconLock } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router";
import { z } from "zod";
import { Alert, Button } from "@/components/ui";

/** The placeholder address the first administrator is seeded with. */
const SEED_ADMIN_DOMAIN = "@medbrains.localhost";

/**
 * Whether this account is the seeded administrator handed to a hospital: it
 * still has the placeholder address and is not a MedBrains account (on a
 * hosted server the seeded login is MedBrains staff and keeps it).
 */
export function needsRealAdminEmail(email: string | undefined, role: string | undefined): boolean {
  return (
    (email ?? "").trim().toLowerCase().endsWith(SEED_ADMIN_DOMAIN) && role !== "vendor_support"
  );
}

/** The form's rules; the address is required only when the account needs one. */
function schemaFor(needsEmail: boolean) {
  return z
    .object({
      current_password: z.string().min(1, "Current password is required"),
      new_password: z.string().min(8, "New password must be at least 8 characters"),
      confirm_password: z.string().min(1, "Confirm the new password"),
      email: z.string(),
    })
    .refine((values) => !needsEmail || z.string().email().safeParse(values.email.trim()).success, {
      message: "Enter the hospital administrator's own email address",
      path: ["email"],
    })
    .refine(
      (values) => !needsEmail || !values.email.trim().toLowerCase().endsWith(SEED_ADMIN_DOMAIN),
      { message: "Use a real address, not the placeholder", path: ["email"] },
    )
    .refine((values) => values.new_password === values.confirm_password, {
      message: "Passwords do not match",
      path: ["confirm_password"],
    })
    .refine((values) => values.new_password !== values.current_password, {
      message: "New password must differ from the current password",
      path: ["new_password"],
    });
}

type ForcePasswordChangeInput = z.infer<ReturnType<typeof schemaFor>>;

/**
 * Mandatory password rotation screen for seeded/provisioned accounts
 * (users.must_change_password). ProtectedRoute redirects here; the user
 * cannot reach the app until the password is changed.
 */
export function ForcePasswordChangePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const needsEmail = needsRealAdminEmail(user?.email, user?.role);
  const schema = useMemo(() => schemaFor(needsEmail), [needsEmail]);
  const form = useForm<ForcePasswordChangeInput>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: "", new_password: "", confirm_password: "", email: "" },
  });

  const changeMutation = useMutation({
    mutationFn: (values: ForcePasswordChangeInput) =>
      api.changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
        ...(needsEmail ? { email: values.email.trim() } : {}),
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
      <Paper withBorder p="xl" maw={420} w="100%">
        <form onSubmit={form.handleSubmit((values) => changeMutation.mutate(values))}>
          <Stack>
            <Title order={3}>Set a new password</Title>
            <Text size="sm" c="dimmed">
              This account was provisioned with a temporary password. Choose a new one to continue.
            </Text>
            {needsEmail && (
              <Text size="sm">
                This is the hospital's first administrator account. Give it the administrator's own
                email address: password resets and security notices go there.
              </Text>
            )}
            {changeMutation.isError && (
              <Alert tone="danger" title="Password change failed">
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
            {needsEmail && (
              <Controller
                control={form.control}
                name="email"
                render={({ field, fieldState }) => (
                  <TextInput
                    {...field}
                    type="email"
                    label="Administrator's email"
                    withAsterisk
                    error={fieldState.error?.message}
                    autoComplete="email"
                  />
                )}
              />
            )}
            <Button tone="primary" type="submit" loading={changeMutation.isPending}>
              Change password
            </Button>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
