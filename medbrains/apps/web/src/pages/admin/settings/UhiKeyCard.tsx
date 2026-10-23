import { Anchor, Group, Stack, Text } from "@mantine/core";
import type { UhiSettingsView } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Card, Modal, PasswordField, toast } from "@/components/ui";
import { uhiService } from "@/services/uhi.service";

interface UhiKeyCardProps {
  data: UhiSettingsView | undefined;
  queryKey: readonly string[];
}

const HEADER_UTILITY = "https://github.com/NHA-ABDM/UHI/tree/main/header_generator_utility";
const SANDBOX_FORM = "https://sandbox.abdm.gov.in/sandbox/v3/sandbox-registration";

/**
 * Steps 2 and 3 of NHA's UHI onboarding: make the ed25519 key pair (here, or
 * with NHA's header generation utility and import the private key), then
 * submit the callback URL and public key to NHA. Nothing here depends on the
 * subscriber ID — NHA issues that after this step.
 */
export function UhiKeyCard({ data, queryKey }: UhiKeyCardProps) {
  const queryClient = useQueryClient();
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [imported, setImported] = useState("");
  const keys = useMutation({
    mutationFn: (privateKey?: string) => uhiService.generateKeys(privateKey),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKey, saved);
      setConfirmRotate(false);
      setImported("");
      toast.success("Submit the public key to NHA with the callback URL.", {
        title: "Signing key saved",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save the key" }),
  });
  const hasKey = Boolean(data?.signing_public_key);
  const run = (privateKey?: string) => (hasKey ? setConfirmRotate(true) : keys.mutate(privateKey));

  return (
    <Card>
      <Stack gap="sm">
        <Text fw={600}>2 · Make the signing key</Text>
        <Text size="sm" c="dimmed">
          Generate the ed25519 key pair here, or make it with NHA's{" "}
          <Anchor href={HEADER_UTILITY} target="_blank" rel="noreferrer">
            header generation utility
          </Anchor>{" "}
          and paste its private key. The private key is sealed on the server and never shown again.
        </Text>
        <Group align="flex-end">
          <Button
            tone="secondary"
            disabled={!data?.configured}
            loading={keys.isPending && !confirmRotate}
            onClick={() => run()}
          >
            {hasKey ? "Generate a new key" : "Generate the signing key"}
          </Button>
        </Group>
        <PasswordField
          label="Or import a private key"
          description="Base64 PKCS#8, as the header generation utility prints it."
          autoComplete="off"
          value={imported}
          onChange={(e) => setImported(e.currentTarget.value)}
          disabled={!data?.configured}
        />
        <Group>
          <Button
            tone="secondary"
            disabled={!data?.configured || imported.trim() === ""}
            loading={keys.isPending && imported !== ""}
            onClick={() => run(imported.trim())}
          >
            Import the key
          </Button>
        </Group>
        {!data?.configured && (
          <Text size="xs" c="dimmed">
            Save step 1 first.
          </Text>
        )}

        <Text fw={600} mt="md">
          3 · Submit to NHA
        </Text>
        <Text size="sm" c="dimmed">
          Tell your NHA contact the service and the role (HSPA, provider), then send these two
          values on the{" "}
          <Anchor href={SANDBOX_FORM} target="_blank" rel="noreferrer">
            sandbox registration form
          </Anchor>
          . NHA replies with the subscriber ID and key ID for step 4.
        </Text>
        {!data?.subscriber_url && (
          <Alert tone="warning" title="The public address is not set">
            MEDBRAINS_PUBLIC_BASE_URL must be set on the server before NHA can reach this hospital.
          </Alert>
        )}
        <Text size="sm">Callback URL (provider_uri)</Text>
        <Text size="sm" ff="monospace" style={{ wordBreak: "break-all" }}>
          {data?.subscriber_url ?? "—"}
        </Text>
        <Text size="sm">Signing public key</Text>
        <Text size="sm" ff="monospace" style={{ wordBreak: "break-all" }}>
          {data?.signing_public_key ?? "Not made yet (step 2)"}
        </Text>
      </Stack>
      <Modal
        opened={confirmRotate}
        onClose={() => setConfirmRotate(false)}
        title="Replace the signing key?"
        danger
        primaryAction={{
          label: "Replace the key",
          onClick: () => keys.mutate(imported.trim() || undefined),
          loading: keys.isPending,
        }}
        secondaryAction={{ label: "Cancel", onClick: () => setConfirmRotate(false) }}
      >
        <Text size="sm">
          Patient apps will refuse this hospital's answers until NHA has the new public key. Do this
          only when NHA is ready to register it.
        </Text>
      </Modal>
    </Card>
  );
}
