/**
 * Where a shared-images link lands. Public by necessity — the recipient has
 * no login — so the page shows nothing about the patient: only who the link
 * is for and where the one-time code will go (masked). The viewer opens only
 * after the code is entered; a forwarded link stops here.
 */
import { Center, Group, Loader, Stack, Text, Title } from "@mantine/core";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router";
import { Alert, Badge, Button, Card, Input } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";

const CODE_LENGTH = 6;

export function SharedImagesPage() {
  const { token = "" } = useParams<{ token: string }>();
  const [code, setCode] = useState("");
  const link = useQuery({
    queryKey: ["public-share-link", token],
    queryFn: () => radiologyService.getPublicShareLink(token),
    retry: false,
  });
  const send = useMutation({ mutationFn: () => radiologyService.sendShareLinkCode(token) });
  const verify = useMutation({
    mutationFn: () => radiologyService.verifyShareLinkCode(token, code.trim()),
    onSuccess: ({ viewer_url }) => window.location.assign(viewer_url),
  });

  if (link.isLoading)
    return (
      <Center mih="60vh">
        <Loader />
      </Center>
    );
  if (link.isError || !link.data)
    return (
      <Center mih="60vh" p="md">
        <Alert tone="warning" title="This link no longer opens">
          It has expired or been revoked. Ask whoever shared the images to send a new one.
        </Alert>
      </Center>
    );
  const d = link.data;
  return (
    <Center mih="80vh" p="md">
      <Card withBorder padding="lg" maw={440} w="100%">
        <Stack>
          <Title order={2}>Shared medical images</Title>
          <Text size="sm">
            {d.recipient_kind === "patient"
              ? "Your images, shared by your hospital."
              : `Shared with ${d.recipient_name ?? "you"} for review.`}{" "}
            The link works until {new Date(d.expires_at).toLocaleString()}.
          </Text>
          {d.deidentified && (
            <Group gap="xs">
              <Badge tone="info">De-identified</Badge>
              <Text size="xs" c="dimmed">
                Names and IDs are removed; text burned into an image may remain.
              </Text>
            </Group>
          )}
          {!send.isSuccess ? (
            <Button tone="primary" loading={send.isPending} onClick={() => send.mutate()}>
              Send my code to {d.code_sent_to ?? "the recipient"}
            </Button>
          ) : (
            <Stack gap="xs">
              <Text size="sm">
                Enter the {CODE_LENGTH}-digit code sent to {send.data.sent_to}.
              </Text>
              <Input
                label="Code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                value={code}
                onChange={(e) => setCode(e.currentTarget.value.replace(/\D/g, ""))}
              />
              <Group justify="space-between">
                <Button tone="ghost" size="xs" onClick={() => send.mutate()}>
                  Send a new code
                </Button>
                <Button
                  tone="primary"
                  disabled={code.length !== CODE_LENGTH}
                  loading={verify.isPending}
                  onClick={() => verify.mutate()}
                >
                  Open images
                </Button>
              </Group>
            </Stack>
          )}
          {(send.isError || verify.isError) && (
            <Alert tone="danger" title="That didn't work">
              {((send.error ?? verify.error) as Error).message}
            </Alert>
          )}
        </Stack>
      </Card>
    </Center>
  );
}
