import { Box, Group, Stack, Text, ThemeIcon } from "@mantine/core";
import { useDebouncedCallback, useWindowEvent } from "@mantine/hooks";
import { soapNoteFormSchema } from "@medbrains/schemas";
import { IconAlertTriangle, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, RichTextEditor } from "@/components/ui";
import styles from "./soap-notes.module.scss";
import { SOAP_SECTIONS, type SoapSectionKey } from "./soap-sections";

/** Quiet time after the last keystroke before the note is saved. */
const AUTOSAVE_DELAY_MS = 1200;

export type SoapNoteValues = Record<SoapSectionKey, string>;

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "failed"; message: string };

interface SoapNoteEditorProps {
  initialValues: SoapNoteValues;
  /** Persist the whole note; resolves once the server has it. */
  onSave: (values: SoapNoteValues) => Promise<void>;
}

/** An editor's empty document is `<p></p>`: that is no text, not a note. */
export function soapPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** The first section over its length limit, if any. */
function lengthProblem(values: SoapNoteValues): string | null {
  for (const section of SOAP_SECTIONS) {
    const result = soapNoteFormSchema.shape[section.key].safeParse(values[section.key]);
    if (!result.success) return result.error.issues[0]?.message ?? "Section is too long";
  }
  return null;
}

/**
 * The visit's SOAP note, typed straight in and saved as the doctor goes:
 * there is no Save button to forget. A failed save says so and keeps the
 * text on screen with a retry.
 */
export function SoapNoteEditor({ initialValues, onSave }: SoapNoteEditorProps) {
  const { t } = useTranslation("clinical");
  const [values, setValues] = useState(initialValues);
  const [state, setState] = useState<SaveState>({ kind: "idle" });

  async function save(next: SoapNoteValues) {
    const problem = lengthProblem(next);
    if (problem) {
      setState({ kind: "failed", message: problem });
      return;
    }
    setState({ kind: "saving" });
    try {
      await onSave(next);
      setState({ kind: "saved", at: new Date() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "The server did not answer";
      setState({ kind: "failed", message });
    }
  }

  // Leaving the tab mid-pause still saves what was typed.
  const scheduleSave = useDebouncedCallback(save, {
    delay: AUTOSAVE_DELAY_MS,
    flushOnUnmount: true,
  });

  // Closing the browser mid-pause would lose the last words: ask first.
  useWindowEvent("beforeunload", (event) => {
    if (scheduleSave.isPending() || state.kind === "saving") event.preventDefault();
  });

  function change(key: SoapSectionKey, html: string) {
    const next = { ...values, [key]: html };
    setValues(next);
    scheduleSave(next);
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text fw={700} size="sm">
          Consultation note
        </Text>
        <SaveStatus state={state} onRetry={() => void save(values)} />
      </Group>
      {SOAP_SECTIONS.map((section) => (
        <Box
          key={section.key}
          className={styles.soapSection}
          style={{ borderLeftColor: `var(--mantine-color-${section.color}-5)` }}
        >
          <Group gap={8} mb={6}>
            <ThemeIcon variant="light" color={section.color} size={24}>
              <Text size="xs" fw={800} lh={1}>
                {section.letter}
              </Text>
            </ThemeIcon>
            <Box>
              <Text size="sm" fw={600} lh={1.2}>
                {t(section.labelKey)}
              </Text>
              <Text size="xs" c="dimmed" lh={1.2}>
                {section.formatHint}
              </Text>
            </Box>
          </Group>
          <RichTextEditor
            ariaLabel={t(section.placeholderKey)}
            value={values[section.key]}
            onChange={(html) => change(section.key, html)}
            minHeight={96}
            toolbar="compact"
          />
        </Box>
      ))}
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
            Saving…
          </Text>
        </>
      )}
      {state.kind === "saved" && (
        <>
          <IconCheck size={16} aria-hidden />
          <Text size="xs" c="dimmed">
            Saved {state.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
