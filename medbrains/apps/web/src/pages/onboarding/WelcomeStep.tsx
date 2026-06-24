import { Card, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { useOnboardingStore } from "@medbrains/stores";
import { IconBuildingHospital, IconDatabase, IconLock, IconServer } from "@tabler/icons-react";
import { Alert, Badge, Button, toast } from "@/components/ui";
import { FOUNDATION_OPTIONS, type FoundationOption } from "./foundation";
import classes from "./onboarding.module.scss";

interface Props {
  onNext: () => void;
}

function localId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
}

export function WelcomeStep({ onNext }: Props) {
  const setDepartments = useOnboardingStore((s) => s.setDepartments);
  const setServices = useOnboardingStore((s) => s.setServices);
  const setSequences = useOnboardingStore((s) => s.setSequences);

  const applyFoundation = (option: FoundationOption) => {
    setDepartments(option.departments.map((d) => ({ local_id: localId(), ...d })));
    setServices(option.services.map((s) => ({ local_id: localId(), ...s })));
    setSequences(option.sequences);
    toast.success(`${option.label} foundation applied`, {
      title: "Quick start",
    });
    onNext();
  };

  return (
    <Stack gap="md">
      <div className={classes.welcomeHero}>
        <ThemeIcon
          variant="filled"
          size={64}
          radius="xl"
          color="primary"
          className={classes.welcomeIcon}
        >
          <IconBuildingHospital size={32} />
        </ThemeIcon>
        <Title order={2}>Welcome to MedBrains</Title>
        <Text c="dimmed" mt="sm" maw={500} mx="auto">
          Start from a Foundation template to pre-fill the essentials and go live in minutes — or
          set everything up step by step. You can change anything later.
        </Text>
      </div>

      <Stack gap={4}>
        <Text fw={600}>Quick start with a Foundation template</Text>
        <Text size="sm" c="dimmed">
          Pre-fills departments, services and numbering for your hospital type. Tweak before you
          launch.
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {FOUNDATION_OPTIONS.map((option) => (
          <Card key={option.id} withBorder padding="md">
            <Stack gap="xs" h="100%" justify="space-between">
              <Stack gap={6}>
                <Title order={5}>{option.label}</Title>
                <Text size="sm" c="dimmed">
                  {option.description}
                </Text>
                <Badge tone="neutral" size="xs">
                  {option.departments.length} departments · {option.services.length} services
                </Badge>
              </Stack>
              <Button tone="primary" size="xs" fullWidth onClick={() => applyFoundation(option)}>
                Use {option.label}
              </Button>
            </Stack>
          </Card>
        ))}
      </SimpleGrid>

      <Alert tone="info" title="Prefer to start from scratch?">
        Set everything up step by step instead. Have your hospital classification, super-admin
        credentials, contact/registration details and department list ready.
      </Alert>

      <ul className={classes.checklist}>
        <li className={classes.checkItem}>
          <IconBuildingHospital size={20} color="var(--mantine-color-primary-5)" />
          Hospital name, code, and classification
        </li>
        <li className={classes.checkItem}>
          <IconLock size={20} color="var(--mantine-color-primary-5)" />
          Super admin credentials (username, email, password)
        </li>
        <li className={classes.checkItem}>
          <IconServer size={20} color="var(--mantine-color-primary-5)" />
          Address, contact details, and registration number
        </li>
        <li className={classes.checkItem}>
          <IconDatabase size={20} color="var(--mantine-color-primary-5)" />
          Department list and staff roles to configure
        </li>
      </ul>

      <div className={classes.navButtons}>
        <div />
        <Button tone="secondary" onClick={onNext}>
          Start from scratch
        </Button>
      </div>
    </Stack>
  );
}
