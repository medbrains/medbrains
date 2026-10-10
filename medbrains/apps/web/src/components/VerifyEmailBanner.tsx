import { Group, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button } from "@/components/ui";
import { toast } from "@/components/ui/toast";

/**
 * Advisory banner shown to a signed-in user whose email isn't verified yet.
 * Login is not blocked — this just nudges + offers a resend.
 */
export function VerifyEmailBanner() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api.me(), staleTime: 60_000 });
  const resend = useMutation({
    mutationFn: () => api.resendVerification(),
    onSuccess: () =>
      toast.success("Verification email sent — check your inbox.", { title: "Sent" }),
    onError: (err: Error) => toast.error(err.message, { title: "Could not resend" }),
  });

  if (!me || me.email_verified) return null;

  return (
    <Alert tone="warning" title="Verify your email">
      {/* Wraps, and the button keeps its size: at high zoom the line breaks,
          the address breaks if it must, and Resend moves below the text. */}
      <Group justify="space-between" gap="md">
        <Text size="sm" miw={0} style={{ flex: "1 1 20rem", overflowWrap: "anywhere" }}>
          Confirm <b>{me.email}</b> to secure your account — check your inbox for the link.
        </Text>
        <Button
          tone="ghost"
          size="compact-sm"
          style={{ flexShrink: 0 }}
          onClick={() => resend.mutate()}
          loading={resend.isPending}
        >
          Resend
        </Button>
      </Group>
    </Alert>
  );
}
