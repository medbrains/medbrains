/**
 * The hospital's ICD-10 catalogue: load the licensed file (WHO ClaML or a
 * code,title,chapter CSV) and see what was loaded, by whom, under which
 * licence. MedBrains ships no ICD-10 content.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FileInput,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import type { Icd10Release } from "@medbrains/types";
import { IconFileText, IconUpload } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable } from "@/components";
import { Alert, Badge, Button, Card, toast } from "@/components/ui";
import {
  ICD10_FORMAT_OPTIONS,
  type Icd10ImportForm,
  icd10ImportSchema,
  toImportIcd10Request,
} from "@/forms/icd10-import.form";
import { DIAGNOSIS_CODING_KEY, diagnosisCodingService } from "@/services/diagnosisCoding.service";

const RELEASES_KEY = ["icd10-releases"];

function formatWhen(r: Icd10Release) {
  return `${r.loaded_by_name ?? "Unknown user"} · ${new Date(r.loaded_at).toLocaleString()}`;
}

export function Icd10CatalogueSection() {
  const qc = useQueryClient();
  const releases = useQuery({
    queryKey: RELEASES_KEY,
    queryFn: diagnosisCodingService.listIcd10Releases,
  });
  const form = useForm<Icd10ImportForm>({
    resolver: zodResolver(icd10ImportSchema),
    defaultValues: { format: "claml", version: "", source: "", licence_note: "" },
  });
  const load = useMutation({
    mutationFn: async (values: Icd10ImportForm) =>
      diagnosisCodingService.importIcd10Release(await toImportIcd10Request(values)),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: RELEASES_KEY });
      void qc.invalidateQueries({ queryKey: DIAGNOSIS_CODING_KEY });
      form.reset();
      const what = `${result.release.code_count.toLocaleString()} codes (${result.release.version})`;
      if (result.already_loaded) toast.info(`This file is already the catalogue in use — ${what}`);
      else toast.success(`ICD-10 catalogue loaded: ${what}`);
    },
  });
  const activeId = releases.data?.[0]?.id;

  return (
    <Stack gap="md">
      <Card withBorder padding="md">
        <Stack gap="sm" component="form" onSubmit={form.handleSubmit((v) => load.mutate(v))}>
          <Text fw={600}>Load the ICD-10 catalogue</Text>
          <Text size="sm" c="dimmed">
            ICD-10 is not openly licensed for commercial use, so MedBrains ships none. Load the file
            your hospital holds a licence for; it replaces the catalogue in use.
          </Text>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Controller
              control={form.control}
              name="format"
              render={({ field, fieldState }) => (
                <Select
                  label="File format"
                  data={ICD10_FORMAT_OPTIONS}
                  value={field.value}
                  onChange={(v) => field.onChange(v ?? "claml")}
                  error={fieldState.error?.message}
                  allowDeselect={false}
                  required
                />
              )}
            />
            <Controller
              control={form.control}
              name="file"
              render={({ field, fieldState }) => (
                <FileInput
                  label="ICD-10 file"
                  accept=".xml,.csv,text/xml,application/xml,text/csv"
                  leftSection={<IconFileText size={16} />}
                  value={field.value ?? null}
                  onChange={(f) => field.onChange(f ?? undefined)}
                  error={fieldState.error?.message}
                  clearable
                  required
                />
              )}
            />
            <Controller
              control={form.control}
              name="version"
              render={({ field, fieldState }) => (
                <TextInput
                  label="Edition / version"
                  placeholder="e.g. 2019"
                  {...field}
                  error={fieldState.error?.message}
                  required
                />
              )}
            />
            <Controller
              control={form.control}
              name="source"
              render={({ field, fieldState }) => (
                <TextInput
                  label="Supplied by"
                  placeholder="e.g. WHO"
                  {...field}
                  error={fieldState.error?.message}
                  required
                />
              )}
            />
          </SimpleGrid>
          <Controller
            control={form.control}
            name="licence_note"
            render={({ field, fieldState }) => (
              <Textarea
                label="Licence"
                description="The agreement the hospital holds this file under — kept with the catalogue and in the audit log."
                autosize
                minRows={2}
                {...field}
                error={fieldState.error?.message}
                required
              />
            )}
          />
          {load.error && <Alert tone="danger">{load.error.message}</Alert>}
          <Group justify="flex-end">
            <Button
              tone="primary"
              type="submit"
              leftSection={<IconUpload size={16} />}
              loading={load.isPending}
            >
              Load catalogue
            </Button>
          </Group>
        </Stack>
      </Card>
      <DataTable
        data={releases.data ?? []}
        loading={releases.isLoading}
        error={releases.error}
        onRetry={() => void releases.refetch()}
        rowKey={(r) => r.id}
        emptyTitle="No ICD-10 catalogue loaded"
        emptyDescription="Load the hospital's licensed ICD-10 file above."
        columns={[
          {
            key: "release",
            label: "Release",
            render: (r) => (
              <Stack gap={0}>
                <Group gap={6}>
                  <Text size="sm" fw={600}>
                    {r.version} · {r.source}
                  </Text>
                  {r.id === activeId && <Badge tone="success">In use</Badge>}
                </Group>
                <Text size="xs" c="dimmed">
                  {r.file_name ?? r.format} · {r.code_count.toLocaleString()} codes
                </Text>
              </Stack>
            ),
          },
          {
            key: "licence",
            label: "Licence",
            render: (r) => <Text size="xs">{r.licence_note}</Text>,
          },
          { key: "by", label: "Loaded by", render: (r) => <Text size="xs">{formatWhen(r)}</Text> },
        ]}
      />
    </Stack>
  );
}
