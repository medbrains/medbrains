import { CopyButton, Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconCheck, IconCopy, IconQrcode } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Card, Input, toast } from "@/components/ui";
import { signatureService } from "@/services/signature.service";

interface SignatureVerifyLinkCardProps {
  /** The signed record whose public check link this manages. */
  signedRecordId: string;
}

/**
 * The public check link of one signed record: the page its printed QR opens
 * for an insurer, a court or another hospital. Medical records shows it to
 * send by hand, and withdraws it when a copy must stop being relied on (every
 * paper already printed then says "withdrawn"). Each control is gated on the
 * permission its call needs; a user with neither sees nothing.
 */
export function SignatureVerifyLinkCard({ signedRecordId }: SignatureVerifyLinkCardProps) {
  const canIssue = useHasPermission(P.MRD.VERIFY_LINKS.ISSUE);
  const canRevoke = useHasPermission(P.MRD.VERIFY_LINKS.REVOKE);
  const [reason, setReason] = useState("");
  const issue = useMutation({
    mutationFn: () => signatureService.issueSignatureVerifyLink(signedRecordId),
  });
  const revoke = useMutation({
    mutationFn: () => signatureService.revokeSignatureVerifyLink(signedRecordId, reason.trim()),
    onSuccess: (res) => {
      issue.reset();
      setReason("");
      toast.success(res.revoked ? "Link withdrawn" : "There was no live link to withdraw");
    },
  });

  if (!canIssue && !canRevoke) return null;
  const url = issue.data ? `${window.location.origin}/verify/signature/${issue.data.token}` : null;

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group gap="xs">
          <IconQrcode size={20} aria-hidden />
          <Text fw={600}>Public check link</Text>
        </Group>
        <Text size="sm" c="dimmed">
          The page the QR on the printed copy opens. It shows the signer, the time and whether the
          record is unchanged, never the patient.
        </Text>
        {canIssue && !url && (
          <Group>
            <Button tone="secondary" loading={issue.isPending} onClick={() => issue.mutate()}>
              Show the link
            </Button>
          </Group>
        )}
        {url && (
          <Group gap="xs" wrap="nowrap">
            <Text size="xs" ff="var(--mb-font-mono)" style={{ wordBreak: "break-all" }}>
              {url}
            </Text>
            <CopyButton value={url}>
              {({ copied, copy }) => (
                <Button tone="ghost" size="compact-sm" onClick={copy} aria-label="Copy the link">
                  {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                </Button>
              )}
            </CopyButton>
          </Group>
        )}
        {canRevoke && (
          <Group align="flex-end" gap="xs">
            <Input
              label="Why withdraw it"
              placeholder="e.g. copy reported lost"
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
              w={320}
            />
            <Button
              tone="danger"
              disabled={!reason.trim()}
              loading={revoke.isPending}
              onClick={() => revoke.mutate()}
            >
              Withdraw link
            </Button>
          </Group>
        )}
        {(issue.isError || revoke.isError) && (
          <Alert tone="danger" title="That did not go through">
            {((issue.error ?? revoke.error) as Error).message}
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
