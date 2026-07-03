import { Group, Stack, Text } from "@mantine/core";
import { api, setStepUpHandler } from "@medbrains/api";
import { useRef, useState } from "react";
import { useEffectOnce } from "react-use";
import { Button, Input, Modal, toast } from "@/components/ui";

/**
 * App-wide step-up re-auth prompt. When any API call gets a `step_up_required`
 * 403, the client invokes the registered handler → this modal opens; on a
 * correct password (POST /auth/step-up sets the 5-min cookie) it resolves true
 * and the original request retries. Mounted once in the app shell.
 */
export function StepUpGate() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  useEffectOnce(() => {
    setStepUpHandler(
      () =>
        new Promise<boolean>((resolve) => {
          resolverRef.current = resolve;
          setOpen(true);
        }),
    );
    return () => setStepUpHandler(null);
  });

  const finish = (ok: boolean) => {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setOpen(false);
    setPassword("");
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.stepUp(password);
      finish(true);
    } catch {
      toast.error("Incorrect password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal opened={open} onClose={() => finish(false)} title="Confirm it's you">
      <Stack gap="sm">
        <Text size="sm">This is a sensitive action — re-enter your password to continue.</Text>
        <Input
          type="password"
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && password) {
              void submit();
            }
          }}
        />
        <Group justify="flex-end" gap="sm">
          <Button tone="secondary" onClick={() => finish(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting} disabled={!password}>
            Confirm
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
