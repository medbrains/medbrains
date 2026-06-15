import { Alert, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconBuildingHospital, IconDatabase, IconLock, IconServer } from "@tabler/icons-react";
import { Button } from "@/components/ui";
import classes from "./onboarding.module.scss";

interface Props {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: Props) {
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
          This wizard will guide you through the initial setup of your Hospital Management System.
          It takes about 10 minutes to complete.
        </Text>
      </div>

      <Alert variant="light" color="primary" title="Before you begin">
        Make sure you have the following information ready:
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
        <Button tone="primary" onClick={onNext}>
          Begin Setup
        </Button>
      </div>
    </Stack>
  );
}
