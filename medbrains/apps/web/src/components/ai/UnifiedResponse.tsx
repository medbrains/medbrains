import { Anchor, Box, Group, Image, List, Stack, Text, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconAlertTriangle, IconChevronRight, IconTool } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { CodeBlock } from "./CodeBlock";
import { Response } from "./Response";
import type { ChatMessage, ChatPart, ChatToolCall } from "./transport/types";
import { messageParts } from "./transport/types";
import styles from "./unified-response.module.scss";

/** A renderer for one part type. Consumers override any of these. */
export type PartRenderers = Partial<{
  markdown: (part: Extract<ChatPart, { type: "markdown" }>) => ReactNode;
  code: (part: Extract<ChatPart, { type: "code" }>) => ReactNode;
  reasoning: (part: Extract<ChatPart, { type: "reasoning" }>) => ReactNode;
  tool: (part: Extract<ChatPart, { type: "tool" }>) => ReactNode;
  sources: (part: Extract<ChatPart, { type: "sources" }>) => ReactNode;
  image: (part: Extract<ChatPart, { type: "image" }>) => ReactNode;
}>;

export interface UnifiedResponseProps {
  message: ChatMessage;
  /** Per-part renderer overrides. */
  renderers?: PartRenderers;
  /** Renderers for `custom` parts, keyed by `kind` (clinical widgets etc.). */
  customRenderers?: Record<string, (data: unknown) => ReactNode>;
}

/**
 * The unified assistant renderer: dispatches each message part to its renderer
 * so a turn is never limited to a single markdown blob. Markdown is just one
 * registered type; `custom` parts route by `kind` so app surfaces can register
 * clinical widgets (patient card, lab result…) without touching the core.
 */
export function UnifiedResponse({ message, renderers, customRenderers }: UnifiedResponseProps) {
  const parts = messageParts(message);
  return (
    <Stack gap="xs">
      {parts.map((part, index) => (
        <PartView
          // biome-ignore lint/suspicious/noArrayIndexKey: parts are an ordered stream, index is stable per turn
          key={index}
          part={part}
          renderers={renderers}
          customRenderers={customRenderers}
        />
      ))}
    </Stack>
  );
}

function PartView({
  part,
  renderers,
  customRenderers,
}: {
  part: ChatPart;
  renderers?: PartRenderers;
  customRenderers?: Record<string, (data: unknown) => ReactNode>;
}) {
  switch (part.type) {
    case "markdown":
      return <>{renderers?.markdown?.(part) ?? <Response>{part.text}</Response>}</>;
    case "code":
      return (
        <>{renderers?.code?.(part) ?? <CodeBlock code={part.code} language={part.language} />}</>
      );
    case "reasoning":
      return <>{renderers?.reasoning?.(part) ?? <ReasoningView text={part.text} />}</>;
    case "tool":
      return <>{renderers?.tool?.(part) ?? <ToolView toolCall={part.toolCall} />}</>;
    case "sources":
      return (
        <>
          {renderers?.sources?.(part) ?? (
            <List size="xs" spacing={2} className={styles.sources}>
              {part.sources.map((s) => (
                <List.Item key={s.id}>
                  {s.url ? (
                    <Anchor href={s.url} target="_blank" rel="noopener" size="xs">
                      {s.title}
                    </Anchor>
                  ) : (
                    <Text size="xs">{s.title}</Text>
                  )}
                </List.Item>
              ))}
            </List>
          )}
        </>
      );
    case "image":
      return (
        <>{renderers?.image?.(part) ?? <Image src={part.url} alt={part.alt ?? ""} radius="sm" />}</>
      );
    case "custom": {
      const render = customRenderers?.[part.kind];
      return render ? render(part.data) : null;
    }
    default:
      return null;
  }
}

const TOOL_LABELS: Record<string, string> = {
  check_drug_safety: "Drug safety check",
  draft_prescription: "Prescription draft",
};

/** Read the block decision out of a tool result (shape varies by tool). */
function toolResultInfo(result: unknown): { blocked: boolean; message?: string } {
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    return {
      blocked: r.decision === "blocked" || r.safe === false,
      message: typeof r.message === "string" ? r.message : undefined,
    };
  }
  return { blocked: false };
}

/** A tool-call chip — turns prominently red when the server BLOCKED the action. */
function ToolView({ toolCall }: { toolCall: ChatToolCall }) {
  const { blocked, message } = toolResultInfo(toolCall.result);
  const label = TOOL_LABELS[toolCall.name] ?? toolCall.name;
  const running = toolCall.status === "running" || toolCall.status === "pending";

  return (
    <Box className={blocked ? styles.toolBlocked : styles.tool}>
      <Group gap={8} wrap="nowrap">
        {blocked ? <IconAlertTriangle size={15} /> : <IconTool size={14} />}
        <Text size="xs" fw={blocked ? 700 : 500}>
          {label}
        </Text>
        <Badge tone={blocked ? "danger" : running ? "neutral" : "success"} size="sm">
          {blocked ? "BLOCKED" : toolCall.status}
        </Badge>
      </Group>
      {blocked && message && (
        <Text size="xs" mt={4} className={styles.toolBlockedMsg}>
          {message}
        </Text>
      )}
    </Box>
  );
}

function ReasoningView({ text }: { text: string }) {
  const [open, { toggle }] = useDisclosure(false);
  return (
    <Box className={styles.reasoning}>
      <UnstyledButton className={styles.reasoningToggle} onClick={toggle} aria-expanded={open}>
        <IconChevronRight
          size={13}
          style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 120ms" }}
        />
        <Text size="xs" c="dimmed">
          Reasoning
        </Text>
      </UnstyledButton>
      {open && (
        <Text size="xs" c="dimmed" className={styles.reasoningBody}>
          {text}
        </Text>
      )}
    </Box>
  );
}
