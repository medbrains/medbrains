/**
 * What running MedBrains takes for the facility described so far — the same
 * arithmetic the server records with the trial, asked of the server.
 */
import { SimpleGrid, Stack, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import type { TrialPlan } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Alert, Card } from "@/components/ui";
import { onboardingService } from "@/services/onboarding.service";

const TIER_LABEL = { small: "Small", medium: "Medium", large: "Large", xlarge: "Extra large" };

export function SizingPreview({ plan }: { plan: TrialPlan }) {
  const [settled] = useDebouncedValue(plan, 300);
  const quote = useQuery({
    queryKey: ["trial-sizing", settled],
    queryFn: () => onboardingService.getTrialSizing(settled),
    enabled: settled.staff_users > 0,
  });
  if (quote.isError) {
    return <Alert tone="warning">Could not work out the sizing: {quote.error.message}</Alert>;
  }
  const s = quote.data;
  if (!s) return null;
  const facts: Array<[string, string]> = [
    ["Server", `${TIER_LABEL[s.tier]} · ${s.vcpu} vCPU, ${s.ram_gb} GB RAM`],
    ["Storage, first year", `${s.storage_gb} GB`],
    ["Backups (30-day recovery)", `${s.backup_gb} GB`],
  ];
  if (s.cloud_instance) facts.push(["Cloud instance", s.cloud_instance]);
  if (s.hardware) facts.push(["Hardware to buy", s.hardware]);
  return (
    <Card padding="md" withBorder data-testid="sizing-preview">
      <Stack gap="xs">
        <Text fw={600}>What you will need</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          {facts.map(([label, value]) => (
            <Stack key={label} gap={0}>
              <Text size="xs" c="dimmed">
                {label}
              </Text>
              <Text size="sm">{value}</Text>
            </Stack>
          ))}
        </SimpleGrid>
        <Text size="sm" fw={600}>
          {plan.placement === "shared_cloud"
            ? "Infrastructure is included on our cloud."
            : plan.placement === "dedicated_cloud"
              ? `Server cost about ₹${(s.infra_monthly_inr ?? 0).toLocaleString("en-IN")} a month, billed at cost.`
              : "Runs on your hardware; we send the licence and installer."}
        </Text>
        <Text size="xs" c="dimmed">
          Your trial runs on our cloud for free whichever you choose. You can change this before you
          pay.
        </Text>
      </Stack>
    </Card>
  );
}
