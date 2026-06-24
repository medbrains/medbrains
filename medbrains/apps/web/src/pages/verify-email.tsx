import { Anchor, Box, Center, Loader, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { api } from "@medbrains/api";
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["verify-email", token],
    queryFn: () => api.verifyEmail(token),
    enabled: token.length > 0,
    retry: false,
  });

  const verified = data?.verified === true;
  const message = !token
    ? "This verification link is missing its token."
    : isError
      ? error instanceof Error
        ? error.message
        : "This verification link is invalid or has expired."
      : "";

  return (
    <Center mih="100vh" p="md">
      <Box maw={420} w="100%">
        <Stack align="center" gap="md">
          {isLoading ? (
            <>
              <Loader />
              <Text c="dimmed">Verifying your email…</Text>
            </>
          ) : verified ? (
            <>
              <ThemeIcon variant="light" color="success" size={64} radius="xl">
                <IconCircleCheck size={36} />
              </ThemeIcon>
              <Title order={3}>Email verified</Title>
              <Text c="dimmed" ta="center">
                Your email address is confirmed. You can now sign in.
              </Text>
            </>
          ) : (
            <>
              <ThemeIcon variant="light" color="danger" size={64} radius="xl">
                <IconCircleX size={36} />
              </ThemeIcon>
              <Title order={3}>Verification failed</Title>
              <Text c="dimmed" ta="center">
                {message}
              </Text>
            </>
          )}
          {!isLoading && (
            <Anchor href="/login" fw={600}>
              Go to sign in
            </Anchor>
          )}
        </Stack>
      </Box>
    </Center>
  );
}
