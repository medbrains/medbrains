/**
 * ABDM dashboard: how far ABDM reaches the hospital in a month — OPD visits
 * with a verified ABHA, KYC, ABHAs created here, records linked against the
 * DHIS threshold and the estimated incentive, consents, Scan & Share, HPR —
 * with the six-month trend, each campus's HFR state and the failed links.
 */
import { Group, Loader, Progress, SimpleGrid, Stack, Text } from "@mantine/core";
import type { AbdmDashboard } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components";
import { AbdmStat } from "@/components/Patient/abdm/AbdmStat";
import { Alert, Badge, Button, Card, Select } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import {
  formatInr,
  formatPercent,
  monthOptions,
  percentOf,
  thresholdProgress,
} from "@/lib/abdm-dashboard";
import { abdmRecordsService } from "@/services/abdmRecords.service";
import { DashboardDetails } from "./DashboardDetails";

const MONTHS_OFFERED = 12;

function ThresholdCard({ data }: { data: AbdmDashboard }) {
  const e = data.current.estimate;
  return (
    <Card>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>Records counted for DHIS</Text>
          <Badge tone={e.threshold_met ? "success" : "warning"}>
            {e.threshold_met ? "Threshold passed" : "Below threshold, no DHIS this month"}
          </Badge>
        </Group>
        <Progress
          value={thresholdProgress(e.eligible_links, e.threshold)}
          aria-label={`${e.eligible_links} of ${e.threshold} records counted for DHIS`}
        />
        <Text size="sm">
          {e.eligible_links} of the {e.threshold} a month DHIS needs before it pays · KYC-verified
          ABHAs only, 1 a day and 5 a month per ABHA
        </Text>
        <Text size="sm" c="dimmed">
          Estimate: {formatInr(e.payable_inr)} payable ({formatInr(e.hip_inr)} for records linked as
          HIP, {formatInr(e.hiu_inr)} for records received as HIU, once past the threshold). NHA
          settles the actual claim.
        </Text>
      </Stack>
    </Card>
  );
}

function KpiGrid({ data }: { data: AbdmDashboard }) {
  const m = data.current;
  const hpr = data.hpr;
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
      <AbdmStat
        label="OPD visits with ABHA"
        value={formatPercent(percentOf(m.opd_with_abha, m.opd_visits))}
        hint={`${m.opd_with_abha} of ${m.opd_visits} visits, ABHA verified by the visit day`}
      />
      <AbdmStat
        label="KYC-verified ABHAs"
        value={formatPercent(percentOf(m.kyc_patients, m.abha_patients))}
        hint={`${m.kyc_patients} of ${m.abha_patients} patients seen with an ABHA`}
      />
      <AbdmStat label="ABHAs created here" value={m.abhas_created} hint="Created at our desk" />
      <AbdmStat
        label="DHIS estimate"
        value={formatInr(m.estimate.payable_inr)}
        hint={m.estimate.threshold_met ? "Threshold passed" : "Below threshold: nothing payable"}
      />
      <AbdmStat
        label="Scan & Share"
        value={m.shares}
        hint={`${formatPercent(percentOf(m.shares_completed, m.shares))} completed, ${m.shares_expired} expired`}
      />
      <AbdmStat
        label="Consents to share (HIP)"
        value={m.hip_consents_granted}
        hint={`Granted; ${m.hip_consents_denied} denied, ${m.hip_consents_revoked} revoked`}
      />
      <AbdmStat
        label="Consents requested (HIU)"
        value={m.hiu_consents_granted}
        hint={`Granted; ${m.hiu_consents_denied} denied, ${m.hiu_consents_revoked} revoked`}
      />
      <AbdmStat
        label="Doctors with HPR ID"
        value={formatPercent(percentOf(hpr.with_hpr_id, hpr.active_doctors))}
        hint={`${hpr.with_hpr_id} of ${hpr.active_doctors} active, ${hpr.verified} verified`}
      />
    </SimpleGrid>
  );
}

export function AbdmDashboardPage() {
  useRequirePermission(P.ABDM.DASHBOARD.VIEW);
  const months = useMemo(() => monthOptions(new Date(), MONTHS_OFFERED), []);
  const [month, setMonth] = useState(months[0]?.value ?? "");
  const query = useQuery({
    queryKey: ["abdm", "dashboard", month],
    queryFn: () => abdmRecordsService.dashboard(month),
  });

  return (
    <Stack gap="md">
      <PageHeader
        title="ABDM dashboard"
        subtitle="ABHA reach, records linked for DHIS, consents and failures, month by month"
        actions={
          <Select
            aria-label="Month"
            data={months}
            value={month}
            onChange={(v) => v && setMonth(v)}
            allowDeselect={false}
            w={200}
          />
        }
      />
      {query.isLoading && <Loader size="sm" />}
      {query.isError && (
        <Alert tone="danger" title="Could not load the ABDM figures">
          <Stack gap="xs" align="flex-start">
            <Text size="sm">The figures failed to load — this does not mean they are zero.</Text>
            <Button tone="secondary" size="xs" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </Stack>
        </Alert>
      )}
      {query.data && (
        <>
          {!query.data.configured && (
            <Alert tone="warning" title="ABDM is not set up">
              Nothing links to ABDM until the ABDM keys are saved under Settings → ABDM.
            </Alert>
          )}
          <KpiGrid data={query.data} />
          <ThresholdCard data={query.data} />
          <DashboardDetails data={query.data} />
        </>
      )}
    </Stack>
  );
}
