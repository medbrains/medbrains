import { zodResolver } from "@hookform/resolvers/zod";
import { Anchor, Box, Checkbox, PasswordInput, Stack, TextInput } from "@mantine/core";
import { userSchema } from "@medbrains/schemas";
import { useAuthStore, usePermissionStore } from "@medbrains/stores";
import { IconLock, IconUser } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { Alert, Button } from "@/components/ui";
import {
  DEFAULT_LOGIN_FORM_VALUES,
  type LoginFormInput,
  loginFormSchema,
} from "@/forms/login.form";
import { rememberHospitalCode } from "@/lib/hospital-code";
import classes from "@/pages/login.module.scss";
import { sessionService } from "@/services/session.service";

interface PasswordSignInProps {
  /** The hospital chosen in step 1; every attempt is scoped to it. */
  hospitalCode: string;
}

/** Username and password for one hospital, with the two-factor step. */
export function PasswordSignIn({ hospitalCode }: PasswordSignInProps) {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setPermissions = usePermissionStore((s) => s.setPermissions);
  const form = useForm<LoginFormInput>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: DEFAULT_LOGIN_FORM_VALUES,
  });
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  const login = useMutation({
    mutationFn: (values: LoginFormInput) =>
      sessionService.login({
        username: values.username,
        password: values.password,
        hospital_code: hospitalCode,
        ...(mfaStep ? { mfa_code: mfaCode } : {}),
      }),
    // The refusal is shown on the form (below); no global "Action failed" toast.
    onError: () => undefined,
    onSuccess: (data) => {
      if (data.mfa_required) {
        setMfaStep(true);
        return;
      }
      rememberHospitalCode(hospitalCode);
      setAuth(
        userSchema.parse({
          ...data.user,
          access_matrix: {},
          is_active: true,
          created_at: "",
          updated_at: "",
        }),
      );
      setPermissions(data.user.role, data.permissions, data.field_access);
      navigate("/dashboard");
    },
  });

  return (
    <form onSubmit={form.handleSubmit((values) => login.mutate(values))}>
      <Stack gap="md">
        <TextInput
          label="Username"
          placeholder="Enter your username"
          leftSection={<IconUser size={16} />}
          error={form.formState.errors.username?.message}
          {...form.register("username")}
          required
          size="md"
          autoComplete="username"
        />
        <PasswordInput
          label="Password"
          placeholder="Enter your password"
          leftSection={<IconLock size={16} />}
          error={form.formState.errors.password?.message}
          {...form.register("password")}
          required
          size="md"
          autoComplete="current-password"
          visibilityToggleButtonProps={{ "aria-label": "Show or hide password" }}
        />
        <Box className={classes.formFooter}>
          <Controller
            control={form.control}
            name="remember_me"
            render={({ field }) => (
              <Checkbox
                label="Remember me"
                size="xs"
                checked={field.value}
                onChange={(event) => field.onChange(event.currentTarget.checked)}
              />
            )}
          />
          <Anchor component={Link} to="/forgot-password" size="xs" c="primary">
            Forgot password?
          </Anchor>
        </Box>
        {login.isError && (
          <Alert tone="danger" radius="md" data-testid="login-error">
            {login.error.message}
          </Alert>
        )}
        {mfaStep && (
          <TextInput
            label="Two-factor code"
            placeholder="6-digit code or recovery code"
            value={mfaCode}
            onChange={(event) => setMfaCode(event.currentTarget.value)}
            inputMode="numeric"
            autoFocus
            size="md"
          />
        )}
        <Button tone="primary" type="submit" fullWidth loading={login.isPending} size="md">
          {mfaStep ? "Verify & Sign In" : "Sign In"}
        </Button>
      </Stack>
    </form>
  );
}
