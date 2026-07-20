// Radiology ModalitiesTab — split from radiology.tsx (pure move).

import { Group, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { RadiologyModality } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components";
import { Badge, Button, IconButton, Table } from "@/components/ui";
import { confirmDestructive } from "@/lib/confirm";
import { radiologyService } from "@/services/radiology.service";

export function ModalitiesTab() {
  const canManage = useHasPermission(P.RADIOLOGY.MODALITIES_MANAGE);
  const qc = useQueryClient();
  const [formOpened, formHandlers] = useDisclosure(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: modalities, isLoading } = useQuery({
    queryKey: ["radiology-modalities"],
    queryFn: () => radiologyService.listRadiologyModalities(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      radiologyService.createRadiologyModality({
        code,
        name,
        description: description || undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-modalities"] });
      notifications.show({ title: "Modality created", message: "", color: "success" });
      setCode("");
      setName("");
      setDescription("");
      formHandlers.close();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => radiologyService.deleteRadiologyModality(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["radiology-modalities"] });
      notifications.show({ title: "Modality deleted", message: "", color: "danger" });
    },
  });

  return (
    <>
      <PageHeader
        title="Imaging Modalities"
        subtitle="Master list of imaging types"
        actions={
          canManage ? (
            <Button
              tone="primary"
              leftSection={<IconPlus size={16} />}
              size="xs"
              onClick={formHandlers.open}
            >
              Add Modality
            </Button>
          ) : undefined
        }
      />

      {formOpened && (
        <Stack
          mb="md"
          p="md"
          style={{ border: "1px solid var(--mantine-color-gray-3)", borderRadius: 0 }}
        >
          <Group grow>
            <TextInput
              label="Code"
              required
              value={code}
              onChange={(e) => setCode(e.currentTarget.value)}
              placeholder="XRAY"
            />
            <TextInput
              label="Name"
              required
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="X-Ray"
            />
          </Group>
          <TextInput
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />
          <Group>
            <Button
              tone="primary"
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!code || !name}
            >
              Save
            </Button>
            <Button tone="ghost" onClick={formHandlers.close}>
              Cancel
            </Button>
          </Group>
        </Stack>
      )}

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Code</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Description</Table.Th>
            <Table.Th>Active</Table.Th>
            {canManage && <Table.Th />}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            <Table.Tr>
              <Table.Td colSpan={5}>
                <Text c="dimmed">Loading...</Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            (modalities ?? []).map((m: RadiologyModality) => (
              <Table.Tr key={m.id}>
                <Table.Td fw={600}>{m.code}</Table.Td>
                <Table.Td>{m.name}</Table.Td>
                <Table.Td>{m.description ?? "—"}</Table.Td>
                <Table.Td>
                  {m.is_active ? (
                    <Badge tone="success" size="xs">
                      Active
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="xs">
                      Inactive
                    </Badge>
                  )}
                </Table.Td>
                {canManage && (
                  <Table.Td>
                    <IconButton
                      tone="danger"
                      onClick={() =>
                        confirmDestructive({
                          title: "Delete",
                          message: "Permanently delete this record? This cannot be undone.",
                          onConfirm: () => deleteMutation.mutate(m.id),
                        })
                      }
                      aria-label="Close"
                    >
                      <IconX size={16} />
                    </IconButton>
                  </Table.Td>
                )}
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </>
  );
}

// ══════════════════════════════════════════════════════════
//  Appointments Tab
// ══════════════════════════════════════════════════════════
