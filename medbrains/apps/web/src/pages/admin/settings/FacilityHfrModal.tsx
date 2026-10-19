/**
 * Register / link one campus in ABDM's Health Facility Registry (HFR).
 *
 * Link: enter the HFR ID the campus already holds — verified against HFR
 * search when ABDM keys exist, saved as "registered" (unconfirmed) when not.
 * Register: submit a new registration through the HFR API; needs keys.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { FacilityHfr } from "@medbrains/types";
import { IconExternalLink } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useController, useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Button,
  Input,
  Modal,
  NumberField,
  SegmentedControl,
  Select,
  Switch,
} from "@/components/ui";
import { abdmRegistryService } from "@/services/abdmRegistry.service";

export const HFR_QUERY_KEY = ["abdm-hfr-facilities"];
const HFR_PORTAL_URL = "https://facility.abdm.gov.in";

const bedsSchema = z.number().int().min(0, "Cannot be negative").nullable();

const linkSchema = z.object({
  hfr_facility_id: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^IN[0-9A-Za-z]{10}$/.test(v),
      "IN followed by 10 letters or digits",
    ),
  hfr_bed_count: bedsSchema,
  hfr_ipd: z.boolean(),
});
type LinkForm = z.infer<typeof linkSchema>;

const registerSchema = z.object({
  ownership: z.enum(["government", "private", "trust"]),
  state_lgd_code: z.string().regex(/^\d+$/, "Numeric LGD state code"),
  district_lgd_code: z.string().regex(/^\d+$/, "Numeric LGD district code"),
  pincode: z.string().regex(/^\d{6}$/, "6 digits"),
  hfr_bed_count: bedsSchema,
  hfr_ipd: z.boolean(),
});
type RegisterForm = z.infer<typeof registerSchema>;

const OWNERSHIP_OPTIONS = [
  { value: "government", label: "Government" },
  { value: "private", label: "Private" },
  { value: "trust", label: "Trust" },
];

interface FacilityHfrModalProps {
  facility: FacilityHfr;
  registryConfigured: boolean;
  onClose: () => void;
}

export function FacilityHfrModal({ facility, registryConfigured, onClose }: FacilityHfrModalProps) {
  const [mode, setMode] = useState<"link" | "register">("link");
  return (
    <Modal opened onClose={onClose} title={`Health Facility Registry — ${facility.name}`} size="lg">
      <Stack gap="md">
        <SegmentedControl
          value={mode}
          onChange={(v) => setMode(v === "register" ? "register" : "link")}
          data={[
            { value: "link", label: "Link existing HFR ID" },
            { value: "register", label: "Register new" },
          ]}
        />
        {!registryConfigured && (
          <Alert tone="info">
            ABDM keys are not configured yet. A linked ID is saved as registered, not verified, and
            can be verified once keys are added.
          </Alert>
        )}
        {mode === "link" ? (
          <LinkHfrForm facility={facility} onDone={onClose} />
        ) : (
          <RegisterHfrForm
            facility={facility}
            registryConfigured={registryConfigured}
            onDone={onClose}
          />
        )}
      </Stack>
    </Modal>
  );
}

function useHfrMutation<T>(fn: (data: T) => Promise<FacilityHfr>, onDone: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (row) => {
      notifications.show({
        title: "HFR updated",
        message: `${row.name}: ${row.hfr_status.replace(/_/g, " ")}`,
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: HFR_QUERY_KEY });
      onDone();
    },
    onError: (err: Error) =>
      notifications.show({ title: "HFR update failed", message: err.message, color: "danger" }),
  });
}

function LinkHfrForm({ facility, onDone }: { facility: FacilityHfr; onDone: () => void }) {
  const { control, handleSubmit, register, formState } = useForm<LinkForm>({
    resolver: zodResolver(linkSchema),
    defaultValues: {
      hfr_facility_id: facility.hfr_facility_id ?? "",
      hfr_bed_count: facility.hfr_bed_count ?? facility.bed_count,
      hfr_ipd: facility.hfr_ipd,
    },
  });
  const beds = useController({ control, name: "hfr_bed_count" }).field;
  const ipd = useController({ control, name: "hfr_ipd" }).field;
  const save = useHfrMutation(
    (form: LinkForm) =>
      abdmRegistryService.linkFacilityHfr(facility.id, {
        hfr_facility_id: form.hfr_facility_id.toUpperCase() || null,
        hfr_bed_count: form.hfr_bed_count,
        hfr_ipd: form.hfr_ipd,
      }),
    onDone,
  );
  return (
    <Stack gap="sm">
      <Input
        label="HFR facility ID"
        description="Leave empty to unlink this campus"
        placeholder="IN0410000183"
        error={formState.errors.hfr_facility_id?.message}
        {...register("hfr_facility_id")}
      />
      <BedsAndIpd
        beds={beds.value}
        onBeds={beds.onChange}
        ipd={ipd.value}
        onIpd={ipd.onChange}
        bedsError={formState.errors.hfr_bed_count?.message}
      />
      <Group justify="flex-end">
        <Button tone="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button
          tone="primary"
          loading={save.isPending}
          onClick={() => void handleSubmit((f) => save.mutate(f))()}
        >
          Verify and save
        </Button>
      </Group>
    </Stack>
  );
}

function RegisterHfrForm({
  facility,
  registryConfigured,
  onDone,
}: {
  facility: FacilityHfr;
  registryConfigured: boolean;
  onDone: () => void;
}) {
  const { control, handleSubmit, register, formState } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      ownership: "private",
      state_lgd_code: "",
      district_lgd_code: "",
      pincode: "",
      hfr_bed_count: facility.hfr_bed_count ?? facility.bed_count,
      hfr_ipd: facility.hfr_ipd,
    },
  });
  const beds = useController({ control, name: "hfr_bed_count" }).field;
  const ipd = useController({ control, name: "hfr_ipd" }).field;
  const submit = useHfrMutation(
    (form: RegisterForm) =>
      abdmRegistryService.registerFacilityHfr(facility.id, { ...form, specializations: [] }),
    onDone,
  );
  const { errors } = formState;
  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Name, address, phone and email are taken from this facility's record. You can also register
        on the HFR portal and link the ID it issues.
      </Text>
      <Controller
        control={control}
        name="ownership"
        render={({ field }) => (
          <Select
            label="Ownership"
            data={OWNERSHIP_OPTIONS}
            value={field.value}
            onChange={(v) => field.onChange(v ?? "private")}
            allowDeselect={false}
          />
        )}
      />
      <Group grow>
        <Input
          label="LGD state code"
          error={errors.state_lgd_code?.message}
          {...register("state_lgd_code")}
        />
        <Input
          label="LGD district code"
          error={errors.district_lgd_code?.message}
          {...register("district_lgd_code")}
        />
        <Input label="Pincode" error={errors.pincode?.message} {...register("pincode")} />
      </Group>
      <BedsAndIpd
        beds={beds.value}
        onBeds={beds.onChange}
        ipd={ipd.value}
        onIpd={ipd.onChange}
        bedsError={errors.hfr_bed_count?.message}
      />
      <Group justify="space-between">
        <Button
          tone="ghost"
          component="a"
          href={HFR_PORTAL_URL}
          target="_blank"
          rel="noreferrer"
          rightSection={<IconExternalLink size={16} />}
        >
          HFR portal
        </Button>
        <Button
          tone="primary"
          disabled={!registryConfigured}
          loading={submit.isPending}
          onClick={() => void handleSubmit((f) => submit.mutate(f))()}
        >
          Submit to HFR
        </Button>
      </Group>
    </Stack>
  );
}

interface BedsAndIpdProps {
  beds: number | null;
  onBeds: (beds: number | null) => void;
  ipd: boolean;
  onIpd: (ipd: boolean) => void;
  bedsError?: string;
}

function BedsAndIpd({ beds, onBeds, ipd, onIpd, bedsError }: BedsAndIpdProps) {
  return (
    <Group grow align="flex-end">
      <NumberField
        label="Beds declared to HFR"
        description="DHIS needs 10 or more beds with IPD"
        min={0}
        value={beds ?? ""}
        onChange={(v) => onBeds(typeof v === "number" ? v : null)}
        error={bedsError}
      />
      <Switch
        label="Has inpatient department (IPD)"
        checked={ipd}
        onChange={(e) => onIpd(e.currentTarget.checked)}
      />
    </Group>
  );
}
