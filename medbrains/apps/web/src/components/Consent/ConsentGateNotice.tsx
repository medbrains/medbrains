/**
 * What a procedure screen shows about consent, per outcome.
 *
 * The two failure outcomes look different on purpose. `deny` is an answer:
 * there is no valid consent, and the fix is to obtain one. `unknown` is not an
 * answer: the check failed, and the fix is to verify another way. Rendering
 * them the same way — or rendering `unknown` as `deny` — tells a clinician
 * something the system does not know.
 *
 * Neither outcome blocks on its own. Refusing a transfusion because a consent
 * lookup timed out can kill someone; the gate states what it knows and makes
 * the clinician record that they proceeded anyway.
 */
import { Stack, Text } from "@mantine/core";
import { IconRefresh } from "@tabler/icons-react";
import { Alert, Button, Checkbox } from "@/components/ui";
import type { ConsentGateOutcome } from "@/hooks/useConsentGate";

export interface ConsentGateNoticeProps {
  outcome: ConsentGateOutcome;
  /** What is about to happen, e.g. "this operation", "this transfusion". */
  procedureLabel: string;
  /** Ticked by the clinician to proceed without a valid recorded consent. */
  overrideAcknowledged: boolean;
  onOverrideChange: (acknowledged: boolean) => void;
  onRecheck: () => void;
}

export function ConsentGateNotice({
  outcome,
  procedureLabel,
  overrideAcknowledged,
  onOverrideChange,
  onRecheck,
}: ConsentGateNoticeProps) {
  if (outcome === "checking") {
    return (
      <Text size="sm" c="dimmed">
        Checking consent…
      </Text>
    );
  }

  if (outcome === "allow") {
    return (
      <Alert tone="success" title="Consent on file">
        A valid consent covers {procedureLabel}.
      </Alert>
    );
  }

  if (outcome === "deny") {
    return (
      <Alert tone="danger" title="No valid consent on file">
        <Stack gap="xs">
          <Text size="sm">
            Nothing recorded covers {procedureLabel}. Obtain and record consent before proceeding.
          </Text>
          <Checkbox
            checked={overrideAcknowledged}
            onChange={(event) => onOverrideChange(event.currentTarget.checked)}
            label="Consent was taken and will be recorded — proceed and document it"
          />
        </Stack>
      </Alert>
    );
  }

  // unknown — deliberately not phrased as an absence of consent.
  return (
    <Alert tone="warning" title="Consent could not be checked">
      <Stack gap="xs">
        <Text size="sm">
          The consent record could not be read. This is <b>not</b> the same as no consent on file —
          the system does not know either way. Verify by another route before {procedureLabel}.
        </Text>
        <Button
          size="compact-sm"
          tone="secondary"
          leftSection={<IconRefresh size={14} />}
          onClick={onRecheck}
        >
          Try again
        </Button>
        <Checkbox
          checked={overrideAcknowledged}
          onChange={(event) => onOverrideChange(event.currentTarget.checked)}
          label="Consent verified another way — proceed"
        />
      </Stack>
    </Alert>
  );
}
