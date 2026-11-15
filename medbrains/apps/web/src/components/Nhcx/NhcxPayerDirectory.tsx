import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type { NhcxParticipant } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconCloudDownload, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Alert, Badge, Button, Input, Modal, Select, TextArea, toast } from "@/components/ui";
import { formatDateTime } from "@/lib/date-utils";
import { directoryCertLabel, lastSynced } from "./nhcxSummary";

const EMPTY = { code: "", name: "", role: "PAYER", cert: "" };

/** NHCX payer directory — the payers/TPAs (HCX participant codes) a claim can be
 * sent to, filled from the NHCX registry; a payer typed in by hand is the
 * fallback, with the certificate each message to it is encrypted with. */
export function NhcxPayerDirectory() {
  const queryClient = useQueryClient();
  const canView = useHasPermission(P.INSURANCE.NHCX.VIEW);
  const canConfigure = useHasPermission(P.INSURANCE.NHCX.CONFIGURE);
  const canRefresh = useHasPermission(P.INSURANCE.NHCX.REFRESH_DIRECTORY);
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

  const refresh = useMutation({
    mutationFn: () => api.refreshNhcxParticipants(),
    onSuccess: (r) => {
      queryClient.setQueryData(["nhcx-participants"], r.directory);
      const partial = r.failed.length ? ` ${r.failed.length} list(s) did not answer.` : "";
      toast.success(`${r.listed} payers and TPAs listed by NHCX.${partial}`, {
        title: "Directory refreshed",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Directory not refreshed" }),
  });

  if (!canView) return null;
  const synced = lastSynced(participants);

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
      key: "source" as const,
      label: "Source",
      render: (p: NhcxParticipant) =>
        p.source === "registry" ? (
          <Badge tone="info">NHCX{p.entity_type ? ` · ${p.entity_type}` : ""}</Badge>
        ) : (
          <Badge tone="neutral">Added by hand</Badge>
        ),
    },
    {
      key: "has_encryption_cert" as const,
      label: "Encryption certificate",
      render: (p: NhcxParticipant) => {
        const cert = directoryCertLabel(p);
        return <Badge tone={cert.tone}>{cert.label}</Badge>;
      },
    },
  ];

  return (
    <Stack gap="sm" mt="lg">
      <Group justify="space-between">
        <Stack gap={0}>
          <Text fw={600}>NHCX payer directory</Text>
          <Text size="xs" c="dimmed">
            {synced ? `Listed by NHCX ${formatDateTime(synced)}` : "Not yet listed by NHCX"}
          </Text>
        </Stack>
        <Group gap="xs">
          {canRefresh && (
            <Button
              tone="secondary"
              leftSection={<IconCloudDownload size={16} />}
              loading={refresh.isPending}
              onClick={() => refresh.mutate()}
            >
              Refresh from NHCX
            </Button>
          )}
          {canConfigure && (
            <Button tone="tertiary" leftSection={<IconPlus size={16} />} onClick={open}>
              Add payer by hand
            </Button>
          )}
        </Group>
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
          emptyTitle="No payers yet — refresh the directory from NHCX."
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
