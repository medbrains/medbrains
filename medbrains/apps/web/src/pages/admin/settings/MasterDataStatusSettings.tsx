import { Badge, Card, Grid, Group, Loader, Stack, Text, ThemeIcon } from "@mantine/core";
import {
  IconAlertCircle,
  IconCheck,
  IconFlask,
  IconMapPin,
  IconMedicalCross,
  IconPill,
  IconSitemap,
  IconUsers,
} from "@tabler/icons-react";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { adminAccessService } from "../../../services/adminAccess.service";
import { labCatalogService } from "../../../services/labCatalog.service";
import { pharmacyCatalogService } from "../../../services/pharmacyCatalog.service";
import { settingsSetupService } from "../../../services/settingsSetup.service";

interface MasterDataItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  count: number;
  needsSetup: boolean;
}

export function MasterDataStatusSettings() {
  const queries = useQueries({
    queries: [
      {
        queryKey: ["pharmacy-catalog"],
        queryFn: () => pharmacyCatalogService.listPharmacyCatalog(),
      },
      {
        queryKey: ["lab-catalog"],
        queryFn: () => labCatalogService.listLabCatalog(),
      },
      {
        queryKey: ["procedure-catalog"],
        queryFn: () => settingsSetupService.listProcedureCatalog(),
      },
      {
        queryKey: ["setup-departments"],
        queryFn: () => settingsSetupService.listDepartments(),
      },
      {
        queryKey: ["setup-users"],
        queryFn: () => adminAccessService.listUsers(),
      },
      {
        queryKey: ["setup-locations"],
        queryFn: () => settingsSetupService.listLocations(),
      },
    ],
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const firstError = queries.find((q) => q.isError)?.error;

  const masterItems: MasterDataItem[] = useMemo(() => {
    const [pharmacyQuery, labQuery, procedureQuery, deptQuery, userQuery, locationQuery] = queries;

    const drugCount = pharmacyQuery.data?.length || 0;
    const testCount = labQuery.data?.length || 0;
    const procedureCount = procedureQuery.data?.length || 0;
    const deptCount = deptQuery.data?.length || 0;
    const userCount = userQuery.data?.length || 0;
    const locationCount = locationQuery.data?.length || 0;

    return [
      {
        key: "drugs",
        label: "Drugs",
        icon: <IconPill size={24} />,
        count: drugCount,
        needsSetup: drugCount === 0,
      },
      {
        key: "tests",
        label: "Lab Tests",
        icon: <IconFlask size={24} />,
        count: testCount,
        needsSetup: testCount === 0,
      },
      {
        key: "procedures",
        label: "Procedures",
        icon: <IconMedicalCross size={24} />,
        count: procedureCount,
        needsSetup: procedureCount === 0,
      },
      {
        key: "departments",
        label: "Departments",
        icon: <IconSitemap size={24} />,
        count: deptCount,
        needsSetup: deptCount === 0,
      },
      {
        key: "users",
        label: "Users",
        icon: <IconUsers size={24} />,
        count: userCount,
        needsSetup: userCount === 0,
      },
      {
        key: "locations",
        label: "Locations",
        icon: <IconMapPin size={24} />,
        count: locationCount,
        needsSetup: locationCount === 0,
      },
    ];
  }, [queries]);

  const needsSetupCount = useMemo(
    () => masterItems.filter((item) => item.needsSetup).length,
    [masterItems],
  );

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading master data status...</Text>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Stack align="center" py="xl">
        <Text c="danger">
          Failed to load master data status:{" "}
          {firstError instanceof Error ? firstError.message : "Unknown error"}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Text fw={600} size="lg">
          Master Data Configuration
        </Text>
        {needsSetupCount > 0 && (
          <Badge color="orange" variant="light" size="lg">
            {needsSetupCount} items need setup
          </Badge>
        )}
      </Group>

      <Grid gap="md">
        {masterItems.map((item) => (
          <Grid.Col key={item.key} span={{ base: 12, sm: 6, md: 4 }}>
            <Card
              shadow="sm"
              padding="lg"
              radius="md"
              withBorder
              style={{
                borderColor: item.needsSetup
                  ? "var(--mb-danger-accent)"
                  : "var(--mb-border-subtle)",
              }}
            >
              <Stack gap="md">
                <Group justify="space-between">
                  <ThemeIcon
                    size="xl"
                    radius="xl"
                    variant="light"
                    color={item.needsSetup ? "danger" : "primary"}
                  >
                    {item.icon}
                  </ThemeIcon>
                  {item.needsSetup ? (
                    <Badge color="danger" variant="light" size="sm">
                      Needs setup
                    </Badge>
                  ) : (
                    <ThemeIcon size="sm" radius="xl" color="success" variant="light">
                      <IconCheck size={14} />
                    </ThemeIcon>
                  )}
                </Group>

                <div>
                  <Text size="lg" fw={700}>
                    {item.count}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {item.label}
                  </Text>
                </div>

                {item.needsSetup && (
                  <Group gap="xs">
                    <IconAlertCircle size={14} color="var(--mantine-color-red-6)" />
                    <Text size="xs" c="danger">
                      No items configured
                    </Text>
                  </Group>
                )}
              </Stack>
            </Card>
          </Grid.Col>
        ))}
      </Grid>

      {needsSetupCount === 0 && (
        <Card
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          style={{ background: "var(--mb-accent-gradient-soft)" }}
        >
          <Group gap="md">
            <ThemeIcon size="xl" radius="xl" color="success" variant="light">
              <IconCheck size={28} />
            </ThemeIcon>
            <div style={{ flex: 1 }}>
              <Text fw={600} size="md">
                All master data configured
              </Text>
              <Text size="sm" c="dimmed">
                Your system has all essential master data set up and ready to use.
              </Text>
            </div>
          </Group>
        </Card>
      )}
    </Stack>
  );
}
