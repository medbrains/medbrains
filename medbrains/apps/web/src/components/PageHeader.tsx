import { Group, Text, ThemeIcon, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { useLocation } from "react-router";
import { ModuleBadge } from "@/components/ui";
import { matchModuleBadge } from "@/config/navigation";
import styles from "./page-header.module.scss";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  actions?: ReactNode;
  icon?: ReactNode;
  color?: string;
  /** @deprecated The global breadcrumb in the app header is the single source;
   *  per-page breadcrumbs here caused a duplicate trail. No longer rendered. */
  breadcrumbs?: BreadcrumbItem[];
  /** Show the bottom hairline rule. Off when the page's next element is its own
   *  bordered surface (avoids a double divider). Default true. */
  divider?: boolean;
}

/**
 * Console-style page header: a flat title row over a hairline rule,
 * no gradient accent or decorative glow. Icon is shown only when the
 * page supplies one.
 */
export function PageHeader({
  title,
  subtitle,
  description,
  actions,
  icon,
  color,
  divider = true,
}: PageHeaderProps) {
  const { pathname } = useLocation();
  const badge = matchModuleBadge(pathname);
  return (
    <header className={divider ? styles.card : `${styles.card} ${styles.noDivider}`}>
      <div className={styles.titleRow}>
        <Group gap="sm" wrap="nowrap" align="center">
          {badge ? (
            <ModuleBadge abbr={badge.abbr} color={badge.color} size={34} title={title} />
          ) : (
            icon && (
              <ThemeIcon variant="light" color={color ?? "primary"} size={34} radius="sm">
                {icon}
              </ThemeIcon>
            )
          )}
          <div>
            <Title order={1} className={styles.title}>
              {title}
            </Title>
            {subtitle && (
              <Text size="sm" c="var(--mb-text-secondary)">
                {subtitle}
              </Text>
            )}
            {description && (
              <Text size="xs" maw={640} c="var(--mb-text-muted)">
                {description}
              </Text>
            )}
          </div>
        </Group>
        {actions && (
          <Group gap="xs" className={styles.actions}>
            {actions}
          </Group>
        )}
      </div>
    </header>
  );
}
