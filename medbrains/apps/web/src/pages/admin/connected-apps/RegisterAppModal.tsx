import { Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import type { ConnectedAppCredentials } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, Modal, TextArea } from "@/components/ui";

interface RegisterAppModalProps {
  opened: boolean;
  onClose: () => void;
  onIssued: (issued: ConnectedAppCredentials) => void;
}

/** Paste the vendor's manifest; the server validates it and issues credentials. */
export function RegisterAppModal({ opened, onClose, onIssued }: RegisterAppModalProps) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const register = useMutation({
    mutationFn: (manifest: unknown) => api.registerConnectedApp(manifest),
    onSuccess: (issued) => {
      void queryClient.invalidateQueries({ queryKey: ["connected-apps"] });
      setText("");
      onClose();
      onIssued(issued);
    },
  });

  const submit = () => {
    try {
      const manifest: unknown = JSON.parse(text);
      setParseError(null);
      register.mutate(manifest);
    } catch {
      setParseError("This is not JSON. Paste the manifest file exactly as the vendor sent it.");
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Register an app" size="xl">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          The app stays pending — it cannot sign in — until someone approves it after reading its
          privacy label.
        </Text>
        <TextArea
          label="Manifest (medbrains.manifest.json)"
          description="Created by `medbrains ext init` and checked by `medbrains ext validate`."
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          minRows={12}
          maxRows={24}
          styles={{ input: { fontFamily: "var(--mb-font-mono)" } }}
          error={parseError}
        />
        {register.error && (
          <Alert tone="danger" title="Not registered">
            {register.error.message}
          </Alert>
        )}
        <Button
          tone="primary"
          onClick={submit}
          loading={register.isPending}
          disabled={text.trim() === ""}
        >
          Register
        </Button>
      </Stack>
    </Modal>
  );
}
