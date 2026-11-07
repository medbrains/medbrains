/**
 * The page the QR on a signed print opens: a discharge summary, a lab or
 * radiology report, a signed prescription.
 *
 * Read by a TPA officer, a court clerk or a doctor at another hospital, often
 * on a phone, with the paper in hand. It answers the one question first ("is
 * this record unchanged?") and then who signed it, when, at which facility,
 * and whether the signing key still stands. It never shows the patient or the
 * clinical content: the reader holds the paper, and the full record always
 * needs the hospital.
 *
 * A token the hospital never issued and a missing one give the same answer.
 * A check that could not run (the server busy or down) says so, and is never
 * worded as "not genuine".
 */

import { Group, Stack, Text, Title } from "@mantine/core";
import { ApiError } from "@medbrains/api";
import type { CheckedSignedDocument } from "@medbrains/types";
import { IconCircleCheck, IconCircleX, IconClockQuestion } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { Alert, Badge, Card } from "@/components/ui";
import { signatureService } from "@/services/signature.service";

const DOCUMENT_LABEL: Record<string, string> = {
  discharge_summary: "Discharge summary",
  lab_report: "Laboratory report",
  radiology_report: "Radiology report",
  prescription: "Prescription",
};

const PAGE = { p: "md", gap: "md", maw: 640, mx: "auto", w: "100%" } as const;

/** The public check page: reads the token from the URL and shows the outcome. */
export function VerifySignaturePage() {
  const { token = "" } = useParams<{ token: string }>();
  const check = useQuery({
    queryKey: ["verify-signature", token],
    queryFn: () => signatureService.verifySignatureLink(token),
    enabled: Boolean(token),
    retry: false,
  });

  if (check.isLoading) {
    return (
      <Stack {...PAGE} align="center">
        <Text>Checking this document…</Text>
      </Stack>
    );
  }
  if (check.isError || !check.data) {
    const notOurs = !token || (check.error instanceof ApiError && check.error.status === 404);
    return <CheckFailed notOurs={notOurs} />;
  }
  if (check.data.status === "withdrawn") {
    return (
      <Stack {...PAGE}>
        <Title order={1} size="h2">
          This check was withdrawn
        </Title>
        <Alert tone="warning" title="Do not rely on this copy">
          The hospital withdrew the check for this document on{" "}
          {new Date(check.data.withdrawn_on).toLocaleDateString()}. Ask the hospital for a current
          copy before relying on it.
        </Alert>
      </Stack>
    );
  }
  return <CheckedDocument doc={check.data} />;
}

/** No answer: an unknown code ("no match") or a server that did not answer. */
function CheckFailed({ notOurs }: { notOurs: boolean }) {
  return (
    <Stack {...PAGE}>
      <Title order={1} size="h2">
        {notOurs ? "This document could not be verified" : "The check could not run"}
      </Title>
      {notOurs ? (
        <Alert tone="danger" title="No match">
          The code on this paper is not one a hospital on MedBrains issued. Contact the hospital
          before relying on it.
        </Alert>
      ) : (
        <Alert tone="warning" title="Try again in a minute">
          The hospital's server did not answer. This says nothing about the document either way.
        </Alert>
      )}
    </Stack>
  );
}

/** The headline, icon and notice for each outcome of the check. */
const OUTCOME = {
  unchanged: {
    Icon: IconCircleCheck,
    title: "Unchanged since it was signed",
    tone: "success",
    notice: "The record matches the signature",
    detail: "Compare the paper with the hospital's copy if anything on it looks altered.",
  },
  changed: {
    Icon: IconCircleX,
    title: "Changed since it was signed",
    tone: "danger",
    notice: "Do not rely on this copy",
    detail:
      "The hospital's record no longer matches what the doctor signed. Ask the hospital for the current record.",
  },
  signed_before_checks: {
    Icon: IconClockQuestion,
    title: "Signed before online checking began",
    tone: "info",
    notice: "This copy cannot be checked online",
    detail: "Ask the hospital's records department to confirm this copy.",
  },
} as const;

/** The outcome, then who signed, when, and the signing key's status. */
function CheckedDocument({ doc }: { doc: CheckedSignedDocument }) {
  const outcome = OUTCOME[doc.status];
  return (
    <Stack {...PAGE}>
      <Stack gap={4}>
        <Text size="sm" c="dimmed">
          {DOCUMENT_LABEL[doc.document_type] ?? "Signed document"} · {doc.facility}
        </Text>
        <Group gap="xs" wrap="nowrap" align="center">
          <outcome.Icon size={32} aria-hidden />
          <Title order={1} size="h2">
            {outcome.title}
          </Title>
        </Group>
      </Stack>
      <Alert tone={outcome.tone} title={outcome.notice}>
        {outcome.detail}
        {doc.status === "signed_before_checks" &&
          (doc.signature_intact
            ? " The doctor's signature itself is intact."
            : " The doctor's signature could not be confirmed.")}
      </Alert>
      <Card withBorder padding="md">
        <Stack gap="sm">
          <Fact label="Signed by" value={doc.signer_name} />
          <Fact label="Registration" value={registration(doc)} />
          <Fact label="Signed on" value={new Date(doc.signed_at).toLocaleString()} />
          <Group justify="space-between" gap="xs">
            <Text size="sm" c="dimmed">
              Signing key
            </Text>
            <KeyStatus doc={doc} />
          </Group>
        </Stack>
      </Card>
      <Text size="xs" c="dimmed">
        This page shows no patient or clinical detail. The full record is available only from the
        hospital.
      </Text>
    </Stack>
  );
}

/** The registration number with its council, or "Not recorded". */
function registration(doc: CheckedSignedDocument): string {
  if (!doc.signer_registration) return "Not recorded";
  return doc.signer_council
    ? `${doc.signer_registration} (${doc.signer_council})`
    : doc.signer_registration;
}

/** One labelled fact on the card. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" gap="xs" align="flex-start" wrap="nowrap">
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600} ta="right">
        {value}
      </Text>
    </Group>
  );
}

/** The signing key's status as a badge, with the revocation date when revoked. */
function KeyStatus({ doc }: { doc: CheckedSignedDocument }) {
  if (doc.key_status === "active") return <Badge tone="success">Active</Badge>;
  if (doc.key_status === "revoked") {
    const on = doc.key_revoked_on ? new Date(doc.key_revoked_on).toLocaleDateString() : "";
    return <Badge tone="warning">{`Revoked ${on}`.trim()}</Badge>;
  }
  return <Badge tone="neutral">Not on record</Badge>;
}
