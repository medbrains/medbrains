import { Stack, Text } from "@mantine/core";
import { Alert, Button } from "@/components/ui";
import type { OwnSignatureStatus } from "@/hooks/useOwnSignature";

interface OwnSignatureNoticeProps {
  status: OwnSignatureStatus;
  onRecheck: () => void;
}

/**
 * What a sign screen says about the signer's own signature, beside its Sign
 * button. A failed check says so and offers Retry: it is never shown as "no
 * signature". A missing one says that Sign will ask for it.
 */
export function OwnSignatureNotice({ status, onRecheck }: OwnSignatureNoticeProps) {
  if (status === "unknown") {
    return (
      <Alert tone="danger" title="Couldn't check your signature">
        <Stack gap="xs" align="flex-start">
          <Text size="sm">Nothing is wrong with the record. Check again to sign it.</Text>
          <Button size="xs" onClick={onRecheck}>
            Retry
          </Button>
        </Stack>
      </Alert>
    );
  }
  if (status !== "missing") return null;
  return (
    <Text size="xs" c="dimmed">
      You have no signature yet. Sign will ask you to set it up first.
    </Text>
  );
}
