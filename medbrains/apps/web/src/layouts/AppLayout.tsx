import {
  ActionIcon,
  AppShell,
  Avatar,
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
import { api } from "@medbrains/api";
import { Outlet, useLocation, useNavigate } from "react-router";
import {
  IconBell,
  IconChevronRight,
  IconLanguage,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLogout,
  IconSearch,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageSkeleton } from "../components/PageSkeleton";
import { NAV_GROUPS, resolveIcon, buildPathLabels, type NavItemConfig } from "../config/navigation";
import classes from "./AppLayout.module.scss";

// ── Resolved nav item (with ReactNode icon + label string) ──

interface ResolvedNavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  requiredPermission?: string;
  children?: ResolvedNavItem[];
}

const RAIL_WIDTH = 56;
const EXPANDED_WIDTH = 240;

export function AppLayout() {
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const { t } = useTranslation("nav");

  const isExpanded = sidebarOpen;
  const navbarWidth = isExpanded ? EXPANDED_WIDTH : RAIL_WIDTH;

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    clearAuth();
    navigate("/login");
  };

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
    closeMobile();
  }, [navigate, closeMobile]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((p) => {
      return !p;
    });
  }, []);

  const userInitial = user?.full_name?.charAt(0)?.toUpperCase() ?? "U";

  // Resolve config items to renderable items with translated labels
  const resolveItem = useCallback((cfg: NavItemConfig, childSize = false): ResolvedNavItem => ({
    label: t(cfg.i18nKey),
    path: cfg.path,
    icon: resolveIcon(cfg.icon, childSize ? 16 : 20, 1.5),
    requiredPermission: cfg.requiredPermission,
    children: cfg.children?.map((c) => resolveItem(c, true)),
  }), [t]);

  // Build nav groups from static config
  const navGroups = useMemo(() =>
    NAV_GROUPS.map((group) => ({
      key: group.key,
      items: group.items.map((item) => resolveItem(item)),
    })),
  [resolveItem]);

  // Breadcrumbs
  const pathLabelMap = useMemo(() => buildPathLabels(NAV_GROUPS, t), [t]);
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const breadcrumbItems = pathSegments.map((_, index) => {
    const href = `/${pathSegments.slice(0, index + 1).join("/")}`;
    const segment = pathSegments[index] ?? "";
    const title = pathLabelMap[href] ?? segment
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return { title, href };
  });

  const isActive = (path: string) => location.pathname === path;
  const isAdminActive = location.pathname.startsWith("/admin");

  // ── Filter nav items by permission ──
  const filterItem = (item: ResolvedNavItem): boolean =>
    !item.requiredPermission || hasPermission(item.requiredPermission);

  // ── Render a single rail icon ──
  const renderRailItem = (item: ResolvedNavItem, active: boolean) => (
    <Tooltip key={item.path} label={item.label} position="right" withArrow>
      <UnstyledButton
        className={`${classes.railItem} ${active ? classes.railItemActive : ""}`}
        onClick={() => handleNavigate(item.path)}
      >
        {item.icon}
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
            leftSection={item.icon}
            active={isAdminActive}
            defaultOpened={isAdminActive}
            className={isAdminActive ? classes.expandedItemActive : classes.expandedItem}
          >
            {visibleChildren.map((child) => (
              <NavLink
                key={child.path}
                label={child.label}
                leftSection={child.icon}
                active={isActive(child.path)}
                onClick={() => handleNavigate(child.path)}
                className={isActive(child.path) ? classes.expandedChildActive : classes.expandedChild}
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
        leftSection={item.icon}
        active={active}
        onClick={() => handleNavigate(item.path)}
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
          {group.items.map(renderExpandedItem)}
        </div>
      ));
    }

    // Rail mode
    return groups.map((group, gi) => (
      <div key={group.key} className={classes.railGroup}>
        {gi > 0 && <Divider my={4} className={classes.railDivider} />}
        {group.items.map((item) => {
          const active = item.children ? isAdminActive : isActive(item.path);
          return renderRailItem(item, active);
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
      padding="xl"
      transitionDuration={200}
      transitionTimingFunction="ease"
    >
      {/* ── Header ── */}
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
            <Group
              gap={8}
              className={classes.logoArea}
              onClick={() => navigate("/dashboard")}
            >
              <img src="/logo/medbrains-mark.svg" alt="" width={30} height={30} style={{ borderRadius: 8 }} />
              <Text size="sm" fw={700} c="var(--mb-text-primary)" style={{ letterSpacing: "-0.02em" }}>
                MedBrains
              </Text>
              <Text size="xs" c="var(--mb-text-muted)" fw={500} visibleFrom="md">
                HMS
              </Text>
            </Group>
          </Group>

          <Group gap="sm">
            {/* Spotlight trigger */}
            <UnstyledButton onClick={spotlight.open} className={classes.searchTrigger} visibleFrom="sm">
              <Group gap={6}>
                <IconSearch size={14} stroke={1.5} />
                <Text size="xs" c="dimmed">Search...</Text>
                <Kbd size="xs">⌘K</Kbd>
              </Group>
            </UnstyledButton>
            <ActionIcon size="md" color="slate" variant="subtle" hiddenFrom="sm" onClick={spotlight.open}>
              <IconSearch size={18} stroke={1.5} />
            </ActionIcon>

            <Indicator size={6} color="danger" offset={3} processing>
              <ActionIcon size="md" color="slate" variant="subtle">
                <IconBell size={18} stroke={1.5} />
              </ActionIcon>
            </Indicator>

            <Menu shadow="md" width={160} position="bottom-end">
              <Menu.Target>
                <Tooltip label="Language" withArrow>
                  <ActionIcon size="md" color="slate" variant="subtle">
                    <IconLanguage size={18} stroke={1.5} />
                  </ActionIcon>
                </Tooltip>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Language</Menu.Label>
                <Menu.Item leftSection={<Text size="xs" fw={600}>EN</Text>}>
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
                <Menu.Item leftSection={<IconUser size={14} stroke={1.5} />}>
                  Profile
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconSettings size={14} stroke={1.5} />}
                  onClick={() => navigate("/admin/settings")}
                >
                  Settings
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="danger"
                  leftSection={<IconLogout size={14} stroke={1.5} />}
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
              <UnstyledButton className={classes.expandedItem} onClick={toggleSidebar} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 8 }}>
                <IconLayoutSidebarLeftCollapse size={18} stroke={1.5} />
                <Text size="xs" c="var(--mb-text-muted)">{t("collapse")}</Text>
              </UnstyledButton>
            ) : (
              <Tooltip label={t("expand")} position="right" withArrow>
                <UnstyledButton className={classes.railItem} onClick={toggleSidebar}>
                  <IconLayoutSidebarLeftExpand size={20} stroke={1.5} />
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
        {breadcrumbItems.length > 0 && (
          <Breadcrumbs
            mb="md"
            separator={<IconChevronRight size={12} color="var(--mb-text-muted)" />}
            className={classes.breadcrumbs}
          >
            {breadcrumbItems.map((item, index) => (
              <Text
                key={item.href}
                size="xs"
                c={index === breadcrumbItems.length - 1 ? "var(--mb-text-primary)" : "var(--mb-text-secondary)"}
                fw={index === breadcrumbItems.length - 1 ? 600 : 400}
                className={index < breadcrumbItems.length - 1 ? classes.breadcrumbLink : undefined}
                onClick={
                  index < breadcrumbItems.length - 1
                    ? () => navigate(item.href)
                    : undefined
                }
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
