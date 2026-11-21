/**
 * Admin → Connected apps (RFC-HOSPITAL-OS C1).
 *
 * The hospital's gate for outside apps: register from a manifest, read its
 * privacy label, approve, revoke (cuts it off at once), rotate its secret.
 */

import { Group, Stack, Text } from "@mantine/core";
import { adminApi } from "@medbrains/api/modules/admin";
import { useHasPermission } from "@medbrains/stores";
import { type ConnectedApp, type ConnectedAppCredentials, P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "@/components";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { confirmDestructive } from "@/lib/confirm";
import { formatDateTime } from "@/lib/date-utils";
import { AppReviewModal } from "./AppReviewModal";
import { CredentialsModal } from "./CredentialsModal";
import { RegisterAppModal } from "./RegisterAppModal";

const STATUS: Record<ConnectedApp["status"], { label: string; tone: BadgeTone }> = {
  pending: { label: "Pending", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  revoked: { label: "Revoked", tone: "danger" },
};

const APPS_KEY = ["connected-apps"];

interface AppRowActionsProps {
  app: ConnectedApp;
  canManage: boolean;
  approving: boolean;
  onReview: (app: ConnectedApp) => void;
  onApprove: (app: ConnectedApp) => void;
  onRotate: (app: ConnectedApp) => void;
  onRevoke: (app: ConnectedApp) => void;
}

/** One row's buttons; Approve shows only for a pending app the server refused no codes for. */
function AppRowActions({ app, canManage, approving, ...on }: AppRowActionsProps) {
  const canApprove = canManage && app.status === "pending" && app.refused_permissions.length === 0;
  return (
    <Group gap={4} wrap="nowrap">
      <Button size="xs" tone="ghost" onClick={() => on.onReview(app)}>
        Privacy label
      </Button>
      {canApprove && (
        <Button size="xs" tone="primary" onClick={() => on.onApprove(app)} loading={approving}>
          Approve
        </Button>
      )}
      {canManage && app.status !== "revoked" && (
        <>
          <Button size="xs" tone="ghost" onClick={() => on.onRotate(app)}>
            Rotate secret
          </Button>
          <Button size="xs" tone="danger" onClick={() => on.onRevoke(app)}>
            Revoke
          </Button>
        </>
      )}
    </Group>
  );
}

/** Approve, revoke and rotate for one app, each refreshing the list; rotate hands back the new secret. */
function useAppActions(setIssued: (issued: ConnectedAppCredentials) => void) {
  const queryClient = useQueryClient();
  /** Reload the list after any change to an app. */
  const refresh = () => void queryClient.invalidateQueries({ queryKey: APPS_KEY });
  const onError = (error: Error) => toast.error(error.message, { title: "Not done" });

  const approve = useMutation({
    mutationFn: (id: string) => adminApi.approveConnectedApp(id),
    onSuccess: () => {
      toast.success("It can sign in now, with exactly the permissions shown.", {
        title: "App approved",
      });
      refresh();
    },
    onError,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => adminApi.revokeConnectedApp(id, "Revoked from Connected apps"),
    onSuccess: (r) => {
      toast.success(`Cut off at once. ${r.tokens_revoked} live token(s) revoked.`, {
        title: "App revoked",
      });
      refresh();
    },
    onError,
  });
  const rotate = useMutation({
    mutationFn: (id: string) => adminApi.rotateConnectedAppSecret(id),
    onSuccess: (r) => {
      setIssued(r);
      refresh();
    },
    onError,
  });

  const onRevoke = (app: ConnectedApp) =>
    confirmDestructive({
      title: `Revoke “${app.name}”?`,
      message:
        "Its next call is refused and its event deliveries stop. A revoked app cannot be re-approved; register it again if needed.",
      confirmLabel: "Revoke app",
      onConfirm: () => revoke.mutate(app.id),
    });
  const onRotate = (app: ConnectedApp) =>
    confirmDestructive({
      title: `New secret for “${app.name}”?`,
      message:
        "The old secret stops working now and every live token is revoked. The vendor needs the new secret before their next sign-in.",
      confirmLabel: "Rotate secret",
      onConfirm: () => rotate.mutate(app.id),
    });

  return { approve, onRevoke, onRotate };
}

export function ConnectedAppsPage() {
  useRequirePermission(P.ADMIN.CONNECTED_APPS.VIEW);
  const canManage = useHasPermission(P.ADMIN.CONNECTED_APPS.MANAGE);
  const [registering, setRegistering] = useState(false);
  const [reviewing, setReviewing] = useState<ConnectedApp | null>(null);
  const [issued, setIssued] = useState<ConnectedAppCredentials | null>(null);
  const list = useQuery({ queryKey: APPS_KEY, queryFn: () => adminApi.listConnectedApps() });
  const { approve, onRevoke, onRotate } = useAppActions(setIssued);

  return (
    <Stack gap="md" p="md">
      <PageHeader
        title="Connected apps"
        subtitle="Outside apps the hospital lets in — each with exactly the permissions its manifest asks for, until you revoke it."
        actions={
          canManage ? (
            <Button
              tone="primary"
              leftSection={<IconPlus size={16} />}
              onClick={() => setRegistering(true)}
            >
              Register app
            </Button>
          ) : undefined
        }
      />
      <DataTable
        columns={[
          {
            key: "name",
            label: "App",
            render: (a: ConnectedApp) => (
              <Stack gap={0}>
                <Text fw={500}>{a.name}</Text>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {a.publisher}
                </Text>
              </Stack>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (a: ConnectedApp) =>
              a.refused_permissions.length > 0 && a.status !== "revoked" ? (
                <Badge tone="danger">Needs a new manifest</Badge>
              ) : (
                <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
              ),
          },
          {
            key: "permissions",
            label: "Permissions",
            render: (a: ConnectedApp) => a.permissions.length,
          },
          {
            key: "data",
            label: "Data classes",
            render: (a: ConnectedApp) => a.manifest.dataClasses.join(", "),
          },
          {
            key: "used",
            label: "Last used",
            render: (a: ConnectedApp) =>
              a.last_used_at ? formatDateTime(a.last_used_at) : "never",
          },
          {
            key: "actions",
            label: "",
            render: (a: ConnectedApp) => (
              <AppRowActions
                app={a}
                canManage={canManage}
                approving={approve.isPending && approve.variables === a.id}
                onReview={setReviewing}
                onApprove={(app) => approve.mutate(app.id)}
                onRotate={onRotate}
                onRevoke={onRevoke}
              />
            ),
          },
        ]}
        data={list.data ?? []}
        loading={list.isLoading}
        error={list.error}
        onRetry={() => void list.refetch()}
        rowKey={(a) => a.id}
        emptyTitle="No connected apps yet"
      />
      {canManage && (
        <RegisterAppModal
          opened={registering}
          onClose={() => setRegistering(false)}
          onIssued={setIssued}
        />
      )}
      <AppReviewModal app={reviewing} onClose={() => setReviewing(null)} />
      <CredentialsModal issued={issued} onClose={() => setIssued(null)} />
    </Stack>
  );
}
