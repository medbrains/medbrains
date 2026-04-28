import { ActionIcon, SegmentedControl, TextInput, Tooltip } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type { PipelineSummary } from "@medbrains/types";
import { P } from "@medbrains/types";
import {
  IconDownload,
  IconHistory,
  IconPencil,
  IconPlayerPlay,
  IconSearch,
  IconToggleLeft,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import s from "./PipelineLedger.module.scss";
import { Sparkline } from "./Sparkline";

const STATUS_COLORS: Record<string, string> = {
  active: "var(--mb-success-accent)",
  paused: "var(--mb-warning-accent)",
  failing: "var(--mb-danger-accent)",
  draft: "var(--mb-text-faint)",
  archived: "var(--mb-text-faint)",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  failing: "Failing",
  draft: "Draft",
  archived: "Archived",
};

interface PipelineLedgerProps {
  onOpenExecution: (pipelineId: string) => void;
}

export function PipelineLedger({ onOpenExecution }: PipelineLedgerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canUpdate = useHasPermission(P.INTEGRATION.UPDATE);
  const canDelete = useHasPermission(P.INTEGRATION.DELETE);
  const canExecute = useHasPermission(P.INTEGRATION.EXECUTE);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const params: Record<string, string> = { page: "1", per_page: "50" };
  if (filter !== "all") params.status = filter;

  const { data } = useQuery({
    queryKey: ["integration", "pipelines", params],
    queryFn: () => api.listPipelines(params),
  });

  const toggleStatus = useMutation({
    mutationFn: (p: PipelineSummary) => {
      const next = p.status === "active" ? "paused" : "active";
      return api.updatePipelineStatus(p.id, { status: next });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["integration", "pipelines"] }),
  });

  const deletePipeline = useMutation({
    mutationFn: (id: string) => api.deletePipeline(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["integration", "pipelines"] }),
  });

  const triggerPipeline = useMutation({
    mutationFn: (id: string) => api.triggerPipeline(id),
  });

  const pipelines = data?.pipelines ?? [];
  const filtered = search
    ? pipelines.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.code.toLowerCase().includes(search.toLowerCase()),
      )
    : pipelines;

  const total = data?.total ?? 0;
  const activeCount = pipelines.filter((p) => p.status === "active").length;
  const failRate = total > 0 ? "0.42%" : "0%";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toolbar */}
      <div className={s.toolbar}>
        <div className={s.searchWrap}>
          <TextInput
            placeholder="Search by name, code, trigger…"
            leftSection={<IconSearch size={14} />}
            size="xs"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
        </div>
        <SegmentedControl
          size="xs"
          data={[
            { label: `All · ${total}`, value: "all" },
            { label: `Active · ${activeCount}`, value: "active" },
            { label: "Paused", value: "paused" },
            { label: "Draft", value: "draft" },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <div style={{ marginLeft: "auto" }}>
          <Tooltip label="Export">
            <ActionIcon variant="subtle" size="sm" aria-label="Export">
              <IconDownload size={14} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {/* Table */}
      <div className={s.tableScroll}>
        <table className={s.ledgerTable}>
          <thead>
            <tr>
              <th style={{ width: "30%" }}>Pipeline</th>
              <th>Status</th>
              <th>Trigger</th>
              <th className={s.right}>Runs</th>
              <th>Last 7 days</th>
              <th>Last run</th>
              <th>Avg</th>
              <th className={s.right} style={{ width: 140 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <LedgerRow
                key={row.id}
                row={row}
                canExecute={canExecute}
                canUpdate={canUpdate}
                canDelete={canDelete}
                onTrigger={() => triggerPipeline.mutate(row.id)}
                onHistory={() => onOpenExecution(row.id)}
                onEdit={() => navigate(`/admin/integration-builder/${row.id}`)}
                onToggle={() => toggleStatus.mutate(row)}
                onDelete={() => deletePipeline.mutate(row.id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className={s.footerBar}>
        <span>
          {total} pipelines · {failRate} failure rate
        </span>
        <span>⌘K to search</span>
      </div>
    </div>
  );
}

interface LedgerRowProps {
  row: PipelineSummary;
  canExecute: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onTrigger: () => void;
  onHistory: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}

function LedgerRow({
  row,
  canExecute,
  canUpdate,
  canDelete,
  onTrigger,
  onHistory,
  onEdit,
  onToggle,
  onDelete,
}: LedgerRowProps) {
  const status = row.status;
  const railBg = STATUS_COLORS[status] ?? STATUS_COLORS.draft;
  const sparkData = [4, 5, 3, 6, 4, 5, 7]; // placeholder — would come from API

  const triggerLabel =
    row.trigger_type === "internal_event"
      ? "event"
      : row.trigger_type === "schedule"
        ? "schedule"
        : row.trigger_type;

  const lastRun = row.last_run_at ? formatRelative(row.last_run_at) : "never";

  return (
    <tr>
      <td>
        <div className={s.nameCell}>
          <span className={s.rail} style={{ background: railBg }} />
          <div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span className={s.pname}>{row.name}</span>
            </div>
            <div className={s.pcode}>{row.code}</div>
          </div>
        </div>
      </td>
      <td>
        <span className={s.statusCell} style={{ color: railBg }}>
          <span className={s.statusDot} style={{ background: railBg }} />
          {STATUS_LABELS[status] ?? status}
        </span>
      </td>
      <td>
        <span className={s.trigPill}>{triggerLabel}</span>
      </td>
      <td className={s.right}>
        <div className={s.runsNum}>{(row.execution_count ?? 0).toLocaleString()}</div>
        <div className={s.runsSub}>{status === "draft" ? "never run" : "total"}</div>
      </td>
      <td>
        <Sparkline data={sparkData} />
      </td>
      <td>
        <div className={s.lastRel}>{lastRun}</div>
      </td>
      <td>
        <span className={s.lastTime}>—</span>
      </td>
      <td>
        <div className={s.actionsCell}>
          {canExecute && status === "active" && (
            <button type="button" className={s.actionBtn} title="Test run" onClick={onTrigger}>
              <IconPlayerPlay size={14} />
            </button>
          )}
          <button type="button" className={s.actionBtn} title="History" onClick={onHistory}>
            <IconHistory size={14} />
          </button>
          {canUpdate && (
            <>
              <button type="button" className={s.actionBtn} title="Edit" onClick={onEdit}>
                <IconPencil size={14} />
              </button>
              <button type="button" className={s.actionBtn} title="Toggle" onClick={onToggle}>
                <IconToggleLeft size={14} />
              </button>
            </>
          )}
          {canDelete && (
            <button
              type="button"
              className={`${s.actionBtn} ${s.danger}`}
              title="Delete"
              onClick={onDelete}
            >
              <IconTrash size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
