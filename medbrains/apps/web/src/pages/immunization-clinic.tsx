/**
 * The immunisation clinic's day: every child with a dose on record here
 * whose next vaccine is due, overdue or coming up, by the hospital's
 * schedule. Settings (schedule, JE, SMS reminders) for those who may set it.
 */
import { Anchor, Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type ImmunizationScheduleSetting, P, type ScheduledDoseState } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { PageHeader } from "@/components";
import {
  Alert,
  Badge,
  type BadgeTone,
  Button,
  Card,
  NumberField,
  SegmentedControl,
  Select,
  Switch,
  Table,
  toast,
} from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { immunizationClinicService } from "@/services/immunizationClinic.service";

const STATE: Partial<Record<ScheduledDoseState, { label: string; tone: BadgeTone }>> = {
  due: { label: "Due", tone: "warning" },
  overdue: { label: "Overdue", tone: "danger" },
  upcoming: { label: "Coming up", tone: "info" },
};

function ageText(dob: string): string {
  const days = Math.floor((Date.now() - new Date(dob).getTime()) / 86_400_000);
  if (days < 84) return `${Math.floor(days / 7)} wk`;
  if (days < 730) return `${Math.floor(days / 30.4375)} mo`;
  return `${Math.floor(days / 365.25)} y`;
}

export function ImmunizationClinicPage() {
  useRequirePermission(P.PATIENTS.IMMUNIZATIONS.DUE_LIST);
  const canConfigure = useHasPermission(P.PATIENTS.IMMUNIZATIONS.CONFIGURE);
  const [within, setWithin] = useState("0");
  const due = useQuery({
    queryKey: ["immunization-due-list", within],
    queryFn: () => immunizationClinicService.listDueList({ within_days: Number(within) }),
  });

  return (
    <Stack>
      <PageHeader
        title="Immunisation clinic"
        subtitle="Children's next vaccines by the hospital's schedule"
      />
      {canConfigure && <ScheduleSettings />}
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {due.data
            ? `${due.data.setting.kind === "iap" ? "IAP recommended" : "National (UIP)"} schedule · ${due.data.total} dose${due.data.total === 1 ? "" : "s"}`
            : " "}
        </Text>
        <SegmentedControl
          aria-label="How far ahead"
          value={within}
          onChange={setWithin}
          data={[
            { value: "0", label: "Due and overdue" },
            { value: "7", label: "Next 7 days" },
            { value: "30", label: "Next 30 days" },
          ]}
        />
      </Group>
      {due.isError && (
        <Alert tone="danger" title="The due list could not be loaded">
          {(due.error as Error).message}
        </Alert>
      )}
      {due.data?.rows.length === 0 && (
        <Text size="sm">No child with a dose on record here has a vaccine due.</Text>
      )}
      {!!due.data?.rows.length && (
        <Table aria-label="Vaccines due">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Due</Table.Th>
              <Table.Th>Child</Table.Th>
              <Table.Th>Age</Table.Th>
              <Table.Th>Vaccine</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Phone</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {due.data.rows.map((r) => (
              <Table.Tr key={`${r.patient_id}-${r.dose}`}>
                <Table.Td>{r.due_on}</Table.Td>
                <Table.Td>
                  <Anchor component={Link} to={`/patients/${r.patient_id}?tab=immunizations`}>
                    {r.patient_name}
                  </Anchor>
                  <Text size="xs" c="dimmed">
                    {r.uhid}
                  </Text>
                </Table.Td>
                <Table.Td>{ageText(r.date_of_birth)}</Table.Td>
                <Table.Td>
                  {r.dose}
                  <Text size="xs" c="dimmed">
                    {r.product_name}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {STATE[r.state] && (
                    <Badge tone={STATE[r.state]?.tone}>{STATE[r.state]?.label}</Badge>
                  )}
                </Table.Td>
                <Table.Td>{r.phone ?? "—"}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

/** Which schedule the hospital follows, JE, and SMS reminders. */
function ScheduleSettings() {
  const queryClient = useQueryClient();
  const current = useQuery({
    queryKey: ["immunization-settings"],
    queryFn: () => immunizationClinicService.getSettings(),
  });
  const [draft, setDraft] = useState<ImmunizationScheduleSetting | null>(null);
  const value = draft ?? current.data ?? null;
  const save = useMutation({
    mutationFn: (s: ImmunizationScheduleSetting) => immunizationClinicService.updateSettings(s),
    onSuccess: () => {
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: ["immunization-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["immunization-due-list"] });
      toast.success("The schedule setting is saved.", { title: "Saved" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not saved" }),
  });
  if (current.isError) {
    return (
      <Alert tone="danger" title="The schedule setting could not be loaded">
        {(current.error as Error).message}
      </Alert>
    );
  }
  if (!value) return null;
  const edit = (patch: Partial<ImmunizationScheduleSetting>) => setDraft({ ...value, ...patch });

  return (
    <Card withBorder p="md">
      <Group align="flex-end" gap="lg">
        <Select
          label="Schedule"
          value={value.kind}
          onChange={(v) => edit({ kind: v === "iap" ? "iap" : "uip" })}
          data={[
            { value: "uip", label: "National Immunization Schedule (UIP)" },
            { value: "iap", label: "IAP recommended (ACVIP)" },
          ]}
          w={320}
        />
        <Switch
          label="Give JE (endemic district)"
          checked={value.include_je}
          onChange={(e) => edit({ include_je: e.currentTarget.checked })}
        />
        <Switch
          label="SMS reminders to parents"
          checked={value.sms_reminders}
          onChange={(e) => edit({ sms_reminders: e.currentTarget.checked })}
        />
        <NumberField
          label="Days before the dose"
          min={0}
          max={14}
          value={value.remind_days_before}
          onChange={(v) => edit({ remind_days_before: typeof v === "number" ? v : 0 })}
          disabled={!value.sms_reminders}
          w={160}
        />
        <Button
          tone="primary"
          disabled={!draft}
          loading={save.isPending}
          onClick={() => draft && save.mutate(draft)}
        >
          Save
        </Button>
      </Group>
    </Card>
  );
}
