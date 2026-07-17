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

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Badge,
  Button,
  Drawer,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { notifications } from "@mantine/notifications";
import type {
  ShareGrantFormInput,
  ShareRelationFormValue,
  SharingSubjectTypeFormValue,
} from "@medbrains/schemas";
import {
  parseSharingSubjectTypeFormValue,
  shareGrantFormSchema,
  toShareRelationFormValue,
  toSharingSubjectTypeFormValue,
} from "@medbrains/schemas";
import { IconShare, IconShieldLock, IconUserCheck, IconUsersGroup } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components/DataTable";
import { type SharingSubjects, sharingService } from "@/services/sharing.service";

interface Props {
  opened: boolean;
  onClose: () => void;
  objectType: string;
  objectId: string;
  objectLabel?: string;
  onGrantCreated?: (grant: {
    expiresAt: string | null;
    grantId: string;
    relation: string;
    subjectId: string;
    subjectType: string;
  }) => void;
}

const DEFAULT_SHARE_GRANT_VALUES: ShareGrantFormInput = {
  subject_type: "user",
  subject_id: "",
  relation: "viewer",
  expires_at: null,
  reason: "",
};

const RELATIONS: Array<{ value: ShareRelationFormValue; label: string }> = [
  { value: "viewer", label: "Viewer (read-only)" },
  { value: "editor", label: "Editor (can modify)" },
  { value: "consultant", label: "Consultant (read + comment)" },
];

const SUBJECT_TYPES: Array<{ value: SharingSubjectTypeFormValue; label: string }> = [
  { value: "user", label: "User (single person)" },
  { value: "role", label: "Role (everyone with that role)" },
  { value: "department", label: "Department (all members)" },
  { value: "group", label: "Group (e.g. lab_seniors)" },
];

function subjectsForType(subjects: SharingSubjects, subjectType: SharingSubjectTypeFormValue) {
  switch (subjectType) {
    case "role":
      return subjects.roles;
    case "department":
      return subjects.departments;
    case "group":
      return subjects.groups;
    default:
      return subjects.users;
  }
}

export function ShareDrawer({
  opened,
  onClose,
  objectType,
  objectId,
  objectLabel,
  onGrantCreated,
}: Props) {
  const qc = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ShareGrantFormInput>({
    resolver: zodResolver(shareGrantFormSchema),
    defaultValues: DEFAULT_SHARE_GRANT_VALUES,
    mode: "onTouched",
  });
  const values = watch();

  const grantsQuery = useQuery({
    queryKey: ["sharing", "grants", objectType, objectId],
    queryFn: () => sharingService.listSharingGrants(objectType, objectId),
    enabled: opened,
  });

  const subjectsQuery = useQuery({
    queryKey: ["sharing", "subjects"],
    queryFn: () => sharingService.listSharingSubjects(),
    enabled: opened,
  });

  const subjectOptions = useMemo(() => {
    const subjects = subjectsQuery.data;
    if (!subjects) return [];
    return subjectsForType(subjects, values.subject_type).map((item) => ({
      value: item.id,
      label: item.subtitle ? `${item.label} (${item.subtitle})` : item.label,
    }));
  }, [subjectsQuery.data, values.subject_type]);

  const createMutation = useMutation({
    mutationFn: (formValues: ShareGrantFormInput) =>
      sharingService.createSharingGrant({
        object_type: objectType,
        object_id: objectId,
        relation: formValues.relation,
        subject: { type: formValues.subject_type, id: formValues.subject_id.trim() },
        expires_at: formValues.expires_at ? formValues.expires_at.toISOString() : undefined,
        reason: formValues.reason.trim() || undefined,
      }),
    onSuccess: (result, formValues) => {
      onGrantCreated?.({
        expiresAt: formValues.expires_at ? formValues.expires_at.toISOString() : null,
        grantId: result.tuple_id,
        relation: formValues.relation,
        subjectId: formValues.subject_id.trim(),
        subjectType: formValues.subject_type,
      });
      notifications.show({ message: "Grant created", color: "green" });
      qc.invalidateQueries({
        queryKey: ["sharing", "grants", objectType, objectId],
      });
      reset(DEFAULT_SHARE_GRANT_VALUES);
    },
    onError: (err: Error) => {
      notifications.show({ message: err.message, color: "red" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (g: { relation: string; subject_type: string; subject_id: string }) => {
      const subjectType = parseSharingSubjectTypeFormValue(g.subject_type);
      if (!subjectType) throw new Error(`Unsupported subject type: ${g.subject_type}`);
      return sharingService.revokeSharingGrant({
        object_type: objectType,
        object_id: objectId,
        relation: g.relation,
        subject: {
          type: subjectType,
          id: g.subject_id,
        },
      });
    },
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
  const submitGrant = handleSubmit((formValues) => createMutation.mutate(formValues));

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={
        <Group gap="sm">
          <IconShare size={20} />
          <Title order={4}>Share {objectLabel ? `"${objectLabel}"` : objectType}</Title>
        </Group>
      }
    >
      <Stack gap="lg">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={5}>Grant access</Title>
              <Text size="sm" c="dimmed">
                Zanzibar-style resource sharing. Use expiry for temporary consults and audit-safe
                delegation.
              </Text>
            </div>
            <Badge variant="light" color="primary">
              {objectType}
            </Badge>
          </Group>
          <Select
            label="Subject type"
            data={SUBJECT_TYPES}
            value={values.subject_type}
            leftSection={
              values.subject_type === "user" ? (
                <IconUserCheck size={16} />
              ) : values.subject_type === "role" ? (
                <IconShieldLock size={16} />
              ) : (
                <IconUsersGroup size={16} />
              )
            }
            onChange={(value) => {
              setValue("subject_type", toSharingSubjectTypeFormValue(value));
              setValue("subject_id", "");
            }}
          />
          <Controller
            control={control}
            name="subject_id"
            render={({ field }) => (
              <Select
                label={values.subject_type === "user" ? "Staff member" : values.subject_type}
                description="Select who should receive this resource relationship"
                data={subjectOptions}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "")}
                error={errors.subject_id?.message}
                placeholder={subjectsQuery.isLoading ? "Loading..." : "Search and select"}
                searchable
                clearable
                disabled={subjectsQuery.isLoading}
                nothingFoundMessage="No matching subject"
              />
            )}
          />
          <Controller
            control={control}
            name="relation"
            render={({ field }) => (
              <Select
                label="Relation"
                data={RELATIONS}
                value={field.value}
                onChange={(value) => field.onChange(toShareRelationFormValue(value))}
              />
            )}
          />
          <Controller
            control={control}
            name="expires_at"
            render={({ field }) => (
              <DateTimePicker
                label="Expires at (optional)"
                description="Set a time limit for temporary consults. Expired grants stop resolving automatically."
                value={field.value}
                onChange={(value) => field.onChange(value ? new Date(value) : null)}
                clearable
              />
            )}
          />
          <Controller
            control={control}
            name="reason"
            render={({ field }) => (
              <TextInput
                label="Reason (optional)"
                description="Captured in audit log for compliance review."
                value={field.value}
                onChange={field.onChange}
                placeholder="Second opinion consult, covering duty, emergency handover"
              />
            )}
          />
          <Group justify="flex-end">
            <Button
              onClick={() => void submitGrant()}
              loading={createMutation.isPending}
              disabled={!values.subject_id.trim()}
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
            <DataTable
              columns={[
                {
                  key: "subject",
                  label: "Subject",
                  render: (g: NonNullable<typeof grantsQuery.data>[number]) => (
                    <>
                      <Text size="sm" fw={500}>
                        {g.subject_type}
                      </Text>
                      <Text size="xs" c="dimmed" ff="monospace">
                        {g.subject_id.slice(0, 8)}…
                      </Text>
                    </>
                  ),
                },
                {
                  key: "relation",
                  label: "Relation",
                  render: (g: NonNullable<typeof grantsQuery.data>[number]) => g.relation,
                },
                {
                  key: "expires",
                  label: "Expires",
                  render: (g: NonNullable<typeof grantsQuery.data>[number]) =>
                    g.expires_at ? new Date(g.expires_at).toLocaleString() : "permanent",
                },
                {
                  key: "actions",
                  label: "",
                  render: (g: NonNullable<typeof grantsQuery.data>[number]) => (
                    <Button
                      variant="subtle"
                      color="red"
                      size="xs"
                      onClick={() => revokeMutation.mutate(g)}
                      loading={revokeMutation.isPending}
                    >
                      Revoke
                    </Button>
                  ),
                },
              ]}
              data={grantsQuery.data}
              rowKey={(g) =>
                `${g.object_type}-${g.object_id}-${g.subject_type}-${g.subject_id}-${g.relation}`
              }
            />
          ) : (
            <Text c="dimmed" size="sm">
              No grants yet. The resource is visible only to its owner / attending / department
              members.
            </Text>
          )}
        </Stack>
      </Stack>
    </Drawer>
  );
}
