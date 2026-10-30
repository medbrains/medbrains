/**
 * One case's NCDIR HBCR abstract: what the record already holds (patient and
 * staging), the core-form items the clerk codes, what still keeps it from
 * complete, and — once complete — the NCDIR registration it was given.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type RegistryCase, type RegistryCodeLists } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Badge, Button, Input, Modal, Select, toast } from "@/components/ui";
import { specialtyService } from "@/services/specialty.service";
import { type RegistryFormValues, registrySchema, toCoding, toFormValues } from "./registry-form";

interface AbstractModalProps {
  stagingId: string | null;
  onClose: () => void;
}

const REFERRAL = [
  { value: "self", label: "Self" },
  { value: "other_facility", label: "Referred by another facility" },
  { value: "unknown", label: "Unknown" },
];
const SEQUENCE = Array.from({ length: 10 }, (_, i) => ({
  value: String(i),
  label: i === 0 ? "0 - Single primary" : String(i),
}));

/** Labelled selects for each coded item, keyed by field. */
const CODED_FIELDS: [keyof RegistryFormValues & string, string][] = [
  ["case_registered_through", "6 Case registered through"],
  ["method_of_diagnosis", "20 Method of diagnosis"],
  ["laterality", "25 Laterality"],
  ["extent_of_disease", "27 Clinical extent of disease"],
  ["staging_system", "28.1 Staging system"],
  ["prior_treatment", "29 Treatment before registration"],
  ["intention", "29 Intention of treatment"],
  ["ecog", "29.3 ECOG performance status"],
  ["treatment_at_ri", "30 Treatment at this institute"],
];
const TEXT_FIELDS: [keyof RegistryFormValues & string, string, string][] = [
  ["hbcr_registration_no", "2 HBCR registration number", ""],
  ["icdo3_topography", "23.1 Topography (ICD-O-3)", "C50.4"],
  ["icdo3_morphology", "23.2 Morphology (ICD-O-3)", "8500/3"],
  ["icd10_code", "23 ICD-10", "C50.4"],
];

const options = (codes: RegistryCodeLists | undefined, field: string) =>
  (codes?.[field] ?? []).map(([code, meaning]) => ({
    value: String(code),
    label: `${code} - ${meaning}`,
  }));

function Facts({ c }: { c: RegistryCase }) {
  const f = c.facts;
  const tnm = [f.t_stage, f.n_stage, f.m_stage].filter(Boolean).join(" ") || "—";
  return (
    <SimpleGrid cols={{ base: 1, sm: 3 }}>
      <Text size="sm">
        {f.patient_name} · {f.uhid}
      </Text>
      <Text size="sm">
        {f.primary_site}
        {f.histology ? ` · ${f.histology}` : ""}
      </Text>
      <Text size="sm">
        TNM {tnm} · Stage {f.overall_stage ?? "—"}
      </Text>
    </SimpleGrid>
  );
}

function AbstractForm({ c, codes }: { c: RegistryCase; codes: RegistryCodeLists | undefined }) {
  const qc = useQueryClient();
  const canAbstract = useHasPermission(P.SPECIALTY.OTHER.ONCOLOGY_REGISTRY_ABSTRACT);
  const locked = c.status === "submitted" || !canAbstract;
  const id = c.facts.staging_id;
  const form = useForm<RegistryFormValues>({
    resolver: zodResolver(registrySchema),
    defaultValues: toFormValues(c.coding),
  });
  const save = useMutation({
    mutationFn: (v: RegistryFormValues) => specialtyService.saveRegistryAbstract(id, toCoding(v)),
    onSuccess: (saved) => {
      qc.setQueryData(["registry-case", id], saved);
      qc.invalidateQueries({ queryKey: ["cancer-registry"] });
      toast.success(saved.status === "complete" ? "Abstract complete" : "Draft saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const err = form.formState.errors;
  return (
    <Stack component="form" gap="sm" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        {TEXT_FIELDS.map(([name, label, placeholder]) => (
          <Controller
            key={name}
            name={name}
            control={form.control}
            render={({ field }) => (
              <Input
                {...field}
                label={label}
                placeholder={placeholder}
                error={err[name]?.message}
                disabled={locked}
              />
            )}
          />
        ))}
        <Controller
          name="date_of_first_diagnosis"
          control={form.control}
          render={({ field }) => (
            <Input {...field} type="date" label="8 Date of first diagnosis" disabled={locked} />
          )}
        />
        <Controller
          name="referral_type"
          control={form.control}
          render={({ field }) => (
            <Select
              label="7 Type of referral"
              data={REFERRAL}
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? "")}
              clearable
              disabled={locked}
            />
          )}
        />
        <Controller
          name="sequence"
          control={form.control}
          render={({ field }) => (
            <Select
              label="26 Sequence"
              data={SEQUENCE}
              value={field.value || null}
              onChange={(v) => field.onChange(v ?? "")}
              clearable
              disabled={locked}
            />
          )}
        />
        {CODED_FIELDS.map(([name, label]) => (
          <Controller
            key={name}
            name={name}
            control={form.control}
            render={({ field }) => (
              <Select
                label={label}
                data={options(codes, name)}
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? "")}
                clearable
                disabled={locked}
              />
            )}
          />
        ))}
      </SimpleGrid>
      {!locked && (
        <Group justify="flex-end">
          <Button type="submit" tone="primary" loading={save.isPending}>
            Save abstract
          </Button>
        </Group>
      )}
    </Stack>
  );
}

function SubmitSection({ c }: { c: RegistryCase }) {
  const qc = useQueryClient();
  const canExport = useHasPermission(P.SPECIALTY.OTHER.ONCOLOGY_REGISTRY_EXPORT);
  const [reference, setReference] = useState("");
  const id = c.facts.staging_id;
  const submit = useMutation({
    mutationFn: () => specialtyService.markRegistrySubmitted(id, reference),
    onSuccess: (saved) => {
      qc.setQueryData(["registry-case", id], saved);
      qc.invalidateQueries({ queryKey: ["cancer-registry"] });
      toast.success("Marked submitted to NCDIR");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (c.status === "submitted") {
    return <Alert tone="success">Submitted to NCDIR as {c.ncdir_reference}.</Alert>;
  }
  if (c.status !== "complete" || !canExport) return null;
  return (
    <Group align="flex-end">
      <Input
        label="NCDIR registration"
        description="As the HBCR software gave it, once this case is entered there"
        value={reference}
        onChange={(e) => setReference(e.currentTarget.value)}
        maxLength={60}
      />
      <Button
        tone="secondary"
        disabled={reference.trim() === ""}
        loading={submit.isPending}
        onClick={() => submit.mutate()}
      >
        Mark submitted
      </Button>
    </Group>
  );
}

export function AbstractModal({ stagingId, onClose }: AbstractModalProps) {
  const caseQuery = useQuery({
    queryKey: ["registry-case", stagingId],
    queryFn: () => specialtyService.getRegistryCase(stagingId ?? ""),
    enabled: stagingId !== null,
  });
  const codes = useQuery({
    queryKey: ["registry-codes"],
    queryFn: () => specialtyService.getRegistryCodeLists(),
    enabled: stagingId !== null,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const c = caseQuery.data;
  return (
    <Modal opened={stagingId !== null} onClose={onClose} title="Cancer registry abstract" size="xl">
      {caseQuery.isError && (
        <Alert tone="danger">Could not load this case: {caseQuery.error.message}</Alert>
      )}
      {c && (
        <Stack gap="md">
          <Group justify="space-between">
            <Facts c={c} />
            <Badge tone={c.status === "complete" ? "success" : "neutral"}>{c.status}</Badge>
          </Group>
          {c.missing.length > 0 && (
            <Alert tone="warning" title="Still needed before this case is complete">
              {c.missing.join(", ")}
            </Alert>
          )}
          <AbstractForm key={`${c.status}-${c.missing.length}`} c={c} codes={codes.data} />
          <SubmitSection c={c} />
        </Stack>
      )}
    </Modal>
  );
}
