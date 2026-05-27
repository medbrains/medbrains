import { Anchor, Breadcrumbs, Card, Group, Text, ThemeIcon, Title } from "@mantine/core";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { AnimatedIcon } from "./AnimatedIcon";
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
  breadcrumbs?: BreadcrumbItem[];
}

export function PageHeader({
  title,
  subtitle,
  description,
  actions,
  icon,
  color,
  breadcrumbs,
}: PageHeaderProps) {
  return (
    <div className={styles.wrapper}>
      <Card component="header" className={styles.card} padding={0} radius="md" shadow="xs">
        <div className={styles.headerGlow} />
        {color ? (
          <div
            className={styles.accentBarColored}
            style={{
              background: `linear-gradient(90deg, var(--mantine-color-${color}-5), var(--mantine-color-${color}-3))`,
            }}
          />
        ) : (
          <div className={styles.accentBar} />
        )}

        <div className={styles.inner}>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <Breadcrumbs className={styles.breadcrumbs} separator="/">
              {breadcrumbs.map((item) =>
                item.href ? (
                  <Anchor href={item.href} key={item.label} size="xs" c="var(--mb-text-muted)">
                    {item.label}
                  </Anchor>
                ) : (
                  <Text key={item.label} size="xs" c="var(--mb-text-muted)">
                    {item.label}
                  </Text>
                ),
              )}
            </Breadcrumbs>
          )}

          <div className={styles.titleRow}>
            <div className={styles.titleGroup}>
              {icon && (
                <ThemeIcon
                  className={styles.iconTile}
                  variant="light"
                  color={color ?? "primary"}
                  size="var(--mb-page-header-icon-size)"
                  radius="lg"
                >
                  <span className={styles.iconMotion}>{icon}</span>
                </ThemeIcon>
              )}
              {!icon && (
                <ThemeIcon
                  className={styles.iconTile}
                  variant="light"
                  color={color ?? "primary"}
                  size="var(--mb-page-header-icon-size)"
                  radius="lg"
                >
                  <AnimatedIcon icon={Sparkles} size={15} motion="spark" />
                </ThemeIcon>
              )}
              <div className={styles.textBlock}>
                <Title order={1} size="h4" className={styles.title}>
                  {title}
                </Title>
                {subtitle && (
                  <Text size="xs" className={styles.subtitle}>
                    {subtitle}
                  </Text>
                )}
                {description && (
                  <Text size="xs" maw={600} className={styles.description}>
                    {description}
                  </Text>
                )}
              </div>
            </div>
            {actions && (
              <Group gap="xs" className={styles.actions}>
                {actions}
              </Group>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
