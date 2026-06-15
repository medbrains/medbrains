import { Card, Group, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import { IconArrowRight } from "@tabler/icons-react";
import { type CSSProperties, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router";
import { Badge } from "@/components/ui";
import {
  APP_LAUNCHER_PERMISSIONS,
  APP_WORKSPACES,
  type AppWorkspaceConfig,
  NAV_GROUPS,
  type NavItemConfig,
  resolveIcon,
  WORKSPACE_STORAGE_KEY,
  workspaceHasPermission,
} from "@/config/navigation";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import classes from "./apps.module.scss";

function pathMatchesWorkspacePattern(path: string, pattern: string) {
  if (pattern.endsWith("/*")) {
    const basePath = pattern.slice(0, -2);
    return path === basePath || path.startsWith(`${basePath}/`);
  }
  return path === pattern;
}

function itemBelongsToWorkspace(item: NavItemConfig, workspace: AppWorkspaceConfig): boolean {
  if (workspace.pathPrefixes.some((pattern) => pathMatchesWorkspacePattern(item.path, pattern))) {
    return true;
  }
  return item.children?.some((child) => itemBelongsToWorkspace(child, workspace)) ?? false;
}

function itemHasPermission(item: NavItemConfig, hasPermission: (code: string) => boolean): boolean {
  return (
    (!item.requiredPermission || hasPermission(item.requiredPermission)) &&
    (!item.requiredPermissions || item.requiredPermissions.some((code) => hasPermission(code)))
  );
}

function firstPermittedPath(
  workspace: AppWorkspaceConfig,
  hasPermission: (code: string) => boolean,
) {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (!itemBelongsToWorkspace(item, workspace)) continue;
      const child = item.children?.find(
        (candidate) =>
          itemBelongsToWorkspace(candidate, workspace) &&
          itemHasPermission(candidate, hasPermission),
      );
      if (child) return child.path;
      if (itemHasPermission(item, hasPermission)) return item.path;
    }
  }
  return null;
}

function workspaceLandingPath(workspace: AppWorkspaceConfig): string {
  return `/apps/${workspace.key}`;
}

export function AppsPage() {
  useRequirePermission(APP_LAUNCHER_PERMISSIONS);
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const navigate = useNavigate();
  const { t } = useTranslation("nav");

  const availableApps = useMemo(
    () =>
      APP_WORKSPACES.map((workspace) => ({
        workspace,
        path: firstPermittedPath(workspace, hasPermission),
      })).filter((entry) => workspaceHasPermission(entry.workspace, hasPermission)),
    [hasPermission],
  );

  const openWorkspace = (workspace: AppWorkspaceConfig, path: string) => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace.key);
    navigate(path);
  };

  return (
    <div className={classes.page}>
      <Stack gap="lg">
        <div className={classes.hero}>
          <Badge tone="neutral" variant="light" mb="sm">
            App launcher
          </Badge>
          <Title order={1}>Choose your workspace</Title>
          <Text c="dimmed" maw={760} mt={6}>
            Pick the hospital app you want to work in. The sidebar will then show only that
            workspace, and the app switcher stays available in the top bar.
          </Text>
        </div>

        {availableApps.length === 0 ? (
          <Card withBorder padding="xl" className={classes.empty}>
            <Title order={3}>No apps available</Title>
            <Text c="dimmed" mt="xs">
              Your role does not currently have a visible app workspace. Ask an administrator to
              review your access.
            </Text>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg" className={classes.grid}>
            {availableApps.map(({ workspace, path }) => (
              <Card
                key={workspace.key}
                className={classes.card}
                style={{ "--workspace-gradient": workspace.color } as CSSProperties}
                onClick={() => openWorkspace(workspace, path ?? workspaceLandingPath(workspace))}
                withBorder
              >
                <Stack h="100%" justify="space-between" gap="lg">
                  <Group justify="space-between" align="flex-start">
                    <span className={classes.iconShell}>
                      {resolveIcon(workspace.icon, 24, 1.7)}
                    </span>
                    <IconArrowRight size={20} stroke={1.7} className={classes.arrow} />
                  </Group>
                  <div>
                    <Title order={3}>{t(workspace.i18nKey)}</Title>
                    <Text size="sm" c="dimmed" mt={6}>
                      {workspace.description}
                    </Text>
                  </div>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </div>
  );
}

export function WorkspaceLandingPage() {
  useRequirePermission(APP_LAUNCHER_PERMISSIONS);
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const { workspaceKey } = useParams();
  const { t } = useTranslation("nav");

  const workspace = APP_WORKSPACES.find((candidate) => candidate.key === workspaceKey);
  if (!workspace || !workspaceHasPermission(workspace, hasPermission)) {
    return <Navigate to="/apps" replace />;
  }

  const permittedPath = firstPermittedPath(workspace, hasPermission);
  if (permittedPath) {
    return <Navigate to={permittedPath} replace />;
  }

  return (
    <div className={classes.page}>
      <Card withBorder padding="xl" className={classes.empty}>
        <Group gap="sm" mb="sm">
          <span className={classes.iconShell}>{resolveIcon(workspace.icon, 24, 1.7)}</span>
          <Title order={2}>{t(workspace.i18nKey)}</Title>
        </Group>
        <Text c="dimmed">
          This role has app-level access, but no sidebar screen is enabled yet. Grant a screen
          permission to open work inside this app.
        </Text>
      </Card>
    </div>
  );
}
