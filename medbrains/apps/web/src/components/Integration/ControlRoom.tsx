import { Button } from "@mantine/core";
import { api } from "@medbrains/api";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import s from "./ControlRoom.module.scss";

/** Pulse stat cell with optional mini bar chart. */
function PulseCell({
  label,
  value,
  emphValue,
  unit,
  delta,
  deltaCls,
  bars,
}: {
  label: string;
  value?: string;
  emphValue?: string;
  unit?: string;
  delta?: string;
  deltaCls?: string;
  bars?: { h: number; on?: boolean }[];
}) {
  return (
    <div className={s.pulseCell}>
      <div className={s.pulseLbl}>{label}</div>
      <div className={s.pulseValue}>
        {emphValue && <em>{emphValue}</em>}
        {value}
        {unit && <span className={s.unit}>{unit}</span>}
      </div>
      {bars && (
        <div className={s.pulseRow}>
          {bars.map((b) => (
            <span
              key={`bar-${b.h}`}
              className={b.on ? s.pulseBarOn : s.pulseBar}
              style={{ height: `${b.h * 100}%` }}
            />
          ))}
        </div>
      )}
      {delta && <div className={`${s.pulseDelta} ${deltaCls ?? ""}`}>{delta}</div>}
    </div>
  );
}

/** Live activity stream event. */
interface StreamEvent {
  time: string;
  relative: string;
  marker: "ok" | "fail" | "warn" | "info";
  title: string;
  body: string;
  pipeline?: string;
  event?: string;
  chain: { step: string; status: "ok" | "fail" }[];
  duration: string;
}

function EventRow({ ev }: { ev: StreamEvent }) {
  const markerCls =
    ev.marker === "ok"
      ? s.markerOk
      : ev.marker === "fail"
        ? s.markerFail
        : ev.marker === "warn"
          ? s.markerWarn
          : s.markerInfo;

  return (
    <div className={s.ev}>
      <div className={s.evTs}>
        <span className={s.evTsBold}>{ev.relative}</span>
        {ev.time}
      </div>
      <div className={markerCls} />
      <div className={s.evBody}>
        <div className={s.evTop}>
          <b>{ev.title}</b> · {ev.body}
        </div>
        <div className={s.evMeta}>
          {ev.pipeline && (
            <>
              <span className={s.evPill}>{ev.pipeline}</span>pipeline
            </>
          )}
          {ev.event && (
            <>
              {" · "}
              <span className={s.evPill}>{ev.event}</span>event
            </>
          )}
        </div>
        <div className={s.chain}>
          {ev.chain.map((c) => (
            <span key={c.step}>
              <span className={c.status === "ok" ? s.chainStepOk : s.chainStepFail}>{c.step}</span>
              <span className={s.chainArr}> › </span>
            </span>
          ))}
        </div>
      </div>
      <div className={s.evDur}>
        {ev.duration}
        <span>duration</span>
      </div>
    </div>
  );
}

/** Triage card for failed/warning items. */
interface TriageItem {
  title: string;
  ago: string;
  error: string;
  severity: "danger" | "warning";
  affected: string;
  pipeline: string;
}

function TriageCard({ item }: { item: TriageItem }) {
  const cardCls = item.severity === "warning" ? s.trCardWarn : s.trCard;
  const errCls = item.severity === "warning" ? s.trErrorWarn : s.trError;

  return (
    <div className={cardCls}>
      <div className={s.trTop}>
        <span className={s.trTitle}>{item.title}</span>
        <span className={s.trAgo}>{item.ago}</span>
      </div>
      <div className={errCls}>{item.error}</div>
      <div className={s.trRow}>
        <span>Affected</span>
        <b>{item.affected}</b>
      </div>
      <div className={s.trRow}>
        <span>Pipeline</span>
        <b>{item.pipeline}</b>
      </div>
      <div className={s.trActions}>
        <Button size="compact-xs" variant="outline">
          Open run
        </Button>
        {item.severity === "danger" && (
          <Button size="compact-xs" style={{ background: "var(--fc-copper)", color: "white" }}>
            Acknowledge
          </Button>
        )}
      </div>
    </div>
  );
}

export function ControlRoom() {
  // Fetch job stats for pulse metrics
  const { data: jobStats } = useQuery({
    queryKey: ["orchestration", "jobs", "stats"],
    queryFn: () => api.getJobStats(),
    refetchInterval: 10000,
  });

  const pending = jobStats?.pending ?? 0;
  const running = jobStats?.running ?? 0;
  const completed = jobStats?.completed ?? 0;
  const failed = jobStats?.failed ?? 0;
  const total = pending + running + completed + failed;
  const successRate = total > 0 ? ((completed / total) * 100).toFixed(1) : "100";

  // Placeholder stream events — would come from WebSocket or polling endpoint
  const streamEvents: StreamEvent[] = buildStreamEvents();

  // Placeholder triage items — would come from failed jobs
  const triageItems: TriageItem[] =
    failed > 0
      ? [
          {
            title: "Failed job",
            ago: "recently",
            error: `${failed} job(s) in failed state`,
            severity: "danger",
            affected: `${failed} jobs`,
            pipeline: "—",
          },
        ]
      : [];

  const barHeights = [0.4, 0.5, 0.45, 0.6, 0.55, 0.65, 0.7, 0.75, 0.6, 0.85, 0.92, 0.95];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Pulse stats */}
      <div className={s.pulse}>
        <PulseCell
          label="Queue depth"
          value={String(pending + running)}
          delta={pending > 0 ? `${pending} pending · ${running} running` : "idle"}
          deltaCls={pending > 0 ? s.deltaCopper : s.deltaUp}
          bars={barHeights.map((h) => ({ h, on: true }))}
        />
        <PulseCell
          label="Success rate"
          emphValue={successRate}
          unit="%"
          delta={failed > 0 ? `↓ ${failed} failures` : "no failures"}
          deltaCls={failed > 0 ? s.deltaDown : s.deltaUp}
        />
        <PulseCell
          label="Completed"
          value={completed.toLocaleString()}
          delta="total processed"
          deltaCls={s.deltaUp}
        />
        <PulseCell
          label="Dead letter"
          value={String(jobStats?.dead_letter ?? 0)}
          delta="requires attention"
          deltaCls={(jobStats?.dead_letter ?? 0) > 0 ? s.deltaDown : s.deltaUp}
        />
      </div>

      {/* Body: stream + triage */}
      <div className={s.body}>
        {/* Live activity stream */}
        <div className={s.stream}>
          <div className={s.streamHead}>
            <h4 className={s.streamTitle}>
              <span className={s.liveDot} />
              Live activity
            </h4>
            <span className={s.streamFilter}>all pipelines · all severity</span>
          </div>
          <div className={s.streamList}>
            {streamEvents.map((ev) => (
              <EventRow key={ev.time} ev={ev} />
            ))}
            {streamEvents.length === 0 && <div className={s.emptyTriage}>No recent activity</div>}
          </div>
        </div>

        {/* Triage queue */}
        <div className={s.triage}>
          <div className={s.triageHead}>
            <h4 className={s.triageTitle}>
              <IconAlertTriangle size={14} />
              Triage
            </h4>
            {triageItems.length > 0 && <span className={s.triageBadge}>{triageItems.length}</span>}
          </div>
          <div className={s.triageList}>
            {triageItems.map((item) => (
              <TriageCard key={item.title} item={item} />
            ))}
            <div className={s.emptyTriage}>
              {triageItems.length === 0
                ? "All clear — no issues requiring attention"
                : "— auto-resolved events shown above —"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Build placeholder stream events from recent pipeline activity. */
function buildStreamEvents(): StreamEvent[] {
  const now = new Date();
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

  return [
    {
      time: fmt(now),
      relative: "just now",
      marker: "info",
      title: "Control Room",
      body: "monitoring started — streaming live events",
      chain: [{ step: "Connected", status: "ok" }],
      duration: "—",
    },
    {
      time: fmt(new Date(now.getTime() - 120000)),
      relative: "2m ago",
      marker: "ok",
      title: "System health",
      body: "all connectors healthy · job queue idle",
      pipeline: "system",
      chain: [
        { step: "DB check", status: "ok" },
        { step: "Queue check", status: "ok" },
      ],
      duration: "45ms",
    },
  ];
}
