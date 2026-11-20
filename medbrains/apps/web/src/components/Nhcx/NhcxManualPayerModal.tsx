import { Group, Stack } from "@mantine/core";
import { api } from "@medbrains/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Input, Modal, Select, TextArea, toast } from "@/components/ui";

interface NhcxManualPayerModalProps {
  opened: boolean;
  onClose: () => void;
}

const EMPTY = { code: "", name: "", role: "PAYER", cert: "" };

const ROLES = [
  { value: "PAYER", label: "Payer" },
  { value: "TPA", label: "TPA" },
  { value: "PROVIDER", label: "Provider" },
];

/** Save a hand-typed payer to the directory, then clear the form via `onSaved`. */
function useSaveManualPayer(draft: typeof EMPTY, onSaved: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.upsertNhcxParticipant({
        participant_code: draft.code.trim(),
        participant_name: draft.name.trim(),
        role: draft.role,
        encryption_cert: draft.cert.trim() || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["nhcx-participants"] });
      toast.success("Payer saved", { title: "NHCX directory" });
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save payer" }),
  });
}

/** Add a payer NHCX does not list, with the certificate messages to it are
 * encrypted with — the directory's fallback when the registry cannot help. */
export function NhcxManualPayerModal({ opened, onClose }: NhcxManualPayerModalProps) {
  const [draft, setDraft] = useState(EMPTY);
  const upsert = useSaveManualPayer(draft, () => {
    setDraft(EMPTY);
    onClose();
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Add NHCX payer">
      <Stack gap="sm">
        <Input
          label="Payer name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.currentTarget.value })}
          placeholder="e.g. Star Health"
        />
        <Input
          label="HCX participant code"
          value={draft.code}
          onChange={(e) => setDraft({ ...draft, code: e.currentTarget.value })}
          placeholder="the payer's registered NHCX code"
        />
        <Select
          label="Role"
          value={draft.role}
          onChange={(v) => setDraft({ ...draft, role: v ?? "PAYER" })}
          data={ROLES}
        />
        <TextArea
          label="Encryption certificate (PEM)"
          description="Only when NHCX cannot supply it: the certificate fetched from the registry replaces this one. Blank keeps the saved one."
          value={draft.cert}
          onChange={(e) => setDraft({ ...draft, cert: e.currentTarget.value })}
          autosize
          minRows={3}
          maxRows={8}
          spellCheck={false}
          ff="monospace"
        />
        <Group justify="flex-end">
          <Button tone="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => upsert.mutate()}
            loading={upsert.isPending}
            disabled={!draft.code.trim() || !draft.name.trim()}
          >
            Save payer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
