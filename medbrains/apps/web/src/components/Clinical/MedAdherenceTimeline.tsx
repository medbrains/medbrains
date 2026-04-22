import { Text, Tooltip } from "@mantine/core";

type MedStatus = "scheduled" | "given" | "held" | "refused" | "missed" | "self_administered";

interface MedTimelineEntry {
  scheduled_time: string; // ISO or "HH:MM"
  status: MedStatus;
  administered_at?: string;
  notes?: string;
}

interface MedAdherenceTimelineProps {
  drugName: string;
  dosage: string;
  entries: MedTimelineEntry[];
  /** Time range in hours — default 0-24 */
  startHour?: number;
  endHour?: number;
}

const STATUS_COLORS: Record<MedStatus, string> = {
  scheduled: "var(--mb-text-faint)",
  given: "var(--mantine-color-success-5)",
  held: "var(--mantine-color-warning-5)",
  refused: "var(--mantine-color-orange-5)",
  missed: "var(--mantine-color-danger-5)",
  self_administered: "var(--mantine-color-teal-5)",
};

const STATUS_LABELS: Record<MedStatus, string> = {
  scheduled: "Scheduled",
  given: "Given",
  held: "Held",
  refused: "Refused",
  missed: "Missed",
  self_administered: "Self-administered",
};

/** Extract hour (0-23) from time string */
function timeToHour(time: string | undefined): number {
  if (!time) return 0;
  const d = new Date(time);
  if (!isNaN(d.getTime())) return d.getHours() + d.getMinutes() / 60;
  // Try "HH:MM" format
  const parts = time.split(":");
  if (parts.length >= 2) return parseInt(parts[0] ?? "0", 10) + parseInt(parts[1] ?? "0", 10) / 60;
  return 0;
}

export function MedAdherenceTimeline({
  drugName,
  dosage,
  entries,
  startHour = 0,
  endHour = 24,
}: MedAdherenceTimelineProps) {
  const range = endHour - startHour;
  const hourMarkers = Array.from({ length: Math.floor(range / 4) + 1 }, (_, i) => startHour + i * 4);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* Drug label */}
      <div style={{ minWidth: 140, maxWidth: 160 }}>
        <Text size="xs" fw={600} lineClamp={1}>{drugName}</Text>
        <Text size="10px" c="dimmed">{dosage}</Text>
      </div>

      {/* Timeline bar */}
      <div style={{ flex: 1, position: "relative", height: 28 }}>
        {/* Background track */}
        <div style={{
          position: "absolute",
          top: 12,
          left: 0,
          right: 0,
          height: 4,
          background: "var(--mb-bg-content)",
          borderRadius: 2,
        }} />

        {/* Hour markers */}
        {hourMarkers.map((h) => {
          const pct = ((h - startHour) / range) * 100;
          return (
            <div key={h} style={{ position: "absolute", left: `${pct}%`, top: 0, transform: "translateX(-50%)" }}>
              <Text size="8px" c="dimmed" ta="center">{h}:00</Text>
              <div style={{ width: 1, height: 6, background: "var(--mb-border-subtle)", margin: "0 auto" }} />
            </div>
          );
        })}

        {/* Dose dots */}
        {entries.map((entry, idx) => {
          const hour = timeToHour(entry.scheduled_time);
          const pct = ((hour - startHour) / range) * 100;
          const color = STATUS_COLORS[entry.status];
          const label = STATUS_LABELS[entry.status];
          const timeStr = entry.administered_at
            ? new Date(entry.administered_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : new Date(entry.scheduled_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

          const tooltipText = `${label} at ${timeStr}${entry.notes ? ` — ${entry.notes}` : ""}`;

          return (
            <Tooltip key={idx} label={tooltipText} withArrow>
              <div
                style={{
                  position: "absolute",
                  left: `${Math.max(2, Math.min(98, pct))}%`,
                  top: 8,
                  transform: "translateX(-50%)",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: color,
                  border: "2px solid var(--mb-card-bg)",
                  cursor: "default",
                  zIndex: 1,
                  boxShadow: entry.status === "missed" ? `0 0 0 2px var(--mantine-color-danger-2)` : undefined,
                }}
              />
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
