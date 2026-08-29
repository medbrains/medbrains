import { Group, NumberInput, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { MarketingCohort } from "@medbrains/types";
import { IconPlus, IconStethoscope } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Alert, Badge, Button, Drawer, Select, toast } from "@/components/ui";
import { CAMPAIGN_CHANNEL_OPTIONS } from "@/forms/marketing.form";
import { marketingService } from "@/services/marketing.service";

/**
 * Two kinds of list, and the difference is who was allowed to define it.
 *
 * An enquiry cohort filters the marketing tables and keeps its criteria. A
 * clinical cohort is defined under `marketing.cohorts.clinical_define`, which
 * doctors hold and marketing roles do not, and its criteria never enter this
 * schema at all — a database constraint keeps them NULL. What the campaign
 * shows is the coarse label the clinician wrote.
 *
 * The screen keeps that visible rather than flattening both into one form,
 * because the whole point of the distinction is that it is not an
 * implementation detail.
 */
export function MarketingCohortsTab({
  canManage,
  canDefineClinical,
}: {
  canManage: boolean;
  canDefineClinical: boolean;
}) {
  const queryClient = useQueryClient();
  const [enquiryOpen, enquiryDrawer] = useDisclosure(false);
  const [clinicalOpen, clinicalDrawer] = useDisclosure(false);

  const [enquiryForm, setEnquiryForm] = useState({ name: "", source: "", stage: "" });
  const [clinicalForm, setClinicalForm] = useState({
    name: "",
    criteria_label: "",
    dormant_days: 365,
  });

  const {
    data: cohorts = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["marketing", "cohorts"],
    queryFn: () => marketingService.listCohorts(),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["marketing", "cohorts"] });

  const enquiryMutation = useMutation({
    mutationFn: () => {
      // Only the filters actually filled in are sent. An empty string here
      // would match nothing rather than being ignored.
      const criteria: Record<string, unknown> = {};
      if (enquiryForm.source.trim()) criteria.source = enquiryForm.source.trim();
      if (enquiryForm.stage.trim()) criteria.stage = enquiryForm.stage.trim();
      return marketingService.createEnquiryCohort({
        name: enquiryForm.name.trim(),
        criteria,
      });
    },
    onSuccess: () => {
      invalidate();
      setEnquiryForm({ name: "", source: "", stage: "" });
      enquiryDrawer.close();
      toast.success("Cohort created");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not create cohort" }),
  });

  const clinicalMutation = useMutation({
    mutationFn: () =>
      marketingService.createClinicalCohort({
        name: clinicalForm.name.trim(),
        criteria_label: clinicalForm.criteria_label.trim(),
        dormant_days: clinicalForm.dormant_days,
      }),
    onSuccess: () => {
      invalidate();
      setClinicalForm({ name: "", criteria_label: "", dormant_days: 365 });
      clinicalDrawer.close();
      toast.success("Recall list defined");
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not define list" }),
  });

  const columns = [
    {
      key: "name",
      label: "Cohort",
      render: (row: MarketingCohort) => (
        <Stack gap={0}>
          <Text fw={500}>{row.name}</Text>
          {row.criteria_label && (
            <Text size="xs" c="dimmed">
              {row.criteria_label}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: "criteria_kind",
      label: "Kind",
      render: (row: MarketingCohort) => (
        <Badge tone={row.criteria_kind === "clinical" ? "info" : "neutral"} size="sm">
          {row.criteria_kind === "clinical" ? "Clinical recall" : "Enquiry filter"}
        </Badge>
      ),
    },
    {
      key: "member_count",
      label: "Members",
      render: (row: MarketingCohort) => <Text size="sm">{row.member_count}</Text>,
    },
    {
      key: "refreshed_at",
      label: "Refreshed",
      render: (row: MarketingCohort) => (
        <Text size="sm" c="dimmed">
          {row.refreshed_at ? new Date(row.refreshed_at).toLocaleDateString() : "Never"}
        </Text>
      ),
    },
  ];

  return (
    <Stack>
      <Group>
        {canManage && (
          <Button
            tone="primary"
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={enquiryDrawer.open}
          >
            New enquiry cohort
          </Button>
        )}
        {canDefineClinical && (
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconStethoscope size={14} />}
            onClick={clinicalDrawer.open}
          >
            Define recall list
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={cohorts}
        loading={isLoading}
        rowKey={(row: MarketingCohort) => row.id}
        emptyTitle={isError ? "Cohorts could not be loaded" : "No cohorts yet"}
        emptyDescription={
          isError
            ? "This is not a statement that there are none — the list failed to load."
            : "A cohort is the list an outreach run is sent to."
        }
      />

      <Drawer
        opened={enquiryOpen}
        onClose={enquiryDrawer.close}
        title="New enquiry cohort"
        position="right"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Filters the enquiry records this module already holds. Nothing clinical is read.
          </Text>
          <TextInput
            label="Cohort name"
            value={enquiryForm.name}
            onChange={(event) => setEnquiryForm((f) => ({ ...f, name: event.currentTarget.value }))}
          />
          <Select
            label="Source"
            description="Leave blank to include every source."
            data={CAMPAIGN_CHANNEL_OPTIONS}
            value={enquiryForm.source || null}
            onChange={(value) => setEnquiryForm((f) => ({ ...f, source: value ?? "" }))}
            clearable
            searchable
          />
          <TextInput
            label="Stage code"
            description="Leave blank to include every stage."
            value={enquiryForm.stage}
            onChange={(event) =>
              setEnquiryForm((f) => ({ ...f, stage: event.currentTarget.value }))
            }
          />
          <Group justify="flex-end">
            <Button tone="secondary" size="xs" onClick={enquiryDrawer.close}>
              Cancel
            </Button>
            <Button
              tone="primary"
              size="xs"
              loading={enquiryMutation.isPending}
              onClick={() => enquiryMutation.mutate()}
            >
              Create cohort
            </Button>
          </Group>
        </Stack>
      </Drawer>

      <Drawer
        opened={clinicalOpen}
        onClose={clinicalDrawer.close}
        title="Define a recall list"
        position="right"
      >
        <Stack gap="sm">
          <Alert tone="info" title="What leaves the clinical record">
            The list is resolved to contact identifiers and nothing else. No diagnosis, no code and
            no visit date is written into marketing, and the criteria are not stored. The only thing
            a campaign will show is the label you write below — so write what is safe to say out
            loud.
          </Alert>
          <TextInput
            label="List name"
            value={clinicalForm.name}
            onChange={(event) =>
              setClinicalForm((f) => ({ ...f, name: event.currentTarget.value }))
            }
          />
          <TextInput
            label="Label shown on the campaign"
            placeholder="Annual review due"
            description="Deliberately coarse. This is the only description that reaches marketing."
            value={clinicalForm.criteria_label}
            onChange={(event) =>
              setClinicalForm((f) => ({ ...f, criteria_label: event.currentTarget.value }))
            }
          />
          <NumberInput
            label="Not seen in (days)"
            description="The only criterion available. Richer ones are a deliberate decision, not a form field."
            min={1}
            value={clinicalForm.dormant_days}
            onChange={(value) =>
              setClinicalForm((f) => ({ ...f, dormant_days: Number(value) || 365 }))
            }
          />
          <Group justify="flex-end">
            <Button tone="secondary" size="xs" onClick={clinicalDrawer.close}>
              Cancel
            </Button>
            <Button
              tone="primary"
              size="xs"
              loading={clinicalMutation.isPending}
              onClick={() => clinicalMutation.mutate()}
            >
              Define list
            </Button>
          </Group>
        </Stack>
      </Drawer>
    </Stack>
  );
}
