import { api } from "@medbrains/api";
import { Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, Button, Input, Modal, Select, toast } from "@/components/ui";

/** NHCX payer directory — the payers/TPAs (HCX participant codes) used as the
 * recipient_code when submitting a claim to NHCX. View + add. */
export function NhcxPayerDirectory() {
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("PAYER");

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["nhcx-participants"],
    queryFn: () => api.listNhcxParticipants(),
  });

  const upsert = useMutation({
    mutationFn: () =>
      api.upsertNhcxParticipant({
        participant_code: code.trim(),
        participant_name: name.trim(),
        role,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["nhcx-participants"] });
      toast.success("Payer saved", { title: "NHCX directory" });
      setCode("");
      setName("");
      setRole("PAYER");
      close();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save payer" }),
  });

  const columns = [
    {
      key: "participant_name" as const,
      label: "Payer",
      render: (p: (typeof participants)[number]) => p.participant_name,
    },
    {
      key: "participant_code" as const,
      label: "HCX code",
      render: (p: (typeof participants)[number]) => (
        <Text size="sm" ff="monospace">
          {p.participant_code}
        </Text>
      ),
    },
    {
      key: "role" as const,
      label: "Role",
      render: (p: (typeof participants)[number]) => <Badge tone="neutral">{p.role}</Badge>,
    },
  ];

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fw={600}>NHCX payer directory</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          Add payer
        </Button>
      </Group>
      <DataTable
        columns={columns}
        data={participants}
        loading={isLoading}
        rowKey={(p) => p.id}
        emptyTitle="No payers yet — add one, or sync from NHCX."
      />

      <Modal opened={opened} onClose={close} title="Add NHCX payer">
        <Stack gap="sm">
          <Input
            label="Payer name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="e.g. Star Health"
          />
          <Input
            label="HCX participant code"
            value={code}
            onChange={(e) => setCode(e.currentTarget.value)}
            placeholder="the payer's registered NHCX code"
          />
          <Select
            label="Role"
            value={role}
            onChange={(v) => setRole(v ?? "PAYER")}
            data={[
              { value: "PAYER", label: "Payer" },
              { value: "TPA", label: "TPA" },
              { value: "PROVIDER", label: "Provider" },
            ]}
          />
          <Group justify="flex-end">
            <Button tone="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              onClick={() => upsert.mutate()}
              loading={upsert.isPending}
              disabled={!code.trim() || !name.trim()}
            >
              Save payer
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
