/**
 * `/trial` — a hospital starts its own 30-day MedBrains trial, no card asked:
 * what the facility is and where it will run (with what that takes), then
 * its name, code and administrator. Only the trial server takes sign-ups.
 */
import { Container, Loader, Stack, Stepper, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert } from "@/components/ui";
import { onboardingService } from "@/services/onboarding.service";
import { AccountStep } from "./account-step";
import { type FacilityChoice, FacilityStep } from "./facility-step";

const START: FacilityChoice = {
  hospitalType: "multi_specialty",
  plan: { beds: 50, staff_users: 60, imaging: false, placement: "shared_cloud" },
};

export function TrialPage() {
  const [step, setStep] = useState(0);
  const [facility, setFacility] = useState<FacilityChoice>(START);
  const status = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: () => onboardingService.onboardingStatus(),
  });

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={1}>Try MedBrains free for {status.data?.trial_days ?? 30} days</Title>
          <Text c="dimmed">
            No card needed. Your own hospital, your own code, every module your facility uses.
          </Text>
        </Stack>
        {status.isPending ? (
          <Loader size="sm" />
        ) : status.isError ? (
          <Alert tone="danger" role="alert">
            Could not reach MedBrains: {status.error.message}
          </Alert>
        ) : !status.data.trial_open && !status.data.needs_setup ? (
          <Alert tone="info" title="Trials start on app.medbrains.in" data-testid="trial-closed">
            This server belongs to a hospital and does not take sign-ups. Start a trial at
            app.medbrains.in, or write to hello@medbrains.in.
          </Alert>
        ) : (
          <Stepper active={step} onStepClick={(i) => i < step && setStep(i)}>
            <Stepper.Step label="Your facility" description="What it is and where it runs">
              <FacilityStep value={facility} onChange={setFacility} onNext={() => setStep(1)} />
            </Stepper.Step>
            <Stepper.Step label="Your hospital" description="Name, code and administrator">
              <AccountStep facility={facility} onBack={() => setStep(0)} />
            </Stepper.Step>
          </Stepper>
        )}
      </Stack>
    </Container>
  );
}
