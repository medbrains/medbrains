import { Stack, TextInput } from "@mantine/core";
import { ApiError } from "@medbrains/api";
import { IconBuildingHospital } from "@tabler/icons-react";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";

/**
 * Why the hospital lookup failed. Three different facts, never one message:
 * the server is busy refusing this computer, the server answered with an
 * error, or the server was not reached at all.
 */
type HospitalLookupFailure = "rate_limited" | "server_error" | "unreachable";

/** What the person is told for each failure, with what to do next. */
const FAILURE_MESSAGES: Record<HospitalLookupFailure, string> = {
  rate_limited: "Too many attempts from this computer. Try again in a minute.",
  server_error:
    "The hospital server answered with an error. Try again in a moment; if it keeps happening, call IT.",
  unreachable:
    "Couldn't reach the hospital server. This is a connection problem, not a wrong code — try again in a moment.",
};

/** Classify a failed sign-in-options lookup: only a request that got no answer is "unreachable". */
export function classifyLookupFailure(error: unknown): HospitalLookupFailure {
  if (!(error instanceof ApiError)) return "unreachable";
  return error.status === 429 ? "rate_limited" : "server_error";
}

interface HospitalCodeStepProps {
  initialCode: string;
  /** The code the server knew no hospital by, if the last try was one. */
  unknownCode: string | null;
  /** Why the last lookup failed, other than an unknown code; falsy when it did not. */
  lookupError: unknown;
  checking: boolean;
  onSubmit: (code: string) => void;
}

/** Step 1 of sign-in: which hospital. Everything after depends on it. */
export function HospitalCodeStep({
  initialCode,
  unknownCode,
  lookupError,
  checking,
  onSubmit,
}: HospitalCodeStepProps) {
  const [code, setCode] = useState(initialCode);
  const failure = lookupError ? classifyLookupFailure(lookupError) : null;
  const trimmed = code.trim();
  return (
    <Stack
      component="form"
      gap="md"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) onSubmit(trimmed);
      }}
    >
      <TextInput
        label="Hospital code"
        description="The code your hospital gave you, e.g. CITYHOSP."
        placeholder="Hospital code"
        leftSection={<IconBuildingHospital size={16} />}
        value={code}
        onChange={(event) => setCode(event.currentTarget.value)}
        error={
          unknownCode
            ? `No hospital uses the code "${unknownCode}". Check it with your IT desk.`
            : undefined
        }
        autoCapitalize="characters"
        autoComplete="organization"
        autoFocus
        required
        size="md"
        data-testid="login-hospital-code"
      />
      {failure && (
        <Alert
          tone={failure === "rate_limited" ? "warning" : "danger"}
          data-testid="login-hospital-failed"
        >
          {FAILURE_MESSAGES[failure]}
        </Alert>
      )}
      <Button
        tone="primary"
        type="submit"
        fullWidth
        size="md"
        loading={checking}
        disabled={!trimmed}
      >
        Continue
      </Button>
    </Stack>
  );
}
