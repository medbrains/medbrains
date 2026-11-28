import "highlight.js/styles/github.css";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";

/**
 * Renders markdown, sanitised, with code highlighting. Its own chunk: react-markdown and
 * highlight.js are ~280 kB that `Response` loads only when an AI answer is on screen.
 * react-markdown does not render raw HTML by default; rehypeSanitize is belt-and-suspenders,
 * then rehypeHighlight adds code-token classes (highlight runs after sanitize so its classes
 * survive).
 */
export function MarkdownBody({ children }: { children: string }) {
  return <Markdown rehypePlugins={[rehypeSanitize, rehypeHighlight]}>{children}</Markdown>;
}
