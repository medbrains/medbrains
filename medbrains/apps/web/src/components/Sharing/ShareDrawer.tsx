/**
 * ShareDrawer — reusable per-resource sharing UI.
 *
 * Drops onto any detail page that wants a "Share" button:
 *
 *   const [opened, setOpened] = useState(false);
 *   ...
 *   {row._perms?.share && <Button onClick={() => setOpened(true)}>Share</Button>}
 *   <ShareDrawer
 *     opened={opened}
 *     onClose={() => setOpened(false)}
 *     objectType="patient"
 *     objectId={patient.id}
 *     objectLabel={`${patient.first_name} ${patient.last_name}`}
 *   />
 *
 * Calls /api/sharing/grants (POST/DELETE/GET) — shows current grants,
 * lets the resource owner add new ones, revokes individual rows.
 *
 * Time-bounded grants: pick a date in the future for `expires_at`;
 * SpiceDB filters expired tuples at resolution time, no app-side
 * cleanup needed. Reason field is captured in audit_log for
 * compliance review.
 */

import {
  Button,
  Drawer,
  Group,
  Loader,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface Props {
  opened: boolean;
  onClose: () => void;
  objectType: string;
  objectId: string;
  objectLabel?: string;
}

type SubjectType = "user" | "role" | "department" | "group";

const RELATIONS: { value: string; label: string }[] = [
  { value: "viewer", label: "Viewer (read-only)" },
  { value: "editor", label: "Editor (can modify)" },
  { value: "consultant", label: "Consultant (read + comment)" },
];

const SUBJECT_TYPES: { value: SubjectType; label: string }[] = [
  { value: "user", label: "User (single person)" },
  { value: "role", label: "Role (everyone with that role)" },
  { value: "department", label: "Department (all members)" },
  { value: "group", label: "Group (e.g. lab_seniors)" },
];

export function ShareDrawer({
  opened,
  onClose,
  objectType,
  objectId,
  objectLabel,
}: Props) {
  const qc = useQueryClient();

  const [subjectType, setSubjectType] = useState<SubjectType>("user");
  const [subjectId, setSubjectId] = useState("");
  const [relation, setRelation] = useState("viewer");
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [reason, setReason] = useState("");

  const grantsQuery = useQuery({
    queryKey: ["sharing", "grants", objectType, objectId],
    queryFn: () => api.listSharingGrants(objectType, objectId),
    enabled: opened,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createSharingGrant({
        object_type: objectType,
        object_id: objectId,
        relation,
        subject: { type: subjectType, id: subjectId.trim() },
        expires_at: expiresAt ? expiresAt.toISOString() : undefined,
        reason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      notifications.show({ message: "Grant created", color: "green" });
      qc.invalidateQueries({
        queryKey: ["sharing", "grants", objectType, objectId],
      });
      setSubjectId("");
      setReason("");
      setExpiresAt(null);
    },
    onError: (err: Error) => {
      notifications.show({ message: err.message, color: "red" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (g: {
      relation: string;
      subject_type: string;
      subject_id: string;
    }) =>
      api.revokeSharingGrant({
        object_type: objectType,
        object_id: objectId,
        relation: g.relation,
        subject: {
          type: g.subject_type as SubjectType,
          id: g.subject_id,
        },
      }),
    onSuccess: () => {
      notifications.show({ message: "Grant revoked", color: "green" });
      qc.invalidateQueries({
        queryKey: ["sharing", "grants", objectType, objectId],
      });
    },
    onError: (err: Error) => {
      notifications.show({ message: err.message, color: "red" });
    },
  });

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="md"
      title={
        <Title order={4}>
          Share {objectLabel ? `"${objectLabel}"` : objectType}
        </Title>
      }
    >
      <Stack gap="lg">
        <Stack gap="sm">
          <Title order={5}>Grant access</Title>
          <Select
            label="Subject type"
            data={SUBJECT_TYPES}
            value={subjectType}
            onChange={(v) => setSubjectType((v as SubjectType) ?? "user")}
          />
          <TextInput
            label="Subject ID"
            description={
              subjectType === "role"
                ? "Role code (e.g. nurse, doctor)"
                : `${subjectType} UUID`
            }
            value={subjectId}
            onChange={(e) => setSubjectId(e.currentTarget.value)}
            placeholder={
              subjectType === "role"
                ? "doctor"
                : "00000000-0000-0000-0000-000000000000"
            }
          />
          <Select
            label="Relation"
            data={RELATIONS}
            value={relation}
            onChange={(v) => setRelation(v ?? "viewer")}
          />
          <DateTimePicker
            label="Expires at (optional)"
            description="Leave empty for permanent grant. SpiceDB filters expired tuples automatically."
            value={expiresAt}
            onChange={(v) => setExpiresAt(v ? new Date(v) : null)}
            clearable
          />
          <TextInput
            label="Reason (optional)"
            description="Captured in audit log for compliance review."
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            placeholder="second_opinion_consult"
          />
          <Group justify="flex-end">
            <Button
              onClick={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!subjectId.trim()}
            >
              Grant
            </Button>
          </Group>
        </Stack>

        <Stack gap="sm">
          <Title order={5}>Current grants</Title>
          {grantsQuery.isLoading ? (
            <Loader size="sm" />
          ) : grantsQuery.data && grantsQuery.data.length > 0 ? (
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Subject</Table.Th>
                  <Table.Th>Relation</Table.Th>
                  <Table.Th>Expires</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {grantsQuery.data.map((g, i) => (
                  <Table.Tr key={`${g.subject_type}-${g.subject_id}-${g.relation}-${i}`}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {g.subject_type}
                      </Text>
                      <Text size="xs" c="dimmed" ff="monospace">
                        {g.subject_id.slice(0, 8)}…
                      </Text>
                    </Table.Td>
                    <Table.Td>{g.relation}</Table.Td>
                    <Table.Td>
                      {g.expires_at
                        ? new Date(g.expires_at).toLocaleString()
                        : "permanent"}
                    </Table.Td>
                    <Table.Td>
                      <Button
                        variant="subtle"
                        color="red"
                        size="xs"
                        onClick={() => revokeMutation.mutate(g)}
                        loading={revokeMutation.isPending}
                      >
                        Revoke
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text c="dimmed" size="sm">
              No grants yet. The resource is visible only to its owner /
              attending / department members.
            </Text>
          )}
        </Stack>
      </Stack>
    </Drawer>
  );
}
