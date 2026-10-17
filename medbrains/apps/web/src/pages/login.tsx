import { Anchor, Box, Center, Divider, Loader, Stack, Text, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { api, nullOn404 } from "@medbrains/api";
import { useAuthStore } from "@medbrains/stores";
import type { SignInOptions } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate } from "react-router";
import { Brand } from "@/components/Brand";
import { DesktopConnection } from "@/components/login/DesktopConnection";
import { HospitalCodeStep } from "@/components/login/HospitalCodeStep";
import { PasswordSignIn } from "@/components/login/PasswordSignIn";
import { SignInStage } from "@/components/login/SignInStage";
import { SsoLoginButtons } from "@/components/SsoLoginButtons";
import { Alert } from "@/components/ui";
import { isTauriDesktopRuntime } from "@/lib/desktop-runtime";
import { getRememberedHospitalCode, rememberHospitalCode } from "@/lib/hospital-code";
import classes from "./login.module.scss";

/**
 * Sign-in starts with the hospital. Its code (remembered on this device), or
 * the hospital's own domain the page is on, names it; the server answers with
 * that hospital's name and how it signs in — its own identity providers
 * and/or username and password — and only those are offered.
 */
export function LoginPage() {
  const user = useAuthStore((s) => s.user);
  // null: no code yet — the server tries the hospital's own domain.
  const [code, setCode] = useState<string | null>(() => getRememberedHospitalCode() || null);
  const [choosing, setChoosing] = useState(false);
  const options = useQuery({
    queryKey: ["sign-in-options", code ?? "@domain"],
    queryFn: () => api.getSignInOptions(code ?? undefined).catch(nullOn404),
    staleTime: 300_000,
    retry: false,
  });
  // Only an empty server takes a registration (see onboarding/init).
  const { data: onboarding } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => api.onboardingStatus(),
    staleTime: 300_000,
    retry: false,
  });

  if (user) return <Navigate to="/dashboard" replace />;

  const hospital = choosing ? null : options.data;
  return (
    <Box className={classes.wrapper}>
      <SignInStage />

      <main className={classes.formSide}>
        <Box className={classes.container}>
          <Stack align="center" gap="xs" mb="xl">
            <Brand surface="signin" />
            <Text
              component="h1"
              size="sm"
              fw={600}
              c="var(--mb-text-secondary)"
              tt="uppercase"
              className={classes.title}
            >
              Sign in
            </Text>
            <Text
              size="sm"
              c="var(--mb-text-secondary)"
              ta="center"
              data-testid="login-hospital-name"
            >
              {hospital ? hospital.name : "Start with your hospital"}
            </Text>
          </Stack>

          {options.isPending && !choosing ? (
            <Center py="md">
              <Loader size="sm" aria-label="Checking how your hospital signs in" />
            </Center>
          ) : hospital ? (
            <HospitalSignIn
              hospital={hospital}
              onChangeHospital={() => {
                rememberHospitalCode("");
                setChoosing(true);
              }}
            />
          ) : (
            <HospitalCodeStep
              initialCode={code ?? ""}
              unknownCode={!choosing && code && options.data === null ? code : null}
              failed={!choosing && options.isError}
              checking={options.isFetching}
              onSubmit={(next) => {
                setChoosing(false);
                setCode(next);
              }}
            />
          )}

          {isTauriDesktopRuntime() && <DesktopConnection />}
          <LoginFooter
            needsSetup={onboarding?.needs_setup === true}
            trialOpen={onboarding?.trial_open === true}
          />
        </Box>
      </main>
    </Box>
  );
}

/** Step 2: the methods this hospital uses, and a way back to step 1. */
function HospitalSignIn({
  hospital,
  onChangeHospital,
}: {
  hospital: SignInOptions;
  onChangeHospital: () => void;
}) {
  // Passwords off: the hospital's break-glass admin can still use one.
  const [breakGlass, setBreakGlass] = useState(false);
  const hasSso = hospital.providers.length > 0;
  const showPassword = hospital.password || breakGlass;
  return (
    <Stack gap="md">
      {hasSso && (
        <SsoLoginButtons
          providers={hospital.providers}
          hideDivider
          onStart={() => rememberHospitalCode(hospital.code)}
        />
      )}
      {hasSso && showPassword && <Divider label="or" labelPosition="center" />}
      {showPassword && <PasswordSignIn hospitalCode={hospital.code} />}
      {!hasSso && !showPassword && (
        <Alert tone="warning" radius="md" data-testid="login-no-methods">
          {hospital.name} hasn't set up sign-in yet. Ask your IT desk.
        </Alert>
      )}
      <Center>
        <Stack gap={4} align="center">
          {!hospital.password && !breakGlass && (
            <Anchor
              component="button"
              type="button"
              size="sm"
              c="dimmed"
              onClick={() => setBreakGlass(true)}
            >
              Administrator? Use a password
            </Anchor>
          )}
          <Anchor
            component="button"
            type="button"
            size="sm"
            onClick={onChangeHospital}
            data-testid="login-change-hospital"
          >
            Not {hospital.name}? Change hospital
          </Anchor>
        </Stack>
      </Center>
    </Stack>
  );
}

function LoginFooter({ needsSetup, trialOpen }: { needsSetup: boolean; trialOpen: boolean }) {
  const [devOpened, dev] = useDisclosure(false);
  return (
    <Box className={classes.footer}>
      {needsSetup && (
        <Box className={classes.onboardingLink}>
          New installation? <Link to="/onboarding">Set up now &rarr;</Link>
        </Box>
      )}
      {trialOpen && (
        <Box className={classes.onboardingLink}>
          New to MedBrains? <Link to="/trial">Start a free trial &rarr;</Link>
        </Box>
      )}
      {/* The seeded admin's password, for local development only. */}
      {import.meta.env.DEV && (
        <Box className={classes.devHelper}>
          <UnstyledButton
            className={classes.devToggle}
            onClick={dev.toggle}
            aria-expanded={devOpened}
            aria-controls="dev-creds-panel"
          >
            {devOpened ? "Hide dev credentials" : "Dev credentials"}
          </UnstyledButton>
          {devOpened && (
            <Box id="dev-creds-panel" className={classes.devCreds}>
              <Text size="xs" c="var(--mb-text-secondary)" ff="var(--font-mono, monospace)">
                default / admin / admin123
              </Text>
            </Box>
          )}
        </Box>
      )}
      <Box className={classes.version}>MedBrains HMS v0.1.0</Box>
      <Text size="xs" c="var(--mb-text-secondary)" ta="center" mt={4}>
        <Anchor component={Link} to="/terms" c="inherit">
          Terms
        </Anchor>
        {" · "}
        <Anchor component={Link} to="/privacy" c="inherit">
          Privacy
        </Anchor>
      </Text>
      <Brand surface="footer" />
    </Box>
  );
}
