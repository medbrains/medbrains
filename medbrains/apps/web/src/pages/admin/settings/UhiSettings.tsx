import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type UhiService } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Modal,
  SegmentedControl,
  Select,
  Switch,
  toast,
} from "@/components/ui";
import { uhiService } from "@/services/uhi.service";
import { UhiFeesCard } from "./UhiFeesCard";

const KEY = ["uhi", "settings"];

const SERVICES: { value: UhiService; label: string; hint: string }[] = [
  {
    value: "teleconsultation",
    label: "Teleconsultation",
    hint: "Doctors with an HPR ID and a weekly schedule; booking makes an appointment.",
  },
  {
    value: "physical_consultation",
    label: "Consultation at the hospital",
    hint: "The same doctors and slots, booked as an OPD visit; paid at the desk.",
  },
  {
    value: "lab_tests",
    label: "Lab tests",
    hint: "Tests the lab catalogue marks bookable by patients; the lab accepts each request.",
  },
  {
    value: "ambulance",
    label: "Ambulance",
    hint: "Available ambulances by type; a request waits for dispatch to accept.",
  },
  {
    value: "blood_bank",
    label: "Blood availability",
    hint: "Released units by group and component, counts only; requests are enquiries.",
  },
];

const schema = z.object({
  environment: z.enum(["sandbox", "production"]),
  subscriber_id: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]{3,128}$/, "3–128 letters, digits, dots, dashes or underscores"),
  unique_key_id: z.string().trim().min(1, "Enter the unique key ID registered with NHA"),
  city_code: z.string().trim(),
  facility_id: z.string().nullable(),
  services: z.array(
    z.enum(["teleconsultation", "physical_consultation", "lab_tests", "blood_bank", "ambulance"]),
  ),
  is_active: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

/**
 * Settings → UHI. How this hospital is registered on NHA's Unified Health
 * Interface, so patient apps can book its teleconsultations and request its
 * ambulances and blood. The signing key pair is generated on the server;
 * only the public key is ever shown — it is what NHA registers.
 */
export function UhiSettings() {
  const queryClient = useQueryClient();
  const canSeeCampuses = useHasPermission(P.ABDM.HFR.VIEW);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const { data, isLoading, isError } = useQuery({ queryKey: KEY, queryFn: uhiService.getSettings });
  const campuses = useQuery({
    queryKey: ["abdm", "hfr", "facilities"],
    queryFn: uhiService.listCampuses,
    enabled: canSeeCampuses,
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      environment: data?.environment ?? "sandbox",
      subscriber_id: data?.subscriber_id ?? "",
      unique_key_id: data?.unique_key_id ?? "",
      city_code: data?.city_code ?? "",
      facility_id: data?.facility_id ?? null,
      services: data?.services ?? [],
      is_active: data?.is_active ?? false,
    },
  });
  const save = useMutation({
    mutationFn: (v: FormValues) =>
      uhiService.saveSettings({ ...v, city_code: v.city_code || null }),
    onSuccess: (saved) => {
      queryClient.setQueryData(KEY, saved);
      toast.success(
        saved.is_active
          ? "Patient apps can now reach this hospital."
          : "UHI stays off until you switch it on.",
        { title: "UHI settings saved" },
      );
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save the UHI settings" }),
  });
  const keys = useMutation({
    mutationFn: uhiService.generateKeys,
    onSuccess: (saved) => {
      queryClient.setQueryData(KEY, saved);
      setConfirmRotate(false);
      toast.success("Register the new public key with NHA.", { title: "Signing key generated" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not generate the key" }),
  });

  if (isError) {
    return (
      <Alert tone="danger" title="Could not load the UHI settings">
        This does not mean UHI is off — the settings failed to load.
      </Alert>
    );
  }
  const hasKey = Boolean(data?.signing_public_key);
  const campusOptions = (campuses.data?.facilities ?? []).map((f) => ({
    value: f.id,
    label: f.hfr_facility_id ? `${f.name} · HFR ${f.hfr_facility_id}` : `${f.name} · no HFR ID`,
  }));

  return (
    <Stack>
      <Card>
        <Stack component="form" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <Stack gap={4}>
            <Text fw={600}>UHI provider (HSPA)</Text>
            <Text size="sm" c="dimmed">
              The subscriber ID and unique key ID NHA registered this hospital under. Patient apps
              reach it through the UHI gateway; every call is signed both ways.
            </Text>
            <Group gap="xs">
              <Badge tone={data?.is_active ? "success" : "warning"}>
                {isLoading ? "Loading…" : data?.is_active ? "On" : "Off"}
              </Badge>
              <Badge tone={data && data.doctors_with_hpr > 0 ? "info" : "warning"}>
                {`${data?.doctors_with_hpr ?? 0} doctors with an HPR ID`}
              </Badge>
            </Group>
          </Stack>
          <Controller
            control={form.control}
            name="environment"
            render={({ field }) => (
              <SegmentedControl
                aria-label="UHI environment"
                value={field.value}
                onChange={field.onChange}
                data={[
                  { value: "sandbox", label: "Sandbox (testing)" },
                  { value: "production", label: "Production (live patients)" },
                ]}
              />
            )}
          />
          <Controller
            control={form.control}
            name="subscriber_id"
            render={({ field }) => (
              <Input
                {...field}
                label="Subscriber ID"
                autoComplete="off"
                error={form.formState.errors.subscriber_id?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="unique_key_id"
            render={({ field }) => (
              <Input
                {...field}
                label="Unique key ID"
                autoComplete="off"
                error={form.formState.errors.unique_key_id?.message}
              />
            )}
          />
          <Controller
            control={form.control}
            name="city_code"
            render={({ field }) => (
              <Input
                {...field}
                label="City (STD code)"
                placeholder="std:080"
                description="The city NHA registered the hospital in, e.g. std:080 for Bengaluru."
              />
            )}
          />
          {canSeeCampuses && (
            <Controller
              control={form.control}
              name="facility_id"
              render={({ field }) => (
                <Select
                  label="Campus"
                  description="Its HFR facility ID names the hospital to patient apps."
                  placeholder="Choose the campus"
                  data={campusOptions}
                  value={field.value}
                  onChange={field.onChange}
                  clearable
                />
              )}
            />
          )}
          <Controller
            control={form.control}
            name="services"
            render={({ field }) => (
              <Stack gap="xs" role="group" aria-label="Services offered">
                <Text size="sm" fw={500}>
                  Services offered
                </Text>
                {SERVICES.map((s) => (
                  <Checkbox
                    key={s.value}
                    label={s.label}
                    description={s.hint}
                    checked={field.value.includes(s.value)}
                    onChange={(e) =>
                      field.onChange(
                        e.currentTarget.checked
                          ? [...field.value, s.value]
                          : field.value.filter((v) => v !== s.value),
                      )
                    }
                  />
                ))}
              </Stack>
            )}
          />
          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <Switch
                label="Accept calls from patient apps"
                description={hasKey ? undefined : "Generate the signing key first."}
                disabled={!hasKey}
                checked={field.value}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
              />
            )}
          />
          <Group>
            <Button type="submit" tone="primary" loading={save.isPending}>
              Save
            </Button>
          </Group>
        </Stack>
      </Card>
      {data && <UhiFeesCard fees={data.fees} onlinePayment={data.online_payment} />}
      <Card>
        <Stack gap="xs">
          <Text fw={600}>Register with NHA</Text>
          {!data?.subscriber_url && (
            <Alert tone="warning" title="The public address is not set">
              MEDBRAINS_PUBLIC_BASE_URL must be set on the server before patient apps can reach this
              hospital.
            </Alert>
          )}
          <Text size="sm">Subscriber URL</Text>
          <Text size="sm" ff="monospace">
            {data?.subscriber_url ?? "—"}
          </Text>
          <Text size="sm">Signing public key</Text>
          <Text size="sm" ff="monospace" style={{ wordBreak: "break-all" }}>
            {data?.signing_public_key ?? "Not generated yet"}
          </Text>
          <Group>
            <Button
              tone="secondary"
              disabled={!data?.configured}
              loading={keys.isPending && !confirmRotate}
              onClick={() => (hasKey ? setConfirmRotate(true) : keys.mutate())}
            >
              {hasKey ? "Generate a new key" : "Generate the signing key"}
            </Button>
          </Group>
          {!data?.configured && (
            <Text size="xs" c="dimmed">
              Save the subscriber ID first.
            </Text>
          )}
        </Stack>
      </Card>
      <Modal
        opened={confirmRotate}
        onClose={() => setConfirmRotate(false)}
        title="Replace the signing key?"
        danger
        primaryAction={{
          label: "Replace the key",
          onClick: () => keys.mutate(),
          loading: keys.isPending,
        }}
        secondaryAction={{ label: "Cancel", onClick: () => setConfirmRotate(false) }}
      >
        <Text size="sm">
          Patient apps will refuse this hospital's answers until NHA has the new public key. Do this
          only when NHA is ready to register it.
        </Text>
      </Modal>
    </Stack>
  );
}
