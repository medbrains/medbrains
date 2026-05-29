import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Modal,
  MultiSelect,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
  Tooltip,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasPermission } from "@medbrains/stores";
import type { IamAccessRequest } from "@medbrains/types";
import { P, PERMISSIONS } from "@medbrains/types";
import {
  IconCheck,
  IconClockHour4,
  IconGitBranch,
  IconLockAccess,
  IconPlus,
  IconShieldLock,
  IconUserCheck,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { adminAccessService } from "@/services/adminAccess.service";

const STATUS_COLOR: Record<IamAccessRequest["status"], string> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  revoked: "gray",
  expired: "orange",
};

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "revoked", label: "Revoked" },
  { value: "expired", label: "Expired" },
];

const APPROVAL_LANES = [
  {
    title: "Normal access",
    actor: "Self request",
    approver: "Access manager",
    scope: "Temporary module permissions for shift coverage and routine operations",
  },
  {
    title: "Elevated access",
    actor: "Doctor / nurse / staff",
    approver: "Hospital admin or super admin",
    scope: "Admin, security, HR, audit review, NDPS, write-off, concession, PCPNDT, mortality",
  },
  {
    title: "Break-glass",
    actor: "Doctor / nurse",
    approver: "Audit reviewer",
    scope: "Patient-scoped emergency access starts immediately and is reviewed after use",
  },
] as const;

function defaultExpiry() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000);
}

function formatDateTime(value: string | null) {
  if (!value) return "No expiry";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function modulesForPermissions(permissions: string[]) {
  return Array.from(
    new Set(
      permissions
        .map((p) => p.split(".")[0])
        .filter((module): module is string => typeof module === "string" && module.length > 0),
    ),
  ).sort();
}

export function AccessRequestsPage() {
  useRequirePermission(P.DASHBOARD.VIEW);

  const qc = useQueryClient();
  const canManage = useHasPermission(P.SECURITY.ACCESS_MANAGE);
  const [status, setStatus] = useState("pending");
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [reviewTarget, setReviewTarget] = useState<{
    request: IamAccessRequest;
    action: "approve" | "reject" | "revoke";
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const requestsQuery = useQuery({
    queryKey: ["iam-access-requests", status],
    queryFn: () =>
      adminAccessService.listIamAccessRequests(status === "all" ? undefined : { status }),
  });

  const usersQuery = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => adminAccessService.listUsers(),
    enabled: createOpened && canManage,
  });

  const permissionOptions = useMemo(
    () =>
      PERMISSIONS.map((p) => ({
        value: p.code,
        label: `${p.label} (${p.code})`,
      })),
    [],
  );

  const pendingCount = requestsQuery.data?.filter((r) => r.status === "pending").length ?? 0;
  const approvedCount = requestsQuery.data?.filter((r) => r.status === "approved").length ?? 0;

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!reviewTarget) throw new Error("No request selected");
      if (reviewTarget.action === "approve") {
        return adminAccessService.approveIamAccessRequest(reviewTarget.request.id, {
          note: reviewNote.trim(),
        });
      }
      if (reviewTarget.action === "reject") {
        return adminAccessService.rejectIamAccessRequest(reviewTarget.request.id, {
          note: reviewNote.trim(),
        });
      }
      return adminAccessService.revokeIamAccessRequest(reviewTarget.request.id, {
        reason: reviewNote.trim(),
      });
    },
    onSuccess: () => {
      notifications.show({ message: "Access request updated", color: "green" });
      setReviewTarget(null);
      setReviewNote("");
      qc.invalidateQueries({ queryKey: ["iam-access-requests"] });
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: "red" }),
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="IAM Access Requests"
        subtitle="Time-bound module permissions with approval, expiry, and audit trail. Record-level sharing remains Zanzibar/ReBAC."
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Request access
          </Button>
        }
      />

      <Group gap="sm">
        <Badge leftSection={<IconClockHour4 size={12} />} variant="light" color="warning">
          {pendingCount} pending
        </Badge>
        <Badge leftSection={<IconShieldLock size={12} />} variant="light" color="success">
          {approvedCount} active grants
        </Badge>
        <Badge variant="light" color="primary">
          Default request window: 8 hours
        </Badge>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        {APPROVAL_LANES.map((lane) => (
          <Card key={lane.title} withBorder padding="sm">
            <Stack gap={6}>
              <Group gap="xs">
                <IconGitBranch size={16} />
                <Text size="sm" fw={700}>
                  {lane.title}
                </Text>
              </Group>
              <Group gap={6}>
                <Badge variant="light" leftSection={<IconUserCheck size={12} />}>
                  {lane.actor}
                </Badge>
                <Badge variant="light" color="primary">
                  {lane.approver}
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                {lane.scope}
              </Text>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      <SegmentedControl value={status} onChange={setStatus} data={STATUS_OPTIONS} />

      <Table withTableBorder striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Request</Table.Th>
            <Table.Th>Target</Table.Th>
            <Table.Th>Modules</Table.Th>
            <Table.Th>Permissions</Table.Th>
            <Table.Th>Expiry</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {requestsQuery.data?.map((request) => (
            <Table.Tr key={request.id}>
              <Table.Td>
                <Text size="sm" fw={600}>
                  {request.requester_name}
                </Text>
                <Text size="xs" c="dimmed" lineClamp={2}>
                  {request.reason}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{request.target_user_name}</Text>
                <Text size="xs" c="dimmed">
                  {request.target_role}
                </Text>
              </Table.Td>
              <Table.Td>
                <Group gap={4}>
                  {request.requested_modules.slice(0, 3).map((module) => (
                    <Badge key={module} size="xs" variant="light">
                      {module}
                    </Badge>
                  ))}
                  {request.requested_modules.length > 3 && (
                    <Badge size="xs" variant="light" color="gray">
                      +{request.requested_modules.length - 3}
                    </Badge>
                  )}
                </Group>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{request.requested_permissions.length}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{formatDateTime(request.requested_expires_at)}</Text>
              </Table.Td>
              <Table.Td>
                <Badge color={STATUS_COLOR[request.status]} variant="light">
                  {request.status}
                </Badge>
              </Table.Td>
              <Table.Td>
                {canManage && (
                  <Group gap={4} justify="flex-end">
                    {request.status === "pending" && (
                      <>
                        <Tooltip label="Approve">
                          <ActionIcon
                            variant="light"
                            color="success"
                            onClick={() => setReviewTarget({ request, action: "approve" })}
                          >
                            <IconCheck size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Reject">
                          <ActionIcon
                            variant="light"
                            color="danger"
                            onClick={() => setReviewTarget({ request, action: "reject" })}
                          >
                            <IconX size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </>
                    )}
                    {request.status === "approved" && (
                      <Tooltip label="Revoke">
                        <ActionIcon
                          variant="light"
                          color="gray"
                          onClick={() => setReviewTarget({ request, action: "revoke" })}
                        >
                          <IconLockAccess size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <CreateAccessRequestDrawer
        opened={createOpened}
        onClose={closeCreate}
        canManage={canManage}
        users={usersQuery.data ?? []}
        permissionOptions={permissionOptions}
        onCreated={() => {
          closeCreate();
          qc.invalidateQueries({ queryKey: ["iam-access-requests"] });
        }}
      />

      <Modal
        opened={reviewTarget !== null}
        onClose={() => {
          setReviewTarget(null);
          setReviewNote("");
        }}
        title={<Title order={4}>{reviewTarget?.action ?? "Review"} access request</Title>}
      >
        <Stack>
          <Text size="sm">
            {reviewTarget?.request.target_user_name} requested{" "}
            {reviewTarget?.request.requested_permissions.length ?? 0} permission(s).
          </Text>
          <Textarea
            label={reviewTarget?.action === "revoke" ? "Revocation reason" : "Review note"}
            value={reviewNote}
            onChange={(e) => setReviewNote(e.currentTarget.value)}
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setReviewTarget(null)}>
              Cancel
            </Button>
            <Button loading={reviewMutation.isPending} onClick={() => reviewMutation.mutate()}>
              Confirm
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function CreateAccessRequestDrawer({
  opened,
  onClose,
  canManage,
  users,
  permissionOptions,
  onCreated,
}: {
  opened: boolean;
  onClose: () => void;
  canManage: boolean;
  users: { id: string; full_name: string; role: string }[];
  permissionOptions: { value: string; label: string }[];
  onCreated: () => void;
}) {
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState<Date | null>(defaultExpiry());
  const [reason, setReason] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      adminAccessService.createIamAccessRequest({
        target_user_id: canManage ? (targetUserId ?? undefined) : undefined,
        requested_permissions: permissions,
        requested_modules: modulesForPermissions(permissions),
        reason: reason.trim(),
        requested_expires_at: expiresAt?.toISOString() ?? null,
      }),
    onSuccess: () => {
      notifications.show({ message: "Access request submitted", color: "green" });
      setTargetUserId(null);
      setPermissions([]);
      setReason("");
      setExpiresAt(defaultExpiry());
      onCreated();
    },
    onError: (err: Error) => notifications.show({ message: err.message, color: "red" }),
  });

  return (
    <Drawer opened={opened} onClose={onClose} position="right" size="lg" title="Request access">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Use this for temporary module capability such as billing approval, pharmacy edit, IPD
          transfer, or camp management. Use the Share button on a record for patient/resource
          access.
        </Text>

        {canManage && (
          <Select
            label="Target user"
            description="Leave blank to request for yourself"
            data={users.map((u) => ({
              value: u.id,
              label: `${u.full_name} (${u.role})`,
            }))}
            value={targetUserId}
            onChange={setTargetUserId}
            searchable
            clearable
          />
        )}

        <MultiSelect
          label="Permissions"
          data={permissionOptions}
          value={permissions}
          onChange={setPermissions}
          searchable
          clearable
          hidePickedOptions
          maxDropdownHeight={360}
          placeholder="Search module.resource.action"
        />

        <DateTimePicker
          label="Expires at"
          description="Time-bound by default. Use shorter windows for emergency coverage."
          value={expiresAt}
          onChange={(value) => setExpiresAt(value ? new Date(value) : null)}
        />

        <Textarea
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          minRows={4}
          placeholder="Why this access is needed, patient/camp/shift context, expected duration"
        />

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={createMutation.isPending}
            disabled={permissions.length === 0 || reason.trim().length < 3 || !expiresAt}
            onClick={() => createMutation.mutate()}
          >
            Submit request
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
