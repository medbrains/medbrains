import { Group, Loader, Progress, Stack, Text, ThemeIcon } from "@mantine/core";
import { api } from "@medbrains/api";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

interface SetupStep {
  key: string;
  label: string;
  description: string;
  isComplete: boolean;
}

export function SetupWizardSettings() {
  const queries = useQueries({
    queries: [
      {
        queryKey: ["setup-departments"],
        queryFn: () => api.listDepartments(),
      },
      {
        queryKey: ["setup-users"],
        queryFn: () => api.listSetupUsers(),
      },
      {
        queryKey: ["setup-roles"],
        queryFn: () => api.listRoles(),
      },
      {
        queryKey: ["setup-services"],
        queryFn: () => api.listServices(),
      },
      {
        queryKey: ["setup-locations"],
        queryFn: () => api.listLocations(),
      },
    ],
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const firstError = queries.find((q) => q.isError)?.error;

  const steps: SetupStep[] = useMemo(() => {
    const [deptQuery, userQuery, roleQuery, serviceQuery, locationQuery] = queries;

    return [
      {
        key: "departments",
        label: "Departments",
        description: "Configure hospital departments and their hierarchy",
        isComplete: (deptQuery.data?.length || 0) > 0,
      },
      {
        key: "users",
        label: "Users",
        description: "Create user accounts for staff and administrators",
        isComplete: (userQuery.data?.length || 0) > 1,
      },
      {
        key: "roles",
        label: "Roles",
        description: "Define roles and permissions for system access",
        isComplete: (roleQuery.data?.length || 0) > 0,
      },
      {
        key: "services",
        label: "Services",
        description: "Set up medical services and procedures",
        isComplete: (serviceQuery.data?.length || 0) > 0,
      },
      {
        key: "locations",
        label: "Locations",
        description: "Define physical locations (campus, buildings, floors)",
        isComplete: (locationQuery.data?.length || 0) > 0,
      },
    ];
  }, [queries]);

  const completedCount = useMemo(() => steps.filter((s) => s.isComplete).length, [steps]);

  const progressPercent = (completedCount / steps.length) * 100;

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading setup status...</Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="danger">
          Failed to load setup status:{" "}
          {firstError instanceof Error ? firstError.message : "Unknown error"}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Text fw={600} size="lg">
          System Configuration Status
        </Text>
        <Text size="sm" c="dimmed">
          {completedCount} of {steps.length} steps complete
        </Text>
      </Group>

      <Stack gap="md">
        <Progress
          value={progressPercent}
          size="lg"
          color={progressPercent === 100 ? "success" : "primary"}
          animated={progressPercent < 100}
        />
        <Text size="sm" c="dimmed" ta="center">
          {progressPercent === 100
            ? "Setup complete! Your system is ready to use."
            : "Complete the remaining steps to finish setting up your system."}
        </Text>
      </Stack>

      <Stack gap="md" mt="md">
        {steps.map((step) => (
          <Group
            key={step.key}
            gap="md"
            p="md"
            style={{
              border: "1px solid #e9ecef",
              borderRadius: "8px",
              backgroundColor: step.isComplete ? "#f8f9fa" : "white",
            }}
          >
            <ThemeIcon
              size="lg"
              radius="xl"
              color={step.isComplete ? "success" : "danger"}
              variant="light"
            >
              {step.isComplete ? <IconCheck size={20} /> : <IconX size={20} />}
            </ThemeIcon>
            <div style={{ flex: 1 }}>
              <Text size="sm" fw={500}>
                {step.label}
              </Text>
              <Text size="xs" c="dimmed">
                {step.description}
              </Text>
            </div>
            <Text size="xs" fw={500} c={step.isComplete ? "success" : "danger"}>
              {step.isComplete ? "Complete" : "Incomplete"}
            </Text>
          </Group>
        ))}
      </Stack>
    </Stack>
  );
}
