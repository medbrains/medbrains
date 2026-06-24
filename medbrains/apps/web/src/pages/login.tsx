import { zodResolver } from "@hookform/resolvers/zod";
import { Anchor, Checkbox, Group, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@medbrains/api";
import { userSchema } from "@medbrains/schemas";
import { useAuthStore, usePermissionStore } from "@medbrains/stores";
import { IconLock, IconUser } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router";
import { SsoLoginButtons } from "@/components/SsoLoginButtons";
import { Alert, Button, Image } from "@/components/ui";
import {
  DEFAULT_LOGIN_FORM_VALUES,
  type LoginFormInput,
  loginFormSchema,
} from "@/forms/login.form";
import {
  defaultDesktopApiBase,
  getStoredDesktopApiBase,
  isTauriDesktopRuntime,
  normalizeDesktopApiBase,
  setStoredDesktopApiBase,
} from "@/lib/desktop-runtime";
import { sessionService } from "@/services/session.service";
import classes from "./login.module.scss";

export function LoginPage() {
  const [devCredsOpened, devCredsDisclosure] = useDisclosure(false);
  const isDesktop = isTauriDesktopRuntime();
  const defaultApiBase = defaultDesktopApiBase();
  const [desktopSetupOpened, desktopSetupDisclosure] = useDisclosure(false);
  const [desktopApiBaseInput, setDesktopApiBaseInput] = useState(
    getStoredDesktopApiBase() ?? sessionService.getApiBase() ?? defaultApiBase,
  );
  const [connectionStatus, setConnectionStatus] = useState<{
    color: "danger" | "success";
    message: string;
  } | null>(null);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setPermissions = usePermissionStore((s) => s.setPermissions);

  // Pre-auth: if this host is a hospital's custom domain, brand the login page
  // with that hospital. 404 (default domain) → fall back to MedBrains.
  const { data: tenantBrand } = useQuery({
    queryKey: ["tenant-by-host"],
    queryFn: () => api.getTenantByHost(window.location.hostname),
    retry: false,
    staleTime: 300_000,
  });
  const brandName = tenantBrand?.name ?? "MedBrains";
  const brandLogo = tenantBrand?.logo_url || "/logo/medbrains-mark.svg";

  const loginForm = useForm<LoginFormInput>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: DEFAULT_LOGIN_FORM_VALUES,
  });

  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  const loginMutation = useMutation({
    mutationFn: (values: LoginFormInput & { mfa_code?: string }) =>
      sessionService.login({
        username: values.username,
        password: values.password,
        ...(values.mfa_code ? { mfa_code: values.mfa_code } : {}),
      }),
    onSuccess: (data) => {
      if (data.mfa_required) {
        setMfaStep(true);
        return;
      }
      const authUser = userSchema.parse({
        ...data.user,
        access_matrix: {},
        is_active: true,
        created_at: "",
        updated_at: "",
      });
      setAuth(authUser);
      setPermissions(data.user.role, data.permissions, data.field_access);
      navigate("/dashboard");
    },
  });

  const normalizedDesktopApiBase = normalizeDesktopApiBase(desktopApiBaseInput);

  const saveDesktopConnection = () => {
    if (!normalizedDesktopApiBase) {
      setConnectionStatus({ color: "danger", message: "Enter a backend URL or /api." });
      return;
    }

    setStoredDesktopApiBase(normalizedDesktopApiBase);
    sessionService.setApiBase(normalizedDesktopApiBase);
    window.location.reload();
  };

  const resetDesktopConnection = () => {
    setStoredDesktopApiBase(null);
    setDesktopApiBaseInput(defaultApiBase);
    sessionService.setApiBase(defaultApiBase);
    window.location.reload();
  };

  const testDesktopConnection = async () => {
    if (!normalizedDesktopApiBase) {
      setConnectionStatus({ color: "danger", message: "Enter a backend URL or /api." });
      return;
    }

    setConnectionStatus(null);
    try {
      await sessionService.testHealthAtBase(normalizedDesktopApiBase);
      setConnectionStatus({ color: "success", message: "Backend health check passed." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed.";
      setConnectionStatus({ color: "danger", message });
    }
  };

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={classes.wrapper}>
      {/* Left — dark forest manifesto panel */}
      <div className={classes.manifesto}>
        <div className={classes.manifestoLogo}>
          <Image
            src="/logo/medbrains-mark.svg"
            alt=""
            w={36}
            h={36}
            fit="contain"
            radius={8}
            loading="eager"
          />
          <span className={classes.manifestoLogoText}>MedBrains</span>
        </div>

        <h1 className={classes.manifestoTitle}>
          The hospital operating system built for <em>everyone</em>
        </h1>

        <p className={classes.manifestoBody}>
          From OPD to ICU, pharmacy to billing — one platform that runs the entire hospital. Open
          source, multi-tenant, compliance-ready.
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
        <svg
          className={classes.manifestoEcg}
          viewBox="0 0 600 40"
          fill="none"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
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
            <Image
              src={brandLogo}
              alt={brandName}
              w={48}
              h={48}
              fit="contain"
              radius={12}
              loading="eager"
              className={classes.mobileLogo}
            />
            <Text size="xl" fw={700} c="var(--mb-text-primary)">
              Sign in
            </Text>
            <Text size="sm" c="var(--mb-text-secondary)">
              Enter your credentials to access {brandName}
            </Text>
          </Stack>

          <form
            onSubmit={loginForm.handleSubmit((values) =>
              loginMutation.mutate(mfaStep ? { ...values, mfa_code: mfaCode } : values),
            )}
          >
            <Stack gap="md">
              <TextInput
                label="Username"
                placeholder="Enter your username"
                leftSection={<IconUser size={16} />}
                error={loginForm.formState.errors.username?.message}
                {...loginForm.register("username")}
                required
                size="md"
              />
              <PasswordInput
                label="Password"
                placeholder="Enter your password"
                leftSection={<IconLock size={16} />}
                error={loginForm.formState.errors.password?.message}
                {...loginForm.register("password")}
                required
                size="md"
              />

              <div className={classes.formFooter}>
                <Controller
                  control={loginForm.control}
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
              </div>

              {loginMutation.isError && (
                <Alert tone="danger" radius="md">
                  {loginMutation.error.message}
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

              <Button
                tone="primary"
                type="submit"
                fullWidth
                loading={loginMutation.isPending}
                size="md"
              >
                {mfaStep ? "Verify & Sign In" : "Sign In"}
              </Button>
            </Stack>
          </form>

          <SsoLoginButtons />

          {isDesktop && (
            <div className={classes.desktopSetup}>
              <button
                type="button"
                className={classes.desktopSetupToggle}
                onClick={desktopSetupDisclosure.toggle}
              >
                Desktop connection setup
              </button>

              {desktopSetupOpened && (
                <div className={classes.desktopSetupPanel}>
                  <TextInput
                    label="Backend API URL"
                    description="Use /api for local dev, or enter a vendor / on-prem server URL."
                    placeholder="https://hospital.example.com/api"
                    value={desktopApiBaseInput}
                    onChange={(event) => {
                      setDesktopApiBaseInput(event.currentTarget.value);
                      setConnectionStatus(null);
                    }}
                    size="sm"
                  />

                  <div className={classes.desktopSetupActions}>
                    <Button tone="secondary" size="xs" onClick={testDesktopConnection}>
                      Test
                    </Button>
                    <Button tone="primary" size="xs" onClick={saveDesktopConnection}>
                      Save & reload
                    </Button>
                    <Button tone="ghost" size="xs" onClick={resetDesktopConnection}>
                      Reset
                    </Button>
                  </div>

                  {connectionStatus && (
                    <Alert tone={connectionStatus.color} radius="md">
                      {connectionStatus.message}
                    </Alert>
                  )}
                </div>
              )}
            </div>
          )}

          <div className={classes.footer}>
            <div className={classes.onboardingLink}>
              New installation? <Link to="/onboarding">Set up now &rarr;</Link>
            </div>

            <div className={classes.devHelper}>
              <button
                type="button"
                className={classes.devToggle}
                onClick={devCredsDisclosure.toggle}
              >
                {devCredsOpened ? "Hide dev credentials" : "Dev credentials"}
              </button>
              {devCredsOpened && (
                <div className={classes.devCreds}>
                  <Text size="xs" c="var(--mb-text-secondary)" ff="var(--font-mono, monospace)">
                    admin / admin123
                  </Text>
                </div>
              )}
            </div>

            <div className={classes.version}>MedBrains HMS v0.1.0</div>
            {tenantBrand && (
              // Open-source attribution on a white-labelled custom domain.
              <Group gap={6} justify="center" mt={6}>
                <Image
                  src="/logo/medbrains-mark-mono.svg"
                  alt=""
                  w={14}
                  h={14}
                  fit="contain"
                  loading="lazy"
                />
                <Text size="xs" c="var(--mb-text-muted)">
                  Powered by MedBrains
                </Text>
              </Group>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
