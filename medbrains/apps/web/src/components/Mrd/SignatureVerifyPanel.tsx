import { Group, Stack, Text } from "@mantine/core";
import type { VerifyResponse } from "@medbrains/types";
import { IconCircleCheck, IconCircleX, IconShieldLock } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, Input } from "@/components/ui";
import { signatureService } from "@/services/signature.service";

/**
 * Tamper-evident signature verification. Paste/scan a signed-record id (from a
 * document's QR / verify reference) and the server recomputes the payload hash
 * and checks the Ed25519 signature — proving the record was not altered after
 * signing. The legal-defensibility check for a paperless medico-legal record.
 */
export function SignatureVerifyPanel() {
  const [recordId, setRecordId] = useState("");

  const verify = useMutation({
    mutationFn: (id: string) => signatureService.verifySignature({ signed_record_id: id.trim() }),
  });

  const result: VerifyResponse | undefined = verify.data;

  return (
    <Stack maw={640}>
      <Card withBorder padding="md">
        <Group gap="xs" mb="xs">
          <IconShieldLock size={18} />
          <Text fw={600}>Verify a signed record</Text>
        </Group>
        <Text size="sm" c="dimmed" mb="sm">
          Enter the signature reference printed on the document (or scanned from its QR code) to
          confirm the record has not been altered since it was signed.
        </Text>
        <Group align="flex-end" gap="xs">
          <Input
            label="Signed-record ID"
            placeholder="e.g. 7b89b572-4d1b-49ca-85c0-..."
            value={recordId}
            onChange={(e) => setRecordId(e.currentTarget.value)}
            w={420}
          />
          <Button
            tone="primary"
            disabled={!recordId.trim()}
            loading={verify.isPending}
            onClick={() => verify.mutate(recordId)}
          >
            Verify
          </Button>
        </Group>
      </Card>

      {verify.isError && (
        <Alert tone="danger" title="Could not verify">
          {(verify.error as Error).message}
        </Alert>
      )}

      {result && (
        <Card
          withBorder
          padding="md"
          style={{
            borderColor: result.verified
              ? "var(--mantine-color-green-5)"
              : "var(--mantine-color-red-5)",
          }}
        >
          <Group gap="xs" mb="sm">
            {result.verified ? (
              <>
                <IconCircleCheck size={22} color="var(--mantine-color-green-6)" />
                <Text fw={700} c="green">
                  Valid — record unmodified
                </Text>
              </>
            ) : (
              <>
                <IconCircleX size={22} color="var(--mantine-color-red-6)" />
                <Text fw={700} c="red">
                  Invalid — record was altered after signing
                </Text>
              </>
            )}
            {result.credential_revoked && (
              <Badge tone="warning" size="sm">
                Signing credential revoked
              </Badge>
            )}
          </Group>
          <Stack gap={4}>
            <Detail label="Signed at" value={new Date(result.signed_at).toLocaleString()} />
            <Detail label="Signer" value={result.signer_user_id} mono />
            <Detail label="Stored hash" value={result.stored_hash_hex} mono />
            <Detail label="Recomputed hash" value={result.recomputed_hash_hex} mono />
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <Text size="xs" c="dimmed" w={120} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text
        size="xs"
        ff={mono ? "var(--mb-font-mono)" : undefined}
        style={{ wordBreak: "break-all" }}
      >
        {value}
      </Text>
    </Group>
  );
}
