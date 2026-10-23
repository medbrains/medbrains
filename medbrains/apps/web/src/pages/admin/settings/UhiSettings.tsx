import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P, type UhiService } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  SegmentedControl,
  Select,
  Switch,
  toast,
} from "@/components/ui";
import { uhiService } from "@/services/uhi.service";
import { UhiFeesCard } from "./UhiFeesCard";
import { UhiKeyCard } from "./UhiKeyCard";

const KEY = ["uhi", "settings"] as const;

const SERVICES: { value: UhiService; label: string; hint: string }[] = [
  {
    value: "physical_consultation",
    label: "Consultation at the hospital",
    hint: "Doctors with an HPR ID and a weekly schedule, booked as an OPD visit; paid at the desk.",
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
  {
    value: "teleconsultation",
    label: "Teleconsultation (preview)",
    hint: "Not a UHI provider service yet; online payment comes with it.",
  },
  {
    value: "lab_tests",
    label: "Lab tests (preview)",
    hint: "Not a UHI provider service yet; the lab accepts each request.",
  },
];

const SUBSCRIBER = /^[A-Za-z0-9._-]{3,128}$/;

const schema = z
  .object({
    environment: z.enum(["sandbox", "production"]),
    gateway_spec: z.enum(["v2_0_2", "s2"]),
    subscriber_id: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || SUBSCRIBER.test(v),
        "3–128 letters, digits, dots, dashes or underscores",
      ),
    unique_key_id: z.string().trim(),
    city_code: z.string().trim(),
    facility_id: z.string().nullable(),
    services: z.array(
      z.enum(["teleconsultation", "physical_consultation", "lab_tests", "blood_bank", "ambulance"]),
    ),
    is_active: z.boolean(),
  })
  .refine((v) => (v.subscriber_id === "") === (v.unique_key_id === ""), {
    path: ["unique_key_id"],
    message: "NHA issues the subscriber ID and the key ID together — enter both",
  });
type FormValues = z.infer<typeof schema>;

/**
 * Settings → UHI, in NHA's onboarding order: 1 choose the services, 2 make
 * the signing key, 3 submit the callback URL and public key to NHA, 4 enter
 * the subscriber ID and key ID NHA issues, 5 pass the sandbox tests and
 * switch on. The callback URL is known from step 1; it never contains the
 * subscriber ID.
 */
export function UhiSettings() {
  const queryClient = useQueryClient();
  const canSeeCampuses = useHasPermission(P.ABDM.HFR.VIEW);
  const { data, isLoading, isError } = useQuery({ queryKey: KEY, queryFn: uhiService.getSettings });
  const campuses = useQuery({
    queryKey: ["abdm", "hfr", "facilities"],
    queryFn: uhiService.listCampuses,
    enabled: canSeeCampuses,
  });
  const available = data?.available_services ?? [];
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      environment: data?.environment ?? "sandbox",
      gateway_spec: data?.gateway_spec ?? "v2_0_2",
      subscriber_id: data?.subscriber_id ?? "",
      unique_key_id: data?.unique_key_id ?? "",
      city_code: data?.city_code ?? "",
      facility_id: data?.facility_id ?? null,
      services: (data?.services ?? []).filter((s) => available.includes(s)),
      is_active: data?.is_active ?? false,
    },
  });
  const save = useMutation({
    mutationFn: (v: FormValues) =>
      uhiService.saveSettings({
        ...v,
        city_code: v.city_code || null,
        subscriber_id: v.subscriber_id || null,
        unique_key_id: v.unique_key_id || null,
      }),
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

  const facilityId = form.watch("facility_id");
  const subscriberId = form.watch("subscriber_id");
  const blockers = useMemo(() => {
    const hfr = canSeeCampuses
      ? campuses.data?.facilities.find((f) => f.id === facilityId)?.hfr_facility_id
      : data?.hfr_facility_id;
    return [
      !data?.signing_public_key && "Make the signing key (step 2).",
      subscriberId.trim() === "" && "Enter the subscriber ID and key ID NHA issued (step 4).",
      !hfr &&
        "Choose a campus with an HFR facility ID — NHA admits only HFR-registered facilities.",
    ].filter((b): b is string => Boolean(b));
  }, [canSeeCampuses, campuses.data, facilityId, subscriberId, data]);

  if (isError) {
    return (
      <Alert tone="danger" title="Could not load the UHI settings">
        This does not mean UHI is off — the settings failed to load.
      </Alert>
    );
  }
  const campusOptions = (campuses.data?.facilities ?? []).map((f) => ({
    value: f.id,
    label: f.hfr_facility_id ? `${f.name} · HFR ${f.hfr_facility_id}` : `${f.name} · no HFR ID`,
  }));
  const dropped = (data?.services ?? []).filter((s) => !available.includes(s));

  return (
    <Stack component="form" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
      <Card>
        <Stack>
          <Stack gap={4}>
            <Text fw={600}>1 · Choose the services</Text>
            <Text size="sm" c="dimmed">
              This hospital joins UHI as a provider (HSPA). Patient apps reach it through NHA's
              gateway; every call is signed both ways.
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
            name="services"
            render={({ field }) => (
              <Stack gap="xs" role="group" aria-label="Services offered">
                <Text size="sm" fw={500}>
                  Services offered
                </Text>
                {SERVICES.filter((s) => available.includes(s.value)).map((s) => (
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
          {dropped.length > 0 && (
            <Alert tone="info" title="Some services are no longer offered">
              Teleconsultation, online payment and lab tests are not UHI provider services yet, so
              patient apps are not answered for them. Saving removes them.
            </Alert>
          )}
          {canSeeCampuses && (
            <Controller
              control={form.control}
              name="facility_id"
              render={({ field }) => (
                <Select
                  label="Campus"
                  description="Required: its HFR facility ID names the hospital to patient apps."
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
            name="city_code"
            render={({ field }) => (
              <Input
                {...field}
                label="City (STD code)"
                placeholder="std:080"
                description="The city NHA registers the hospital in, e.g. std:080 for Bengaluru."
              />
            )}
          />
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
            name="gateway_spec"
            render={({ field }) => (
              <Stack gap={4}>
                <Text size="sm" fw={500}>
                  Gateway contract
                </Text>
                <SegmentedControl
                  aria-label="UHI gateway contract"
                  value={field.value}
                  onChange={field.onChange}
                  data={[
                    { value: "v2_0_2", label: "Gateway spec v2.0.2 (Sep 2026)" },
                    { value: "s2", label: "NHA-ABDM/UHI (earlier)" },
                  ]}
                />
                <Text size="xs" c="dimmed">
                  Which gateway paths and headers this environment uses. v2.0.2 is the current spec
                  on the ABDM developer portal; choose the earlier one only if NHA asks.
                </Text>
              </Stack>
            )}
          />
          <Group>
            <Button type="submit" tone="secondary" loading={save.isPending}>
              Save
            </Button>
          </Group>
        </Stack>
      </Card>
      {data && <UhiFeesCard fees={data.fees} onlinePayment={data.online_payment} />}
      <UhiKeyCard data={data} queryKey={KEY} />
      <Card>
        <Stack>
          <Text fw={600}>4 · Enter what NHA issued</Text>
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
                label="Key ID (pub_key_id)"
                autoComplete="off"
                error={form.formState.errors.unique_key_id?.message}
              />
            )}
          />
          <Text fw={600}>5 · Test in the sandbox, then switch on</Text>
          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <Switch
                label="Accept calls from patient apps"
                description={blockers.length > 0 ? blockers.join(" ") : undefined}
                disabled={blockers.length > 0 && !field.value}
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
    </Stack>
  );
}
