/**
 * The patient portal — a patient reading their own records.
 *
 * The whole API for this has existed with nothing calling it: sign-in by OTP,
 * bills, lab reports, prescriptions, appointments. Six endpoints, no way in.
 *
 * Read on a phone, often in a corridor, by somebody who is worried. So it is
 * one column, no navigation chrome, and the four things they came for are
 * tabs rather than pages — a patient checking a result should not have to
 * learn where anything lives.
 *
 * The session is deliberately separate from staff auth in every respect: its
 * own storage key, its own token passed per call, its own sign-out. Nothing
 * here can widen into a staff session, and signing out of one does not touch
 * the other.
 */

import { Stack, Tabs, Text, TextInput, Title } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router";
import { Alert, Button } from "@/components/ui";
import { portalService } from "@/services/portal.service";
import {
  clearPortalSession,
  readPortalSession,
  type StoredPortalSession,
  storePortalSession,
} from "./portal-session";
import { PortalAppointments, PortalBills, PortalPrescriptions, PortalReports } from "./views";

/** Digits in the code the server mints. */
const CODE_LENGTH = 6;

export function PatientPortalPage() {
  const { tenantCode = "" } = useParams<{ tenantCode: string }>();
  // Read once on first render rather than in an effect: this is a synchronous
  // read of storage, and an effect would flash the sign-in screen at somebody
  // who is already signed in.
  const [session, setSession] = useState<StoredPortalSession | null>(() => readPortalSession());

  if (!session) {
    return <SignIn tenantCode={tenantCode} onSignedIn={setSession} />;
  }

  return (
    <Frame>
      <Stack gap={2} w="100%">
        <Title order={2}>Your records</Title>
        <Text size="sm" c="dimmed">
          Signed in. This closes when you close the tab.
        </Text>
      </Stack>

      <Tabs defaultValue="reports" w="100%">
        <Tabs.List grow>
          <Tabs.Tab value="reports">Results</Tabs.Tab>
          <Tabs.Tab value="prescriptions">Medicines</Tabs.Tab>
          <Tabs.Tab value="bills">Bills</Tabs.Tab>
          <Tabs.Tab value="visits">Visits</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="reports" pt="md">
          <PortalReports token={session.token} />
        </Tabs.Panel>
        <Tabs.Panel value="prescriptions" pt="md">
          <PortalPrescriptions token={session.token} />
        </Tabs.Panel>
        <Tabs.Panel value="bills" pt="md">
          <PortalBills token={session.token} />
        </Tabs.Panel>
        <Tabs.Panel value="visits" pt="md">
          <PortalAppointments token={session.token} />
        </Tabs.Panel>
      </Tabs>

      <Button
        tone="secondary"
        fullWidth
        onClick={() => {
          clearPortalSession();
          setSession(null);
        }}
      >
        Sign out
      </Button>
    </Frame>
  );
}

function SignIn({
  tenantCode,
  onSignedIn,
}: {
  tenantCode: string;
  onSignedIn: (session: StoredPortalSession) => void;
}) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const sendCode = useMutation({
    mutationFn: () =>
      portalService.requestPortalOtp({ tenant_code: tenantCode, phone: phone.trim() }),
    // The server answers identically whether or not the phone belongs to a
    // patient — telling them apart would turn this into a way to ask "is this
    // person treated here". The page keeps that promise and claims nothing
    // about delivery.
    onSuccess: () => {
      setCodeSent(true);
      setFailure(null);
    },
    onError: (error: Error) => setFailure(error.message),
  });

  const verify = useMutation({
    mutationFn: () =>
      portalService.verifyPortalOtp({
        tenant_code: tenantCode,
        phone: phone.trim(),
        code: code.replace(/\D/g, ""),
      }),
    onSuccess: (session) => onSignedIn(storePortalSession(session)),
    onError: () =>
      // One message for a wrong code, an expired one and a phone with no
      // records. Anything more specific confirms who is a patient here.
      setFailure("That code did not work. Check it, or send a new one."),
  });

  const digits = phone.replace(/\D/g, "");
  const canSend = digits.length >= 10 && digits.length <= 15;
  const canVerify = code.replace(/\D/g, "").length === CODE_LENGTH;

  return (
    <Frame>
      <Title order={2}>See your records</Title>
      <Text size="sm">
        Enter the mobile number the hospital has for you. We will send a code to sign you in.
      </Text>

      <TextInput
        label="Mobile number"
        value={phone}
        onChange={(event) => setPhone(event.currentTarget.value)}
        inputMode="tel"
        autoComplete="tel"
        w="100%"
      />

      <Button
        tone={codeSent ? "secondary" : "primary"}
        fullWidth
        loading={sendCode.isPending}
        disabled={sendCode.isPending || !canSend}
        onClick={() => sendCode.mutate()}
      >
        {codeSent ? "Send a new code" : "Send code"}
      </Button>

      {codeSent && (
        <>
          <TextInput
            label="Code"
            description={`Enter the ${CODE_LENGTH} digits sent to your phone.`}
            value={code}
            onChange={(event) => setCode(event.currentTarget.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH + 2}
            w="100%"
          />
          <Button
            tone="primary"
            fullWidth
            loading={verify.isPending}
            disabled={verify.isPending || !canVerify}
            onClick={() => {
              setFailure(null);
              verify.mutate();
            }}
          >
            Sign in
          </Button>
        </>
      )}

      {failure && (
        <Alert tone="warning" title="We could not sign you in">
          {failure}
        </Alert>
      )}

      <Text size="xs" c="dimmed">
        If you have no records here, or the hospital has a different number for you, no code will
        arrive. Ask at reception.
      </Text>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <Stack align="center" gap="md" p="lg" mx="auto" maw={560} mih="100vh">
      {children}
    </Stack>
  );
}
