import "highlight.js/styles/github.css";
import { Box } from "@mantine/core";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import styles from "./response.module.scss";

interface ResponseProps {
  /** Markdown text (may be mid-stream / partial). */
  children: string;
  className?: string;
}

// Streamed assistant markdown. react-markdown does not render raw HTML by
// default; rehypeSanitize is belt-and-suspenders, then rehypeHighlight adds
// code-token classes (order matters — highlight runs after sanitize so its
// classes survive). Chosen over Tiptap-readonly: streaming-friendly + code HL.
export function Response({ children, className }: ResponseProps) {
  return (
    <Box className={className ? `${styles.response} ${className}` : styles.response}>
      <Markdown rehypePlugins={[rehypeSanitize, rehypeHighlight]}>{children}</Markdown>
    </Box>
  );
}
