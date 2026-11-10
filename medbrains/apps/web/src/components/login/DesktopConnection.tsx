import { Group, Stack, Text } from "@mantine/core";
import { IconServer } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button } from "@/components/ui";
import { desktopInvoke } from "@/lib/desktop-runtime";
import classes from "@/pages/login.module.scss";

/**
 * On the desktop app's sign-in page: which hospital server this computer
 * opens, and the way to pick another. The desktop forgets the server and
 * restarts into its setup screen.
 */
export function DesktopConnection() {
  const forget = useMutation({ mutationFn: () => desktopInvoke<void>("desktop_server_forget") });
  return (
    <Stack className={classes.desktopSetup} gap="xs">
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Text size="xs" c="var(--mb-text-secondary)">
          This computer opens {window.location.origin}
        </Text>
        <Button
          tone="ghost"
          size="xs"
          leftSection={<IconServer size={16} />}
          loading={forget.isPending}
          onClick={() => forget.mutate()}
        >
          Change server
        </Button>
      </Group>
      {forget.isError && <Alert tone="danger">{forget.error.message}</Alert>}
    </Stack>
  );
}
