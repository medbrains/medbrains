import {
  Badge,
  Button,
  Container,
  Group,
  Loader,
  Stepper,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import type { OnboardingInitInput } from "@medbrains/schemas";
import { useAuthStore } from "@medbrains/stores";
import { IconArrowLeft, IconBuildingHospital } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { onboardingService } from "../../services/onboarding.service";

import { AdminStep } from "./AdminStep";
import { BedConfigStep } from "./BedConfigStep";
import { BillingTaxStep } from "./BillingTaxStep";
import { BrandingStep } from "./BrandingStep";
import { DepartmentsStep } from "./DepartmentsStep";
import { FacilitiesStep } from "./FacilitiesStep";
import { GeoRegulatoryStep } from "./GeoRegulatoryStep";
import { HospitalStep } from "./HospitalStep";
import { LocationsStep } from "./LocationsStep";
import { ModulesStep } from "./ModulesStep";
import classes from "./onboarding.module.scss";
import { ReviewStep } from "./ReviewStep";
import { SequencesStep } from "./SequencesStep";
import { ServicesStep } from "./ServicesStep";
import { UsersStep } from "./UsersStep";
import { WelcomeStep } from "./WelcomeStep";

const steps = [
  { label: "Welcome", description: "Prerequisites" },
  { label: "Admin Setup", description: "Hospital & admin account" },
  { label: "Hospital Details", description: "Address & contact" },
  { label: "Geography", description: "Location & regulators" },
  { label: "Facilities", description: "Institutional hierarchy" },
  { label: "Locations", description: "Campus to bed tree" },
  { label: "Departments", description: "Departments & working hours" },
  { label: "Users & Roles", description: "Staff & doctor profiles" },
  { label: "Modules", description: "Enable/disable features" },
  { label: "Sequences", description: "UHID, invoice & more" },
  { label: "Services", description: "Service categories" },
  { label: "Bed Config", description: "Bed types & rates" },
  { label: "Billing & Tax", description: "Tax slabs & payment modes" },
  { label: "Branding", description: "Colors & logo" },
  { label: "Review", description: "Verify & launch" },
];

export function OnboardingPage() {
  const [active, setActive] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  // Persist AdminStep form values across step navigation
  const adminDraftRef = useRef<Partial<OnboardingInitInput>>({});

  const { isLoading: statusLoading } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => onboardingService.onboardingStatus(),
  });

  const goNext = useCallback(() => {
    setCompletedSteps((prev) => (prev.includes(active + 1) ? prev : [...prev, active + 1]));
    setActive((c) => Math.min(steps.length - 1, c + 1));
  }, [active]);

  const goBack = useCallback(() => {
    setActive((c) => Math.max(0, c - 1));
  }, []);

  const renderStep = () => {
    switch (active) {
      case 0:
        return <WelcomeStep onNext={goNext} />;
      case 1:
        return <AdminStep onNext={goNext} onBack={goBack} draftRef={adminDraftRef} />;
      case 2:
        return <HospitalStep onNext={goNext} onBack={goBack} />;
      case 3:
        return <GeoRegulatoryStep onNext={goNext} onBack={goBack} />;
      case 4:
        return <FacilitiesStep onNext={goNext} onBack={goBack} />;
      case 5:
        return <LocationsStep onNext={goNext} onBack={goBack} />;
      case 6:
        return <DepartmentsStep onNext={goNext} onBack={goBack} />;
      case 7:
        return <UsersStep onNext={goNext} onBack={goBack} />;
      case 8:
        return <ModulesStep onNext={goNext} onBack={goBack} />;
      case 9:
        return <SequencesStep onNext={goNext} onBack={goBack} />;
      case 10:
        return <ServicesStep onNext={goNext} onBack={goBack} />;
      case 11:
        return <BedConfigStep onNext={goNext} onBack={goBack} />;
      case 12:
        return <BillingTaxStep onNext={goNext} onBack={goBack} />;
      case 13:
        return <BrandingStep onNext={goNext} onBack={goBack} />;
      case 14:
        return <ReviewStep onBack={goBack} />;
      default:
        return null;
    }
  };

  if (statusLoading) {
    return (
      <div className={classes.wizardContainer}>
        <Container size="sm" py={120} ta="center">
          <Loader size="md" />
          <Text c="dimmed" mt="md">
            Checking system status...
          </Text>
        </Container>
      </div>
    );
  }

  return (
    <div className={classes.wizardContainer}>
      <div className={classes.header}>
        <Group gap="sm">
          <Button
            variant="subtle"
            size="xs"
            leftSection={<IconArrowLeft size={14} />}
            onClick={() => navigate("/")}
          >
            Back
          </Button>
          <ThemeIcon variant="filled" size={32} radius="sm" color="primary">
            <IconBuildingHospital size={18} />
          </ThemeIcon>
          <Title order={4}>MedBrains Setup</Title>
        </Group>
        <Group gap="sm">
          <Badge variant="light" size="lg">
            Step {active + 1} of {steps.length}
          </Badge>
          <Button variant="subtle" size="xs" onClick={() => navigate("/login")}>
            Already registered? Log in
          </Button>
        </Group>
      </div>

      <Container size="lg" py="xl">
        <Group align="flex-start" gap="xl" wrap="nowrap">
          <Stepper
            active={active}
            onStepClick={(step) => {
              // Allow going back or to completed steps
              if (step <= active || completedSteps.includes(step + 1)) {
                // Steps 2+ require authentication
                if (step >= 2 && !user) return;
                setActive(step);
              }
            }}
            orientation="vertical"
            size="sm"
            styles={{
              root: { minWidth: 220, flexShrink: 0 },
              stepLabel: { fontSize: 13 },
              stepDescription: { fontSize: 11 },
            }}
          >
            {steps.map((step) => (
              <Stepper.Step key={step.label} label={step.label} description={step.description} />
            ))}
          </Stepper>

          <div className={classes.stepContent} style={{ flex: 1 }}>
            <div className={classes.stepCard}>
              <Title order={4} className={classes.stepTitle}>
                {steps[active]?.label}
              </Title>
              <Text size="sm" c="dimmed" className={classes.stepDescription}>
                {steps[active]?.description}
              </Text>
              {renderStep()}
            </div>
          </div>
        </Group>
      </Container>
    </div>
  );
}
