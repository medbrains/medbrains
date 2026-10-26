// What Ni-kshay asks about a TB case beyond its diagnosis: the MoHFW hospital
// format's site, patient type, basis of diagnosis, treatment start, weight
// and regimen.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import type { SaveTbDetailsRequest, TbCase } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  Button,
  Input,
  Modal,
  NumberField,
  SegmentedControl,
  Select,
  TextArea,
  toast,
} from "@/components/ui";
import { ckbService } from "@/services/ckb.service";

export const BASIS_OPTIONS = [
  { value: "smear", label: "Smear microscopy" },
  { value: "pcr", label: "PCR (CBNAAT / TrueNat)" },
  { value: "culture", label: "Culture" },
  { value: "lpa", label: "Line probe assay" },
  { value: "fnac", label: "FNAC" },
  { value: "histopathology", label: "Histopathology" },
  { value: "xray", label: "X-ray" },
  { value: "clinical", label: "Clinical exam" },
] as const;

const tbSchema = z
  .object({
    site: z.enum(["P", "EP"]),
    ep_site: z.string().trim().max(80),
    patient_type: z.enum(["new", "recurrent", "treatment_change"]),
    basis: z.enum(["smear", "culture", "pcr", "lpa", "fnac", "histopathology", "clinical", "xray"]),
    diagnosed_on: z.string().min(1, "Give the date of diagnosis"),
    treatment_started_on: z.string(),
    weight_kg: z.number().positive().max(400).nullable(),
    regimen: z.string().trim().max(300),
  })
  .refine((v) => v.site === "P" || v.ep_site.length > 0, {
    path: ["ep_site"],
    message: "Name the site: pleura, lymph node, spine ...",
  })
  .refine((v) => !v.treatment_started_on || v.treatment_started_on >= v.diagnosed_on, {
    path: ["treatment_started_on"],
    message: "Treatment cannot start before the diagnosis",
  });
type TbForm = z.infer<typeof tbSchema>;

interface TbDetailsModalProps {
  tbCase: TbCase;
  onClose: () => void;
}

function toRequest(f: TbForm, doctor: string | null): SaveTbDetailsRequest {
  return {
    site: f.site,
    ep_site: f.site === "EP" ? f.ep_site : null,
    patient_type: f.patient_type,
    basis: f.basis,
    diagnosed_on: f.diagnosed_on,
    treatment_started_on: f.treatment_started_on || null,
    weight_kg: f.weight_kg,
    regimen: f.regimen || null,
    notifying_doctor_id: doctor,
  };
}

export function TbDetailsModal({ tbCase, onClose }: TbDetailsModalProps) {
  const qc = useQueryClient();
  const { control, handleSubmit, register, watch, formState } = useForm<TbForm>({
    resolver: zodResolver(tbSchema),
    defaultValues: {
      // TB of the nervous system and of other organs is extra-pulmonary.
      site: tbCase.site ?? (/^A1[78]/.test(tbCase.icd10_code) ? "EP" : "P"),
      ep_site: tbCase.ep_site ?? "",
      patient_type: tbCase.patient_type ?? "new",
      basis: tbCase.basis ?? "clinical",
      diagnosed_on: tbCase.diagnosed_on ?? "",
      treatment_started_on: tbCase.treatment_started_on ?? "",
      weight_kg: tbCase.weight_kg === null ? null : Number(tbCase.weight_kg),
      regimen: tbCase.regimen ?? "",
    },
  });
  const save = useMutation({
    mutationFn: (f: TbForm) =>
      ckbService.saveTbDetails(tbCase.report_id, toRequest(f, tbCase.notifying_doctor_id)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["ckb-nikshay"] });
      toast.success("TB details saved");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not saved" }),
  });
  const errors = formState.errors;

  return (
    <Modal opened onClose={onClose} title="TB notification details" size="lg">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {tbCase.patient_name ?? "Patient"} · {tbCase.disease_name} ({tbCase.icd10_code})
          {tbCase.notifying_doctor_name ? ` · notified by ${tbCase.notifying_doctor_name}` : ""}
        </Text>
        <Group grow align="flex-start">
          <Controller
            control={control}
            name="site"
            render={({ field }) => (
              <SegmentedControl
                aria-label="Site of disease"
                data={[
                  { value: "P", label: "Pulmonary" },
                  { value: "EP", label: "Extra-pulmonary" },
                ]}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {watch("site") === "EP" && (
            <Input
              label="Extra-pulmonary site"
              placeholder="Lymph node"
              error={errors.ep_site?.message}
              {...register("ep_site")}
            />
          )}
        </Group>
        <Group grow align="flex-start">
          <Controller
            control={control}
            name="patient_type"
            render={({ field }) => (
              <Select
                label="Patient type"
                data={[
                  { value: "new", label: "New TB case" },
                  { value: "recurrent", label: "Recurrent TB case" },
                  { value: "treatment_change", label: "Treatment change" },
                ]}
                value={field.value}
                onChange={(v) => v && field.onChange(v)}
                allowDeselect={false}
              />
            )}
          />
          <Controller
            control={control}
            name="basis"
            render={({ field }) => (
              <Select
                label="Basis of diagnosis"
                data={[...BASIS_OPTIONS]}
                value={field.value}
                onChange={(v) => v && field.onChange(v)}
                allowDeselect={false}
              />
            )}
          />
        </Group>
        <Group grow align="flex-start">
          <Input
            type="date"
            label="Date of diagnosis"
            required
            error={errors.diagnosed_on?.message}
            {...register("diagnosed_on")}
          />
          <Input
            type="date"
            label="Treatment started"
            error={errors.treatment_started_on?.message}
            {...register("treatment_started_on")}
          />
          <Controller
            control={control}
            name="weight_kg"
            render={({ field }) => (
              <NumberField
                label="Weight (kg)"
                min={1}
                max={400}
                decimalScale={1}
                value={field.value ?? ""}
                onChange={(v) => field.onChange(typeof v === "number" ? v : null)}
                error={errors.weight_kg?.message}
              />
            )}
          />
        </Group>
        <TextArea
          label="Drugs and dosages (mg)"
          placeholder="H 300 / R 600 / Z 1500 / E 1100"
          autosize
          minRows={2}
          error={errors.regimen?.message}
          {...register("regimen")}
        />
        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            loading={save.isPending}
            onClick={() => void handleSubmit((f) => save.mutate(f))()}
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
