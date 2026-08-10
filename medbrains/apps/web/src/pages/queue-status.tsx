/**
 * Follow your own queue token, from your phone.
 *
 * The kiosk has been printing a QR to this address since self-check-in
 * shipped, and there was no page here. A patient scanned it and got a 404 while
 * standing in a waiting room.
 *
 * What they actually want to know is whether they can sit down, walk to the
 * chemist, or need to be at the door now — so the count of people ahead is the
 * largest thing on the page, and being called takes the whole screen.
 *
 * Public by necessity: a patient has no login. The opaque token in the URL is
 * the entire authorisation, and the server keeps it that way — the reply
 * carries a token number, a department and a position, and no name, no id and
 * nothing clinical. Someone reading over a shoulder learns that a stranger is
 * fourth in line for Orthopaedics.
 */

import { Loader, Stack, Text, Title } from "@mantine/core";
import type { PublicTokenStatus } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { Alert, Card } from "@/components/ui";
import { appointmentsService } from "@/services/appointments.service";
import { type QueueStage, queueStage, queueWaitLabel } from "./queue-status-model";

/**
 * How often the page re-asks.
 *
 * Fast enough that "you're next" arrives while the patient can still act on
 * it, slow enough that a full waiting room is not hammering the server. A
 * queue moves in minutes, not seconds.
 */
const REFRESH_MS = 20_000;

export function QueueStatusPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["public-queue-token", token],
    queryFn: () => appointmentsService.getPublicQueueTokenStatus(token ?? ""),
    enabled: Boolean(token),
    refetchInterval: REFRESH_MS,
    // A patient reopening the tab wants the truth, not what it said an hour ago.
    refetchOnWindowFocus: true,
    retry: false,
  });

  if (isLoading) {
    return (
      <Frame>
        <Loader />
        <Text>Finding your token…</Text>
      </Frame>
    );
  }

  // An expired, unknown or tampered token all read the same. Telling them apart
  // would confirm to someone guessing that a token once existed here.
  if (isError || !data) {
    return (
      <Frame>
        <Title order={2}>We could not find this token</Title>
        <Alert tone="warning" title="This link may have expired">
          Links stop working after the day they were issued. Please ask at the reception desk and
          they will help you.
        </Alert>
      </Frame>
    );
  }

  return (
    <Frame>
      <TokenView status={data} />
    </Frame>
  );
}

function TokenView({ status }: { status: PublicTokenStatus }) {
  const stage = queueStage(status.status);

  return (
    <Stack gap="lg" align="center" w="100%">
      <Text size="sm" c="dimmed" tt="uppercase" style={{ letterSpacing: "0.12em" }}>
        {status.department_name || "Your queue"}
      </Text>

      <Text
        style={{ fontSize: 88, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}
      >
        {status.token_number}
      </Text>

      {/*
        The changing part is announced on its own. A screen-reader user should
        hear "you are being called" without re-reading the page, and should not
        have the token number repeated at them every twenty seconds.
      */}
      <output aria-live="polite" style={{ width: "100%" }}>
        <StageCard stage={stage} status={status} />
      </output>

      <Text size="xs" c="dimmed" ta="center">
        This page updates on its own. Keep it open.
      </Text>
    </Stack>
  );
}

function StageCard({ stage, status }: { stage: QueueStage; status: PublicTokenStatus }) {
  if (stage === "called") {
    return (
      <Alert tone="success" title="You are being called now">
        Please go to {status.department_name || "the department"}.
      </Alert>
    );
  }

  if (stage === "in_consultation") {
    return <Alert tone="info" title="You are with the doctor now" />;
  }

  if (stage === "finished") {
    return (
      <Alert tone="neutral" title="This visit is finished">
        Nothing more to wait for. If you were asked to come back, reception will have given you a
        new token.
      </Alert>
    );
  }

  if (stage === "missed") {
    return (
      <Alert tone="warning" title="Your number was called and missed">
        Please go to the reception desk. They can put you back in the queue.
      </Alert>
    );
  }

  return <WaitingCard status={status} />;
}

function WaitingCard({ status }: { status: PublicTokenStatus }) {
  const ahead = status.ahead ?? 0;

  return (
    <Card>
      <Stack gap={4} align="center" py="md">
        <Text
          style={{
            fontSize: 56,
            fontWeight: 800,
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {ahead}
        </Text>
        <Text size="lg">{ahead === 1 ? "person ahead of you" : "people ahead of you"}</Text>
        <Text size="sm" c="dimmed">
          {queueWaitLabel(status.estimated_wait_minutes)}
        </Text>
      </Stack>
    </Card>
  );
}

/**
 * One narrow column. Read one-handed, on a phone, by someone who may be
 * standing — so nothing to navigate and nothing below the fold that matters.
 */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <Stack
      align="center"
      justify="center"
      gap="md"
      p="lg"
      mx="auto"
      maw={480}
      mih="100vh"
      style={{ textAlign: "center" }}
    >
      {children}
    </Stack>
  );
}
