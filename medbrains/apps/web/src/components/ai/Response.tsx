import { Box } from "@mantine/core";
import { lazy, Suspense } from "react";
import styles from "./response.module.scss";

// Screens that may show an AI answer (patient record, OPD dictation) import this; the renderer
// is fetched the first time an answer renders, not with the screen.
const MarkdownBody = lazy(() =>
  import("./markdown-body").then((m) => ({ default: m.MarkdownBody })),
);

interface ResponseProps {
  /** Markdown text (may be mid-stream / partial). */
  children: string;
  className?: string;
}

/**
 * Streamed assistant markdown. Until the renderer arrives the raw text shows, so an answer is
 * never blank. Chosen over Tiptap-readonly: streaming-friendly + code HL.
 */
export function Response({ children, className }: ResponseProps) {
  return (
    <Box className={className ? `${styles.response} ${className}` : styles.response}>
      <Suspense fallback={children}>
        <MarkdownBody>{children}</MarkdownBody>
      </Suspense>
    </Box>
  );
}
