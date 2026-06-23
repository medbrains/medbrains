import { Anchor, Box, Text } from "@mantine/core";
import type { ReactNode } from "react";
import styles from "./breadcrumb.module.scss";

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
  /** Client-side navigation handler — preventDefault is applied for you. */
  onNavigate?: () => void;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /** Accessible name for the nav landmark — defaults to "Breadcrumb". */
  "aria-label"?: string;
}

/**
 * Carbon-style breadcrumb. Renders a real `nav > ol > li` trail with a "/"
 * separator; the final item is the current page — not a link — and carries
 * `aria-current="page"`. Ancestors are links.
 */
export function Breadcrumb({ items, ...rest }: BreadcrumbProps) {
  return (
    <Box component="nav" aria-label={rest["aria-label"] ?? "Breadcrumb"} className={styles.nav}>
      <Box component="ol" className={styles.list}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Box component="li" key={item.href ?? "current"} className={styles.item}>
              {item.href && !isLast ? (
                <Anchor
                  href={item.href}
                  size="sm"
                  className={styles.link}
                  onClick={
                    item.onNavigate
                      ? (e) => {
                          e.preventDefault();
                          item.onNavigate?.();
                        }
                      : undefined
                  }
                >
                  {item.label}
                </Anchor>
              ) : (
                <Text
                  component="span"
                  size="sm"
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? styles.current : styles.link}
                >
                  {item.label}
                </Text>
              )}
              {!isLast && (
                <Box component="span" aria-hidden className={styles.sep}>
                  /
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
Breadcrumb.displayName = "Breadcrumb";
