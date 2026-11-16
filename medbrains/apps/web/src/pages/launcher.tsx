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
  administrationEntry,
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

/** What the signed-in person may open now, by the side panel's rule. */
interface ViewerDoors {
  screens: NavItemConfig[];
  apps: LauncherApp[];
  /** Their first Administration screen, when they have one. */
  admin?: NavItemConfig;
}

/**
 * The screens, apps and Administration door the person may open now. It reads
 * the permission set and the switched-off bricks, so a change to either
 * redraws the launcher.
 */
function useViewerDoors(): ViewerDoors {
  const permissions = usePermissionStore((s) => s.userPermissions);
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const disabledModules = useModuleStore((s) => s.disabledModules);
  // biome-ignore lint/correctness/useExhaustiveDependencies: permissions drives hasPermission's answer
  return useMemo(() => {
    const viewer = { hasPermission, disabledModules };
    const screens = visibleScreens(NAV_GROUPS, viewer);
    const admin = administrationEntry(NAV_GROUPS, viewer);
    return { screens, apps: launcherApps(screens, BRICKS), admin };
  }, [permissions, hasPermission, disabledModules]);
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
  const { t } = useTranslation("nav");
  return (
    <SimpleGrid cols={GRID_COLS} aria-busy="true" aria-label={t("launcherLoading")}>
      {[0, 1, 2, 3].map((n) => (
        <Skeleton key={n} height={72} />
      ))}
    </SimpleGrid>
  );
}

/** The person's starred screens they can still open, each with its unstar control. */
function FavouritesSection({
  data,
  screens,
}: {
  data: LauncherResponse;
  screens: NavItemConfig[];
}) {
  const { t } = useTranslation("nav");
  const toggle = useToggleFavourite();
  const favourites = useMemo(
    () => visibleFavourites(data.favourites, screens),
    [data.favourites, screens],
  );
  return (
    <LauncherSection title={t("groupFavorites")}>
      {favourites.length === 0 ? (
        <Text c="dimmed">{t("launcherNoFavourites")}</Text>
      ) : (
        <SimpleGrid cols={GRID_COLS}>
          {favourites.map((item) => (
            <LauncherTile
              key={item.path}
              label={t(item.i18nKey)}
              path={item.path}
              icon={item.icon}
              unstarLabel={t("favouriteRemoveNamed", { label: t(item.i18nKey) })}
              isUnstarPending={toggle.isPending}
              onUnstar={() => toggle.mutate({ path: item.path, starred: false })}
            />
          ))}
        </SimpleGrid>
      )}
    </LauncherSection>
  );
}

/** One tile per app, then Administration for those who have it; hidden, never greyed. */
function AppsSection({ data, doors }: { data: LauncherResponse; doors: ViewerDoors }) {
  const { t } = useTranslation("nav");
  const names = useMemo(() => new Map(data.bricks.map((b) => [b.id, b.name])), [data.bricks]);
  const { apps, admin } = doors;
  return (
    <LauncherSection title={t("launcherApps")}>
      {apps.length === 0 && !admin ? (
        <Text c="dimmed">{t("launcherNoApps")}</Text>
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
          {admin && <LauncherTile label={t("admin")} path={admin.path} icon="IconSettings" />}
        </SimpleGrid>
      )}
    </LauncherSection>
  );
}

/**
 * The web home after sign-in: the screens the person starred, then the apps
 * their roles and the hospital's switched-on bricks allow, hidden, never
 * greyed. Open to every signed-in user, like Approvals: it shows only what the
 * person can already open. Someone with one app and no Administration is taken
 * straight into the app.
 */
export default function LauncherPage() {
  const { t } = useTranslation("nav");
  const userName = useAuthStore((s) => s.user?.full_name);
  const doors = useViewerDoors();
  const launcher = useLauncherData();

  const onlyApp = doors.apps.length === 1 && !doors.admin ? doors.apps[0] : undefined;
  if (onlyApp) return <Navigate to={onlyApp.home.path} replace />;

  return (
    <Stack gap="xl">
      <PageHeader
        title={userName ? t("launcherWelcomeName", { name: userName }) : t("launcherWelcome")}
        divider={false}
      />
      {launcher.isError ? (
        <QueryError
          error={launcher.error}
          onRetry={() => void launcher.refetch()}
          title={t("launcherLoadFailed")}
        />
      ) : launcher.isPending ? (
        <TileSkeletons />
      ) : (
        <>
          <FavouritesSection data={launcher.data} screens={doors.screens} />
          <AppsSection data={launcher.data} doors={doors} />
        </>
      )}
    </Stack>
  );
}
