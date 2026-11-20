import {
  ActionIcon,
  AppShell,
  Avatar,
  Box,
  Burger,
  Divider,
  Group,
  Kbd,
  Menu,
  NavLink,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { spotlight } from "@mantine/spotlight";
import {
  endClientSession,
  useAuthStore,
  useModuleStore,
  usePermissionStore,
} from "@medbrains/stores";
import { BRICK_MANIFESTS } from "@medbrains/types";
import { IconLanguage, IconLogout, IconSearch, IconSettings, IconUser } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import type { CSSProperties, ReactNode } from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router";
import { AnimatedIcon } from "@/components/AnimatedIcon";
import { AppRoute } from "@/components/AppRoute";
import { AiAssistantMount } from "@/components/ai/AiAssistantMount";
import { Brand } from "@/components/Brand";
import { DlpGuard } from "@/components/DlpGuard";
import { HeaderWidgets } from "@/components/HeaderWidgets";
import { HelpButton } from "@/components/HelpButton";
import { EmergencyCodeActivity } from "@/components/LiveActivityIsland/EmergencyCodeActivity";
import { LiveActivityIsland } from "@/components/LiveActivityIsland/LiveActivityIsland";
import { NewsMarquee } from "@/components/NewsMarquee";
import { NotificationCenter } from "@/components/NotificationCenter";
import { NotesButton } from "@/components/notes/NotesButton";
import { PageQueryErrorBanner } from "@/components/PageQueryErrorBanner";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PageTransition } from "@/components/PageTransition";
import { StepUpGate } from "@/components/StepUpGate";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Breadcrumb, ModuleBadge } from "@/components/ui";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import {
  buildPathLabels,
  getModuleBadge,
  NAV_GROUPS,
  type NavItemConfig,
  resolveIcon,
} from "@/config/navigation";
import { usePanelFavourites } from "@/features/launcher/usePanelFavourites";
import { preloadRoute } from "@/lib/route-preload";
import { sessionService } from "@/services/session.service";
import classes from "./AppLayout.module.scss";
import { AppNavbar, hasSidePanel } from "./AppNavbar";
import { panelFor } from "./appPanel";
import { FavouriteStar } from "./FavouriteStar";
import { OnDemandOverlays } from "./OnDemandOverlays";
import { PanelHeader } from "./PanelHeader";
import { PanelPages } from "./PanelPages";

// ── Resolved nav item (with ReactNode icon + label string) ──

interface ResolvedNavItem {
  label: string;
  path: string;
  /** The Tabler icon name, for the panel header (the first entry's, as on the launcher tile). */
  iconName: string;
  icon: ReactNode;
  /** Module badge colour — drives the per-item hover/active tint. */
  color?: string;
  requiredPermission?: string;
  requiredPermissions?: readonly string[];
  children?: ResolvedNavItem[];
  moduleCode?: string;
  isAdvanced?: boolean;
}

// Carbon UI Shell side-nav widths: 48px icon rail, 256px expanded.
const RAIL_WIDTH = 48;
const EXPANDED_WIDTH = 256;
const UUID_SEGMENT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function routeObjectLabel(previousSegment: string | undefined, nextSegment: string | undefined) {
  if (previousSegment === "patients") return "Patient";
  if (previousSegment === "encounters") return "OPD Visit";
  if (previousSegment === "queue") return nextSegment === "vitals" ? "Queue Token" : "Queue";
  if (previousSegment === "camp") return "Camp";
  return "Record";
}

export function AppLayout() {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // The same starred list as the launcher, kept on the server for the person: each panel entry
  // can be starred, and the stars show on the launcher.
  const favourites = usePanelFavourites();

  const location = useLocation();
  const isWorkspace = location.pathname === "/assistant";
  const hasPanel = hasSidePanel(location.pathname);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const permissions = usePermissionStore((s) => s.userPermissions);
  // Select the set, not the stable `isModuleEnabled` function, so the menu re-renders when a
  // brick is switched on or off.
  const disabledModules = useModuleStore((s) => s.disabledModules);
  const { t } = useTranslation("nav");

  const isExpanded = sidebarOpen;
  const navbarWidth = isExpanded ? EXPANDED_WIDTH : RAIL_WIDTH;

  // Focus routes carry their own contextual side pane (e.g. the OPD
  // encounter's clinical-tab rail), so the global nav steps back to
  // the icon rail to avoid two stacked left rails. Collapse on enter,
  // restore on leave — only on the transition, so a manual toggle made
  // while inside the view is respected.
  const isFocusRoute =
    /^\/opd\/encounters\/[^/]+/.test(location.pathname) || location.pathname.startsWith("/reports");
  const wasFocusRoute = useRef(false);
  useEffect(() => {
    if (isFocusRoute && !wasFocusRoute.current) {
      setSidebarOpen(false);
    } else if (!isFocusRoute && wasFocusRoute.current) {
      setSidebarOpen(true);
    }
    wasFocusRoute.current = isFocusRoute;
  }, [isFocusRoute]);

  /**
   * Tear the client down before the server answers: the logout call marks the
   * session ended at once (no refresh), then queries stop, the signed-in
   * screens unmount with their polls and socket, and the cache — this
   * session's patient data — is wiped for the next person at this desk.
   */
  const handleLogout = async () => {
    const loggedOut = sessionService.logout().catch(() => undefined);
    endClientSession(queryClient);
    void navigate("/login");
    await loggedOut;
  };

  const handleNavigate = useCallback(
    (path: string) => {
      preloadRoute(path);
      void navigate(path);
      closeMobile();
    },
    [navigate, closeMobile],
  );

  // Menu items are real links (an href, so keyboard focus, "link" to a
  // screen reader, open-in-new-tab); the router navigates, this only warms
  // the route and closes the mobile drawer.
  const handleLinkClick = useCallback(
    (path: string) => {
      preloadRoute(path);
      closeMobile();
    },
    [closeMobile],
  );

  const handleNavigationIntent = useCallback((path: string) => {
    preloadRoute(path);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((p) => {
      return !p;
    });
  }, []);

  const userInitial = user?.full_name?.charAt(0)?.toUpperCase() ?? "U";

  // Resolve config items to renderable items with translated labels
  const resolveItem = useCallback(
    (cfg: NavItemConfig, childSize = false): ResolvedNavItem => {
      const size = childSize ? 20 : 26;
      const badge = getModuleBadge(cfg.path);
      return {
        label: t(cfg.i18nKey),
        path: cfg.path,
        iconName: cfg.icon,
        color: badge?.color,
        icon: badge ? (
          <ModuleBadge abbr={badge.abbr} color={badge.color} size={size} title={t(cfg.i18nKey)} />
        ) : (
          resolveIcon(cfg.icon, size, 1.5)
        ),
        requiredPermission: cfg.requiredPermission,
        requiredPermissions: cfg.requiredPermissions,
        moduleCode: cfg.moduleCode,
        isAdvanced: cfg.isAdvanced,
        children: cfg.children?.map((c) => resolveItem(c, true)),
      };
    },
    [t],
  );

  // Only the current app's screens, or the core ones: never the whole menu (search has that).
  // biome-ignore lint/correctness/useExhaustiveDependencies: permissions drives hasPermission's answer
  const panel = useMemo(
    () => panelFor(location.pathname, { hasPermission, disabledModules }),
    [location.pathname, hasPermission, disabledModules, permissions],
  );
  const navGroups = useMemo(
    () =>
      panel.groups.map((group) => ({
        key: group.key,
        items: group.items.map((item) => resolveItem(item)),
      })),
    [panel, resolveItem],
  );

  // Flattened leaf modules (children replace their parent), for the active-leaf rule.
  const allLeafItems = useMemo(() => {
    const out: ResolvedNavItem[] = [];
    for (const group of navGroups) {
      for (const item of group.items) {
        if (item.children && item.children.length > 0) out.push(...item.children);
        else out.push(item);
      }
    }
    return out;
  }, [navGroups]);

  const itemHasPermission = useCallback(
    (item: ResolvedNavItem): boolean =>
      (!item.requiredPermission || hasPermission(item.requiredPermission)) &&
      (!item.requiredPermissions ||
        item.requiredPermissions.some((permission) => hasPermission(permission))),
    [hasPermission],
  );

  // Breadcrumbs
  const pathLabelMap = useMemo(() => buildPathLabels(NAV_GROUPS, t), [t]);
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const breadcrumbItems = pathSegments.map((_, index) => {
    const href = `/${pathSegments.slice(0, index + 1).join("/")}`;
    const segment = pathSegments[index] ?? "";
    const previousSegment = pathSegments[index - 1];
    const nextSegment = pathSegments[index + 1];
    const title =
      pathLabelMap[href] ??
      (UUID_SEGMENT_PATTERN.test(segment)
        ? routeObjectLabel(previousSegment, nextSegment)
        : segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
    return { title, href };
  });

  const isActive = useCallback(
    (path: string) => {
      if (path === "/") return location.pathname === "/";
      return location.pathname === path || location.pathname.startsWith(`${path}/`);
    },
    [location.pathname],
  );

  const leafPaths = useMemo(() => allLeafItems.map((item) => item.path), [allLeafItems]);

  // Leaf active state — only the most specific matching leaf lights up, so a
  // parent-prefix item (e.g. OPD Queue `/opd`) doesn't also highlight when a
  // more specific sibling leaf (`/opd/appointments`) is the current page.
  const isLeafActive = useCallback(
    (path: string) => {
      if (!isActive(path)) return false;
      return !leafPaths.some(
        (other) =>
          other !== path &&
          other.length > path.length &&
          other.startsWith(`${path}/`) &&
          (location.pathname === other || location.pathname.startsWith(`${other}/`)),
      );
    },
    [isActive, leafPaths, location.pathname],
  );
  const isAdminActive = isActive("/admin");

  // ── Filter nav items by permission only — the sidebar is a flat,
  //    categorized console service-nav (no workspace gating). ──
  const filterItem = (item: ResolvedNavItem): boolean =>
    itemHasPermission(item) && !(item.moduleCode && disabledModules.has(item.moduleCode));

  // ── Render a single rail icon ──
  const renderRailItem = (item: ResolvedNavItem, active: boolean) => (
    <Tooltip key={item.path} label={item.label} position="right" withArrow>
      <UnstyledButton
        component={Link}
        to={item.path}
        aria-label={item.label}
        className={`${classes.railItem} ${active ? classes.railItemActive : ""}`}
        style={{ "--item-color": item.color ?? "var(--mb-interactive)" } as CSSProperties}
        aria-current={active ? "page" : undefined}
        onFocus={() => handleNavigationIntent(item.path)}
        onClick={() => handleLinkClick(item.path)}
        onPointerEnter={() => handleNavigationIntent(item.path)}
      >
        <span className={classes.navIcon}>{item.icon}</span>
      </UnstyledButton>
    </Tooltip>
  );

  // Which parent entries (Administration → Admin) the user has opened.
  const [openParents, setOpenParents] = useState<Record<string, boolean>>({});

  // ── Render expanded nav item (with optional children) ──
  const renderExpandedItem = (item: ResolvedNavItem) => {
    if (item.children) {
      const visibleChildren = item.children.filter(filterItem);
      if (visibleChildren.length === 0) return null;

      return (
        <div key={item.path}>
          <NavLink
            // A real button, so the keyboard and screen readers can open it.
            component="button"
            type="button"
            label={item.label}
            leftSection={<span className={classes.navIcon}>{item.icon}</span>}
            active={isAdminActive}
            opened={openParents[item.path] ?? isAdminActive}
            onChange={(opened) => setOpenParents((all) => ({ ...all, [item.path]: opened }))}
            aria-expanded={openParents[item.path] ?? isAdminActive}
            className={isAdminActive ? classes.expandedItemActive : classes.expandedItem}
            aria-current={isAdminActive ? "page" : undefined}
            onFocus={() => handleNavigationIntent(item.path)}
            onPointerEnter={() => handleNavigationIntent(item.path)}
          >
            <PanelPages
              pages={visibleChildren}
              renderPage={(child) => (
                <NavLink
                  key={child.path}
                  component={Link}
                  to={child.path}
                  label={child.label}
                  style={
                    { "--item-color": child.color ?? "var(--mb-interactive)" } as CSSProperties
                  }
                  leftSection={<span className={classes.navIcon}>{child.icon}</span>}
                  active={isActive(child.path)}
                  aria-current={isActive(child.path) ? "page" : undefined}
                  onFocus={() => handleNavigationIntent(child.path)}
                  onClick={() => handleLinkClick(child.path)}
                  onPointerEnter={() => handleNavigationIntent(child.path)}
                  className={
                    isActive(child.path) ? classes.expandedChildActive : classes.expandedChild
                  }
                />
              )}
            />
          </NavLink>
        </div>
      );
    }

    const active = isLeafActive(item.path);
    return (
      <NavLink
        key={item.path}
        component={Link}
        to={item.path}
        label={item.label}
        style={{ "--item-color": item.color ?? "var(--mb-interactive)" } as CSSProperties}
        leftSection={<span className={classes.navIcon}>{item.icon}</span>}
        rightSection={<FavouriteStar path={item.path} favourites={favourites} />}
        active={active}
        aria-current={active ? "page" : undefined}
        onFocus={() => handleNavigationIntent(item.path)}
        onClick={() => handleLinkClick(item.path)}
        onPointerEnter={() => handleNavigationIntent(item.path)}
        className={active ? classes.expandedItemActive : classes.expandedItem}
      />
    );
  };

  // ── Render sidebar content: the app's name and the way back, then its screens ──
  const renderSidebar = () => {
    const groups = navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(filterItem),
      }))
      .filter((g) => g.items.length > 0);
    const first = groups[0]?.items[0];
    const header = (
      <PanelHeader
        title={panel.app ? (BRICK_MANIFESTS[panel.app]?.name ?? panel.app) : t("groupCore")}
        icon={resolveIcon(panel.app && first ? first.iconName : "IconDashboard", 20, 1.5)}
        isExpanded={isExpanded}
        onNavigate={closeMobile}
      />
    );

    if (isExpanded) {
      return (
        <>
          {header}
          {groups.map((group, gi) => (
            <div key={group.key}>
              {gi > 0 && <Divider my={4} className={classes.railDivider} />}
              {group.items.map(renderExpandedItem)}
            </div>
          ))}
        </>
      );
    }

    // Rail mode
    return (
      <>
        {header}
        {groups.map((group, gi) => (
          <div key={group.key} className={classes.railGroup}>
            {gi > 0 && <Divider my={4} className={classes.railDivider} />}
            {group.items.map((item) => {
              const visibleChildren = item.children?.filter(filterItem);
              const targetPath = visibleChildren?.[0]?.path ?? item.path;
              const active = visibleChildren
                ? visibleChildren.some((child) => isActive(child.path))
                : isLeafActive(item.path);
              return renderRailItem({ ...item, path: targetPath }, active);
            })}
          </div>
        ))}
      </>
    );
  };

  return (
    <AppShell
      header={{ height: 48 }}
      navbar={
        hasPanel
          ? { width: navbarWidth, breakpoint: "sm", collapsed: { mobile: !mobileOpened } }
          : undefined
      }
      padding="md"
      transitionDuration={260}
      transitionTimingFunction="cubic-bezier(0.22, 1, 0.36, 1)"
    >
      <DlpGuard />
      {/* ── Header ── */}
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap" miw={0} style={{ flex: "1 1 auto" }}>
            {hasPanel && (
              <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
            )}
            <Group
              gap={8}
              wrap="nowrap"
              miw={0}
              className={classes.logoArea}
              onClick={() => navigate("/home")}
            >
              <Brand surface="header" />
            </Group>
          </Group>

          <Group gap="sm" wrap="nowrap" miw={0}>
            <HeaderWidgets />
            {/* The ticker gives way first when the bar is tight. */}
            <Box visibleFrom="xl" miw={0} style={{ height: "100%", flex: "0 1 260px" }}>
              <NewsMarquee />
            </Box>
            <Divider orientation="vertical" size="sm" visibleFrom="sm" />
            {/* Spotlight trigger */}
            <UnstyledButton
              onClick={spotlight.open}
              className={classes.searchTrigger}
              visibleFrom="sm"
            >
              <Group gap={6}>
                <AnimatedIcon icon={IconSearch} size={14} motion="float" />
                <Text size="xs" c="dimmed">
                  Search...
                </Text>
                <Kbd size="xs">⌘K</Kbd>
              </Group>
            </UnstyledButton>
            <ActionIcon
              size="md"
              color="slate"
              variant="subtle"
              hiddenFrom="sm"
              onClick={spotlight.open}
              aria-label="Search"
            >
              <AnimatedIcon icon={IconSearch} size={18} motion="float" />
            </ActionIcon>

            <HelpButton />

            <NotesButton />

            <NotificationCenter />

            <ThemeToggle />

            <Menu shadow="md" width={160} position="bottom-end">
              <Menu.Target>
                <Tooltip label="Language" withArrow>
                  <ActionIcon size="md" color="slate" variant="subtle" aria-label="Language">
                    <AnimatedIcon icon={IconLanguage} size={18} motion="float" />
                  </ActionIcon>
                </Tooltip>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Language</Menu.Label>
                <Menu.Item
                  leftSection={
                    <Text size="xs" fw={600}>
                      EN
                    </Text>
                  }
                >
                  English
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            <Divider orientation="vertical" size="sm" />

            <Menu shadow="lg" width={180} position="bottom-end">
              <Menu.Target>
                <Group gap={8} wrap="nowrap" style={{ cursor: "pointer" }}>
                  <Avatar
                    color="primary"
                    radius="lg"
                    size={30}
                    style={{ fontSize: 12, fontWeight: 600 }}
                  >
                    {userInitial}
                  </Avatar>
                  <Box visibleFrom="lg" maw={160} style={{ lineHeight: 1.2 }}>
                    <Text size="xs" fw={600} c="var(--mb-text-primary)" truncate="end">
                      {user?.full_name}
                    </Text>
                    <Text
                      size="xs"
                      c="var(--mb-text-muted)"
                      fw={400}
                      tt="capitalize"
                      truncate="end"
                    >
                      {user?.role?.replace(/_/g, " ")}
                    </Text>
                  </Box>
                </Group>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<AnimatedIcon icon={IconUser} size={14} />}
                  onClick={() => handleNavigate("/profile")}
                >
                  Profile
                </Menu.Item>
                <Menu.Item
                  leftSection={<AnimatedIcon icon={IconSettings} size={14} motion="float" />}
                  onClick={() => navigate("/admin/settings")}
                >
                  Settings
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="danger"
                  leftSection={<AnimatedIcon icon={IconLogout} size={14} motion="bounce" />}
                  onClick={handleLogout}
                >
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      {/* ── Sidebar: none on the launcher, which replaces navigation ── */}
      {hasPanel && (
        <AppNavbar isExpanded={isExpanded} onToggle={toggleSidebar}>
          {renderSidebar()}
        </AppNavbar>
      )}

      {/* ── Main content ── */}
      {/* Room below the last row: the assistant launcher and the activity
          pill float over the bottom of every page, and a control underneath
          them can be neither clicked nor seen focused (WCAG 2.2 SC 2.4.11).
          A prop, because Mantine's own shell padding outranks a class. */}
      {/* The assistant workspace fills the screen: no launcher over it, and its
          own heading in place of the breadcrumb. */}
      <AppShell.Main pb={isWorkspace ? 0 : "calc(var(--mantine-spacing-xl) * 4)"}>
        <VerifyEmailBanner />
        <PageQueryErrorBanner />
        {breadcrumbItems.length > 0 && !isWorkspace && hasPanel && (
          <div className={classes.breadcrumbs}>
            <Breadcrumb
              items={breadcrumbItems.map((item) => ({
                label: item.title,
                href: item.href,
                onNavigate: () => navigate(item.href),
              }))}
            />
          </div>
        )}

        <Suspense fallback={<PageSkeleton />}>
          <PageTransition>
            {/* A switched-off app's screens do not open, whichever route reaches them. */}
            <AppRoute />
          </PageTransition>
        </Suspense>
      </AppShell.Main>

      {/* App-wide crab assistant — floating launcher + drawer, openable from
          anywhere via useAiAssistant(). Outside PageTransition so its fixed
          launcher anchors to the viewport. */}
      <AiAssistantMount />
      <OnDemandOverlays />
      <LiveActivityIsland />
      <EmergencyCodeActivity />
      <StepUpGate />
    </AppShell>
  );
}
