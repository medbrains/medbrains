import { Group, Menu, Tooltip, UnstyledButton } from "@mantine/core";
import { api } from "@medbrains/api";
import { IconHistory, IconMaximize, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { Crab, IconButton, Modal } from "@/components/ui";
import { useWhispers } from "@/hooks/useWhispers";
import styles from "./ai-assistant-mount.module.scss";
import { useAiAssistantStore } from "./assistant-store";
import { SseTransport } from "./transport/sse";
import type { ChatRole } from "./transport/types";
import { useAiChat } from "./useAiChat";
import { useDraggableFab } from "./useDraggableFab";

// The panel pulls in lottie-web, react-markdown and highlight.js. The mount
// lives in the app shell, so a static import put all three in the entry chunk
// for every user; load the panel the first time the assistant opens instead.
const AiChatPanel = lazy(() => import("./AiChatPanel").then((m) => ({ default: m.AiChatPanel })));

// ai-label-exempt: mounts AiChatPanel, which carries the label; history titles are the user's own question.
export interface AiAssistantMountProps {
  suggestions?: string[];
}

/**
 * The app-wide assistant, mounted ONCE in the shell. Renders a floating crab
 * launcher + a right-side drawer, and owns one shared conversation so it
 * persists across surfaces. Any component opens/asks it via `useAiAssistant()`.
 */
export function AiAssistantMount({ suggestions }: AiAssistantMountProps) {
  const isOpen = useAiAssistantStore((state) => state.isOpen);
  const close = useAiAssistantStore((state) => state.close);
  const toggle = useAiAssistantStore((state) => state.toggle);
  const pendingQuery = useAiAssistantStore((state) => state.pendingQuery);
  const consumeQuery = useAiAssistantStore((state) => state.consumeQuery);
  const context = useAiAssistantStore((state) => state.context);

  const navigate = useNavigate();
  const location = useLocation();
  const transport = useMemo(() => new SseTransport(), []);
  const controller = useAiChat({ transport, context });

  // When a surface calls ask(), flush the queued question into the shared thread.
  // Guarded on pendingQuery so re-renders don't re-send (it's cleared on consume).
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire on queue/open changes only
  useEffect(() => {
    if (pendingQuery && isOpen) {
      const query = consumeQuery();
      if (query) void controller.send(query);
    }
  }, [pendingQuery, isOpen]);

  // History list — eventually-consistent (fetches while the drawer is open;
  // a brand-new thread appears on the next refetch/focus).
  const { data: conversations = [] } = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: () => api.listAiConversations(),
    enabled: isOpen,
  });

  const openConversation = async (id: string) => {
    const loaded = await api.getAiConversationMessages(id);
    controller.hydrate(
      loaded.map((m) => ({
        id: m.id,
        role: m.role as ChatRole,
        content: m.content,
        createdAt: m.created_at,
        status: "complete" as const,
      })),
    );
    transport.setConversationId(id);
  };

  const newChat = () => {
    controller.reset();
    transport.setConversationId(undefined);
  };

  const headerAction = (
    <Group gap={4} wrap="nowrap">
      <IconButton
        tone="default"
        size="sm"
        aria-label="Open full-screen assistant"
        onClick={() => {
          close();
          navigate("/assistant");
        }}
      >
        <IconMaximize size={16} />
      </IconButton>
      <IconButton tone="default" size="sm" aria-label="New chat" onClick={newChat}>
        <IconPlus size={16} />
      </IconButton>
      <Menu position="bottom-end" width={280} withinPortal>
        <Menu.Target>
          <IconButton tone="default" size="sm" aria-label="Conversation history">
            <IconHistory size={16} />
          </IconButton>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Recent</Menu.Label>
          {conversations.length === 0 ? (
            <Menu.Item disabled>No conversations yet</Menu.Item>
          ) : (
            conversations.map((c) => (
              <Menu.Item key={c.id} onClick={() => void openConversation(c.id)}>
                {c.title ?? "Untitled"}
              </Menu.Item>
            ))
          )}
        </Menu.Dropdown>
      </Menu>
    </Group>
  );

  // Once opened, the panel stays mounted (keepMounted) so a half-typed prompt survives closing.
  const hasOpened = useRef(false);
  if (isOpen) hasOpened.current = true;

  const fab = useDraggableFab(toggle);
  useWhispers();

  // The full-screen page owns the assistant — no floating FAB/drawer there.
  if (location.pathname === "/assistant") {
    return null;
  }

  return (
    <>
      {!isOpen && (
        <Tooltip label="Ask MedBrains AI · drag to move" position="top" withArrow>
          <UnstyledButton
            className={styles.fab}
            aria-label="Open MedBrains assistant (drag to reposition)"
            {...fab}
          >
            <Crab variant="geometric" tone="onBrand" size={40} />
          </UnstyledButton>
        </Tooltip>
      )}
      <Modal
        opened={isOpen}
        onClose={close}
        size={440}
        withCloseButton={false}
        padding={0}
        keepMounted
        overlayProps={{ backgroundOpacity: 0.15 }}
        classNames={{ body: styles.drawerBody }}
      >
        {hasOpened.current && (
          <Suspense fallback={null}>
            <AiChatPanel
              controller={controller}
              context={context}
              suggestions={suggestions}
              headerAction={headerAction}
            />
          </Suspense>
        )}
      </Modal>
    </>
  );
}
