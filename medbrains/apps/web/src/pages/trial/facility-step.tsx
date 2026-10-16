/**
 * Step 1 of a trial: what the facility is and where it will run. The modules
 * a kind of facility needs are switched on from its type; they can be changed
 * in Settings at any time.
 */
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { HospitalType, Placement, TrialPlan } from "@medbrains/types";
import { Button, NumberField, SegmentedControl, Select, Switch } from "@/components/ui";
import { EDITIONS } from "@/lib/editions";
import { SizingPreview } from "./sizing-preview";

export interface FacilityChoice {
  hospitalType: HospitalType;
  plan: TrialPlan;
}

const PLACEMENTS: { value: Placement; label: string; hint: string }[] = [
  { value: "shared_cloud", label: "Our cloud", hint: "Ready in minutes. We run and back it up." },
  {
    value: "dedicated_cloud",
    label: "Your own cloud server",
    hint: "A server only your hospital uses, set up for you when you subscribe.",
  },
  {
    value: "on_prem",
    label: "On your premises",
    hint: "Your hardware, our licence and installer. Works without the internet.",
  },
];

interface FacilityStepProps {
  value: FacilityChoice;
  onChange: (next: FacilityChoice) => void;
  onNext: () => void;
}

export function FacilityStep({ value, onChange, onNext }: FacilityStepProps) {
  const { plan } = value;
  const setPlan = (patch: Partial<TrialPlan>) =>
    onChange({ ...value, plan: { ...plan, ...patch } });
  const placement = PLACEMENTS.find((p) => p.value === plan.placement);
  return (
    <Stack gap="md">
      <Select
        label="What kind of facility?"
        data={EDITIONS}
        value={value.hospitalType}
        allowDeselect={false}
        onChange={(v) => v && onChange({ ...value, hospitalType: v as HospitalType })}
      />
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <NumberField
          label="Beds"
          description="0 for an outpatient clinic"
          min={0}
          max={5000}
          allowDecimal={false}
          value={plan.beds}
          onChange={(v) => setPlan({ beds: Number(v) || 0 })}
        />
        <NumberField
          label="Staff who will sign in"
          min={1}
          max={20000}
          allowDecimal={false}
          value={plan.staff_users}
          onChange={(v) => setPlan({ staff_users: Math.max(1, Number(v) || 1) })}
        />
      </SimpleGrid>
      <Switch
        label="Store radiology images (PACS) in MedBrains"
        checked={plan.imaging}
        onChange={(e) => setPlan({ imaging: e.currentTarget.checked })}
      />
      <Stack gap={4}>
        <Text size="sm" fw={500} id="placement-label">
          Where will it run once you subscribe?
        </Text>
        <SegmentedControl
          aria-labelledby="placement-label"
          data={PLACEMENTS.map(({ value: v, label }) => ({ value: v, label }))}
          value={plan.placement}
          onChange={(v) => setPlan({ placement: v as Placement })}
          fullWidth
        />
        <Text size="xs" c="dimmed">
          {placement?.hint}
        </Text>
      </Stack>
      <SizingPreview plan={plan} />
      <Group justify="flex-end">
        <Button tone="primary" onClick={onNext}>
          Continue
        </Button>
      </Group>
    </Stack>
  );
}
