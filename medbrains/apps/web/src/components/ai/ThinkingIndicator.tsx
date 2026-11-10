import { Box, Group, VisuallyHidden } from "@mantine/core";
import { Crab } from "@/components/ui";
import styles from "./thinking-indicator.module.scss";

const DOTS = ["a", "b", "c"] as const;

/**
 * Shown while the assistant works on a turn: the thinking crab and three
 * large pulsing dots. Announced once to screen readers; with reduced motion
 * the dots hold still and the crab shows its still art.
 */
export function ThinkingIndicator() {
  return (
    <Group gap="sm" wrap="nowrap" role="status" aria-live="polite" className={styles.root}>
      <Crab variant="chibi" state="thinking" size={44} />
      <Group gap={8} wrap="nowrap" aria-hidden="true" className={styles.dots}>
        {DOTS.map((d) => (
          <Box key={d} component="span" className={styles.dot} />
        ))}
      </Group>
      <VisuallyHidden>Assistant is thinking</VisuallyHidden>
    </Group>
  );
}
