import { Card, Group, RingProgress, Stack, Text, ThemeIcon } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { IconCheck, IconCircle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui";

/**
 * Dashboard "finish setting up" nudge — surfaces the Setup Center readiness so a
 * new admin sees what's left. Auto-hides once the essentials are configured
 * (the go-live bar) and is only shown to admins.
 */
export function GettingStartedWidget() {
  const isAdmin = useHasPermission(P.ADMIN.SETTINGS.GENERAL.MANAGE);
  const navigate = useNavigate();

  const departments = useQuery({
    queryKey: ["setup", "departments"],
    queryFn: () => api.listDepartments(),
    enabled: isAdmin,
  });
  const services = useQuery({
    queryKey: ["setup", "services"],
    queryFn: () => api.listServices(),
    enabled: isAdmin,
  });
  const sequences = useQuery({
    queryKey: ["setup", "sequences"],
    queryFn: () => api.listSequences(),
    enabled: isAdmin,
  });
  const invitations = useQuery({
    queryKey: ["invitations"],
    queryFn: () => api.listInvitations(),
    enabled: isAdmin,
  });

  if (!isAdmin) return null;

  const essentials = [
    { label: "Add departments", done: (departments.data?.length ?? 0) > 0, to: "/admin/settings" },
    { label: "Add services", done: (services.data?.length ?? 0) > 0, to: "/admin/settings" },
    {
      label: "Set up numbering (UHID, invoice)",
      done: (sequences.data?.length ?? 0) > 0,
      to: "/admin/settings",
    },
  ];
  const extras = [
    { label: "Invite your team", done: (invitations.data?.length ?? 0) > 0, to: "/admin/users" },
  ];

  const doneCount = essentials.filter((s) => s.done).length;
  // Live once the essentials are in place — stop nudging.
  if (doneCount === essentials.length) return null;
  const pct = Math.round((doneCount / essentials.length) * 100);
  const items = [...essentials, ...extras];

  return (
    <Card withBorder padding="lg" mb="md">
      <Group align="flex-start" justify="space-between" wrap="nowrap">
        <Group align="flex-start" wrap="nowrap">
          <RingProgress
            size={88}
            thickness={9}
            roundCaps
            sections={[{ value: pct, color: "indigo" }]}
            label={
              <Text ta="center" fw={700} size="sm">
                {pct}%
              </Text>
            }
          />
          <Stack gap={6}>
            <Text fw={600}>Finish setting up your hospital</Text>
            <Stack gap={2}>
              {items.map((item) => (
                <Group key={item.label} gap={6} justify="space-between">
                  <Group gap={6}>
                    <ThemeIcon
                      variant="light"
                      size={18}
                      radius="xl"
                      color={item.done ? "teal" : "gray"}
                    >
                      {item.done ? <IconCheck size={11} /> : <IconCircle size={11} />}
                    </ThemeIcon>
                    <Text size="sm" td={item.done ? "line-through" : undefined}>
                      {item.label}
                    </Text>
                  </Group>
                  {!item.done && (
                    <Button tone="ghost" size="compact-xs" onClick={() => navigate(item.to)}>
                      Go
                    </Button>
                  )}
                </Group>
              ))}
            </Stack>
          </Stack>
        </Group>
        <Button tone="primary" size="sm" onClick={() => navigate("/setup")}>
          Open Setup Center
        </Button>
      </Group>
    </Card>
  );
}
