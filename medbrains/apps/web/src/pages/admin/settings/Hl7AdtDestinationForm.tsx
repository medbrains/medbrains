import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { AdtDestination, AdtDestinationInput } from "@medbrains/types";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Chip, ChipGroup, Input, NumberField, Switch } from "@/components/ui";

/** The triggers a destination can take, as staff read them. */
export const ADT_EVENTS: { code: AdtDestinationInput["events"][number]; label: string }[] = [
  { code: "A01", label: "A01 Admit" },
  { code: "A02", label: "A02 Transfer" },
  { code: "A03", label: "A03 Discharge" },
  { code: "A04", label: "A04 Register (OPD / ER)" },
  { code: "A08", label: "A08 Update patient" },
  { code: "A11", label: "A11 Cancel admit" },
  { code: "A13", label: "A13 Cancel discharge" },
];

const schema = z.object({
  name: z.string().trim().min(2, "Name the destination, like Radiology PACS"),
  host: z
    .string()
    .trim()
    .min(1, "Enter the host")
    .regex(/^[^/:\s]+$/, "The host name or IP only, like 10.0.4.20 — no http:// or port"),
  port: z.number().int().min(1, "1 to 65535").max(65_535, "1 to 65535"),
  events: z
    .array(z.enum(["A01", "A02", "A03", "A04", "A08", "A11", "A13"]))
    .min(1, "Choose at least one trigger"),
  sending_facility: z.string().trim(),
  receiving_application: z.string().trim(),
  receiving_facility: z.string().trim(),
  is_active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

interface Hl7AdtDestinationFormProps {
  initial?: AdtDestination;
  busy: boolean;
  onSubmit: (values: AdtDestinationInput) => void;
  onCancel: () => void;
}

/** Where one ADT feed goes and which triggers it carries. */
export function Hl7AdtDestinationForm({
  initial,
  busy,
  onSubmit,
  onCancel,
}: Hl7AdtDestinationFormProps) {
  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      host: initial?.host ?? "",
      port: initial?.port ?? 2575,
      events: initial?.events ?? ["A01", "A02", "A03", "A08"],
      sending_facility: initial?.sending_facility ?? "",
      receiving_application: initial?.receiving_application ?? "",
      receiving_facility: initial?.receiving_facility ?? "",
      is_active: initial?.is_active ?? true,
    },
  });
  const text = (
    name: "name" | "host" | "sending_facility" | "receiving_application" | "receiving_facility",
    label: string,
    description?: string,
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Input
          label={label}
          description={description}
          error={fieldState.error?.message}
          {...field}
        />
      )}
    />
  );
  return (
    <Stack gap="md">
      {text("name", "Name")}
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {text("host", "Host", "On the hospital network or VPN; MLLP is not sent over the internet")}
        <Controller
          control={control}
          name="port"
          render={({ field, fieldState }) => (
            <NumberField
              label="MLLP port"
              min={1}
              max={65_535}
              value={field.value}
              onChange={(v) => field.onChange(typeof v === "number" ? v : 0)}
              error={fieldState.error?.message}
            />
          )}
        />
      </SimpleGrid>
      <Controller
        control={control}
        name="events"
        render={({ field, fieldState }) => (
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Triggers
            </Text>
            <ChipGroup multiple value={field.value} onChange={field.onChange}>
              <Group gap="xs">
                {ADT_EVENTS.map((e) => (
                  <Chip key={e.code} value={e.code}>
                    {e.label}
                  </Chip>
                ))}
              </Group>
            </ChipGroup>
            {fieldState.error && (
              <Text size="xs" c="var(--mb-text-error)">
                {fieldState.error.message}
              </Text>
            )}
          </Stack>
        )}
      />
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        {text("sending_facility", "Sending facility (MSH-4)", "Blank: the hospital's code")}
        {text("receiving_application", "Receiving application (MSH-5)")}
        {text("receiving_facility", "Receiving facility (MSH-6)")}
      </SimpleGrid>
      <Controller
        control={control}
        name="is_active"
        render={({ field }) => (
          <Switch
            label="Send to this destination"
            checked={field.value}
            onChange={(e) => field.onChange(e.currentTarget.checked)}
          />
        )}
      />
      <Group justify="flex-end">
        <Button tone="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button tone="primary" loading={busy} onClick={handleSubmit((v) => onSubmit(v))}>
          Save
        </Button>
      </Group>
    </Stack>
  );
}
