/**
 * Injuries on a medico-legal case — the list an injury certificate reads:
 * each wound by site (picked on the body), type, size, and the examining
 * doctor's opinion of its nature. A legal record, so entries are appended
 * and never edited; a correction is a new entry.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { MlcInjury, MlcInjuryNature, MlcInjuryType } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable } from "@/components";
import { formatBodySite } from "@/components/BodySite/anatomy-atlas";
import { BodySitePicker } from "@/components/BodySite/BodySitePicker";
import { Alert, Button, Card, Input, NumberField, Select, TextArea, toast } from "@/components/ui";
import { emergencyService } from "@/services/emergency.service";

const INJURY_TYPES: Array<{ value: MlcInjuryType; label: string }> = [
  { value: "abrasion", label: "Abrasion" },
  { value: "laceration", label: "Laceration" },
  { value: "contusion", label: "Contusion" },
  { value: "incised_wound", label: "Incised wound" },
  { value: "stab_wound", label: "Stab wound" },
  { value: "fracture", label: "Fracture" },
  { value: "burn", label: "Burn" },
  { value: "firearm_wound", label: "Firearm wound" },
  { value: "bite", label: "Bite" },
  { value: "other", label: "Other" },
];

const NATURES: Array<{ value: MlcInjuryNature; label: string }> = [
  { value: "undetermined", label: "Opinion reserved" },
  { value: "simple", label: "Simple" },
  { value: "grievous", label: "Grievous" },
  { value: "dangerous_to_life", label: "Dangerous to life" },
];

const label = <T extends string>(options: Array<{ value: T; label: string }>, value: T) =>
  options.find((o) => o.value === value)?.label ?? value;

const size = z.number().positive().nullable();
const injurySchema = z.object({
  site: z
    .object({
      label: z.string().trim().min(1),
      code: z.string().nullable(),
      laterality: z.enum(["left", "right", "bilateral", "midline"]).nullable(),
    })
    .nullable()
    .refine((s) => Boolean(s), "Where on the body is the injury?"),
  injury_type: z.enum(INJURY_TYPES.map((t) => t.value) as [MlcInjuryType, ...MlcInjuryType[]]),
  nature: z.enum(NATURES.map((n) => n.value) as [MlcInjuryNature, ...MlcInjuryNature[]]),
  length_cm: size,
  width_cm: size,
  depth_cm: size,
  description: z.string(),
  probable_age: z.string(),
  probable_weapon: z.string(),
});
type InjuryInput = z.infer<typeof injurySchema>;

const EMPTY: InjuryInput = {
  site: null,
  injury_type: "abrasion",
  nature: "undetermined",
  length_cm: null,
  width_cm: null,
  depth_cm: null,
  description: "",
  probable_age: "",
  probable_weapon: "",
};

export function MlcInjuriesPanel({ mlcId }: { mlcId: string }) {
  const canList = useHasPermission(P.EMERGENCY.MLC_INJURIES.LIST);
  const canCreate = useHasPermission(P.EMERGENCY.MLC_INJURIES.CREATE);
  const queryClient = useQueryClient();
  const injuries = useQuery({
    queryKey: ["mlc-injuries", mlcId],
    queryFn: () => emergencyService.listMlcInjuries(mlcId),
    enabled: canList,
  });
  const { control, handleSubmit, reset, formState } = useForm<InjuryInput>({
    resolver: zodResolver(injurySchema),
    defaultValues: EMPTY,
  });
  const record = useMutation({
    mutationFn: (v: InjuryInput) =>
      emergencyService.createMlcInjury(mlcId, {
        body_site: v.site?.label ?? "",
        body_site_code: v.site?.code ?? null,
        body_site_laterality: v.site?.laterality ?? null,
        injury_type: v.injury_type,
        nature: v.nature,
        length_cm: v.length_cm,
        width_cm: v.width_cm,
        depth_cm: v.depth_cm,
        description: v.description.trim() || null,
        probable_age: v.probable_age.trim() || null,
        probable_weapon: v.probable_weapon.trim() || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mlc-injuries", mlcId] });
      toast.success("Injury recorded on the case.", { title: "Injury added" });
      reset(EMPTY);
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not record the injury" }),
  });

  if (!canList && !canCreate) return null;

  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Text fw={700}>Injuries</Text>
        {canList &&
          (injuries.isError ? (
            <Alert tone="danger">
              The injury list could not be loaded. It is not empty — retry.
            </Alert>
          ) : (
            <DataTable<MlcInjury>
              data={injuries.data ?? []}
              loading={injuries.isLoading}
              rowKey={(i) => i.id}
              emptyTitle="No injuries recorded yet"
              columns={[
                { key: "number", label: "No.", render: (i) => i.injury_number },
                {
                  key: "site",
                  label: "Site",
                  render: (i) =>
                    formatBodySite({
                      label: i.body_site ?? "—",
                      code: i.body_site_code,
                      laterality: i.body_site_laterality,
                    }),
                },
                { key: "type", label: "Type", render: (i) => label(INJURY_TYPES, i.injury_type) },
                { key: "size", label: "Size", render: (i) => i.size_cm ?? "—" },
                { key: "nature", label: "Nature", render: (i) => label(NATURES, i.nature) },
                { key: "description", label: "Description", render: (i) => i.description ?? "—" },
                { key: "age", label: "Probable age", render: (i) => i.probable_age ?? "—" },
                {
                  key: "weapon",
                  label: "Probable weapon",
                  render: (i) => i.probable_weapon ?? "—",
                },
              ]}
            />
          ))}
        {canCreate && (
          <Stack
            component="form"
            gap="xs"
            onSubmit={handleSubmit((v) => record.mutate(v))}
            aria-label="Record an injury"
          >
            <Controller
              control={control}
              name="site"
              render={({ field }) => (
                <BodySitePicker
                  label="Injury site"
                  value={field.value}
                  onChange={field.onChange}
                  error={formState.errors.site?.message}
                  required
                />
              )}
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Controller
                control={control}
                name="injury_type"
                render={({ field }) => (
                  <Select
                    label="Type"
                    data={INJURY_TYPES}
                    value={field.value}
                    onChange={(v) => v && field.onChange(v)}
                  />
                )}
              />
              <Controller
                control={control}
                name="nature"
                render={({ field }) => (
                  <Select
                    label="Nature (opinion)"
                    data={NATURES}
                    value={field.value}
                    onChange={(v) => v && field.onChange(v)}
                  />
                )}
              />
            </SimpleGrid>
            <SimpleGrid cols={3}>
              {(["length_cm", "width_cm", "depth_cm"] as const).map((dim) => (
                <Controller
                  key={dim}
                  control={control}
                  name={dim}
                  render={({ field }) => (
                    <NumberField
                      label={`${dim.replace("_cm", "")} (cm)`}
                      min={0.1}
                      decimalScale={1}
                      value={field.value ?? ""}
                      onChange={(v) => field.onChange(typeof v === "number" ? v : null)}
                      error={formState.errors[dim]?.message}
                    />
                  )}
                />
              ))}
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Controller
                control={control}
                name="probable_age"
                render={({ field }) => (
                  <Input
                    label="Probable age of injury"
                    placeholder="e.g. Fresh, 6–12 hours"
                    {...field}
                  />
                )}
              />
              <Controller
                control={control}
                name="probable_weapon"
                render={({ field }) => (
                  <Input
                    label="Probable weapon"
                    placeholder="e.g. Hard and blunt object"
                    {...field}
                  />
                )}
              />
            </SimpleGrid>
            <Controller
              control={control}
              name="description"
              render={({ field }) => (
                <TextArea
                  label="Description"
                  placeholder="Margins, colour, foreign body, direction…"
                  minRows={2}
                  {...field}
                />
              )}
            />
            <Group justify="flex-end">
              <Button type="submit" tone="primary" loading={record.isPending}>
                Record injury
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
