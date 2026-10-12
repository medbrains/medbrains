import { Stack, TextInput } from "@mantine/core";
import { IconBuildingHospital } from "@tabler/icons-react";
import { useState } from "react";
import { Alert, Button } from "@/components/ui";

interface HospitalCodeStepProps {
  initialCode: string;
  /** The code the server knew no hospital by, if the last try was one. */
  unknownCode: string | null;
  /** The lookup failed for another reason: the server, not the code. */
  failed: boolean;
  checking: boolean;
  onSubmit: (code: string) => void;
}

/** Step 1 of sign-in: which hospital. Everything after depends on it. */
export function HospitalCodeStep({
  initialCode,
  unknownCode,
  failed,
  checking,
  onSubmit,
}: HospitalCodeStepProps) {
  const [code, setCode] = useState(initialCode);
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
        description="The code your hospital gave you, e.g. AMH."
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
      {failed && (
        <Alert tone="danger" radius="md" data-testid="login-hospital-failed">
          Couldn't reach the hospital server. This is a connection problem, not a wrong code — try
          again in a moment.
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
