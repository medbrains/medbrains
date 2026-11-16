/**
 * Doctor sign-off queue — list of pending signable records grouped by
 * record type, with quick-sign action.
 *
 * Per RFCs/sprints/SPRINT-doctor-activities.md §5.2.
 */
import { Stack, Tabs, Text } from "@mantine/core";
import { useAuthStore, useHasPermission } from "@medbrains/stores";
import { P, type PendingSignoffEntry } from "@medbrains/types";
import { IconAlertTriangle, IconClipboardCheck, IconVolume } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CountersignCard } from "@/components/Clinical/case-sheet/CountersignCard";
import { UnsignedNotesCard } from "@/components/Clinical/case-sheet/UnsignedNotesCard";
import { CriticalValueInbox } from "@/components/Doctor/CriticalValueInbox";
import { SignWorkspace } from "@/components/Doctor/SignWorkspace";
import { VerbalOrderRegister } from "@/components/Doctor/VerbalOrderRegister";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import { Alert, Badge } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { type SignableTypes, useSignableTypes } from "@/hooks/useSignableTypes";
import { signoffService } from "@/services/signoff.service";
import { SignoffCard, verbalCountersign } from "./SignoffCard";
import { signoffLabel } from "./signoff-action";

export function SignoffsPage() {
  useRequirePermission(P.DOCTOR.SIGNOFFS.VIEW_OWN);
  const canViewRegister = useHasPermission(P.DOCTOR.SIGNOFFS.VERBAL_REGISTER);
  // The endpoint refuses any id but the caller's own, so this is the only id
  // that can be asked for. A doctor with no session id sees no tab rather than
  // a tab that cannot load.
  const currentUserId = useAuthStore((state) => state.user?.id) ?? "";
  const canSeeCriticalValues = useHasPermission(P.LAB.ORDERS_LIST) && currentUserId.length > 0;

  const [signTarget, setSignTarget] = useState<PendingSignoffEntry | null>(null);
  // The server's list of signable types: the inbox offers a signature only
  // for these, so it cannot offer one the server refuses.
  const { types, isError: typesFailed } = useSignableTypes();

  const {
    data: items = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["my-pending-signoffs"],
    queryFn: () => signoffService.getMyPendingSignoffs(),
    refetchInterval: 30_000,
  });

  const grouped = useMemo(() => groupByType(items), [items]);

  const totalCount = items.length;

  return (
    <div>
      <PageHeader
        title="Sign-off queue"
        subtitle={error ? "The sign-off list didn't load" : queueSubtitle(items)}
        icon={<IconClipboardCheck size={20} stroke={1.5} />}
        color="warning"
      />
      {/* Clinical notes waiting for this doctor's signature sit with the rest
          of what they must sign (RFC-MODULE-clinical-notes, phase 3a). */}
      {typesFailed && (
        <Alert tone="warning" mb="sm" title="Signing is unavailable">
          The list of signable records could not be loaded, so no Sign button is shown. Reload the
          page to try again.
        </Alert>
      )}
      <UnsignedNotesCard />
      <CountersignCard />

      <Tabs defaultValue="all">
        <Tabs.List>
          <Tabs.Tab value="all">
            All{" "}
            <Badge ml="xs" size="xs">
              {totalCount}
            </Badge>
          </Tabs.Tab>
          {Object.entries(grouped).map(([type, list]) => (
            <Tabs.Tab key={type} value={type}>
              {signoffLabel(type, types)}{" "}
              <Badge ml="xs" size="xs">
                {list.length}
              </Badge>
            </Tabs.Tab>
          ))}
          {canSeeCriticalValues && (
            <Tabs.Tab
              value="critical-values"
              leftSection={<IconAlertTriangle size={14} stroke={1.5} />}
            >
              Critical values
            </Tabs.Tab>
          )}
          {canViewRegister && (
            <Tabs.Tab
              value="verbal-register"
              ml="auto"
              leftSection={<IconVolume size={14} stroke={1.5} />}
            >
              Verbal Order Register
            </Tabs.Tab>
          )}
        </Tabs.List>

        <Tabs.Panel value="all" pt="md">
          <SignoffList
            items={items}
            types={types}
            onSign={setSignTarget}
            loading={isLoading}
            error={error}
            onRetry={() => void refetch()}
          />
        </Tabs.Panel>
        {Object.entries(grouped).map(([type, list]) => (
          <Tabs.Panel key={type} value={type} pt="md">
            <SignoffList items={list} types={types} onSign={setSignTarget} loading={isLoading} />
          </Tabs.Panel>
        ))}
        {canSeeCriticalValues && (
          <Tabs.Panel value="critical-values" pt="md">
            <CriticalValueInbox doctorId={currentUserId} />
          </Tabs.Panel>
        )}
        {canViewRegister && (
          <Tabs.Panel value="verbal-register" pt="md">
            <VerbalOrderRegister />
          </Tabs.Panel>
        )}
      </Tabs>

      {signTarget && (
        <SignWorkspace
          opened={!!signTarget}
          target={signTarget}
          onClose={() => setSignTarget(null)}
          onSigned={() => {
            setSignTarget(null);
            void refetch();
          }}
        />
      )}
    </div>
  );
}

/** The pending records by record type, one tab each. */
function groupByType(items: PendingSignoffEntry[]): Record<string, PendingSignoffEntry[]> {
  const g: Record<string, PendingSignoffEntry[]> = {};
  for (const it of items) {
    const arr = g[it.record_type] ?? [];
    arr.push(it);
    g[it.record_type] = arr;
  }
  return g;
}

/** The header line: how many are pending, and how many are overdue. */
function queueSubtitle(items: PendingSignoffEntry[]): string {
  const overdue = items.filter((it) => {
    const ageHours = (Date.now() - new Date(it.created_at).getTime()) / 3_600_000;
    return ageHours > 24 && it.legal_class === "medico_legal";
  }).length;
  const countersign = items.filter((it) => verbalCountersign(it)?.overdue).length;
  return `${items.length} pending • ${overdue} overdue medico-legal • ${countersign} countersign overdue`;
}

/**
 * The pending records as cards. A list that failed to load says so, and is
 * never shown as "nothing pending" (#6009).
 */
function SignoffList({
  items,
  types,
  onSign,
  loading,
  error,
  onRetry,
}: {
  items: PendingSignoffEntry[];
  types: SignableTypes | undefined;
  onSign: (item: PendingSignoffEntry) => void;
  loading: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  if (loading)
    return (
      <Text size="sm" c="dimmed">
        Loading…
      </Text>
    );
  if (error)
    return <QueryError error={error} onRetry={onRetry} title="The sign-off list didn't load" />;
  if (items.length === 0)
    return (
      <Text size="sm" c="dimmed" ta="center" py="xl">
        Nothing pending. All caught up.
      </Text>
    );
  return (
    <Stack gap="xs">
      {items.map((item) => (
        <SignoffCard key={item.record_id} item={item} types={types} onSign={onSign} />
      ))}
    </Stack>
  );
}
