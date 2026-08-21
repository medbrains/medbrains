// BLOOD-BANK ComplianceTab — split from blood-bank.tsx (pure move).

import {
  Drawer,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  BbLookbackEventRow,
  BbRecruitmentCampaignRow,
  BbSbtcReport,
  CreateBbCampaignRequest,
  CreateBbLookbackRequest,
  UpdateBbCampaignRequest,
  UpdateBbLookbackRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Badge, type BadgeTone, Button, toast } from "@/components/ui";
import { statusColor } from "@/lib/status-colors";
import { bloodBankService } from "@/services/bloodBank.service";

type UpdateBbLookbackPayload = { id: string } & UpdateBbLookbackRequest;
type UpdateBbCampaignPayload = { id: string } & UpdateBbCampaignRequest;

const TTI_INFECTION_TYPES = [
  { value: "hiv", label: "HIV" },
  { value: "hbv", label: "HBV (Hepatitis B)" },
  { value: "hcv", label: "HCV (Hepatitis C)" },
  { value: "syphilis", label: "Syphilis" },
  { value: "malaria", label: "Malaria" },
  { value: "other", label: "Other" },
];

const STATUS_COLOR_TO_BADGE_TONE: Record<string, BadgeTone> = {
  success: "success",
  green: "success",
  teal: "success",
  warning: "warning",
  yellow: "warning",
  orange: "warning",
  danger: "danger",
  red: "danger",
  info: "info",
  blue: "info",
  cyan: "info",
  primary: "primary",
  violet: "accent",
  grape: "accent",
  indigo: "accent",
  pink: "accent",
  lime: "accent",
};

function lookbackStatusTone(status: string): BadgeTone {
  return STATUS_COLOR_TO_BADGE_TONE[statusColor(status)] ?? "neutral";
}

function LookbackSection() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.BLOOD_BANK.TRANSFUSION_CREATE);
  // Look-back is the trace of who received blood from a donor later found
  // reactive. An empty look-back reads as "nobody was exposed".
  const canListTransfusions = useHasPermission(P.BLOOD_BANK.TRANSFUSION_LIST);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data: events, isLoading } = useQuery({
    queryKey: ["blood-bank", "lookback"],
    queryFn: () => bloodBankService.listBbLookback(),
    enabled: canListTransfusions,
  });

  const [infectionType, setInfectionType] = useState("");
  const [detectionDate, setDetectionDate] = useState("");
  const [donationId, setDonationId] = useState("");
  const [donorId, setDonorId] = useState("");
  const [invNotes, setInvNotes] = useState("");

  const createMut = useMutation({
    mutationFn: (d: CreateBbLookbackRequest) => bloodBankService.createBbLookback(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blood-bank", "lookback"] });
      closeCreate();
      toast.success("Lookback event recorded", { title: "Lookback created" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: UpdateBbLookbackPayload) =>
      bloodBankService.updateBbLookback(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blood-bank", "lookback"] });
      toast.success("Lookback event updated", { title: "Updated" });
    },
  });

  const columns = [
    { key: "event_code" as const, label: "Code", render: (r: BbLookbackEventRow) => r.event_code },
    {
      key: "infection_type" as const,
      label: "Infection",
      render: (r: BbLookbackEventRow) => r.infection_type,
    },
    {
      key: "detection_date" as const,
      label: "Detected",
      render: (r: BbLookbackEventRow) => r.detection_date,
    },
    {
      key: "status" as const,
      label: "Status",
      render: (r: BbLookbackEventRow) => (
        <Badge tone={lookbackStatusTone(r.status)}>{r.status}</Badge>
      ),
    },
    {
      key: "recipients_notified" as const,
      label: "Notified",
      render: (r: BbLookbackEventRow) => String(r.recipients_notified ?? 0),
    },
    ...(canCreate
      ? [
          {
            key: "id" as const,
            label: "Actions",
            render: (r: BbLookbackEventRow) => (
              <Group gap={4}>
                {r.status === "detected" && (
                  <Button
                    tone="secondary"
                    size="compact-xs"
                    onClick={() => updateMut.mutate({ id: r.id, status: "investigating" })}
                  >
                    Investigate
                  </Button>
                )}
                {r.status === "investigating" && (
                  <Button
                    tone="secondary"
                    size="compact-xs"
                    onClick={() => updateMut.mutate({ id: r.id, status: "notified" })}
                  >
                    Mark Notified
                  </Button>
                )}
                {r.status === "notified" && (
                  <Button
                    tone="secondary"
                    size="compact-xs"
                    onClick={() => updateMut.mutate({ id: r.id, status: "closed" })}
                  >
                    Close
                  </Button>
                )}
              </Group>
            ),
          },
        ]
      : []),
  ];

  return (
    <Stack>
      <Group>
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New Lookback Event
          </Button>
        )}
      </Group>

      <DataTable columns={columns} data={events ?? []} loading={isLoading} rowKey={(r) => r.id} />

      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Create Lookback Event"
        position="right"
        size="xl"
      >
        <Stack>
          <Select
            label="Infection Type"
            required
            data={TTI_INFECTION_TYPES}
            value={infectionType || null}
            onChange={(v) => setInfectionType(v ?? "")}
            searchable
            placeholder="Select infection type"
          />
          <TextInput
            label="Detection Date"
            required
            value={detectionDate}
            onChange={(e) => setDetectionDate(e.currentTarget.value)}
            placeholder="YYYY-MM-DD"
          />
          <TextInput
            label="Donation ID"
            value={donationId}
            onChange={(e) => setDonationId(e.currentTarget.value)}
            placeholder="Optional UUID"
          />
          <PatientSearchSelect label="Donor" value={donorId} onChange={setDonorId} />
          <Textarea
            label="Investigation Notes"
            value={invNotes}
            onChange={(e) => setInvNotes(e.currentTarget.value)}
          />
          <Button
            tone="primary"
            onClick={() => {
              if (!infectionType || !detectionDate) return;
              createMut.mutate({
                infection_type: infectionType,
                detection_date: detectionDate,
                donation_id: donationId || undefined,
                donor_id: donorId || undefined,
                investigation_notes: invNotes || undefined,
              });
            }}
            loading={createMut.isPending}
          >
            Create Event
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

function SbtcSection() {
  const [report, setReport] = useState<BbSbtcReport | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = () => {
    setLoading(true);
    bloodBankService
      .getBbSbtcReport()
      .then((data) => {
        setReport(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  return (
    <Stack>
      <Button tone="primary" onClick={fetchReport} loading={loading} w={200}>
        Generate SBTC Report
      </Button>
      {report && (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }}>
          <Paper p="md" withBorder>
            <Text size="xs" c="dimmed">
              Donations
            </Text>
            <Title order={3}>{report.donation_count}</Title>
          </Paper>
          <Paper p="md" withBorder>
            <Text size="xs" c="dimmed">
              Components
            </Text>
            <Title order={3}>{report.component_count}</Title>
          </Paper>
          <Paper p="md" withBorder>
            <Text size="xs" c="dimmed">
              Discards
            </Text>
            <Title order={3} c="danger">
              {report.discard_count}
            </Title>
          </Paper>
          <Paper p="md" withBorder>
            <Text size="xs" c="dimmed">
              Reactions
            </Text>
            <Title order={3} c="orange">
              {report.reaction_count}
            </Title>
          </Paper>
          <Paper p="md" withBorder>
            <Text size="xs" c="dimmed">
              Lookback Events
            </Text>
            <Title order={3}>{report.lookback_count}</Title>
          </Paper>
        </SimpleGrid>
      )}
    </Stack>
  );
}

function RecruitmentSection() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.BLOOD_BANK.DONORS_CREATE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["blood-bank", "campaigns"],
    queryFn: () => bloodBankService.listBbCampaigns(),
  });

  const [campName, setCampName] = useState("");
  const [campType, setCampType] = useState<string | null>("drive");
  const [targetCount, setTargetCount] = useState<number>(50);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [campNotes, setCampNotes] = useState("");

  const createMut = useMutation({
    mutationFn: (d: CreateBbCampaignRequest) => bloodBankService.createBbCampaign(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blood-bank", "campaigns"] });
      closeCreate();
      toast.success("Recruitment campaign added", { title: "Campaign created" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: UpdateBbCampaignPayload) =>
      bloodBankService.updateBbCampaign(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blood-bank", "campaigns"] });
      toast.success("Campaign status updated", { title: "Updated" });
    },
  });

  const columns = [
    {
      key: "campaign_name" as const,
      label: "Campaign",
      render: (r: BbRecruitmentCampaignRow) => r.campaign_name,
    },
    {
      key: "campaign_type" as const,
      label: "Type",
      render: (r: BbRecruitmentCampaignRow) => r.campaign_type,
    },
    {
      key: "start_date" as const,
      label: "Start",
      render: (r: BbRecruitmentCampaignRow) => r.start_date,
    },
    {
      key: "target_count" as const,
      label: "Target",
      render: (r: BbRecruitmentCampaignRow) => String(r.target_count ?? "—"),
    },
    {
      key: "actual_count" as const,
      label: "Actual",
      render: (r: BbRecruitmentCampaignRow) => String(r.actual_count ?? "—"),
    },
    {
      key: "status" as const,
      label: "Status",
      render: (r: BbRecruitmentCampaignRow) => (
        <Badge
          tone={
            r.status === "completed" ? "success" : r.status === "active" ? "primary" : "neutral"
          }
        >
          {r.status}
        </Badge>
      ),
    },
    ...(canCreate
      ? [
          {
            key: "id" as const,
            label: "Actions",
            render: (r: BbRecruitmentCampaignRow) => (
              <Group gap={4}>
                {r.status === "planned" && (
                  <Button
                    tone="secondary"
                    size="compact-xs"
                    onClick={() => updateMut.mutate({ id: r.id, status: "active" })}
                  >
                    Activate
                  </Button>
                )}
                {r.status === "active" && (
                  <Button
                    tone="secondary"
                    size="compact-xs"
                    onClick={() => updateMut.mutate({ id: r.id, status: "completed" })}
                  >
                    Complete
                  </Button>
                )}
              </Group>
            ),
          },
        ]
      : []),
  ];

  return (
    <Stack>
      <Group>
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            New Campaign
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={campaigns ?? []}
        loading={isLoading}
        rowKey={(r) => r.id}
      />

      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="New Recruitment Campaign"
        position="right"
        size="xl"
      >
        <Stack>
          <TextInput
            label="Campaign Name"
            required
            value={campName}
            onChange={(e) => setCampName(e.currentTarget.value)}
          />
          <Select
            label="Campaign Type"
            required
            data={[
              { value: "drive", label: "Blood Drive" },
              { value: "awareness", label: "Awareness Campaign" },
              { value: "recall", label: "Donor Recall" },
              { value: "corporate", label: "Corporate Drive" },
            ]}
            value={campType}
            onChange={setCampType}
          />
          <NumberInput
            label="Target Donor Count"
            value={targetCount}
            onChange={(v) => setTargetCount(Number(v))}
            min={1}
          />
          <TextInput
            label="Start Date"
            required
            placeholder="YYYY-MM-DD"
            value={startDate}
            onChange={(e) => setStartDate(e.currentTarget.value)}
          />
          <TextInput
            label="End Date"
            placeholder="YYYY-MM-DD"
            value={endDate}
            onChange={(e) => setEndDate(e.currentTarget.value)}
          />
          <Textarea
            label="Notes"
            value={campNotes}
            onChange={(e) => setCampNotes(e.currentTarget.value)}
          />
          <Button
            tone="primary"
            onClick={() => {
              if (!campName || !campType || !startDate) return;
              createMut.mutate({
                campaign_name: campName,
                campaign_type: campType,
                target_count: targetCount,
                start_date: startDate,
                end_date: endDate || undefined,
                notes: campNotes || undefined,
              });
            }}
            loading={createMut.isPending}
          >
            Create Campaign
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  );
}

export function ComplianceTab() {
  const [compView, setCompView] = useState("lookback");

  return (
    <Stack mt="md">
      <SegmentedControl
        value={compView}
        onChange={setCompView}
        data={[
          { value: "lookback", label: "Lookback Events" },
          { value: "sbtc", label: "SBTC Report" },
          { value: "recruitment", label: "Recruitment Campaigns" },
        ]}
        w={460}
      />
      {compView === "lookback" && <LookbackSection />}
      {compView === "sbtc" && <SbtcSection />}
      {compView === "recruitment" && <RecruitmentSection />}
    </Stack>
  );
}
