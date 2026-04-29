import { Button } from "@mantine/core";
import { api } from "@medbrains/api";
import type { PipelineSummary } from "@medbrains/types";
import { IconArrowRight, IconCopy, IconPencil, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import s from "./RecipeShelf.module.scss";

/** Group definitions — maps pipeline trigger events to clinical domains. */
const DOMAIN_MAP: Record<string, { label: string; num: string }> = {
  ipd: { label: "Discharge & transfer", num: "01" },
  lab: { label: "Lab & diagnostics", num: "02" },
  pharmacy: { label: "Pharmacy & inventory", num: "03" },
  billing: { label: "Billing & compliance", num: "04" },
  opd: { label: "OPD & outpatient", num: "05" },
  emergency: { label: "Emergency", num: "06" },
  admin: { label: "Administration", num: "07" },
};

function domainOf(p: PipelineSummary): string {
  const code = p.code.toLowerCase();
  for (const key of Object.keys(DOMAIN_MAP)) {
    if (code.startsWith(key)) return key;
  }
  if (p.trigger_type === "schedule") return "admin";
  return "admin";
}

export function RecipeShelf() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["integration", "pipelines", { per_page: "100" }],
    queryFn: () => api.listPipelines({ per_page: "100" }),
  });

  const toggleStatus = useMutation({
    mutationFn: (p: PipelineSummary) => {
      const next = p.status === "active" ? "paused" : "active";
      return api.updatePipelineStatus(p.id, { status: next });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["integration", "pipelines"] }),
  });

  const pipelines = data?.pipelines ?? [];

  const grouped = useMemo(() => {
    const map = new Map<string, PipelineSummary[]>();
    for (const p of pipelines) {
      const domain = domainOf(p);
      const list = map.get(domain) ?? [];
      list.push(p);
      map.set(domain, list);
    }
    return map;
  }, [pipelines]);

  const activeCount = pipelines.filter((p) => p.status === "active").length;
  const totalRuns = pipelines.reduce((sum, p) => sum + (p.execution_count ?? 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Hero header */}
      <div className={s.header}>
        <div>
          <div className={s.eyebrow}>Recipe shelf</div>
          <h2 className={s.heroTitle}>
            {pipelines.length} playbooks. <em>Toggle the ones you want.</em>
          </h2>
          <div className={s.heroSub}>
            Curated automations grouped by clinical area. Each one is a battle-tested recipe — flip
            the switch, customize the few fields that matter, ship.
          </div>
        </div>
        <div className={s.headerActions}>
          <Button
            size="xs"
            variant="outline"
            leftSection={<IconCopy size={14} />}
            onClick={() => navigate("/admin/integration-hub")}
          >
            Browse marketplace
          </Button>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => navigate("/admin/integration-builder")}
          >
            Build from scratch
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className={s.stats}>
        <div className={s.stat}>
          <div className={s.statLabel}>Active recipes</div>
          <div className={s.statValue}>
            <em>{activeCount}</em>&nbsp;
            <span className={s.muted}>of {pipelines.length}</span>
          </div>
          <div className={s.statDelta}>↑ pipelines configured</div>
        </div>
        <div className={s.stat}>
          <div className={s.statLabel}>Total runs</div>
          <div className={s.statValue}>{totalRuns.toLocaleString()}</div>
          <div className={s.statDelta}>all time</div>
        </div>
        <div className={s.stat}>
          <div className={s.statLabel}>Domains covered</div>
          <div className={s.statValue}>{grouped.size}</div>
          <div className={s.statDelta}>
            {grouped.size} of {Object.keys(DOMAIN_MAP).length}
          </div>
        </div>
        <div className={s.stat}>
          <div className={s.statLabel}>New recipes</div>
          <div className={s.statValueCopper}>0</div>
          <div className={s.statDeltaCopper}>since last visit</div>
        </div>
      </div>

      {/* Sections */}
      <div className={s.body}>
        {[...grouped.entries()].map(([domain, items]) => {
          const meta = DOMAIN_MAP[domain] ?? { label: domain, num: "—" };
          const activeInGroup = items.filter((p) => p.status === "active").length;
          return (
            <div className={s.section} key={domain}>
              <div className={s.sectionHead}>
                <span className={s.sectionNum}>{meta.num}</span>
                <h3 className={s.sectionTitle}>{meta.label}</h3>
                <span className={s.sectionCount}>
                  {activeInGroup} of {items.length} active
                </span>
              </div>
              <div className={s.grid}>
                {items.map((p) => (
                  <RecipeCard
                    key={p.id}
                    pipeline={p}
                    onToggle={() => toggleStatus.mutate(p)}
                    onEdit={() => navigate(`/admin/integration-builder/${p.id}`)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {pipelines.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "var(--mb-text-muted)" }}>
            No pipelines yet. Create one to see recipes here.
          </div>
        )}
      </div>
    </div>
  );
}

interface RecipeCardProps {
  pipeline: PipelineSummary;
  onToggle: () => void;
  onEdit: () => void;
}

function RecipeCard({ pipeline, onToggle, onEdit }: RecipeCardProps) {
  const isActive = pipeline.status === "active";
  const cls = isActive ? s.recipeActive : s.recipe;

  const triggerLabel =
    pipeline.trigger_type === "internal_event"
      ? "event"
      : pipeline.trigger_type === "schedule"
        ? "schedule"
        : pipeline.trigger_type;

  return (
    <div className={cls}>
      <div className={s.recipeTop}>
        <div className={s.recipeTitle}>{pipeline.name}</div>
        <button
          type="button"
          className={isActive ? s.toggleOn : s.toggle}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-label={isActive ? "Deactivate" : "Activate"}
        />
      </div>
      {pipeline.description && <div className={s.recipeDesc}>{pipeline.description}</div>}
      <div className={s.flow}>
        <span className={s.flowTrigger}>WHEN · {triggerLabel}</span>
        <span className={s.flowArrow}>
          <IconArrowRight size={14} />
        </span>
        <span className={s.flowSeg}>{pipeline.name}</span>
      </div>
      <div className={s.recipeFoot}>
        <span>{(pipeline.execution_count ?? 0).toLocaleString()} runs</span>
        <button
          type="button"
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
            font: "inherit",
            color: "inherit",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <IconPencil size={14} />
          <span style={{ color: "var(--mb-text-muted)" }}>edit</span>
        </button>
      </div>
    </div>
  );
}
