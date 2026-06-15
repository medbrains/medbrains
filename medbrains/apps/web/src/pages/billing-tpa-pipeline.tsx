import { Group, ScrollArea, Stack, Text } from "@mantine/core";
import type { InsuranceClaim, InsuranceClaimStatus } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconClockHour4, IconShieldHalf } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { PageHeader } from "@/components";
import { Badge, type BadgeTone, Card } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { billingService } from "@/services/billing.service";

/** Pipeline columns map claim statuses to a TPA-desk stage. */
interface Stage {
  key: string;
  label: string;
  statuses: InsuranceClaimStatus[];
  /** IRDAI response SLA in minutes for claims in this stage (if any). */
  slaMinutes?: number;
  accent: BadgeTone;
}

const STAGES: Stage[] = [
  {
    key: "preauth",
    label: "Pre-auth requested",
    statuses: ["initiated", "pre_auth_requested"],
    slaMinutes: 60, // IRDAI: insurer responds within 1h
    accent: "warning",
  },
  {
    key: "approved",
    label: "Pre-auth approved",
    statuses: ["pre_auth_approved"],
    accent: "success",
  },
  {
    key: "submitted",
    label: "Claim submitted",
    statuses: ["claim_submitted"],
    slaMinutes: 180, // IRDAI: final discharge auth within 3h
    accent: "primary",
  },
  {
    key: "adjudicated",
    label: "Adjudicated",
    statuses: ["claim_approved", "claim_rejected", "pre_auth_rejected"],
    accent: "info",
  },
  {
    key: "settled",
    label: "Settled",
    statuses: ["settled", "partially_settled"],
    accent: "neutral",
  },
];

function money(value: string | null): string {
  const n = Number(value ?? 0);
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function minutesSince(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((now - then) / 60_000);
}

function SlaBadge({ claim, sla, now }: { claim: InsuranceClaim; sla: number; now: number }) {
  const elapsed = minutesSince(claim.submitted_at ?? claim.created_at, now);
  if (elapsed === null) return null;
  const remaining = sla - elapsed;
  const overdue = remaining < 0;
  const label = overdue ? `${Math.abs(remaining)}m over` : `${remaining}m left`;
  return (
    <Badge
      tone={overdue ? "danger" : remaining <= sla * 0.25 ? "warning" : "neutral"}
      size="xs"
      leftSection={<IconClockHour4 size={11} />}
    >
      {label}
    </Badge>
  );
}

export function BillingTpaPipelinePage() {
  useRequirePermission(P.BILLING.CORPORATE_LIST);
  const navigate = useNavigate();

  const { data: claims = [], isLoading } = useQuery({
    queryKey: ["tpa-pipeline-claims"],
    queryFn: () => billingService.listInsuranceClaims(),
    refetchInterval: 60_000,
  });

  // Snapshot "now" once per render so all SLA badges agree.
  const now = useMemo(() => Date.now(), [claims]);

  const byStage = useMemo(() => {
    const map = new Map<string, InsuranceClaim[]>();
    for (const stage of STAGES) map.set(stage.key, []);
    for (const claim of claims) {
      const stage = STAGES.find((s) => s.statuses.includes(claim.status));
      if (stage) map.get(stage.key)?.push(claim);
    }
    // Sort each column by age (oldest first), SLA stages most urgent on top.
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.submitted_at ?? a.created_at).getTime() -
          new Date(b.submitted_at ?? b.created_at).getTime(),
      );
    }
    return map;
  }, [claims]);

  return (
    <Stack>
      <PageHeader
        title="TPA pre-auth pipeline"
        subtitle="Cashless claims by stage, with IRDAI response clocks (1h pre-auth · 3h discharge)."
        icon={<IconShieldHalf size={20} stroke={1.5} />}
        color="primary"
      />
      <ScrollArea>
        <Group align="flex-start" gap="md" wrap="nowrap" style={{ minWidth: "min-content" }}>
          {STAGES.map((stage) => {
            const list = byStage.get(stage.key) ?? [];
            return (
              <Stack key={stage.key} gap="xs" style={{ width: 280, flex: "0 0 280px" }}>
                <Group justify="space-between">
                  <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                    {stage.label}
                  </Text>
                  <Badge tone={stage.accent} size="sm">
                    {list.length}
                  </Badge>
                </Group>
                {isLoading && (
                  <Text c="dimmed" size="sm">
                    Loading…
                  </Text>
                )}
                {!isLoading && list.length === 0 && (
                  <Text c="dimmed" size="xs">
                    Nothing here.
                  </Text>
                )}
                {list.map((claim) => (
                  <Card
                    key={claim.id}
                    padding="sm"
                    className="clickable-card"
                    onClick={() => navigate(`/billing?tab=insurance&claim_id=${claim.id}`)}
                  >
                    <Stack gap={4}>
                      <Group justify="space-between" wrap="nowrap">
                        <Text size="sm" fw={600} truncate>
                          {claim.claim_number ?? claim.insurance_provider}
                        </Text>
                        {stage.slaMinutes && (
                          <SlaBadge claim={claim} sla={stage.slaMinutes} now={now} />
                        )}
                      </Group>
                      <Text size="xs" c="dimmed" truncate>
                        {claim.tpa_name ?? claim.insurance_provider}
                      </Text>
                      <Group gap="xs">
                        {claim.pre_auth_amount && (
                          <Text size="xs" ff="monospace">
                            req ₹{money(claim.pre_auth_amount)}
                          </Text>
                        )}
                        {claim.approved_amount && (
                          <Text size="xs" ff="monospace" c="var(--mb-success-fg)">
                            appr ₹{money(claim.approved_amount)}
                          </Text>
                        )}
                      </Group>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            );
          })}
        </Group>
      </ScrollArea>
    </Stack>
  );
}
