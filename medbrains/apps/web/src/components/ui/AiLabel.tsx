import { Box, Popover, Stack, Text, UnstyledButton } from "@mantine/core";
import { type ReactNode, useState } from "react";
import styles from "./ai-label.module.scss";

export type AiLabelSize = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * Visual treatment so the label reads on any surface:
 * - `gradient` (default) — the signature violet→blue AI gradient slug.
 * - `outline` — hairline border, ink "AI" (dense tables / inputs).
 * - `filled` — solid dark fill, white "AI" (inverse / dark surfaces).
 * - `active` — brand-accent border (selected / focused state).
 */
export type AiLabelVariant = "gradient" | "outline" | "filled" | "active";

/** Content of the AI explainability popover (Carbon AI Label callout). */
export interface AiLabelExplainer {
  /** Heading — defaults to "AI supported". */
  title?: string;
  /** What the AI does here and how it's governed. */
  description: ReactNode;
  /** Optional model identifier shown as metadata. */
  model?: string;
}

export interface AiLabelProps {
  size?: AiLabelSize;
  variant?: AiLabelVariant;
  /** Optional trailing text after the "AI" slug, e.g. "suggested". */
  text?: string;
  /**
   * Explainability popover content. When provided the label is an interactive
   * button that reveals the callout; omit it for a static marker.
   */
  explainer?: AiLabelExplainer;
  "aria-label"?: string;
}

/**
 * Carbon-style **AI Label** — marks a surface as AI-supported and (optionally)
 * reveals an explainability popover. Use it ONLY where AI genuinely assists
 * (per Carbon guidance); the violet→blue `--mb-gradient-ai` is reserved for
 * exactly this, never generic decoration.
 */
export function AiLabel({ size = "sm", variant = "gradient", text, explainer, ...rest }: AiLabelProps) {
  const [opened, setOpened] = useState(false);

  const slug = (
    <Box component="span" className={`${styles.label} ${styles[size]} ${styles[variant]}`}>
      <Box component="span" className={styles.ai}>
        AI
      </Box>
      {text && (
        <Box component="span" className={styles.text}>
          {text}
        </Box>
      )}
    </Box>
  );

  if (!explainer) {
    return (
      <Box component="span" className={styles.static} aria-label={rest["aria-label"] ?? "AI supported"}>
        {slug}
      </Box>
    );
  }

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      width={280}
      withArrow
      shadow="md"
    >
      <Popover.Target>
        <UnstyledButton
          className={styles.trigger}
          onClick={() => setOpened((o) => !o)}
          aria-label={rest["aria-label"] ?? "About AI support"}
          aria-expanded={opened}
        >
          {slug}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap={6}>
          <Box component="span" className={styles.popHeader}>
            <Box component="span" className={styles.ai}>
              AI
            </Box>
            <Text fw={600} size="sm">
              {explainer.title ?? "AI supported"}
            </Text>
          </Box>
          <Text size="xs" c="dimmed">
            {explainer.description}
          </Text>
          {explainer.model && (
            <Text size="xs" ff="monospace" c="dimmed">
              model · {explainer.model}
            </Text>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
AiLabel.displayName = "AiLabel";
