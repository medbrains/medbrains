import { Box, Stack, Text, TextInput } from "@mantine/core";
import { IconQrcode, IconServer } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Brand } from "@/components/Brand";
import { Alert, Button, Card, TextArea } from "@/components/ui";
import { desktopInvoke } from "@/lib/desktop-runtime";
import classes from "./desktop-setup.module.scss";

/** The hospital a scanned QR names (`BindingInfo` in apps/desktop). */
interface BindingInfo {
  hospital: string;
  address: string;
}

/** Hand the address to the desktop, which checks it and opens it. */
const connect = (address: string) => desktopInvoke<void>("desktop_server_connect", { address });

/** Ask the desktop what a hospital QR says, before connecting to it. */
const readCode = (code: string) => desktopInvoke<BindingInfo>("desktop_server_read_code", { code });

/**
 * The desktop app's first-launch screen: which hospital server this computer
 * opens. Typed, or read from the hospital QR the appliance screen shows (the
 * same code the phone apps scan) with the desk's QR scanner or by pasting it.
 * The desktop checks the server answers before it leaves this screen.
 */
export function DesktopSetup() {
  const [address, setAddress] = useState("");
  const [code, setCode] = useState("");
  const open = useMutation({ mutationFn: connect });
  const read = useMutation({ mutationFn: readCode });

  return (
    <Box component="main" className={classes.page}>
      <Card className={classes.card}>
        <Stack gap="lg">
          <Stack align="center" gap="xs">
            <Brand surface="signin" />
            <Text component="h1" fw={600}>
              Connect to your hospital
            </Text>
            <Text size="sm" c="var(--mb-text-secondary)" ta="center">
              Enter your hospital's MedBrains server, or scan the hospital QR on its appliance
              screen. You can change it later from the Server menu.
            </Text>
          </Stack>

          <Stack
            component="form"
            gap="sm"
            onSubmit={(event) => {
              event.preventDefault();
              if (address.trim()) open.mutate(address);
            }}
          >
            <TextInput
              label="Server address"
              description="Ask your IT desk. It starts with https://"
              placeholder="https://hims.example.org"
              leftSection={<IconServer size={16} />}
              value={address}
              onChange={(event) => setAddress(event.currentTarget.value)}
              autoFocus
            />
            <Button
              type="submit"
              tone="primary"
              loading={open.isPending}
              disabled={!address.trim()}
            >
              Connect
            </Button>
          </Stack>

          <Stack gap="sm">
            <TextArea
              label="Or scan the hospital QR"
              description="Click here, then scan with the desk's QR scanner, or paste the code."
              autosize
              minRows={2}
              value={code}
              onChange={(event) => {
                setCode(event.currentTarget.value);
                read.reset();
              }}
            />
            <Button
              tone="secondary"
              leftSection={<IconQrcode size={16} />}
              loading={read.isPending}
              disabled={!code.trim()}
              onClick={() => read.mutate(code)}
            >
              Read the code
            </Button>
            {read.data && (
              <Alert tone="info" title={read.data.hospital}>
                <Stack gap="xs" align="flex-start">
                  <Text size="sm">{read.data.address}</Text>
                  <Button
                    tone="primary"
                    size="xs"
                    loading={open.isPending}
                    onClick={() => read.data && open.mutate(read.data.address)}
                  >
                    Connect to {read.data.hospital}
                  </Button>
                </Stack>
              </Alert>
            )}
            {read.isError && (
              <Alert tone="danger" title="Not a hospital code">
                {read.error.message}
              </Alert>
            )}
          </Stack>

          {open.isError && (
            <Alert tone="danger" title="Could not connect">
              {open.error.message}
            </Alert>
          )}
        </Stack>
      </Card>
    </Box>
  );
}
