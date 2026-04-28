/**
 * Doctor sign-off queue — list of pending signable records grouped by
 * record type, with quick-sign action.
 *
 * Per RFCs/sprints/SPRINT-doctor-activities.md §5.2.
 */
import {
  ActionIcon,
  Badge,
  Card,
  Group,
  Stack,
  Tabs,
  Text,
  Tooltip,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { P, type PendingSignoffEntry } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconClipboardCheck,
  IconSignature,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { useRequirePermission } from "../../hooks/useRequirePermission";
import { SignWorkspace } from "../../components/Doctor/SignWorkspace";

export function SignoffsPage() {
  useRequirePermission(P.DOCTOR.SIGNOFFS.VIEW_OWN);

  const [signTarget, setSignTarget] = useState<PendingSignoffEntry | null>(null);

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ["my-pending-signoffs"],
    queryFn: () => api.getMyPendingSignoffs(),
    refetchInterval: 30_000,
  });

  const grouped = useMemo(() => {
    const g: Record<string, PendingSignoffEntry[]> = {};
    for (const it of items) {
      const arr = g[it.record_type] ?? [];
      arr.push(it);
      g[it.record_type] = arr;
    }
    return g;
  }, [items]);

  const totalCount = items.length;
  const overdueCount = items.filter((it) => {
    const ageHours = (Date.now() - new Date(it.created_at).getTime()) / 3_600_000;
    return ageHours > 24 && it.legal_class === "medico_legal";
  }).length;

  return (
    <div>
      <PageHeader
        title="Sign-off queue"
        subtitle={`${totalCount} pending • ${overdueCount} overdue medico-legal`}
        icon={<IconClipboardCheck size={20} stroke={1.5} />}
        color="warning"
      />

      <Tabs defaultValue="all">
        <Tabs.List>
          <Tabs.Tab value="all">
            All <Badge ml="xs" size="xs">{totalCount}</Badge>
          </Tabs.Tab>
          {Object.entries(grouped).map(([type, list]) => (
            <Tabs.Tab key={type} value={type}>
              {labelFor(type)} <Badge ml="xs" size="xs">{list.length}</Badge>
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value="all" pt="md">
          <SignoffList items={items} onSign={setSignTarget} loading={isLoading} />
        </Tabs.Panel>
        {Object.entries(grouped).map(([type, list]) => (
          <Tabs.Panel key={type} value={type} pt="md">
            <SignoffList items={list} onSign={setSignTarget} loading={isLoading} />
          </Tabs.Panel>
        ))}
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

function SignoffList({
  items,
  onSign,
  loading,
}: {
  items: PendingSignoffEntry[];
  onSign: (item: PendingSignoffEntry) => void;
  loading: boolean;
}) {
  if (loading) return <Text size="sm" c="dimmed">Loading…</Text>;
  if (items.length === 0)
    return (
      <Text size="sm" c="dimmed" ta="center" py="xl">
        Nothing pending. All caught up.
      </Text>
    );
  return (
    <Stack gap="xs">
      {items.map((item) => {
        const ageHours =
          (Date.now() - new Date(item.created_at).getTime()) / 3_600_000;
        const isOverdue = ageHours > 24 && item.legal_class === "medico_legal";
        return (
          <Card
            key={item.record_id}
            withBorder
            padding="sm"
            style={isOverdue ? { borderColor: "var(--mantine-color-red-6)" } : undefined}
          >
            <Group justify="space-between" wrap="nowrap">
              <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                <Group gap="xs">
                  <Badge size="xs" variant="light">
                    {labelFor(item.record_type)}
                  </Badge>
                  <Badge size="xs" color={legalColor(item.legal_class)}>
                    {item.legal_class.replace("_", " ")}
                  </Badge>
                  {isOverdue && (
                    <Badge size="xs" color="red" leftSection={<IconAlertTriangle size={10} />}>
                      Overdue
                    </Badge>
                  )}
                </Group>
                <Text size="sm" fw={500}>
                  {item.record_id.slice(0, 8)}…
                </Text>
                <Text size="xs" c="dimmed">
                  Created {new Date(item.created_at).toLocaleString()} • {Math.round(ageHours)}h ago
                </Text>
              </Stack>
              <Tooltip label="Sign">
                <ActionIcon
                  variant="filled"
                  color="primary"
                  size="lg"
                  onClick={() => onSign(item)}
                >
                  <IconSignature size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Card>
        );
      })}
    </Stack>
  );
}

function labelFor(type: string): string {
  switch (type) {
    case "prescription": return "Prescription";
    case "lab_report": return "Lab Report";
    case "radiology_report": return "Radiology Report";
    case "discharge_summary": return "Discharge Summary";
    case "mlc_certificate": return "MLC Certificate";
    case "death_certificate": return "Death Certificate";
    case "fitness_certificate": return "Fitness Certificate";
    case "medical_leave_certificate": return "Medical Leave";
    case "operative_note": return "Operative Note";
    case "progress_note": return "Progress Note";
    default: return type.replace(/_/g, " ");
  }
}

function legalColor(legalClass: string): string {
  switch (legalClass) {
    case "medico_legal": return "red";
    case "statutory_export": return "orange";
    case "clinical": return "blue";
    default: return "gray";
  }
}
