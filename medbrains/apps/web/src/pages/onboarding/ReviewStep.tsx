import {
  Alert,
  Button,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { api } from "@medbrains/api";
import { useOnboardingStore } from "@medbrains/stores";
import type {
  OnboardingBedType,
  OnboardingDepartment,
  OnboardingFacility,
  OnboardingPaymentMethod,
  OnboardingService,
  OnboardingSetupRequest,
  OnboardingTaxCategory,
  OnboardingUser,
} from "@medbrains/types";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { IconAlertTriangle, IconCheck, IconRocket } from "@tabler/icons-react";
import classes from "./onboarding.module.scss";

interface Props {
  onBack: () => void;
}

export function ReviewStep({ onBack }: Props) {
  const navigate = useNavigate();

  const hospitalDetails = useOnboardingStore((s) => s.hospitalDetails);
  const geo = useOnboardingStore((s) => s.geo);
  const regulatorIds = useOnboardingStore((s) => s.regulatorIds);
  const facilities = useOnboardingStore((s) => s.facilities);
  const locations = useOnboardingStore((s) => s.locations);
  const departments = useOnboardingStore((s) => s.departments);
  const users = useOnboardingStore((s) => s.users);
  const roles = useOnboardingStore((s) => s.roles);
  const moduleStatuses = useOnboardingStore((s) => s.moduleStatuses);
  const sequences = useOnboardingStore((s) => s.sequences);
  const additionalSequences = useOnboardingStore((s) => s.additionalSequences);
  const services = useOnboardingStore((s) => s.services);
  const bedTypes = useOnboardingStore((s) => s.bedTypes);
  const taxCategories = useOnboardingStore((s) => s.taxCategories);
  const paymentMethods = useOnboardingStore((s) => s.paymentMethods);
  const branding = useOnboardingStore((s) => s.branding);
  const reset = useOnboardingStore((s) => s.reset);

  const setupMutation = useMutation({
    mutationFn: () => {
      const request: OnboardingSetupRequest = {
        hospital_details: hospitalDetails ?? undefined,
        geo: geo ?? undefined,
        regulator_ids: regulatorIds.length > 0 ? regulatorIds : undefined,
        facilities,
        locations,
        departments,
        users,
        roles,
        module_statuses: moduleStatuses,
        sequences: sequences ?? undefined,
        additional_sequences: additionalSequences.length > 0 ? additionalSequences : undefined,
        services: services.length > 0 ? services : undefined,
        bed_types: bedTypes.length > 0 ? bedTypes : undefined,
        tax_categories: taxCategories.length > 0 ? taxCategories : undefined,
        payment_methods: paymentMethods.length > 0 ? paymentMethods : undefined,
        branding: branding ?? undefined,
      };
      return api.onboardingSetup(request);
    },
    onSuccess: () => {
      reset();
      navigate("/dashboard");
    },
  });

  const enabledModules = Object.entries(moduleStatuses).filter(
    ([, status]) => status === "enabled",
  );

  // Completeness warnings
  const warnings: string[] = [];
  if (facilities.length === 0) {
    warnings.push("No additional facilities — only the main hospital will exist.");
  }
  if (departments.length === 0) {
    warnings.push("No departments have been added. You can add them later from settings.");
  }
  if (users.length === 0) {
    warnings.push("Only the super admin exists — consider adding staff accounts.");
  }
  if (enabledModules.length === 0) {
    warnings.push("No modules have been enabled. You can enable them later from settings.");
  }
  if (bedTypes.length === 0) {
    warnings.push("No bed types configured — IPD billing will need bed rates added later.");
  }
  if (taxCategories.length === 0) {
    warnings.push("No tax categories — billing will default to no tax until configured.");
  }

  return (
    <Stack gap="lg">
      <div style={{ textAlign: "center" }}>
        <ThemeIcon
          variant="light"
          size={64}
          radius="xl"
          color="teal"
        >
          <IconRocket size={32} />
        </ThemeIcon>
        <Title order={3} mt="md">
          Review & Launch
        </Title>
        <Text c="dimmed" mt="sm">
          Review your configuration before going live. Everything will be
          created in a single transaction.
        </Text>
      </div>

      {warnings.length > 0 && (
        <Alert
          variant="light"
          color="warning"
          title="Setup Recommendations"
          icon={<IconAlertTriangle size={20} />}
        >
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {warnings.map((w) => (
              <li key={w}>
                <Text size="sm">{w}</Text>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {hospitalDetails && (
        <div className={classes.reviewSection}>
          <div className={classes.reviewLabel}>Hospital Details</div>
          <div className={classes.reviewValue}>
            {hospitalDetails.city ?? "—"}
            {hospitalDetails.pincode ? `, ${hospitalDetails.pincode}` : ""}
          </div>
          <Text size="sm" c="dimmed">
            {hospitalDetails.timezone} &middot; {hospitalDetails.currency}
          </Text>
        </div>
      )}

      <div className={classes.reviewSection}>
        <div className={classes.reviewLabel}>
          Facilities ({facilities.length + 1})
        </div>
        <Text size="sm">Main Hospital (auto-created)</Text>
        {facilities.map((f: OnboardingFacility) => (
          <Text key={f.local_id} size="sm">
            {f.name} ({f.facility_type.replace(/_/g, " ")})
          </Text>
        ))}
      </div>

      <div className={classes.reviewSection}>
        <div className={classes.reviewLabel}>
          Locations ({locations.length})
        </div>
        {locations.length === 0 && (
          <Text size="sm" c="dimmed">None configured</Text>
        )}
        {locations.slice(0, 8).map((l) => (
          <Text key={l.local_id} size="sm">
            {l.name} ({l.level})
          </Text>
        ))}
        {locations.length > 8 && (
          <Text size="sm" c="dimmed">
            +{locations.length - 8} more
          </Text>
        )}
      </div>

      <div className={classes.reviewSection}>
        <div className={classes.reviewLabel}>
          Departments ({departments.length})
        </div>
        {departments.slice(0, 8).map((d: OnboardingDepartment) => (
          <Text key={d.local_id} size="sm">
            {d.name}
            {d.working_hours && Object.keys(d.working_hours).length > 0 && " (hours set)"}
          </Text>
        ))}
        {departments.length > 8 && (
          <Text size="sm" c="dimmed">
            +{departments.length - 8} more
          </Text>
        )}
        {departments.length === 0 && (
          <Text size="sm" c="dimmed">None configured</Text>
        )}
      </div>

      <div className={classes.reviewSection}>
        <div className={classes.reviewLabel}>
          Users ({users.length + 1})
        </div>
        <Text size="sm">Super Admin (created in step 1)</Text>
        {users.map((u: OnboardingUser) => (
          <Text key={u.local_id} size="sm">
            {u.full_name} — {u.role.replace(/_/g, " ")}
            {u.specialization && ` (${u.specialization})`}
          </Text>
        ))}
      </div>

      <div className={classes.reviewSection}>
        <div className={classes.reviewLabel}>
          Enabled Modules ({enabledModules.length})
        </div>
        {enabledModules.map(([code]) => (
          <Text key={code} size="sm">
            {code}
          </Text>
        ))}
        {enabledModules.length === 0 && (
          <Text size="sm" c="dimmed">
            No modules enabled yet — you can enable them from settings later.
          </Text>
        )}
      </div>

      {sequences && (
        <div className={classes.reviewSection}>
          <div className={classes.reviewLabel}>Sequences</div>
          <Text size="sm">
            UHID: {sequences.uhid_prefix}{"0".repeat(Math.max(0, sequences.uhid_pad_width - 1))}1
          </Text>
          <Text size="sm">
            Invoice: {sequences.invoice_prefix}{"0".repeat(Math.max(0, sequences.invoice_pad_width - 1))}1
          </Text>
          {additionalSequences.length > 0 && (
            <Text size="sm" c="dimmed">
              +{additionalSequences.length} additional sequence types
            </Text>
          )}
        </div>
      )}

      {services.length > 0 && (
        <div className={classes.reviewSection}>
          <div className={classes.reviewLabel}>
            Services ({services.length})
          </div>
          {services.map((s: OnboardingService) => (
            <Text key={s.local_id} size="sm">
              {s.name} ({s.service_type})
            </Text>
          ))}
        </div>
      )}

      {bedTypes.length > 0 && (
        <div className={classes.reviewSection}>
          <div className={classes.reviewLabel}>
            Bed Types ({bedTypes.length})
          </div>
          {bedTypes.map((b: OnboardingBedType) => (
            <Text key={b.local_id} size="sm">
              {b.name} — ₹{b.daily_rate}/day
            </Text>
          ))}
        </div>
      )}

      {taxCategories.length > 0 && (
        <div className={classes.reviewSection}>
          <div className={classes.reviewLabel}>
            Tax Categories ({taxCategories.length})
          </div>
          {taxCategories.map((t: OnboardingTaxCategory) => (
            <Text key={t.local_id} size="sm">
              {t.name} — {t.rate_percent}% ({t.applicability.replace(/_/g, " ")})
            </Text>
          ))}
        </div>
      )}

      {paymentMethods.length > 0 && (
        <div className={classes.reviewSection}>
          <div className={classes.reviewLabel}>
            Payment Methods ({paymentMethods.length})
          </div>
          {paymentMethods.map((p: OnboardingPaymentMethod) => (
            <Text key={p.local_id} size="sm">
              {p.name}
              {p.is_default && " (default)"}
            </Text>
          ))}
        </div>
      )}

      {setupMutation.isError && (
        <Alert color="danger" variant="light">
          {setupMutation.error.message}
        </Alert>
      )}

      <div className={classes.navButtons}>
        <Button variant="default" onClick={onBack}>
          Back
        </Button>
        <Button
          color="teal"
          leftSection={<IconCheck size={16} />}
          onClick={() => setupMutation.mutate()}
          loading={setupMutation.isPending}
        >
          Complete Setup & Launch
        </Button>
      </div>
    </Stack>
  );
}
