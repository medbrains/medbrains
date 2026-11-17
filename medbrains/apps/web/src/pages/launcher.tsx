import { Group, SimpleGrid, Skeleton, Stack, Text } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import { useModuleStore, usePermissionStore } from "@medbrains/stores";
import type { LauncherResponse } from "@medbrains/types";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { QueryError } from "@/components/QueryError";
import type { NavItemConfig } from "@/config/navigation";
import { NAV_GROUPS } from "@/config/navigation";
import { AppTile } from "@/features/launcher/AppTile";
import { FavouriteChip } from "@/features/launcher/FavouriteChip";
import { LauncherSection } from "@/features/launcher/LauncherSection";
import styles from "@/features/launcher/launcher.module.scss";
import {
  administrationEntry,
  brickOf,
  type LauncherApp,
  launcherApps,
  taggedBricks,
  visibleFavourites,
  visibleScreens,
} from "@/features/launcher/launcherModel";
import { NeedsYouNow } from "@/features/launcher/NeedsYouNow";
import { useLauncherData, useToggleFavourite } from "@/features/launcher/useFavourites";
import { WaitingForYou } from "@/features/launcher/WaitingForYou";
import { needsNow, useMyWork, visibleItems } from "@/features/launcher/workModel";

/** Every brick the side panel tags, worked out once: the menu config is static. */
const BRICKS = taggedBricks(NAV_GROUPS);
/** Six app tiles a row on a desktop, as on the board, down to two on a phone. */
const APP_COLS = { base: 2, sm: 3, md: 4, lg: 6 };

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

/** Skeleton tiles while the launcher loads. */
function TileSkeletons() {
  const { t } = useTranslation("nav");
  const reduceMotion = useReducedMotion();
  return (
    <SimpleGrid cols={APP_COLS} aria-busy="true" aria-label={t("launcherLoading")}>
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <Skeleton key={n} height={120} animate={!reduceMotion} />
      ))}
    </SimpleGrid>
  );
}

/** The person's starred screens they can still open, as inline chips with their app's name. */
function FavouritesSection({
  data,
  screens,
}: {
  data: LauncherResponse;
  screens: NavItemConfig[];
}) {
  const { t } = useTranslation("nav");
  const toggle = useToggleFavourite();
  const names = useMemo(() => new Map(data.bricks.map((b) => [b.id, b.name])), [data.bricks]);
  const favourites = useMemo(
    () => visibleFavourites(data.favourites, screens),
    [data.favourites, screens],
  );
  return (
    <LauncherSection title={t("groupFavorites")} aside={t("launcherFavouritesNote")}>
      {favourites.length === 0 ? (
        <Text c="dimmed">{t("launcherNoFavourites")}</Text>
      ) : (
        <Group gap="sm">
          {favourites.map((item) => (
            <FavouriteChip
              key={item.path}
              label={t(item.i18nKey)}
              path={item.path}
              app={names.get(brickOf(item, BRICKS) ?? "")}
              unstarLabel={t("favouriteRemoveNamed", { label: t(item.i18nKey) })}
              isUnstarPending={toggle.isPending}
              onUnstar={() => toggle.mutate({ path: item.path, starred: false })}
            />
          ))}
        </Group>
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
        <SimpleGrid cols={APP_COLS}>
          {apps.map((app) => (
            <AppTile
              key={app.brick}
              label={names.get(app.brick) ?? t(app.home.i18nKey)}
              path={app.home.path}
              icon={app.home.icon}
            />
          ))}
          {admin && <AppTile label={t("admin")} path={admin.path} icon="IconSettings" />}
        </SimpleGrid>
      )}
      <Text size="sm" c="dimmed">
        {t("launcherAppsNote")}
      </Text>
    </LauncherSection>
  );
}

/**
 * The web home after sign-in, as on the approved Launcher board: what needs the person now (a
 * slim strip, only when there is something), what is waiting for them, their favourites, then
 * the apps their roles and the hospital's switched-on bricks allow, hidden, never greyed. It
 * replaces navigation, so the shell shows no side panel here. Someone with one app and no
 * Administration is taken straight into it, unless a safety item needs them first.
 *
 * Recent patients (#5994) is not shown: no endpoint lists recently opened patients yet.
 */
export default function LauncherPage() {
  const { t } = useTranslation("nav");
  const doors = useViewerDoors();
  const launcher = useLauncherData();
  const work = useMyWork();
  const disabledModules = useModuleStore((s) => s.disabledModules);
  const items = useMemo(
    () => (work.data ? visibleItems(work.data, disabledModules) : []),
    [work.data, disabledModules],
  );
  const now = useMemo(() => needsNow(items), [items]);

  const onlyApp = doors.apps.length === 1 && !doors.admin ? doors.apps[0] : undefined;
  if (onlyApp && work.isSuccess && now.length === 0) {
    return <Navigate to={onlyApp.home.path} replace />;
  }
  if (onlyApp && work.isPending) return <TileSkeletons />;

  return (
    <Stack gap="3xl" className={styles.page}>
      <NeedsYouNow items={now} />
      <WaitingForYou work={work} items={items} />
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
