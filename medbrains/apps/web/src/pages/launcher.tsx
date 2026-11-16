import { SimpleGrid, Skeleton, Stack, Text, Title } from "@mantine/core";
import { useAuthStore, useModuleStore, usePermissionStore } from "@medbrains/stores";
import type { LauncherResponse } from "@medbrains/types";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import type { NavItemConfig } from "@/config/navigation";
import { NAV_GROUPS } from "@/config/navigation";
import { LauncherTile } from "@/features/launcher/LauncherTile";
import {
  type LauncherApp,
  launcherApps,
  taggedBricks,
  visibleFavourites,
  visibleScreens,
} from "@/features/launcher/launcherModel";
import { useLauncherData, useToggleFavourite } from "@/features/launcher/useFavourites";

/** Every brick the side panel tags, worked out once: the menu config is static. */
const BRICKS = taggedBricks(NAV_GROUPS);
/** One tile per column on a phone, more as the screen widens. */
const GRID_COLS = { base: 1, xs: 2, md: 4, xl: 6 };

/**
 * The screens the signed-in person may open now, by the side panel's rule.
 * It reads the permission set and the switched-off bricks so a change to
 * either redraws the launcher.
 */
function useVisibleScreens(): NavItemConfig[] {
  const permissions = usePermissionStore((s) => s.userPermissions);
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const disabledModules = useModuleStore((s) => s.disabledModules);
  // biome-ignore lint/correctness/useExhaustiveDependencies: permissions drives hasPermission's answer
  return useMemo(
    () => visibleScreens(NAV_GROUPS, { hasPermission, disabledModules }),
    [permissions, hasPermission, disabledModules],
  );
}

/** A section heading and its tiles. */
function LauncherSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack gap="sm" component="section" aria-label={title}>
      <Title order={2} size="h4">
        {title}
      </Title>
      {children}
    </Stack>
  );
}

/** Skeleton tiles while the launcher loads. */
function TileSkeletons() {
  return (
    <SimpleGrid cols={GRID_COLS} aria-busy="true" aria-label="Loading">
      {[0, 1, 2, 3].map((n) => (
        <Skeleton key={n} height={72} />
      ))}
    </SimpleGrid>
  );
}

interface LauncherBodyProps {
  data: LauncherResponse;
  screens: NavItemConfig[];
  apps: LauncherApp[];
}

/** The two sections, drawn only from a successful read. */
function LauncherBody({ data, screens, apps }: LauncherBodyProps) {
  const { t } = useTranslation("nav");
  const toggle = useToggleFavourite();
  const names = useMemo(() => new Map(data.bricks.map((b) => [b.id, b.name])), [data.bricks]);
  const favourites = useMemo(
    () => visibleFavourites(data.favourites, screens),
    [data.favourites, screens],
  );
  return (
    <>
      <LauncherSection title="Favourites">
        {favourites.length === 0 ? (
          <Text c="dimmed">Star a screen in the side panel to keep it here.</Text>
        ) : (
          <SimpleGrid cols={GRID_COLS}>
            {favourites.map((item) => (
              <LauncherTile
                key={item.path}
                label={t(item.i18nKey)}
                path={item.path}
                icon={item.icon}
                onUnstar={() => toggle.mutate({ path: item.path, starred: false })}
              />
            ))}
          </SimpleGrid>
        )}
      </LauncherSection>
      <LauncherSection title="Your apps">
        {apps.length === 0 ? (
          <Text c="dimmed">No apps are switched on for your role. Ask your administrator.</Text>
        ) : (
          <SimpleGrid cols={GRID_COLS}>
            {apps.map((app) => (
              <LauncherTile
                key={app.brick}
                label={names.get(app.brick) ?? t(app.home.i18nKey)}
                path={app.home.path}
                icon={app.home.icon}
              />
            ))}
          </SimpleGrid>
        )}
      </LauncherSection>
    </>
  );
}

/**
 * The web home after sign-in: the screens the person starred, then the apps
 * their roles and the hospital's switched-on bricks allow, hidden, never
 * greyed. Open to every signed-in user, like Approvals: it shows only what the
 * person can already open. Someone with one app is taken straight into it.
 */
export function LauncherPage() {
  const userName = useAuthStore((s) => s.user?.full_name);
  const screens = useVisibleScreens();
  const apps = useMemo(() => launcherApps(screens, BRICKS), [screens]);
  const launcher = useLauncherData();

  const onlyApp = apps.length === 1 ? apps[0] : undefined;
  if (onlyApp) return <Navigate to={onlyApp.home.path} replace />;

  return (
    <Stack gap="xl">
      <PageHeader title={userName ? `Welcome, ${userName}` : "Welcome"} divider={false} />
      {launcher.isError ? (
        <QueryError
          error={launcher.error}
          onRetry={() => void launcher.refetch()}
          title="Your favourites and apps didn't load"
        />
      ) : launcher.isPending ? (
        <TileSkeletons />
      ) : (
        <LauncherBody data={launcher.data} screens={screens} apps={apps} />
      )}
    </Stack>
  );
}
