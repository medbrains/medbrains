import {
  ActionIcon,
  AppShell,
  Avatar,
  Badge,
  Box,
  Breadcrumbs,
  Burger,
  Divider,
  Group,
  Indicator,
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
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Languages,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  User,
} from "lucide-react";
import type { ReactNode } from "react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router";
import { AnimatedIcon } from "@/components/AnimatedIcon";
import { PageSkeleton } from "@/components/PageSkeleton";
import {
  APP_WORKSPACES,
  type AppWorkspaceConfig,
  type AppWorkspaceKey,
  buildPathLabels,
  NAV_GROUPS,
  type NavItemConfig,
  resolveIcon,
  WORKSPACE_STORAGE_KEY,
  workspaceHasPermission,
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

const RAIL_WIDTH = 56;
const EXPANDED_WIDTH = 240;
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

const DEFAULT_WORKSPACE: AppWorkspaceConfig = {
  key: "hims",
  i18nKey: "workspaceHims",
  description: "Patient flow, OPD, ER, IPD, ward and nursing work",
  icon: "IconBuildingHospital",
  color: "linear-gradient(135deg, #0f766e 0%, #38bdf8 100%)",
  defaultPath: "/dashboard",
  pathPrefixes: ["/dashboard"],
  permissionModules: ["dashboard"],
};

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

function pathMatchesWorkspacePattern(path: string, pattern: string) {
  if (pattern.endsWith("/*")) {
    const basePath = pattern.slice(0, -2);
    return path === basePath || path.startsWith(`${basePath}/`);
  }
  return path === pattern;
}

function itemBelongsToWorkspace(item: ResolvedNavItem, workspace: AppWorkspaceConfig): boolean {
  if (workspace.pathPrefixes.some((pattern) => pathMatchesWorkspacePattern(item.path, pattern))) {
    return true;
  }
  return item.children?.some((child) => itemBelongsToWorkspace(child, workspace)) ?? false;
}

function workspaceForPath(path: string): AppWorkspaceKey | null {
  if (path.startsWith("/apps/")) {
    const workspaceKey = path.split("/")[2];
    return APP_WORKSPACES.find((workspace) => workspace.key === workspaceKey)?.key ?? null;
  }
  return (
    APP_WORKSPACES.find((workspace) =>
      workspace.pathPrefixes.some((pattern) => pathMatchesWorkspacePattern(path, pattern)),
    )?.key ?? null
  );
}

function storedWorkspace(): AppWorkspaceKey {
  if (typeof window === "undefined") return "hims";
  const stored = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  const workspace = APP_WORKSPACES.find((candidate) => candidate.key === stored);
  return workspace?.key ?? "hims";
}

export function AppLayout() {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [preferredWorkspace, setPreferredWorkspace] = useState<AppWorkspaceKey>(storedWorkspace);

  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const { t } = useTranslation("nav");

  const isAppLauncher = location.pathname === "/apps";
  const isExpanded = sidebarOpen;
  const navbarWidth = isAppLauncher ? 0 : isExpanded ? EXPANDED_WIDTH : RAIL_WIDTH;

  useEffect(() => {
    if (location.pathname.startsWith("/reports")) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await sessionService.logout();
    } catch {
      // ignore
    }
    clearAuth();
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

  const handleWorkspaceSelect = useCallback(
    (workspace: AppWorkspaceConfig, path: string) => {
      setPreferredWorkspace(workspace.key);
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, workspace.key);
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
    (cfg: NavItemConfig, childSize = false): ResolvedNavItem => ({
      label: t(cfg.i18nKey),
      path: cfg.path,
      icon: resolveIcon(cfg.icon, childSize ? 16 : 20, 1.5),
      requiredPermission: cfg.requiredPermission,
      requiredPermissions: cfg.requiredPermissions,
      children: cfg.children?.map((c) => resolveItem(c, true)),
    }),
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

  const itemHasPermission = useCallback(
    (item: ResolvedNavItem): boolean =>
      (!item.requiredPermission || hasPermission(item.requiredPermission)) &&
      (!item.requiredPermissions ||
        item.requiredPermissions.some((permission) => hasPermission(permission))),
    [hasPermission],
  );

  const workspaceStartPath = useCallback(
    (workspace: AppWorkspaceConfig): string | null => {
      for (const group of navGroups) {
        for (const item of group.items) {
          if (!itemBelongsToWorkspace(item, workspace)) continue;
          const visibleChild = item.children?.find(
            (child) => itemHasPermission(child) && itemBelongsToWorkspace(child, workspace),
          );
          if (visibleChild) return visibleChild.path;
          if (itemHasPermission(item)) return item.path;
        }
      }
      return null;
    },
    [itemHasPermission, navGroups],
  );

  const availableWorkspaces = useMemo(() => {
    const workspaces = APP_WORKSPACES.filter((workspace) =>
      workspaceHasPermission(workspace, hasPermission),
    );
    return workspaces.length > 0 ? workspaces : APP_WORKSPACES.slice(0, 1);
  }, [hasPermission]);

  const routeWorkspace = useMemo(() => workspaceForPath(location.pathname), [location.pathname]);
  const activeWorkspaceKey = useMemo(() => {
    const candidate = routeWorkspace ?? preferredWorkspace;
    return availableWorkspaces.some((workspace) => workspace.key === candidate)
      ? candidate
      : (availableWorkspaces[0]?.key ?? "hims");
  }, [availableWorkspaces, preferredWorkspace, routeWorkspace]);
  const activeWorkspace =
    APP_WORKSPACES.find((workspace) => workspace.key === activeWorkspaceKey) ?? DEFAULT_WORKSPACE;

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
  const isAdminActive = isActive("/admin");

  // ── Filter nav items by permission and selected app workspace ──
  const filterItem = (item: ResolvedNavItem): boolean =>
    itemHasPermission(item) && itemBelongsToWorkspace(item, activeWorkspace);

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

    const active = isActive(item.path);
    return (
      <NavLink
        key={item.path}
        label={item.label}
        leftSection={<span className={classes.navIcon}>{item.icon}</span>}
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

    if (isExpanded) {
      return groups.map((group, gi) => (
        <div key={group.key}>
          {gi > 0 && <Divider my={4} className={classes.railDivider} />}
          <Text className={classes.navGroupLabel}>{t(groupLabelKey(group.key))}</Text>
          {group.items.map(renderExpandedItem)}
        </div>
      ));
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
            : isActive(item.path);
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
        collapsed: { mobile: !mobileOpened || isAppLauncher, desktop: isAppLauncher },
      }}
      padding="md"
      transitionDuration={260}
      transitionTimingFunction="cubic-bezier(0.22, 1, 0.36, 1)"
    >
      {/* ── Header ── */}
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            {!isAppLauncher && (
              <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
            )}
            <Group gap={8} className={classes.logoArea} onClick={() => navigate("/apps")}>
              <img
                src="/logo/medbrains-mark.svg"
                alt=""
                width={30}
                height={30}
                style={{ borderRadius: 8 }}
              />
              <Text
                size="sm"
                fw={700}
                c="var(--mb-text-primary)"
                style={{ letterSpacing: "-0.02em" }}
              >
                MedBrains
              </Text>
              <Text size="xs" c="var(--mb-text-muted)" fw={500} visibleFrom="md">
                HMS
              </Text>
            </Group>
            <Menu shadow="lg" width={340} position="bottom-start" withinPortal>
              <Menu.Target>
                <UnstyledButton className={classes.workspaceSelector} aria-label="Select app">
                  <span
                    className={classes.workspaceIconWrap}
                    style={{ background: activeWorkspace.color }}
                  >
                    <span className={classes.workspaceIcon}>
                      {resolveIcon(activeWorkspace.icon, 18, 1.65)}
                    </span>
                  </span>
                  <Box visibleFrom="sm" className={classes.workspaceText}>
                    <Text size="xs" fw={800} c="var(--mb-text-primary)" lh={1.1}>
                      {t(activeWorkspace.i18nKey)}
                    </Text>
                    <Text size="xs" c="var(--mb-text-muted)" lh={1.1}>
                      App workspace
                    </Text>
                  </Box>
                  <AnimatedIcon icon={ChevronDown} size={14} motion="float" />
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown className={classes.workspaceDropdown}>
                <Menu.Label>Apps</Menu.Label>
                {availableWorkspaces.map((workspace) => {
                  const active = workspace.key === activeWorkspace.key;
                  const path = workspaceStartPath(workspace) ?? `/apps/${workspace.key}`;
                  return (
                    <Menu.Item
                      key={workspace.key}
                      className={
                        active ? classes.workspaceMenuItemActive : classes.workspaceMenuItem
                      }
                      leftSection={
                        <span
                          className={classes.workspaceMenuIcon}
                          style={{ background: workspace.color }}
                        >
                          {resolveIcon(workspace.icon, 18, 1.65)}
                        </span>
                      }
                      rightSection={
                        active ? (
                          <Badge size="xs" variant="light">
                            Open
                          </Badge>
                        ) : undefined
                      }
                      onClick={() => handleWorkspaceSelect(workspace, path)}
                    >
                      <Box>
                        <Text size="sm" fw={700}>
                          {t(workspace.i18nKey)}
                        </Text>
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {workspace.description}
                        </Text>
                      </Box>
                    </Menu.Item>
                  );
                })}
              </Menu.Dropdown>
            </Menu>
          </Group>

          <Group gap="sm">
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

            <Indicator size={6} color="danger" offset={3} processing>
              <ActionIcon size="md" color="slate" variant="subtle" aria-label="Notifications">
                <AnimatedIcon icon={Bell} size={18} motion="pulse" />
              </ActionIcon>
            </Indicator>

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
                <Menu.Item leftSection={<AnimatedIcon icon={User} size={14} />}>Profile</Menu.Item>
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
      {!isAppLauncher && (
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
      )}

      {/* ── Main content ── */}
      <AppShell.Main>
        {!isAppLauncher && breadcrumbItems.length > 0 && (
          <Breadcrumbs
            mb="md"
            separator={<ChevronRight size={12} color="var(--mb-text-muted)" />}
            className={classes.breadcrumbs}
          >
            {breadcrumbItems.map((item, index) => (
              <Text
                key={item.href}
                size="xs"
                c={
                  index === breadcrumbItems.length - 1
                    ? "var(--mb-text-primary)"
                    : "var(--mb-text-secondary)"
                }
                fw={index === breadcrumbItems.length - 1 ? 600 : 400}
                className={index < breadcrumbItems.length - 1 ? classes.breadcrumbLink : undefined}
                onClick={index < breadcrumbItems.length - 1 ? () => navigate(item.href) : undefined}
              >
                {item.title}
              </Text>
            ))}
          </Breadcrumbs>
        )}

        <Suspense fallback={<PageSkeleton />}>
          <div className="page-content">
            <Outlet />
          </div>
        </Suspense>
      </AppShell.Main>
    </AppShell>
  );
}
