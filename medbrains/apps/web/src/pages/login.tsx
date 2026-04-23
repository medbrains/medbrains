import {
  Alert,
  Anchor,
  Button,
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
import { IconLock, IconUser } from "@tabler/icons-react";
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
      {/* Left — dark forest manifesto panel */}
      <div className={classes.manifesto}>
        <div className={classes.manifestoLogo}>
          <img src="/logo/medbrains-mark.svg" alt="" width={36} height={36} style={{ borderRadius: 8 }} />
          <span className={classes.manifestoLogoText}>MedBrains</span>
        </div>

        <h1 className={classes.manifestoTitle}>
          The hospital operating system built for <em>everyone</em>
        </h1>

        <p className={classes.manifestoBody}>
          From OPD to ICU, pharmacy to billing — one platform that runs
          the entire hospital. Open source, multi-tenant, compliance-ready.
        </p>

        <div className={classes.manifestoStats}>
          <div className={classes.manifestoStat}>
            <span className={classes.manifestoStatValue}>67+</span>
            <span className={classes.manifestoStatLabel}>Modules</span>
          </div>
          <div className={classes.manifestoStat}>
            <span className={classes.manifestoStatValue}>2,189</span>
            <span className={classes.manifestoStatLabel}>Features</span>
          </div>
          <div className={classes.manifestoStat}>
            <span className={classes.manifestoStatValue}>NABH</span>
            <span className={classes.manifestoStatLabel}>Compliant</span>
          </div>
        </div>

        {/* Subtle ECG line */}
        <svg className={classes.manifestoEcg} viewBox="0 0 600 40" fill="none" preserveAspectRatio="none">
          <polyline
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points="0,20 80,20 100,20 110,18 115,14 118,10 120,20 125,20 140,20 150,18 155,6 157,34 160,14 163,20 170,20 250,20 270,20 280,18 285,14 288,10 290,20 295,20 310,20 320,18 325,6 327,34 330,14 333,20 340,20 420,20 440,20 450,18 455,14 458,10 460,20 465,20 480,20 490,18 495,6 497,34 500,14 503,20 510,20 600,20"
          />
        </svg>
      </div>

      {/* Right — white form */}
      <div className={classes.formSide}>
        <div className={classes.container}>
          <Stack align="center" gap="sm" mb="xl">
            <img
              src="/logo/medbrains-mark.svg"
              alt="MedBrains"
              width={48}
              height={48}
              style={{ borderRadius: 12 }}
              className={classes.mobileLogo}
            />
            <Text size="xl" fw={700} c="var(--mb-text-primary)">
              Sign in
            </Text>
            <Text size="sm" c="var(--mb-text-secondary)">
              Enter your credentials to access MedBrains
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
                  <Text size="xs" c="var(--mb-text-secondary)" ff="var(--font-mono, monospace)">
                    admin / admin123
                  </Text>
                </div>
              )}
            </div>

            <div className={classes.version}>MedBrains HMS v0.1.0</div>
          </div>
        </div>
      </div>
    </div>
  );
}
