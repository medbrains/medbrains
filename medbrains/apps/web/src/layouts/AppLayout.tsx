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
  ScrollArea,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { spotlight } from "@mantine/spotlight";
import { useAuthStore, usePermissionStore } from "@medbrains/stores";
import { useQueryClient } from "@tanstack/react-query";
import {
  Languages,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Star,
  User,
} from "lucide-react";
import type { ReactNode } from "react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router";
import { AnimatedIcon } from "@/components/AnimatedIcon";
import { Brand } from "@/components/Brand";
import { DlpGuard } from "@/components/DlpGuard";
import { HeaderWidgets } from "@/components/HeaderWidgets";
import { NewsMarquee } from "@/components/NewsMarquee";
import { NotificationCenter } from "@/components/NotificationCenter";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PageTransition } from "@/components/PageTransition";
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
import { preloadRoute } from "@/lib/route-preload";
import { sessionService } from "@/services/session.service";
import classes from "./AppLayout.module.scss";

// ── Resolved nav item (with ReactNode icon + label string) ──

interface ResolvedNavItem {
  label: string;
  path: string;
  icon: ReactNode;
  requiredPermission?: string;
  requiredPermissions?: readonly string[];
  children?: ResolvedNavItem[];
}

// Carbon UI Shell side-nav widths: 48px icon rail, 256px expanded.
const RAIL_WIDTH = 48;
const EXPANDED_WIDTH = 256;
const UUID_SEGMENT_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GROUP_LABEL_KEYS = {
  main: "groupMain",
  clinical: "groupClinical",
  diagnostics: "groupDiagnostics",
  inpatient: "groupInpatient",
  finance: "groupFinance",
  operations: "groupOperations",
  compliance: "groupCompliance",
  specialty: "groupSpecialty",
  admin: "groupAdmin",
} satisfies Record<string, string>;

function routeObjectLabel(previousSegment: string | undefined, nextSegment: string | undefined) {
  if (previousSegment === "patients") return nextSegment === "edit" ? "Patient" : "Patient";
  if (previousSegment === "encounters") return "OPD Visit";
  if (previousSegment === "queue") return nextSegment === "vitals" ? "Queue Token" : "Queue";
  if (previousSegment === "camp") return nextSegment === "work" ? "Camp" : "Camp";
  return "Record";
}

function groupLabelKey(key: string) {
  const entry = Object.entries(GROUP_LABEL_KEYS).find(([groupKey]) => groupKey === key);
  return entry?.[1] ?? key;
}

const FAVORITES_STORAGE_KEY = "medbrains.favnav";

function storedFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

export function AppLayout() {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [favorites, setFavorites] = useState<string[]>(storedFavorites);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);
  const toggleFavorite = useCallback((path: string) => {
    setFavorites((prev) => {
      const next = prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path];
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const hasPermission = usePermissionStore((s) => s.hasPermission);
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

  const handleLogout = async () => {
    try {
      await sessionService.logout();
    } catch {
      // ignore
    }
    clearAuth();
    // Wipe the in-memory query cache — it holds PHI/clinical data from this
    // session. Without this, the next user on a shared workstation could be
    // served the previous user's cached records before a refetch.
    queryClient.clear();
    navigate("/login");
  };

  const handleNavigate = useCallback(
    (path: string) => {
      preloadRoute(path);
      navigate(path);
      closeMobile();
    },
    [navigate, closeMobile],
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
        icon: badge ? (
          <ModuleBadge abbr={badge.abbr} color={badge.color} size={size} title={t(cfg.i18nKey)} />
        ) : (
          resolveIcon(cfg.icon, size, 1.5)
        ),
        requiredPermission: cfg.requiredPermission,
        requiredPermissions: cfg.requiredPermissions,
        children: cfg.children?.map((c) => resolveItem(c, true)),
      };
    },
    [t],
  );

  // Build nav groups from static config
  const navGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        key: group.key,
        items: group.items.map((item) => resolveItem(item)),
      })),
    [resolveItem],
  );

  // Flattened leaf modules (children replace their parent) — used to
  // resolve pinned favorites back to renderable items.
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
  const filterItem = (item: ResolvedNavItem): boolean => itemHasPermission(item);

  // ── Render a single rail icon ──
  const renderRailItem = (item: ResolvedNavItem, active: boolean) => (
    <Tooltip key={item.path} label={item.label} position="right" withArrow>
      <UnstyledButton
        className={`${classes.railItem} ${active ? classes.railItemActive : ""}`}
        aria-current={active ? "page" : undefined}
        onFocus={() => handleNavigationIntent(item.path)}
        onClick={() => handleNavigate(item.path)}
        onPointerEnter={() => handleNavigationIntent(item.path)}
      >
        <span className={classes.navIcon}>{item.icon}</span>
      </UnstyledButton>
    </Tooltip>
  );

  // ── Render expanded nav item (with optional children) ──
  const renderExpandedItem = (item: ResolvedNavItem) => {
    if (item.children) {
      const visibleChildren = item.children.filter(filterItem);
      if (visibleChildren.length === 0) return null;

      return (
        <div key={item.path}>
          <NavLink
            label={item.label}
            leftSection={<span className={classes.navIcon}>{item.icon}</span>}
            active={isAdminActive}
            defaultOpened={isAdminActive}
            className={isAdminActive ? classes.expandedItemActive : classes.expandedItem}
            aria-current={isAdminActive ? "page" : undefined}
            onFocus={() => handleNavigationIntent(item.path)}
            onPointerEnter={() => handleNavigationIntent(item.path)}
          >
            {visibleChildren.map((child) => (
              <NavLink
                key={child.path}
                label={child.label}
                leftSection={<span className={classes.navIcon}>{child.icon}</span>}
                active={isActive(child.path)}
                aria-current={isActive(child.path) ? "page" : undefined}
                onFocus={() => handleNavigationIntent(child.path)}
                onClick={() => handleNavigate(child.path)}
                onPointerEnter={() => handleNavigationIntent(child.path)}
                className={
                  isActive(child.path) ? classes.expandedChildActive : classes.expandedChild
                }
              />
            ))}
          </NavLink>
        </div>
      );
    }

    const active = isLeafActive(item.path);
    const pinned = favoriteSet.has(item.path);
    return (
      <NavLink
        key={item.path}
        label={item.label}
        leftSection={<span className={classes.navIcon}>{item.icon}</span>}
        rightSection={
          <Tooltip label={pinned ? "Unpin" : "Pin to favorites"} withArrow openDelay={400}>
            <ActionIcon
              component="div"
              role="button"
              tabIndex={-1}
              size="sm"
              variant="subtle"
              color={pinned ? "warning" : "gray"}
              className={pinned ? classes.favStarOn : classes.favStar}
              aria-label={pinned ? "Unpin from favorites" : "Pin to favorites"}
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                toggleFavorite(item.path);
              }}
            >
              <Star size={13} fill={pinned ? "currentColor" : "none"} />
            </ActionIcon>
          </Tooltip>
        }
        active={active}
        aria-current={active ? "page" : undefined}
        onFocus={() => handleNavigationIntent(item.path)}
        onClick={() => handleNavigate(item.path)}
        onPointerEnter={() => handleNavigationIntent(item.path)}
        className={active ? classes.expandedItemActive : classes.expandedItem}
      />
    );
  };

  // ── Render sidebar content ──
  const renderSidebar = () => {
    const groups = navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(filterItem),
      }))
      .filter((g) => g.items.length > 0);

    const favoriteItems = allLeafItems.filter(
      (item) => favoriteSet.has(item.path) && filterItem(item),
    );

    if (isExpanded) {
      return (
        <>
          {favoriteItems.length > 0 && (
            <div>
              <Text className={classes.navGroupLabel}>{t("groupFavorites")}</Text>
              {favoriteItems.map(renderExpandedItem)}
              <Divider my={4} className={classes.railDivider} />
            </div>
          )}
          {groups.map((group, gi) => (
            <div key={group.key}>
              {gi > 0 && <Divider my={4} className={classes.railDivider} />}
              <Text className={classes.navGroupLabel}>{t(groupLabelKey(group.key))}</Text>
              {group.items.map(renderExpandedItem)}
            </div>
          ))}
        </>
      );
    }

    // Rail mode
    return groups.map((group, gi) => (
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
    ));
  };

  return (
    <AppShell
      header={{ height: 48 }}
      navbar={{
        width: navbarWidth,
        breakpoint: "sm",
        collapsed: { mobile: !mobileOpened, desktop: false },
      }}
      padding="md"
      transitionDuration={260}
      transitionTimingFunction="cubic-bezier(0.22, 1, 0.36, 1)"
    >
      <DlpGuard />
      {/* ── Header ── */}
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
            <Group gap={8} className={classes.logoArea} onClick={() => navigate("/dashboard")}>
              <Brand surface="header" />
            </Group>
          </Group>

          <Group gap="sm" wrap="nowrap">
            <HeaderWidgets />
            <Box visibleFrom="lg" style={{ height: "100%" }}>
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
                <AnimatedIcon icon={Search} size={14} motion="float" />
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
              <AnimatedIcon icon={Search} size={18} motion="float" />
            </ActionIcon>

            <NotificationCenter />

            <ThemeToggle />

            <Menu shadow="md" width={160} position="bottom-end">
              <Menu.Target>
                <Tooltip label="Language" withArrow>
                  <ActionIcon size="md" color="slate" variant="subtle" aria-label="Language">
                    <AnimatedIcon icon={Languages} size={18} motion="float" />
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
                <Group gap={8} style={{ cursor: "pointer" }}>
                  <Avatar
                    color="primary"
                    radius="lg"
                    size={30}
                    style={{ fontSize: 12, fontWeight: 600 }}
                  >
                    {userInitial}
                  </Avatar>
                  <Box visibleFrom="sm" style={{ lineHeight: 1.2 }}>
                    <Text size="xs" fw={600} c="var(--mb-text-primary)">
                      {user?.full_name}
                    </Text>
                    <Text size="xs" c="var(--mb-text-muted)" fw={400} tt="capitalize">
                      {user?.role?.replace(/_/g, " ")}
                    </Text>
                  </Box>
                </Group>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<AnimatedIcon icon={User} size={14} />}
                  onClick={() => handleNavigate("/profile")}
                >
                  Profile
                </Menu.Item>
                <Menu.Item
                  leftSection={<AnimatedIcon icon={Settings} size={14} motion="float" />}
                  onClick={() => navigate("/admin/settings")}
                >
                  Settings
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="danger"
                  leftSection={<AnimatedIcon icon={LogOut} size={14} motion="bounce" />}
                  onClick={handleLogout}
                >
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      {/* ── Sidebar ── */}
      <AppShell.Navbar
        data-testid="app-sidebar"
        data-mode={isExpanded ? "expanded" : "rail"}
        p={isExpanded ? 8 : 0}
        className={isExpanded ? classes.navbarExpanded : classes.navbarRail}
      >
        <AppShell.Section grow component={ScrollArea} className={classes.navContent}>
          {renderSidebar()}
        </AppShell.Section>

        <AppShell.Section className={classes.navFooter}>
          <Divider my={4} className={classes.railDivider} />

          {/* Collapse / Expand toggle */}
          <Box visibleFrom="sm" className={classes.footerAction}>
            {isExpanded ? (
              <UnstyledButton className={classes.sidebarToggleExpanded} onClick={toggleSidebar}>
                <AnimatedIcon icon={PanelLeftClose} size={18} motion="float" />
                <Text size="xs" c="var(--mb-text-muted)">
                  {t("collapse")}
                </Text>
              </UnstyledButton>
            ) : (
              <Tooltip label={t("expand")} position="right" withArrow>
                <UnstyledButton className={classes.railItem} onClick={toggleSidebar}>
                  <AnimatedIcon icon={PanelLeftOpen} size={20} motion="float" />
                </UnstyledButton>
              </Tooltip>
            )}
          </Box>

          {/* Version */}
          <Box className={classes.versionBadge}>
            <Text size="xs" c="var(--mb-text-muted)" fw={400} ta="center">
              v0.1
            </Text>
          </Box>
        </AppShell.Section>
      </AppShell.Navbar>

      {/* ── Main content ── */}
      <AppShell.Main>
        <VerifyEmailBanner />
        {breadcrumbItems.length > 0 && (
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
            <Outlet />
          </PageTransition>
        </Suspense>
      </AppShell.Main>
    </AppShell>
  );
}
