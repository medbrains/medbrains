import {
  Alert,
  Anchor,
  Button,
  Card,
  Checkbox,
  PasswordInput,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { api } from "@medbrains/api";
import { useAuthStore, usePermissionStore } from "@medbrains/stores";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import {
  IconLock,
  IconUser,
} from "@tabler/icons-react";
import classes from "./login.module.scss";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showDevCreds, setShowDevCreds] = useState(false);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setPermissions = usePermissionStore((s) => s.setPermissions);

  const loginMutation = useMutation({
    mutationFn: () => api.login({ username, password }),
    onSuccess: (data) => {
      setAuth(data.user as never);
      setPermissions(data.user.role, data.permissions, data.field_access);
      navigate("/dashboard");
    },
  });

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={classes.wrapper}>
      <div className={classes.container}>
        <Card className={classes.card}>
          <Stack align="center" gap="sm" mb="xl">
            <img src="/logo/medbrains-mark.svg" alt="MedBrains" width={48} height={48} style={{ borderRadius: 12 }} />
            <Text size="xl" fw={700} c="var(--mb-text-primary)">
              MedBrains
            </Text>
            <Text size="sm" c="var(--mb-text-secondary)">
              Sign in to your account
            </Text>
          </Stack>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              loginMutation.mutate();
            }}
          >
            <Stack gap="md">
              <TextInput
                label="Username"
                placeholder="Enter your username"
                leftSection={<IconUser size={16} />}
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                required
                size="md"
              />
              <PasswordInput
                label="Password"
                placeholder="Enter your password"
                leftSection={<IconLock size={16} />}
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
                size="md"
              />

              <div className={classes.formFooter}>
                <Checkbox
                  label="Remember me"
                  size="xs"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.currentTarget.checked)}
                />
                <Anchor size="xs" c="primary">
                  Forgot password?
                </Anchor>
              </div>

              {loginMutation.isError && (
                <Alert color="danger" variant="light" radius="md">
                  {loginMutation.error.message}
                </Alert>
              )}

              <Button
                type="submit"
                fullWidth
                loading={loginMutation.isPending}
                size="md"
              >
                Sign In
              </Button>
            </Stack>
          </form>
        </Card>

        <div className={classes.footer}>
          <div className={classes.onboardingLink}>
            New installation?{" "}
            <Link to="/onboarding">Set up now &rarr;</Link>
          </div>

          <div className={classes.devHelper}>
            <button
              type="button"
              className={classes.devToggle}
              onClick={() => setShowDevCreds((v) => !v)}
            >
              {showDevCreds ? "Hide dev credentials" : "Dev credentials"}
            </button>
            {showDevCreds && (
              <div className={classes.devCreds}>
                <Text size="xs" c="var(--mb-text-secondary)">
                  admin / admin123
                </Text>
              </div>
            )}
          </div>

          <div className={classes.version}>MedBrains HMS v0.1.0</div>
        </div>
      </div>
    </div>
  );
}
