import { Stack } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type FindingStatus, P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/components/ui";
import { securityService } from "@/services/security.service";
import { ChecksPanel } from "./checks-panel";
import { type FindingsFilter, FindingsTable } from "./findings-table";
import { PostureChecklist } from "./posture-checklist";

/** Checks report every minute at most; the screen follows at that pace. */
const REFRESH_MS = 60_000;

/** Security → Intelligence → Internal: posture, findings, and the checks' heartbeats. */
export function InternalTab() {
  // Reads gate the query: without the permission nothing is fetched.
  const canView = useHasPermission(P.SECURITY.INTEL_VIEW);
  const canManage = useHasPermission(P.SECURITY.INTEL_MANAGE);
  const canCreateIncident = useHasPermission(P.SECURITY.INCIDENTS_CREATE);
  // The incident link leads to the Security page, guarded on access.list.
  const canOpenSecurityPage = useHasPermission(P.SECURITY.ACCESS_LIST);
  const canListIncidents = useHasPermission(P.SECURITY.INCIDENTS_LIST);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<FindingsFilter>({ severity: null, status: null });

  const posture = useQuery({
    queryKey: ["security-intel", "posture"],
    queryFn: () => securityService.getSecurityPosture(),
    enabled: canView,
    refetchInterval: REFRESH_MS,
  });
  const checks = useQuery({
    queryKey: ["security-intel", "checks"],
    queryFn: () => securityService.listSecurityChecks(),
    enabled: canView,
    refetchInterval: REFRESH_MS,
  });
  const findings = useQuery({
    queryKey: ["security-intel", "findings", filter],
    queryFn: () =>
      securityService.listVulnerabilities({
        severity: filter.severity ?? undefined,
        status: filter.status ?? undefined,
      }),
    enabled: canView,
    refetchInterval: REFRESH_MS,
  });
  const refreshFindings = () => qc.invalidateQueries({ queryKey: ["security-intel", "findings"] });

  const update = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { remediation_status?: FindingStatus; owner_id?: string };
    }) => securityService.updateVulnerability(id, body),
    onSuccess: () => {
      void refreshFindings();
      toast.success("Finding updated");
    },
  });
  const openIncident = useMutation({
    mutationFn: (id: string) => securityService.openIncidentFromFinding(id),
    onSuccess: (opened) => {
      void refreshFindings();
      toast.success("It is in the breach register with its reporting clocks.", {
        title: opened.created ? "Incident opened" : "Incident already open",
      });
    },
  });
  const busyId = update.isPending
    ? (update.variables?.id ?? null)
    : openIncident.isPending
      ? (openIncident.variables ?? null)
      : null;
  // One clock per render, so every "ago" and every staleness rule agree.
  const now = new Date();

  return (
    <Stack gap="lg">
      <PostureChecklist
        report={posture.data}
        isLoading={posture.isLoading}
        isError={posture.isError}
        onRetry={() => void posture.refetch()}
        now={now}
      />
      <FindingsTable
        findings={findings.data ?? []}
        checks={checks.data ?? []}
        isLoading={findings.isLoading}
        error={findings.error}
        onRetry={() => void findings.refetch()}
        filter={filter}
        onFilterChange={setFilter}
        canManage={canManage}
        canOpenIncident={canManage && canCreateIncident}
        canSeeIncidents={canOpenSecurityPage && canListIncidents}
        onUpdate={(id, body) => update.mutate({ id, body })}
        onOpenIncident={(id) => openIncident.mutate(id)}
        busyId={busyId}
        now={now}
      />
      <ChecksPanel
        checks={checks.data ?? []}
        isLoading={checks.isLoading}
        error={checks.error}
        onRetry={() => void checks.refetch()}
        now={now}
      />
    </Stack>
  );
}
