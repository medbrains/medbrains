/**
 * Request a locale-profile change for one scope. It is saved as a knowledge
 * change set and previewed at once; a second person approves it on
 * Admin → Knowledge changes, and the hospital administrator applies it.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Input, Modal, MultiSelect, Select, TextArea, toast } from "@/components/ui";
import { knowledgeChangesService as svc } from "@/services/knowledgeChanges.service";
import { tenantSettingsService } from "@/services/tenantSettings.service";
import {
  CALENDAR_OPTIONS,
  HOSPITAL_REQUIRED,
  MONTH_OPTIONS,
  PROFILE_FIELDS,
  type ProfileField,
  type ProfileForm,
  type ProfileScope,
  toRow,
} from "./fields";

export interface ScopeRow {
  id: string;
  name: string;
  scope: ProfileScope;
  form: ProfileForm;
}

interface RequestChangeModalProps {
  target: ScopeRow | null;
  onClose: () => void;
  onCreated: (changeSetId: string) => void;
}

const metaSchema = z.object({
  title: z.string().trim().min(1, "Give the change a title"),
  reason: z.string().trim().min(1, "Say why the hospital needs this change"),
});

/** Every value the platform's `Intl` knows for `kind`, as select options. */
function intlOptions(kind: "timeZone" | "currency") {
  return Intl.supportedValuesOf(kind).map((v) => ({ value: v, label: v }));
}

/** The form control for one profile field. */
function FieldControl({
  field,
  value,
  onChange,
  error,
  countries,
  countriesError,
}: {
  field: ProfileField;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  countries: { value: string; label: string }[] | undefined;
  countriesError?: string;
}) {
  const common = { label: field.label, description: field.description, error };
  /** A searchable, clearable select over `data`, sharing the field's label and error. */
  const pick = (options: { value: string; label: string }[]) => {
    // A stored value the platform lists under another name (Chrome lists
    // Asia/Calcutta for Asia/Kolkata) stays selectable, never silently blank.
    const data =
      value && !options.some((o) => o.value === value)
        ? [{ value, label: value }, ...options]
        : options;
    return (
      <Select
        {...common}
        data={data}
        searchable
        clearable
        value={value || null}
        onChange={(v) => onChange(v ?? "")}
      />
    );
  };
  switch (field.kind) {
    case "country":
      return countriesError ? (
        <Select {...common} data={[]} disabled error={countriesError} />
      ) : (
        pick(countries ?? [])
      );
    case "zone":
      return pick(intlOptions("timeZone"));
    case "currency":
      return pick(intlOptions("currency"));
    case "month":
      return pick(MONTH_OPTIONS);
    case "select":
      return pick(field.options ?? []);
    case "calendars":
      return (
        <MultiSelect
          {...common}
          data={CALENDAR_OPTIONS}
          value={value ? value.split(",") : []}
          onChange={(v) => onChange(v.join(","))}
        />
      );
    default:
      return <Input {...common} value={value} onChange={(e) => onChange(e.currentTarget.value)} />;
  }
}

/** The modal: the scope's settable fields, a title and a reason. */
export function RequestChangeModal({ target, onClose, onCreated }: RequestChangeModalProps) {
  const queryClient = useQueryClient();
  const countries = useQuery({
    queryKey: ["geo-countries"],
    queryFn: () => tenantSettingsService.geoCountries(),
    enabled: target?.scope === "hospital",
  });
  const countryOptions = useMemo(
    () => countries.data?.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` })),
    [countries.data],
  );
  // A failed list is said on the field, never shown as "no countries".
  const countriesError = countries.isError
    ? "The country list could not load; close and try again"
    : undefined;
  const fields = PROFILE_FIELDS.filter((f) => target && f.scopes.includes(target.scope));
  const values = useForm<ProfileForm>({ values: target?.form });
  const meta = useForm({
    resolver: zodResolver(metaSchema),
    defaultValues: { title: "", reason: "" },
  });

  const save = useMutation({
    mutationFn: async ({ title, reason }: z.infer<typeof metaSchema>) => {
      if (!target) throw new Error("No scope chosen");
      const missing = HOSPITAL_REQUIRED.filter(
        (k) => target.scope === "hospital" && !values.getValues(k)?.trim(),
      );
      if (missing.length > 0) throw new Error(`The hospital needs: ${missing.join(", ")}`);
      const created = await svc.create({
        area: "locale_profile",
        title,
        reason,
        items: [
          {
            op: "update",
            target_id: target.id,
            after: toRow(target, values.getValues()),
          },
        ],
      });
      // Preview at once; a failed measure is said, never read as "no impact".
      try {
        await svc.preview(created.id);
      } catch (e) {
        toast.warning(
          `Saved as a draft; its impact could not be measured (${(e as Error).message}).`,
        );
      }
      return created.id;
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: ["knowledge-changes"] });
      toast.success("Sent for approval. A second person approves it on Knowledge changes.");
      meta.reset();
      onCreated(id);
    },
  });

  return (
    <Modal
      opened={target !== null}
      onClose={onClose}
      title={`Change the locale profile: ${target?.name ?? ""}`}
      size="lg"
    >
      <Stack component="form" gap="md" onSubmit={meta.handleSubmit((m) => save.mutate(m))}>
        <Text size="sm">
          A change here switches how{" "}
          {target?.scope === "hospital" ? "the whole hospital" : "this facility"} shows money, dates
          and times{target?.scope === "hospital" ? ", and which country's rules apply" : ""}. It
          applies only after a second person approves it. Leave a field empty to inherit it.
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {fields.map((f) => (
            <Controller
              key={f.key}
              control={values.control}
              name={f.key}
              render={({ field }) => (
                <FieldControl
                  field={f}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  countries={countryOptions}
                  countriesError={countriesError}
                />
              )}
            />
          ))}
        </SimpleGrid>
        <Controller
          control={meta.control}
          name="title"
          render={({ field, fieldState }) => (
            <Input label="Title" required {...field} error={fieldState.error?.message} />
          )}
        />
        <Controller
          control={meta.control}
          name="reason"
          render={({ field, fieldState }) => (
            <TextArea label="Why" required {...field} error={fieldState.error?.message} />
          )}
        />
        {save.error && (
          <Alert tone="danger" role="alert" title="Not sent">
            {save.error.message}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" type="submit" loading={save.isPending}>
            Send for approval
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
