/**
 * Admin → Storage lifecycle. Per-doc-category retention policies,
 * per-tier byte/record usage breakdown, hash-chained transition
 * audit log, manual sweep + restore.
 *
 * Tabs: Policies / Usage / Transitions / Archived.
 */

import {
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  NumberInput,
  Stack,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { DonutChart } from "@mantine/charts";
import { useDisclosure } from "@mantine/hooks";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconArchive,
  IconChartDonut,
  IconHistory,
  IconSettings,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, PageHeader } from "../../components";
import { useRequirePermission } from "../../hooks/useRequirePermission";

type Policy = Awaited<ReturnType<typeof api.listStoragePolicies>>[number];
type Transition = Awaited<ReturnType<typeof api.listStorageTransitions>>[number];

const TIER_TONE: Record<string, string> = {
  hot: "green",
  cold: "blue",
  archive: "yellow",
  deleted: "gray",
};

function tierBadge(tier: string) {
  return <Badge color={TIER_TONE[tier] ?? "gray"}>{tier}</Badge>;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KiB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MiB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GiB`;
}

export function StoragePage() {
  useRequirePermission(P.STORAGE.POLICIES.LIST);
  const canSweep = useHasPermission(P.STORAGE.SWEEP_TRIGGER);
  const [tab, setTab] = useState<string | null>("policies");

  const sweepMutation = useMutation({
    mutationFn: () => api.triggerStorageSweep(),
  });

  return (
    <>
      <PageHeader
        title="Storage lifecycle"
        subtitle="Hot / cold / archive tiers, retention policies, and the hash-chained transition log."
        actions={
          canSweep ? (
            <Button
              loading={sweepMutation.isPending}
              onClick={() => sweepMutation.mutate()}
            >
              Run sweep now
            </Button>
          ) : undefined
        }
      />

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="policies" leftSection={<IconSettings size={16} />}>
            Policies
          </Tabs.Tab>
          <Tabs.Tab value="usage" leftSection={<IconChartDonut size={16} />}>
            Usage
          </Tabs.Tab>
          <Tabs.Tab value="transitions" leftSection={<IconHistory size={16} />}>
            Transitions
          </Tabs.Tab>
          <Tabs.Tab value="archived" leftSection={<IconArchive size={16} />}>
            Archived
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="policies" pt="md">
          <PoliciesTab />
        </Tabs.Panel>
        <Tabs.Panel value="usage" pt="md">
          <UsageTab />
        </Tabs.Panel>
        <Tabs.Panel value="transitions" pt="md">
          <TransitionsTab />
        </Tabs.Panel>
        <Tabs.Panel value="archived" pt="md">
          <Alert color="blue">
            Archive-tier listings come from the same patient-documents query;
            see the MRD records page for per-record restore controls.
          </Alert>
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

function PoliciesTab() {
  const canManage = useHasPermission(P.STORAGE.POLICIES.MANAGE);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["storage-policies"],
    queryFn: () => api.listStoragePolicies(),
  });

  const [opened, { open, close }] = useDisclosure(false);
  const [editing, setEditing] = useState<Policy | null>(null);

  return (
    <>
      <DataTable<Policy>
        data={data ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
        columns={[
          {
            key: "category",
            label: "Category",
            render: (r) => (
              <Text size="sm" fw={600}>
                {r.document_category}
              </Text>
            ),
          },
          {
            key: "hot_to_cold",
            label: "Hot → Cold",
            render: (r) => (
              <Text size="xs" ff="monospace">
                {r.hot_to_cold_days != null ? `${r.hot_to_cold_days}d` : "—"}
              </Text>
            ),
          },
          {
            key: "cold_to_archive",
            label: "Cold → Archive",
            render: (r) => (
              <Text size="xs" ff="monospace">
                {r.cold_to_archive_days != null
                  ? `${r.cold_to_archive_days}d`
                  : "—"}
              </Text>
            ),
          },
          {
            key: "archive_to_delete",
            label: "Archive → Delete",
            render: (r) => (
              <Text size="xs" ff="monospace">
                {r.archive_to_delete_days != null
                  ? `${r.archive_to_delete_days}d`
                  : "—"}
              </Text>
            ),
          },
          {
            key: "retention_years",
            label: "Retention",
            render: (r) => (
              <Text size="xs" ff="monospace">
                {r.retention_years}y
              </Text>
            ),
          },
          {
            key: "description",
            label: "Description",
            render: (r) => (
              <Text size="xs" c="dimmed">
                {r.description ?? "—"}
              </Text>
            ),
          },
          {
            key: "actions",
            label: "",
            render: (r) =>
              canManage ? (
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => {
                    setEditing(r);
                    open();
                  }}
                >
                  Edit
                </Button>
              ) : null,
          },
        ]}
      />
      <Drawer
        opened={opened}
        onClose={() => {
          close();
          setEditing(null);
        }}
        title={`Edit policy — ${editing?.document_category ?? ""}`}
        position="right"
      >
        {editing && (
          <PolicyEditForm
            policy={editing}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["storage-policies"] });
              close();
              setEditing(null);
            }}
          />
        )}
      </Drawer>
    </>
  );
}

function PolicyEditForm({ policy, onSaved }: { policy: Policy; onSaved: () => void }) {
  const [hotToCold, setHotToCold] = useState<number | "">(policy.hot_to_cold_days ?? "");
  const [coldToArchive, setColdToArchive] = useState<number | "">(
    policy.cold_to_archive_days ?? "",
  );
  const [archiveToDelete, setArchiveToDelete] = useState<number | "">(
    policy.archive_to_delete_days ?? "",
  );
  const [retentionYears, setRetentionYears] = useState<number | "">(policy.retention_years);
  const [description, setDescription] = useState(policy.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: () =>
      api.updateStoragePolicy(policy.document_category, {
        hot_to_cold_days: hotToCold === "" ? null : hotToCold,
        cold_to_archive_days: coldToArchive === "" ? null : coldToArchive,
        archive_to_delete_days: archiveToDelete === "" ? null : archiveToDelete,
        retention_years: retentionYears === "" ? undefined : retentionYears,
        description: description.length > 0 ? description : undefined,
      }),
    onSuccess: onSaved,
    onError: (e) => setError(e instanceof Error ? e.message : "Update failed"),
  });

  return (
    <Stack>
      <NumberInput
        label="Hot → Cold (days)"
        description="Empty = stay on hot tier indefinitely"
        value={hotToCold}
        onChange={(v) => setHotToCold(v === "" ? "" : Number(v))}
        min={0}
      />
      <NumberInput
        label="Cold → Archive (days)"
        description="Empty = stay on cold tier indefinitely"
        value={coldToArchive}
        onChange={(v) => setColdToArchive(v === "" ? "" : Number(v))}
        min={0}
      />
      <NumberInput
        label="Archive → Delete (days)"
        description="Empty = retain forever (consent forms, ID proofs)"
        value={archiveToDelete}
        onChange={(v) => setArchiveToDelete(v === "" ? "" : Number(v))}
        min={0}
      />
      <NumberInput
        label="Retention floor (years)"
        description="Hard floor — never delete before this many years from creation"
        value={retentionYears}
        onChange={(v) => setRetentionYears(v === "" ? "" : Number(v))}
        min={1}
        max={99}
        required
      />
      <TextInput
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.currentTarget.value)}
      />
      {error && <Alert color="red">{error}</Alert>}
      <Group justify="flex-end">
        <Button loading={update.isPending} onClick={() => update.mutate()}>
          Save
        </Button>
      </Group>
    </Stack>
  );
}

function UsageTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["storage-usage"],
    queryFn: () => api.getStorageUsage(),
  });

  if (isLoading || !data) {
    return <Text c="dimmed">Loading usage…</Text>;
  }

  const usage = data as {
    tiers: Array<{ tier: string; record_count: number; byte_total: number }>;
    breakdown: Array<{
      category: string;
      tier: string;
      record_count: number;
      byte_total: number;
    }>;
  };
  const tiers = usage.tiers;
  const breakdown = usage.breakdown;
  const totalBytes = tiers.reduce((sum: number, t) => sum + t.byte_total, 0);
  const totalRecords = tiers.reduce((sum: number, t) => sum + t.record_count, 0);

  const donut = tiers.map((t) => ({
    name: t.tier,
    value: t.byte_total,
    color: TIER_TONE[t.tier] ?? "gray",
  }));

  return (
    <Stack>
      <Group grow>
        {tiers.map((t) => (
          <Stack key={t.tier} gap={2}>
            <Text size="xs" tt="uppercase" c="dimmed" ff="monospace">
              {t.tier}
            </Text>
            <Text size="xl" fw={600}>
              {formatBytes(t.byte_total)}
            </Text>
            <Text size="xs" c="dimmed">
              {t.record_count.toLocaleString()} records
            </Text>
          </Stack>
        ))}
      </Group>
      <Group align="flex-start" gap="xl">
        <Stack gap={2}>
          <Text size="xs" tt="uppercase" c="dimmed" ff="monospace">
            Distribution
          </Text>
          <DonutChart data={donut} size={160} thickness={20} withLabels />
        </Stack>
        <Stack gap={2} style={{ flex: 1 }}>
          <Text size="xs" tt="uppercase" c="dimmed" ff="monospace">
            Total
          </Text>
          <Text size="xl" fw={600}>
            {formatBytes(totalBytes)}
          </Text>
          <Text size="xs" c="dimmed">
            {totalRecords.toLocaleString()} records across {breakdown.length} category × tier
            buckets
          </Text>
        </Stack>
      </Group>
      <DataTable
        data={breakdown}
        rowKey={(r) => `${r.category}-${r.tier}`}
        columns={[
          {
            key: "category",
            label: "Category",
            render: (r) => <Text size="sm">{r.category}</Text>,
          },
          {
            key: "tier",
            label: "Tier",
            render: (r) => tierBadge(r.tier),
          },
          {
            key: "record_count",
            label: "Records",
            render: (r) => (
              <Text size="xs" ff="monospace">
                {r.record_count.toLocaleString()}
              </Text>
            ),
          },
          {
            key: "byte_total",
            label: "Bytes",
            render: (r) => (
              <Text size="xs" ff="monospace">
                {formatBytes(r.byte_total)}
              </Text>
            ),
          },
        ]}
      />
    </Stack>
  );
}

function TransitionsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["storage-transitions"],
    queryFn: () => api.listStorageTransitions({ limit: 100 }),
  });

  return (
    <DataTable<Transition>
      data={data ?? []}
      loading={isLoading}
      rowKey={(r) => r.id}
      columns={[
        {
          key: "triggered_at",
          label: "When",
          render: (r) => (
            <Text size="xs" ff="monospace">
              {new Date(r.triggered_at).toLocaleString()}
            </Text>
          ),
        },
        {
          key: "document",
          label: "Document",
          render: (r) => (
            <Text size="xs" ff="monospace">
              {r.document_table}/{r.document_id.slice(0, 8)}
            </Text>
          ),
        },
        {
          key: "transition",
          label: "Transition",
          render: (r) => (
            <Group gap="xs">
              {tierBadge(r.from_tier)}
              <Text size="xs" c="dimmed">
                →
              </Text>
              {tierBadge(r.to_tier)}
            </Group>
          ),
        },
        {
          key: "size",
          label: "Size",
          render: (r) => (
            <Text size="xs" ff="monospace">
              {r.byte_size != null ? formatBytes(r.byte_size) : "—"}
            </Text>
          ),
        },
        {
          key: "by",
          label: "By",
          render: (r) => (
            <Text size="xs" c="dimmed">
              {r.triggered_by}
            </Text>
          ),
        },
        {
          key: "hash",
          label: "Hash",
          render: (r) => (
            <Tooltip label={r.hash}>
              <Text size="xs" ff="monospace">
                {r.hash.slice(0, 12)}…
              </Text>
            </Tooltip>
          ),
        },
      ]}
    />
  );
}

export { StoragePage as default };
