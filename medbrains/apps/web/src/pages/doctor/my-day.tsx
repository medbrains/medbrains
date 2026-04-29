/**
 * Doctor "My Day" — composite dashboard.
 * Per RFCs/sprints/SPRINT-doctor-activities.md §2.5.
 */
import {
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { P } from "@medbrains/types";
import {
  IconActivity,
  IconAlertTriangle,
  IconCalendar,
  IconClipboardCheck,
  IconStethoscope,
  IconSignature,
  IconUserCog,
} from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { PageHeader } from "../../components/PageHeader";
import { useRequirePermission } from "../../hooks/useRequirePermission";

export function MyDayPage() {
  useRequirePermission(P.DOCTOR.DASHBOARD.VIEW_OWN);
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["my-doctor-profile"],
    queryFn: () => api.getMyDoctorProfile(),
    retry: 0,
  });

  const { data: myDay, isLoading } = useQuery({
    queryKey: ["my-day"],
    queryFn: () => api.getMyDay(),
    refetchInterval: 30_000,
  });

  return (
    <div>
      <PageHeader
        title={
          profile
            ? `${profile.prefix ? `${profile.prefix} ` : ""}${profile.display_name}`
            : "My Day"
        }
        subtitle={profile?.qualification_string ?? "Today's overview"}
        icon={<IconStethoscope size={20} stroke={1.5} />}
        color="primary"
        actions={
          <Group gap="xs">
            <Button
              variant="light"
              size="xs"
              leftSection={<IconClipboardCheck size={14} />}
              onClick={() => navigate("/doctor/signoffs")}
            >
              Sign-off queue ({myDay?.pending_signoffs.total ?? 0})
            </Button>
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconUserCog size={14} />}
              onClick={() => navigate("/doctor/profile")}
            >
              Profile
            </Button>
          </Group>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="md">
        <StatCard
          label="Appointments today"
          value={myDay?.today.appointments_total ?? 0}
          sub={
            myDay?.today.appointments_remaining
              ? `${myDay.today.appointments_remaining} remaining`
              : undefined
          }
          icon={<IconCalendar size={20} stroke={1.5} />}
          color="primary"
        />
        <StatCard
          label="Pending sign-offs"
          value={myDay?.pending_signoffs.total ?? 0}
          sub={
            myDay && myDay.pending_signoffs.medico_legal > 0
              ? `${myDay.pending_signoffs.medico_legal} medico-legal`
              : undefined
          }
          icon={<IconSignature size={20} stroke={1.5} />}
          color={
            (myDay?.pending_signoffs.overdue ?? 0) > 0 ? "danger" : "warning"
          }
        />
        <StatCard
          label="OT cases today"
          value={myDay?.today.ot_cases ?? 0}
          icon={<IconActivity size={20} stroke={1.5} />}
          color="info"
        />
        <StatCard
          label="Critical alerts"
          value={myDay?.today.critical_alerts ?? 0}
          icon={<IconAlertTriangle size={20} stroke={1.5} />}
          color="danger"
        />
      </SimpleGrid>

      {myDay && myDay.coverage.length > 0 && (
        <Card padding="md" mb="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text fw={600} size="sm">Currently covering for</Text>
              <Text size="xs" c="dimmed">
                {myDay.coverage.length} active assignment(s)
              </Text>
            </div>
            <Badge color="warning" variant="light">
              Locum
            </Badge>
          </Group>
          <Divider my="sm" />
          <Stack gap="xs">
            {myDay.coverage.map((c) => (
              <Group key={c.absent_doctor_id} justify="space-between">
                <Text size="sm">Doctor {c.absent_doctor_id.slice(0, 8)}</Text>
                <Text size="xs" c="dimmed">
                  until {new Date(c.end_at).toLocaleString()}
                </Text>
              </Group>
            ))}
          </Stack>
        </Card>
      )}

      <Grid mb="md">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card padding="md" h="100%">
            <Text fw={600} size="sm" mb="sm">
              Quick actions
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
              <QuickAction
                label="Open sign-off queue"
                description="Review and sign pending records"
                icon={<IconSignature size={20} />}
                onClick={() => navigate("/doctor/signoffs")}
                badge={myDay?.pending_signoffs.total ?? 0}
              />
              <QuickAction
                label="Today's appointments"
                description="OPD queue + booked slots"
                icon={<IconCalendar size={20} />}
                onClick={() => navigate("/opd")}
              />
              <QuickAction
                label="My patients (IPD)"
                description="Wards I'm covering"
                icon={<IconStethoscope size={20} />}
                onClick={() => navigate("/ipd")}
              />
              <QuickAction
                label="Emergency"
                description="Active code blue / triage"
                icon={<IconAlertTriangle size={20} />}
                onClick={() => navigate("/emergency")}
              />
            </SimpleGrid>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card padding="md" h="100%">
            <Text fw={600} size="sm" mb="sm">
              On call
            </Text>
            {myDay?.on_call.is_on_call_now ? (
              <Badge color="warning" variant="filled" size="lg">
                Currently on call
              </Badge>
            ) : (
              <Text size="sm" c="dimmed">
                Not on call
              </Text>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      {isLoading && (
        <Text size="xs" c="dimmed" ta="center">
          Loading…
        </Text>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card padding="md" withBorder>
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <ThemeIcon variant="light" color={color} size={36} radius="md">
          {icon}
        </ThemeIcon>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
            {label}
          </Text>
          <Text fw={700} size="xl">
            {value}
          </Text>
          {sub && (
            <Text size="xs" c="dimmed">
              {sub}
            </Text>
          )}
        </div>
      </Group>
    </Card>
  );
}

function QuickAction({
  label,
  description,
  icon,
  onClick,
  badge,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <Card
      padding="sm"
      withBorder
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      <Group gap="sm" wrap="nowrap" align="flex-start">
        <ThemeIcon variant="light" size={32} radius="md">
          {icon}
        </ThemeIcon>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between">
            <Text fw={600} size="sm">
              {label}
            </Text>
            {badge !== undefined && badge > 0 && (
              <Badge size="sm" color="warning">
                {badge}
              </Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        </div>
      </Group>
    </Card>
  );
}
