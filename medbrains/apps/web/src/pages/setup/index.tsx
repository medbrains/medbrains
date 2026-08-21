import { Card, Group, RingProgress, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  type Icon,
  IconBuildingHospital,
  IconCheck,
  IconCircle,
  IconCpu,
  IconLockSquareRounded,
  IconReceipt,
  IconServerCog,
  IconStethoscope,
  IconUsers,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { PageHeader } from "@/components";
import { Badge, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";

/** A configuration item inside a segment. `signal` keys auto-detect completion. */
interface Item {
  label: string;
  to: string;
  essential?: boolean;
  signal?: "departments" | "services" | "sequences" | "sso";
  soon?: boolean;
}
interface Segment {
  id: string;
  title: string;
  owner: string;
  icon: Icon;
  description: string;
  items: Item[];
}

const SEGMENTS: Segment[] = [
  {
    id: "org",
    title: "Organization",
    owner: "Business",
    icon: IconBuildingHospital,
    description: "Hospital identity, branding, and regulatory profile.",
    items: [
      { label: "Hospital identity", to: "/admin/settings" },
      { label: "Branding", to: "/admin/settings" },
      { label: "Geography & regulatory", to: "/admin/settings" },
      { label: "Custom domain", to: "/admin/settings" },
      { label: "Domains & email (DNS, mail server)", to: "/setup/domains-email" },
    ],
  },
  {
    id: "people",
    title: "People & Access",
    owner: "Admin / IT",
    icon: IconUsers,
    description: "Users, roles, access groups, and single sign-on.",
    items: [
      { label: "Users & roles", to: "/admin/users" },
      { label: "Access groups", to: "/admin/groups" },
      { label: "Single sign-on (SSO)", to: "/admin/sso", signal: "sso" },
    ],
  },
  {
    id: "clinical",
    title: "Clinical Setup",
    owner: "Clinical lead",
    icon: IconStethoscope,
    description: "Departments, services, locations, and beds.",
    items: [
      { label: "Departments", to: "/admin/settings", essential: true, signal: "departments" },
      { label: "Services", to: "/admin/settings", essential: true, signal: "services" },
      { label: "Locations", to: "/admin/settings" },
      { label: "Bed configuration", to: "/admin/settings" },
      { label: "Sample / demo data", to: "/admin/simulator" },
    ],
  },
  {
    id: "business",
    title: "Business Setup",
    owner: "Business",
    icon: IconReceipt,
    description: "Numbering, billing, tariffs, and payments.",
    items: [
      {
        label: "Sequences (UHID, invoice)",
        to: "/admin/settings",
        essential: true,
        signal: "sequences",
      },
      { label: "Billing & tax", to: "/admin/settings" },
      { label: "Charge master / tariffs", to: "/admin/settings" },
      { label: "Payment methods", to: "/admin/settings" },
    ],
  },
  {
    id: "deployment",
    title: "Deployment & Cost",
    owner: "Admin / IT",
    icon: IconCpu,
    description: "Recommended deployment + infra cost; enabled modules.",
    items: [
      { label: "Deployment & cost estimate", to: "/setup/deployment" },
      { label: "Modules", to: "/admin/settings" },
    ],
  },
  {
    id: "infra",
    title: "Infrastructure & Security",
    owner: "IT only",
    icon: IconServerCog,
    description: "Secrets backend, AI provider, and integration keys.",
    items: [
      { label: "Secrets backend (KMS / Vault)", to: "/setup/infrastructure" },
      { label: "AI provider & keys", to: "/setup/infrastructure" },
      { label: "Integrations", to: "/admin/integration-hub" },
    ],
  },
];

export function SetupCenterPage() {
  useRequirePermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const navigate = useNavigate();
  // The setup centre counts what is configured. `admin.settings.general.manage`
  // opens it; each master has its own code, and without them the counts came
  // back zero — which on a page whose whole job is "what still needs setting
  // up" reads as nothing configured rather than nothing visible.
  const canListDepartments = useHasPermission(P.ADMIN.SETTINGS.DEPARTMENTS.LIST);
  const canListServices = useHasPermission(P.ADMIN.SETTINGS.SERVICES.LIST);
  const canManageSequences = useHasPermission(P.ADMIN.SETTINGS.SEQUENCES.MANAGE);

  const { data: departments = [] } = useQuery({
    queryKey: ["setup", "departments"],
    queryFn: () => api.listDepartments(),
    enabled: canListDepartments,
  });
  const { data: services = [] } = useQuery({
    queryKey: ["setup", "services"],
    queryFn: () => api.listServices(),
    enabled: canListServices,
  });
  const { data: sequences = [] } = useQuery({
    queryKey: ["setup", "sequences"],
    queryFn: () => api.listSequences(),
    enabled: canManageSequences,
  });
  const { data: ssoProviders = [] } = useQuery({
    queryKey: ["sso-active-providers"],
    queryFn: () => api.listActiveSsoProviders(),
    retry: false,
  });

  const signalDone = useMemo(
    () => ({
      departments: departments.length > 0,
      services: services.length > 0,
      sequences: sequences.length > 0,
      sso: ssoProviders.length > 0,
    }),
    [departments, services, sequences, ssoProviders],
  );

  const essentials = SEGMENTS.flatMap((s) => s.items.filter((i) => i.essential));
  const essentialsDone = essentials.filter((i) => i.signal && signalDone[i.signal]).length;
  const pct = essentials.length ? Math.round((essentialsDone / essentials.length) * 100) : 0;

  const itemDone = (i: Item) => Boolean(i.signal && signalDone[i.signal]);

  return (
    <Stack>
      <PageHeader
        title="Setup Center"
        subtitle="Complete your hospital's setup — organised by who owns each part. Essentials first; the rest you can finish anytime."
      />

      <Card withBorder padding="lg">
        <Group>
          <RingProgress
            size={96}
            thickness={9}
            roundCaps
            sections={[{ value: pct, color: pct === 100 ? "teal" : "indigo" }]}
            label={
              <Text ta="center" fw={700} size="lg">
                {pct}%
              </Text>
            }
          />
          <Stack gap={2}>
            <Text fw={600}>Setup completeness</Text>
            <Text size="sm" c="dimmed">
              {essentialsDone} of {essentials.length} essentials configured.{" "}
              {pct === 100 ? "You're ready to go live." : "Finish the essentials to go live."}
            </Text>
          </Stack>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {SEGMENTS.map((seg) => (
          <Card key={seg.id} withBorder padding="md">
            <Group gap="xs" mb="xs">
              <ThemeIcon variant="light" color="indigo" size={32} radius="md">
                <seg.icon size={18} />
              </ThemeIcon>
              <Stack gap={0} style={{ flex: 1 }}>
                <Text fw={600}>{seg.title}</Text>
                <Text size="xs" c="dimmed">
                  {seg.description}
                </Text>
              </Stack>
              <Badge tone="neutral" size="sm">
                {seg.owner}
              </Badge>
            </Group>
            <Stack gap={4}>
              {seg.items.map((item) => (
                <Group key={item.label} justify="space-between" gap="xs">
                  <Group gap={6}>
                    <ThemeIcon
                      variant="light"
                      size={18}
                      radius="xl"
                      color={itemDone(item) ? "teal" : "gray"}
                    >
                      {itemDone(item) ? <IconCheck size={11} /> : <IconCircle size={11} />}
                    </ThemeIcon>
                    <Text size="sm">{item.label}</Text>
                    {item.essential && (
                      <Badge tone="warning" size="xs">
                        Essential
                      </Badge>
                    )}
                    {item.soon && (
                      <Badge tone="neutral" size="xs">
                        Soon
                      </Badge>
                    )}
                  </Group>
                  {!item.soon && (
                    <Button
                      tone="ghost"
                      size="compact-xs"
                      leftSection={<IconLockSquareRounded size={12} />}
                      onClick={() => navigate(item.to)}
                    >
                      Configure
                    </Button>
                  )}
                </Group>
              ))}
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
