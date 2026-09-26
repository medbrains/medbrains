import { Box, Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { type ReactNode, useId } from "react";
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
  /** TV/waiting-area mode — scales token numbers up for across-the-room reading. */
  display?: boolean;
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
  display = false,
}: TokenDashboardProps) {
  const serving = tokens.filter((token) => token.active);
  const waiting = tokens.filter((token) => !token.active);
  const className = display ? `${styles.board} ${styles.displayScale}` : styles.board;

  const sectionId = useId();
  return (
    <Box component="section" className={className} aria-label={title}>
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
            <Box>
              <Text className={styles.sectionLabel} id={`${sectionId}-serving`}>
                Now serving
              </Text>
              {/* A list of named items, so a screen reader — and a test — can
                  ask "is R-012 called?" rather than finding a number and a badge
                  in unrelated boxes. */}
              <SimpleGrid
                component="ul"
                aria-labelledby={`${sectionId}-serving`}
                cols={{ base: 1, sm: 2, lg: Math.min(serving.length, 3) }}
                spacing="md"
                className={styles.list}
              >
                {serving.map((token) => (
                  <Box
                    component="li"
                    key={token.id}
                    className={styles.hero}
                    aria-label={`Token ${token.tokenNumber}, ${token.status}`}
                    data-testid={`token-${token.tokenNumber}`}
                    data-status={token.status}
                  >
                    <Text className={styles.heroToken} textWrap="nowrap">
                      {token.tokenNumber}
                    </Text>
                    {(token.primary || token.meta) && (
                      <Stack gap={2}>
                        {token.primary && (
                          <Text className={styles.heroPrimary}>{token.primary}</Text>
                        )}
                        {token.meta && (
                          <Text className={styles.heroMeta} c="dimmed">
                            {token.meta}
                          </Text>
                        )}
                      </Stack>
                    )}
                  </Box>
                ))}
              </SimpleGrid>
            </Box>
          )}

          {waiting.length > 0 && (
            <Box>
              <Text className={styles.sectionLabel} id={`${sectionId}-waiting`}>
                Up next
              </Text>
              <SimpleGrid
                component="ul"
                aria-labelledby={`${sectionId}-waiting`}
                cols={{ base: 2, xs: 3, sm: 4, lg: columns }}
                spacing="sm"
                className={styles.list}
              >
                {waiting.map((token) => (
                  <Box
                    component="li"
                    key={token.id}
                    className={styles.card}
                    aria-label={`Token ${token.tokenNumber}, ${token.status}`}
                    data-testid={`token-${token.tokenNumber}`}
                    data-status={token.status}
                  >
                    {/* Stacked: side by side, the badge crushed to "W" on a TV column. */}
                    <Stack gap={4} align="flex-start">
                      {/* Mantine's own text-wrap outranks a nowrap in SCSS; the prop wins. */}
                      <Text className={styles.token} textWrap="nowrap">
                        {token.tokenNumber}
                      </Text>
                      <Badge tone={token.tone}>{token.status}</Badge>
                    </Stack>
                    {(token.primary || token.meta) && (
                      <Text className={styles.meta} c="dimmed" lineClamp={1} mt={4}>
                        {token.primary ?? token.meta}
                      </Text>
                    )}
                  </Box>
                ))}
              </SimpleGrid>
            </Box>
          )}
        </Stack>
      )}
    </Box>
  );
}
