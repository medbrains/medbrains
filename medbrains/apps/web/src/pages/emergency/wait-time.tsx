import { Stack, Text } from "@mantine/core";
import type { ErVisit, ErWaitTargets } from "@medbrains/types";
import { IconAlertTriangle, IconCheck, IconClock } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { OperationalSignal } from "@/components";
import { Badge } from "@/components/ui";
import { emergencyService } from "@/services/emergency.service";

const TICK_MS = 15_000;

/** The clock, re-read every few seconds while `ticking`, so a live wait counts up. */
function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return undefined;
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [ticking]);
  return now;
}

/** Minutes as "45 min" or "1 h 05 min". */
export function formatWait(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/**
 * The target wait of the visit's triage level. None for a patient not triaged
 * yet or expectant, and none while the targets have not loaded: a missing
 * target is never read as "within target".
 */
export function waitTarget(visit: ErVisit, targets: ErWaitTargets | undefined): number | undefined {
  const level = visit.triage_level;
  if (!targets || !level || level === "expectant" || level === "unassigned") return undefined;
  return targets[level];
}

/**
 * How long a patient has waited for a doctor, against the target of their
 * triage level, with a breach said in words. A patient already seen shows the
 * time it took; a closed visit that was never timed shows nothing.
 */
export function WaitTimeCell({ visit }: { visit: ErVisit }) {
  const { t } = useTranslation("emergency");
  const seenIn = visit.door_to_doctor_mins;
  const waiting = seenIn === null && (visit.status === "registered" || visit.status === "triaged");
  const now = useNow(waiting);
  const { data: targets } = useQuery({
    queryKey: ["er-wait-targets"],
    queryFn: () => emergencyService.getErWaitTargets(),
    staleTime: Number.POSITIVE_INFINITY,
  });
  if (seenIn === null && !waiting) {
    return (
      <Text size="sm" c="dimmed">
        {t("common.notAvailable")}
      </Text>
    );
  }
  const elapsed = Math.floor((now - new Date(visit.arrival_time).getTime()) / 60_000);
  const minutes = seenIn ?? Math.max(0, elapsed);
  const target = waitTarget(visit, targets);
  return (
    <Stack gap={2} align="flex-start">
      <OperationalSignal
        icon={waiting ? IconClock : IconCheck}
        label={t(waiting ? "waitTime.waiting" : "waitTime.seen")}
        shape={waiting ? "diamond" : "pill"}
        tone={waiting ? "blocked" : "ready"}
        value={formatWait(minutes)}
      />
      {target !== undefined && (
        <Text size="xs" c="dimmed">
          {t("waitTime.target", { wait: formatWait(target) })}
        </Text>
      )}
      {target !== undefined && minutes > target && (
        <Badge tone="danger" leftSection={<IconAlertTriangle size={12} aria-hidden />}>
          {t("waitTime.overTarget", { wait: formatWait(minutes - target) })}
        </Badge>
      )}
    </Stack>
  );
}
