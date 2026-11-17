import { SimpleGrid, Skeleton, Stack, Text } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import { useAuthStore, useModuleStore, usePermissionStore } from "@medbrains/stores";
import { type LauncherResponse, ROLE_TEMPLATES, type WorkItem } from "@medbrains/types";
import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { PageHeader } from "@/components/PageHeader";
import { QueryError } from "@/components/QueryError";
import type { NavItemConfig } from "@/config/navigation";
import { NAV_GROUPS } from "@/config/navigation";
import { LauncherSection } from "@/features/launcher/LauncherSection";
import { LauncherTile } from "@/features/launcher/LauncherTile";
import {
  administrationEntry,
  type LauncherApp,
  launcherApps,
  taggedBricks,
  visibleFavourites,
  visibleScreens,
} from "@/features/launcher/launcherModel";
import { NeedsYouNow } from "@/features/launcher/NeedsYouNow";
import { useLauncherData, useToggleFavourite } from "@/features/launcher/useFavourites";
import { WaitingForYou } from "@/features/launcher/WaitingForYou";
import {
  countLabel,
  itemsByBrick,
  needsNow,
  partOfDay,
  useMyWork,
  visibleItems,
} from "@/features/launcher/workModel";

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

/** Skeleton tiles while the launcher loads. */
function TileSkeletons() {
  const { t } = useTranslation("nav");
  const reduceMotion = useReducedMotion();
  return (
    <SimpleGrid cols={GRID_COLS} aria-busy="true" aria-label={t("launcherLoading")}>
      {[0, 1, 2, 3].map((n) => (
        <Skeleton key={n} height={48} animate={!reduceMotion} />
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
    <LauncherSection title={t("groupFavorites")} why={t("launcherFavouritesWhy")}>
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

interface AppsSectionProps {
  data: LauncherResponse;
  doors: ViewerDoors;
  /** My work items, for the live line on each app's tile. */
  work: readonly WorkItem[];
}

/** The live line on an app tile, such as "12 waiting", from that brick's work item. */
function appMeta(item: WorkItem | undefined, t: TFunction<"nav">) {
  return item && t(`workTile_${item.key}`, { count: item.count ?? 0, shown: countLabel(item) });
}

/** One tile per app, then Administration for those who have it; hidden, never greyed. */
function AppsSection({ data, doors, work }: AppsSectionProps) {
  const { t } = useTranslation("nav");
  const names = useMemo(() => new Map(data.bricks.map((b) => [b.id, b.name])), [data.bricks]);
  const byBrick = useMemo(() => itemsByBrick(work), [work]);
  const { apps, admin } = doors;
  return (
    <LauncherSection title={t("launcherApps")} why={t("launcherAppsWhy")}>
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
              meta={appMeta(byBrick.get(app.brick), t)}
            />
          ))}
          {admin && <LauncherTile label={t("admin")} path={admin.path} icon="IconSettings" />}
        </SimpleGrid>
      )}
    </LauncherSection>
  );
}

/** "Good morning, Meera" and "Doctor · Tuesday 17 November": who I am signed in as, and today. */
function Greeting() {
  const { t, i18n } = useTranslation("nav");
  const user = useAuthStore((s) => s.user);
  const now = new Date();
  const part = t(`launcherPart_${partOfDay(now.getHours())}`);
  const role = user ? (ROLE_TEMPLATES[user.role]?.label ?? user.role) : undefined;
  const day = now.toLocaleDateString(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return (
    <PageHeader
      title={user ? t("launcherGreetingName", { part, name: user.full_name }) : part}
      subtitle={[role, day].filter(Boolean).join(" · ")}
      divider={false}
    />
  );
}

/**
 * The web home after sign-in: what needs me now, what is waiting for me, my favourites,
 * then the apps my roles and the hospital's switched-on bricks allow, hidden, never greyed.
 * Open to every signed-in user, like Approvals: it shows only what the person can already
 * open. Someone with one app and no Administration is taken straight into it, unless a
 * safety item needs them first (owner, 2026-11-17).
 *
 * "Continue where you left off" (#6046) and "Suggested for you" (#6047) from the
 * approved design are not shown: neither has the data behind it yet, and neither is faked.
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
    <Stack gap="xl">
      <Greeting />
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
          <AppsSection data={launcher.data} doors={doors} work={items} />
        </>
      )}
    </Stack>
  );
}
