import { Code, Stack, Text } from "@mantine/core";
import type { ConnectedAppCredentials } from "@medbrains/types";
import { Alert, Button, Modal } from "@/components/ui";

interface CredentialsModalProps {
  issued: ConnectedAppCredentials | null;
  onClose: () => void;
}

/** The only time a client secret or signing secret is ever shown. */
export function CredentialsModal({ issued, onClose }: CredentialsModalProps) {
  return (
    <Modal opened={issued !== null} onClose={onClose} title="App credentials" size="lg">
      <Stack gap="sm">
        <Alert tone="warning" title="This is the only time you will see these secrets">
          Give them to the vendor now, over a secure channel. Only a hash is kept, so a lost secret
          means rotating it.
        </Alert>
        <Text size="sm" fw={500}>
          Client ID
        </Text>
        <Code block aria-label="Client ID">
          {issued?.client_id}
        </Code>
        <Text size="sm" fw={500}>
          Client secret
        </Text>
        <Code block aria-label="Client secret">
          {issued?.client_secret}
        </Code>
        {issued?.webhook_signing_secret && (
          <>
            <Text size="sm" fw={500}>
              Webhook signing secret
            </Text>
            <Code block aria-label="Webhook signing secret">
              {issued.webhook_signing_secret}
            </Code>
          </>
        )}
        <Button tone="primary" onClick={onClose}>
          Done
        </Button>
      </Stack>
    </Modal>
  );
}
