import { Box, Group, Stack, Text } from "@mantine/core";
import { useDebouncedCallback, useWindowEvent } from "@mantine/hooks";
import type { NoteSection } from "@medbrains/types";
import { IconAlertTriangle, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { Button, RichTextEditor } from "@/components/ui";
import styles from "../soap-notes.module.scss";

/** Quiet time after the last keystroke before the draft is saved. */
const AUTOSAVE_DELAY_MS = 1200;
/** The server's limit per section (crates/medbrains-clinical-notes model.rs). */
const SECTION_MAX_CHARS = 20_000;

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "failed"; message: string };

interface NoteDraftEditorProps {
  initialSections: NoteSection[];
  /** Persist the draft; resolves once the server has it. */
  onSave: (sections: NoteSection[]) => Promise<void>;
  /** Sign the note — offered when the author may sign; resolves when done. */
  onSign?: () => Promise<void>;
}

/**
 * The author's draft, typed straight in and saved as they go — nothing to
 * forget to save before signing. A failed save says so and keeps the text
 * on screen with a retry.
 */
export function NoteDraftEditor({ initialSections, onSave, onSign }: NoteDraftEditorProps) {
  const [sections, setSections] = useState(initialSections);
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const inFlight = useRef<Promise<boolean>>(Promise.resolve(true));
  const [signing, setSigning] = useState(false);

  function save(next: NoteSection[]): Promise<boolean> {
    inFlight.current = persist(next);
    return inFlight.current;
  }

  async function persist(next: NoteSection[]): Promise<boolean> {
    const long = next.find((s) => s.text.length > SECTION_MAX_CHARS);
    if (long) {
      setState({ kind: "failed", message: `${long.title} is too long` });
      return false;
    }
    setState({ kind: "saving" });
    try {
      await onSave(next);
      setState({ kind: "saved", at: new Date() });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The server did not answer";
      setState({ kind: "failed", message });
      return false;
    }
  }

  // Signing what the server has, not what is on screen, would sign a note
  // without its last words: save anything pending first, and sign only once
  // it is in.
  async function sign() {
    setSigning(true);
    try {
      if (scheduleSave.isPending()) scheduleSave.flush();
      if (await inFlight.current) await onSign?.();
    } finally {
      setSigning(false);
    }
  }

  // Leaving the tab mid-pause still saves what was typed.
  const scheduleSave = useDebouncedCallback((next: NoteSection[]) => void save(next), {
    delay: AUTOSAVE_DELAY_MS,
    flushOnUnmount: true,
  });

  // Closing the browser mid-pause would lose the last words: ask first.
  useWindowEvent("beforeunload", (event) => {
    if (scheduleSave.isPending() || state.kind === "saving") event.preventDefault();
  });

  function change(code: string, html: string) {
    const next = sections.map((s) => (s.code === code ? { ...s, text: html } : s));
    setSections(next);
    scheduleSave(next);
  }

  return (
    <Stack gap="sm">
      <Group justify="flex-end">
        <SaveStatus state={state} onRetry={() => void save(sections)} />
      </Group>
      {sections.map((section) => (
        <Box key={section.code} className={styles.soapSection}>
          <Text size="sm" fw={600} mb={6}>
            {section.title}
          </Text>
          <RichTextEditor
            ariaLabel={section.title}
            value={section.text}
            onChange={(html) => change(section.code, html)}
            minHeight={80}
            toolbar="compact"
          />
        </Box>
      ))}
      {onSign && (
        <Group>
          <Button tone="primary" size="xs" loading={signing} onClick={() => void sign()}>
            Sign
          </Button>
        </Group>
      )}
    </Stack>
  );
}

function SaveStatus({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  return (
    <Group gap={6} aria-live="polite">
      {state.kind === "saving" && (
        <>
          <IconLoader2 size={16} aria-hidden />
          <Text size="xs" c="dimmed">
            Saving draft…
          </Text>
        </>
      )}
      {state.kind === "saved" && (
        <>
          <IconCheck size={16} aria-hidden />
          <Text size="xs" c="dimmed">
            Draft saved {state.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </>
      )}
      {state.kind === "failed" && (
        <>
          <IconAlertTriangle size={16} aria-hidden />
          <Text size="xs" c="var(--mb-support-error)">
            Not saved: {state.message}
          </Text>
          <Button tone="tertiary" size="xs" onClick={onRetry}>
            Retry
          </Button>
        </>
      )}
    </Group>
  );
}
