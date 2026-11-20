/**
 * Register / link one campus in ABDM's Health Facility Registry (HFR).
 *
 * Link: enter the HFR ID the campus already holds — verified against HFR
 * search when ABDM keys exist, saved as "registered" (unconfirmed) when not.
 * Register or update: HFR's official flow, in its own full-screen step
 * (`hfr/HfrOnboardingModal`), opened from here.
 */

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { FacilityHfr } from "@medbrains/types";
import { IconExternalLink } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useController, useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Button,
  Input,
  Modal,
  NumberField,
  SegmentedControl,
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

interface FacilityHfrModalProps {
  facility: FacilityHfr;
  registryConfigured: boolean;
  onClose: () => void;
  /** Open the full-screen official registration / update flow instead. */
  onOnboard: () => void;
}

/** Link an existing HFR ID, or hand over to the registration flow. */
export function FacilityHfrModal({
  facility,
  registryConfigured,
  onClose,
  onOnboard,
}: FacilityHfrModalProps) {
  const [mode, setMode] = useState<"link" | "register">("link");
  return (
    <Modal opened onClose={onClose} title={`Health Facility Registry — ${facility.name}`} size="lg">
      <Stack gap="md">
        <SegmentedControl
          value={mode}
          onChange={(v) => setMode(v === "register" ? "register" : "link")}
          data={[
            { value: "link", label: "Link existing HFR ID" },
            { value: "register", label: "Register or update on HFR" },
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
          <OnboardPrompt registryConfigured={registryConfigured} onOnboard={onOnboard} />
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

/** Where registration happens: HFR's own flow, or its portal. */
function OnboardPrompt({
  registryConfigured,
  onOnboard,
}: {
  registryConfigured: boolean;
  onOnboard: () => void;
}) {
  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Registration follows HFR's own steps: search HFR first, then basic, additional and detailed
        information, then submit with the facility manager's and a verifier's HPR sign-in. A started
        registration resumes where it stopped.
      </Text>
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
        <Button tone="primary" disabled={!registryConfigured} onClick={onOnboard}>
          Open HFR registration
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
