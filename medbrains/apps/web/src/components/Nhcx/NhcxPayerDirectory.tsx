import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type { NhcxParticipant } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Alert, Badge, Button, Input, Modal, Select, TextArea, toast } from "@/components/ui";

const EMPTY = { code: "", name: "", role: "PAYER", cert: "" };

/** NHCX payer directory — the payers/TPAs (HCX participant codes) a claim can be
 * sent to, and the certificate each message to them is encrypted with. */
export function NhcxPayerDirectory() {
  const queryClient = useQueryClient();
  const canView = useHasPermission(P.INSURANCE.NHCX.VIEW);
  const canConfigure = useHasPermission(P.INSURANCE.NHCX.CONFIGURE);
  const [opened, { open, close }] = useDisclosure(false);
  const [draft, setDraft] = useState(EMPTY);

  const {
    data: participants = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["nhcx-participants"],
    queryFn: () => api.listNhcxParticipants(),
    enabled: canView,
  });

  const upsert = useMutation({
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
      setDraft(EMPTY);
      close();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save payer" }),
  });

  if (!canView) return null;

  const columns = [
    {
      key: "participant_name" as const,
      label: "Payer",
      render: (p: NhcxParticipant) => p.participant_name,
    },
    {
      key: "participant_code" as const,
      label: "HCX code",
      render: (p: NhcxParticipant) => (
        <Text size="sm" ff="monospace">
          {p.participant_code}
        </Text>
      ),
    },
    {
      key: "role" as const,
      label: "Role",
      render: (p: NhcxParticipant) => <Badge tone="neutral">{p.role}</Badge>,
    },
    {
      key: "has_encryption_cert" as const,
      label: "Encryption certificate",
      render: (p: NhcxParticipant) =>
        p.has_encryption_cert ? (
          <Badge tone="success">On file</Badge>
        ) : (
          <Badge tone="warning">Missing — claims cannot be sent</Badge>
        ),
    },
  ];

  return (
    <Stack gap="sm" mt="lg">
      <Group justify="space-between">
        <Text fw={600}>NHCX payer directory</Text>
        {canConfigure && (
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            Add payer
          </Button>
        )}
      </Group>
      {isError ? (
        <Alert tone="warning" title="Could not load the NHCX payer directory">
          The payers are unknown right now — this does not mean there are none.
        </Alert>
      ) : (
        <DataTable
          columns={columns}
          data={participants}
          loading={isLoading}
          rowKey={(p) => p.id}
          emptyTitle="No payers yet — add one with its encryption certificate."
        />
      )}

      <Modal opened={opened} onClose={close} title="Add NHCX payer">
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
            data={[
              { value: "PAYER", label: "Payer" },
              { value: "TPA", label: "TPA" },
              { value: "PROVIDER", label: "Provider" },
            ]}
          />
          <TextArea
            label="Encryption certificate (PEM)"
            description="From the NHCX participant registry. Every message to this payer is encrypted with it. Blank keeps the saved one."
            value={draft.cert}
            onChange={(e) => setDraft({ ...draft, cert: e.currentTarget.value })}
            autosize
            minRows={3}
            maxRows={8}
            spellCheck={false}
            ff="monospace"
          />
          <Group justify="flex-end">
            <Button tone="secondary" onClick={close}>
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
    </Stack>
  );
}
