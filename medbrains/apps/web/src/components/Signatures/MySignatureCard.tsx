import { Box, Group, Skeleton, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type SignatureCredential } from "@medbrains/types";
import { useState } from "react";
import { Button, Card, Image } from "@/components/ui";
import paper from "@/components/ui/signature-pad.module.scss";
import { useOwnSignature } from "@/hooks/useOwnSignature";
import { OwnSignatureNotice } from "./OwnSignatureNotice";
import { SignatureSetupModal } from "./SignatureSetupModal";

/** A date as the reader's locale writes it. */
const day = (iso: string) => new Date(iso).toLocaleDateString();

/** One earlier signature: when it was in use, and how it ended. */
function pastLine(credential: SignatureCredential): string {
  const until = credential.revoked_at ?? credential.valid_until;
  const span = `${day(credential.valid_from)} to ${until ? day(until) : "now"}`;
  return credential.revoked_at
    ? `${span}: withdrawn (${credential.revoked_reason ?? "no reason given"})`
    : `${span}: replaced`;
}

/**
 * "My signature" on the signer's own profile: the signature they sign with
 * and the date they set it, Replace (the same dialog and password step-up as
 * at the Sign click), and the dates of the earlier ones. Only the signer sees
 * and changes it; for someone who signs nothing the card is not there.
 */
export function MySignatureCard() {
  const { status, canSign, current, past, recheck } = useOwnSignature();
  const canManage = useHasPermission(P.SIGNATURES.OWN.MANAGE);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const isChecked = status === "ready" || status === "missing";
  // Someone who signs nothing has no signature to show.
  if (!canSign) return null;

  return (
    <Card padding="lg" withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={600} size="sm">
            My signature
          </Text>
          {canManage && isChecked && (
            <Button size="xs" onClick={() => setIsSettingUp(true)}>
              {current ? "Replace" : "Set up"}
            </Button>
          )}
        </Group>
        {status === "checking" && <Skeleton height={72} />}
        <OwnSignatureNotice status={status} onRecheck={recheck} />
        {current?.display_image_url && (
          <Box className={paper.paper} p="sm">
            <Image
              src={current.display_image_url}
              alt="Your signature"
              h={56}
              w="auto"
              fit="contain"
            />
          </Box>
        )}
        {current && !current.display_image_url && (
          <Text size="sm">No image. Your records print “Digitally signed by” and your name.</Text>
        )}
        {current && (
          <Text size="xs" c="dimmed">
            Set on {day(current.valid_from)}
          </Text>
        )}
        {past.length > 0 && (
          <Stack gap={4}>
            <Text size="xs" fw={600}>
              Earlier signatures
            </Text>
            {past.map((credential) => (
              <Text key={credential.id} size="xs" c="dimmed">
                {pastLine(credential)}
              </Text>
            ))}
          </Stack>
        )}
      </Stack>
      <SignatureSetupModal opened={isSettingUp} onClose={() => setIsSettingUp(false)} />
    </Card>
  );
}
