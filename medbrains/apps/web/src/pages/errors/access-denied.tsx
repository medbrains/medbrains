import { Code, Stack, Text } from "@mantine/core";
import { useAuthStore } from "@medbrains/stores";
import { PERMISSIONS, ROLE_TEMPLATES } from "@medbrains/types";
import { IconArrowLeft, IconHome, IconLock, IconSend } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Alert, Button, Card } from "@/components/ui";
import type { AccessDeniedState } from "@/hooks/useRequirePermission";
import { adminAccessService } from "@/services/adminAccess.service";
import { ErrorScreen } from "./ErrorScreen";
import { OWN_PENDING_REQUESTS_KEY, RequestAccessForm } from "./request-access-form";

const PERMISSION_BY_CODE = new Map(PERMISSIONS.map((p) => [p.code, p]));

function readState(state: unknown): AccessDeniedState | null {
  const s = state as Partial<AccessDeniedState> | null;
  return s && typeof s.from === "string" && Array.isArray(s.need)
    ? { from: s.from, need: s.need }
    : null;
}

/**
 * Where a page guard sends a user who lacks its permission. Says which page
 * refused, which permission it needs, and lets the user ask for it — instead
 * of silently landing them on the dashboard wondering what happened.
 */
export function AccessDeniedPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const denied = readState(location.state);
  const [asking, setAsking] = useState(false);
  const primary = denied?.need[0];

  const pending = useQuery({
    queryKey: OWN_PENDING_REQUESTS_KEY,
    queryFn: () => adminAccessService.listIamAccessRequests({ status: "pending" }),
    enabled: Boolean(primary),
  });
  const waiting = useMemo(
    () =>
      pending.data?.find(
        (r) =>
          r.target_user_id === user?.id &&
          r.requested_permissions.some((code) => denied?.need.includes(code)),
      ),
    [pending.data, user?.id, denied],
  );

  const role = user ? (ROLE_TEMPLATES[user.role]?.label ?? user.role) : null;

  return (
    <ErrorScreen
      eyebrow="403 · access denied"
      title="You don't have access to this page"
      description={
        <>
          {user ? `Signed in as ${user.full_name}${role ? ` (${role})` : ""}. ` : ""}
          Your account does not include the permission this page needs. Nothing was opened or
          changed.
        </>
      }
      icon={<IconLock size={32} />}
      tone="warning"
      actions={
        <>
          <Button
            tone="secondary"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate(-1)}
          >
            Go back
          </Button>
          <Button
            tone="ghost"
            onClick={() => navigate("/dashboard")}
            leftSection={<IconHome size={16} />}
          >
            Go to dashboard
          </Button>
        </>
      }
    >
      {denied ? (
        <Stack gap="sm" w="100%">
          <Text size="sm">
            Page: <Code>{denied.from}</Code>
          </Text>
          <Card padding="sm" withBorder>
            <Stack gap={6}>
              <Text size="sm" fw={600}>
                {denied.need.length > 1 ? "Needs any one of" : "Needs"}
              </Text>
              {denied.need.map((code) => (
                <Stack key={code} gap={0}>
                  <Text size="sm">{PERMISSION_BY_CODE.get(code)?.label ?? code}</Text>
                  <Text size="xs" c="dimmed" ff="monospace">
                    {code}
                  </Text>
                </Stack>
              ))}
            </Stack>
          </Card>
          <RequestStatus
            permission={primary}
            waitingSince={waiting?.created_at ?? null}
            lookupFailed={pending.isError}
            asking={asking}
            onAsk={setAsking}
          />
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          Ask your administrator for the permission this page needs.
        </Text>
      )}
    </ErrorScreen>
  );
}

interface RequestStatusProps {
  permission: string | undefined;
  waitingSince: string | null;
  lookupFailed: boolean;
  asking: boolean;
  onAsk: (asking: boolean) => void;
}

function RequestStatus({
  permission,
  waitingSince,
  lookupFailed,
  asking,
  onAsk,
}: RequestStatusProps) {
  if (!permission) return null;
  if (waitingSince) {
    return (
      <Alert tone="info" title="Request waiting for review">
        You asked for this on {new Date(waitingSince).toLocaleString()}. Your administrators have
        been notified; the page opens once they approve it.
      </Alert>
    );
  }
  if (asking) return <RequestAccessForm permission={permission} onCancel={() => onAsk(false)} />;
  return (
    <Stack gap="xs" align="flex-start">
      {/* A failed lookup is not "no request": say so rather than imply none exists. */}
      {lookupFailed && (
        <Alert tone="warning">Could not check whether you already asked for this.</Alert>
      )}
      <Button tone="primary" leftSection={<IconSend size={16} />} onClick={() => onAsk(true)}>
        Request access
      </Button>
    </Stack>
  );
}
