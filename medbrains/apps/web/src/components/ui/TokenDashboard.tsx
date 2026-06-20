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
  /** Primary line under the token — counter/room, or patient name where allowed. */
  primary?: string;
  /** Secondary meta line — department, priority, wait estimate. */
  meta?: string;
  /** Emphasise (e.g. the token currently being called). */
  active?: boolean;
}

export interface TokenDashboardProps {
  /** Board heading, e.g. "OPD Queue", "Pharmacy", "Lab Counter 2". */
  title: string;
  tokens: TokenItem[];
  /** Right-side header slot — last-updated text, live badge, controls. */
  headerRight?: ReactNode;
  /** Columns at the largest breakpoint (default 4). */
  columns?: number;
  emptyLabel?: string;
}

/**
 * Module-agnostic token board. Presentational only — feed it a `TokenItem[]`
 * from any queue (OPD, lab, radiology, pharmacy, billing, emergency, IPD…).
 * Large, display-friendly cards; the active token is emphasised. Carbon-clean,
 * driven entirely by theme tokens.
 */
export function TokenDashboard({
  title,
  tokens,
  headerRight,
  columns = 4,
  emptyLabel = "No tokens in the queue.",
}: TokenDashboardProps) {
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
        <SimpleGrid cols={{ base: 1, xs: 2, sm: 3, lg: columns }} spacing="sm">
          {tokens.map((token) => (
            <div key={token.id} className={styles.card} data-active={token.active || undefined}>
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Text className={styles.token}>{token.tokenNumber}</Text>
                <Badge tone={token.tone}>{token.status}</Badge>
              </Group>
              {(token.primary || token.meta) && (
                <Stack gap={2} mt={6}>
                  {token.primary && <Text className={styles.primary}>{token.primary}</Text>}
                  {token.meta && (
                    <Text className={styles.meta} c="dimmed">
                      {token.meta}
                    </Text>
                  )}
                </Stack>
              )}
            </div>
          ))}
        </SimpleGrid>
      )}
    </section>
  );
}
