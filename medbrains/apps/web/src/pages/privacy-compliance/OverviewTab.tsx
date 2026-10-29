// What is still missing for DPDP and CERT-In, each with the rule behind it
// and the place to fix it.

import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { DpdpGap } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconCircleCheck,
  IconClockExclamation,
  IconFileText,
  IconInbox,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { StatCard } from "@/components";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { privacyComplianceService } from "@/services/privacyCompliance.service";

const FIX_LABEL: Record<DpdpGap["fix"], string> = {
  officers: "Name officers",
  policies: "Open policy pack",
  drills: "Record a drill",
  grievances: "Open grievances",
  processors: "Open processor register",
  breaches: "Open breach register",
};

/** Gaps fixed on another screen leave this page; the rest switch tab. */
const EXTERNAL: Partial<Record<DpdpGap["fix"], string>> = {
  processors: "/audit?tab=processors",
  breaches: "/security?tab=incidents",
};

export function OverviewTab({ onOpenTab }: { onOpenTab: (tab: string) => void }) {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["privacy-compliance", "dashboard"],
    queryFn: () => privacyComplianceService.dashboard(),
  });
  if (error) {
    return (
      <Alert tone="danger" title="The compliance status could not be loaded">
        {(error as Error).message} — this is not an empty list of gaps.
      </Alert>
    );
  }
  if (isLoading || !data) return <Text c="dimmed">Checking compliance…</Text>;
  const critical = data.gaps.filter((g) => g.severity === "critical").length;
  return (
    <Stack>
      <SimpleGrid cols={{ base: 2, md: 5 }}>
        <StatCard label="Critical gaps" value={critical} icon={<IconAlertTriangle size={20} />} />
        <StatCard
          label="Open privacy requests"
          value={data.requests_open}
          icon={<IconInbox size={20} />}
        />
        <StatCard
          label="Past 90 days"
          value={data.requests_overdue}
          icon={<IconClockExclamation size={20} />}
        />
        <StatCard
          label="Published policies"
          value={`${data.published_policies} / 6`}
          icon={<IconFileText size={20} />}
        />
        <StatCard
          label="Next breach drill"
          value={data.next_drill_due ?? "Never held"}
          icon={<IconCalendarEvent size={20} />}
        />
      </SimpleGrid>
      {data.gaps.length === 0 ? (
        <Alert tone="success" icon={<IconCircleCheck size={16} />} title="No gaps found">
          Every duty this pack tracks is in place. Keep drills and policy reviews on schedule.
        </Alert>
      ) : (
        <Stack gap="xs">
          {data.gaps.map((g) => (
            <Card key={g.code} withBorder padding="sm">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                  <IconAlertTriangle size={20} aria-hidden />
                  <Stack gap={0}>
                    <Group gap="xs">
                      <Badge tone={g.severity === "critical" ? "danger" : "warning"}>
                        {g.severity === "critical" ? "Critical" : "Warning"}
                      </Badge>
                      <Text size="sm" fw={600}>
                        {g.title}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {g.basis}
                    </Text>
                  </Stack>
                </Group>
                <Button
                  tone="secondary"
                  size="xs"
                  onClick={() => {
                    const external = EXTERNAL[g.fix];
                    if (external) navigate(external);
                    else onOpenTab(g.fix);
                  }}
                >
                  {FIX_LABEL[g.fix]}
                </Button>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
