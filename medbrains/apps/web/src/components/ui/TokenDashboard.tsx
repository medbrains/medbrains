import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "./Badge";
import styles from "./token-dashboard.module.scss";

/** A single token on the board. Any module maps its queue rows into this. */
export interface TokenItem {
  id: string;
  /** Big token number, e.g. "T-014" or "A12". */
  tokenNumber: string;
  /** Human status label, e.g. "Waiting", "Called", "In progress". */
  status: string;
  /** Semantic tone for the status. */
  tone: BadgeTone;
  /** Primary line — counter/room, or patient name where allowed. */
  primary?: string;
  /** Secondary meta — department, priority, wait estimate. */
  meta?: string;
  /** Currently being served — shown large in the "Now serving" hero row. */
  active?: boolean;
}

export interface TokenDashboardProps {
  /** Board heading, e.g. "OPD Queue", "Pharmacy", "Lab Counter 2". */
  title: string;
  tokens: TokenItem[];
  /** Right-side header slot — last-updated text, live badge, controls. */
  headerRight?: ReactNode;
  /** Columns for the "Up next" grid at the largest breakpoint (default 6). */
  columns?: number;
  emptyLabel?: string;
}

/**
 * Module-agnostic token board. Presentational — feed it a `TokenItem[]` from
 * any queue (OPD, lab, radiology, pharmacy, billing, emergency, IPD…). Active
 * tokens lead the board as a large "Now serving" hero; the rest follow as a
 * compact "Up next" grid. Carbon-clean, display-friendly, driven by theme tokens.
 */
export function TokenDashboard({
  title,
  tokens,
  headerRight,
  columns = 6,
  emptyLabel = "No tokens in the queue.",
}: TokenDashboardProps) {
  const serving = tokens.filter((token) => token.active);
  const waiting = tokens.filter((token) => !token.active);

  return (
    <section className={styles.board} aria-label={title}>
      <Group justify="space-between" align="center" className={styles.header}>
        <Text className={styles.title}>{title}</Text>
        {headerRight}
      </Group>

      {tokens.length === 0 ? (
        <Text c="dimmed" ta="center" className={styles.empty}>
          {emptyLabel}
        </Text>
      ) : (
        <Stack gap="lg">
          {serving.length > 0 && (
            <div>
              <Text className={styles.sectionLabel}>Now serving</Text>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: Math.min(serving.length, 3) }} spacing="md">
                {serving.map((token) => (
                  <div key={token.id} className={styles.hero}>
                    <Text className={styles.heroToken}>{token.tokenNumber}</Text>
                    {(token.primary || token.meta) && (
                      <Stack gap={2}>
                        {token.primary && <Text className={styles.heroPrimary}>{token.primary}</Text>}
                        {token.meta && (
                          <Text className={styles.heroMeta} c="dimmed">
                            {token.meta}
                          </Text>
                        )}
                      </Stack>
                    )}
                  </div>
                ))}
              </SimpleGrid>
            </div>
          )}

          {waiting.length > 0 && (
            <div>
              <Text className={styles.sectionLabel}>Up next</Text>
              <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, lg: columns }} spacing="sm">
                {waiting.map((token) => (
                  <div key={token.id} className={styles.card}>
                    <Group justify="space-between" align="center" wrap="nowrap">
                      <Text className={styles.token}>{token.tokenNumber}</Text>
                      <Badge tone={token.tone}>{token.status}</Badge>
                    </Group>
                    {(token.primary || token.meta) && (
                      <Text className={styles.meta} c="dimmed" lineClamp={1} mt={4}>
                        {token.primary ?? token.meta}
                      </Text>
                    )}
                  </div>
                ))}
              </SimpleGrid>
            </div>
          )}
        </Stack>
      )}
    </section>
  );
}
