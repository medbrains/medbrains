import { Box, Code, CopyButton, Group, Text, Tooltip } from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { IconButton } from "@/components/ui";
import styles from "./code-block.module.scss";

export interface CodeBlockProps {
  code: string;
  language?: string;
}

/** A standalone code part (not embedded in markdown) with a copy affordance. */
export function CodeBlock({ code, language }: CodeBlockProps) {
  return (
    <Box className={styles.wrap}>
      <Group justify="space-between" className={styles.header} wrap="nowrap">
        <Text size="xs" c="dimmed" ff="monospace">
          {language ?? "text"}
        </Text>
        <CopyButton value={code} timeout={1500}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? "Copied" : "Copy code"} withArrow>
              <IconButton
                tone={copied ? "success" : "default"}
                size="sm"
                aria-label="Copy code"
                onClick={copy}
              >
                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
              </IconButton>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
      <Code block className={styles.code}>
        {code}
      </Code>
    </Box>
  );
}
