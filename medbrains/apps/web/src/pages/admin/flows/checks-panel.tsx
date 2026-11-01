/**
 * The checks panel (RFC §11.3), always in view: each rule of §11.2 as a
 * sentence with its verdict in words. Choosing a failing rule highlights
 * its stations on the canvas. The server computed these; an error never
 * reads as "all checks pass".
 */
import { Group, Stack, Text, UnstyledButton } from "@mantine/core";
import type { FlowCheck } from "@medbrains/types";
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { Alert, Button, Panel, ThemeIcon } from "@/components/ui";
import { checkLines, groupProblems } from "./builder";
import styles from "./builder.module.scss";

export interface ChecksPanelProps {
  checks: FlowCheck[] | null;
  /** The last save or load failed: the checks shown may be out of date. */
  error: string | null;
  onRetry: () => void;
  onHighlight: (stations: string[]) => void;
}

export function ChecksPanel({ checks, error, onRetry, onHighlight }: ChecksPanelProps) {
  const lines = checks ? checkLines(checks) : [];
  const failing = lines.filter((l) => !l.pass).length;
  return (
    <Panel
      title="Checks"
      description={
        error
          ? "Not checked: the server could not be reached."
          : !checks
            ? "Checking: the server runs every check when the draft saves."
            : failing === 0
              ? "Every check passes."
              : `${failing} of ${lines.length} checks fail.`
      }
    >
      <Stack gap="xs">
        {error && (
          <Alert tone="danger" title="These checks could not be run">
            <Stack gap="xs">
              <Text size="sm">{error}</Text>
              <Group>
                <Button tone="secondary" size="xs" onClick={onRetry}>
                  Try again
                </Button>
              </Group>
            </Stack>
          </Alert>
        )}
        {!error &&
          lines.map((l) => (
            <UnstyledButton
              key={l.rule}
              className={styles.checkLine}
              onClick={() => onHighlight(l.stations)}
              disabled={l.pass}
              aria-label={`${l.verdict}: ${l.sentence}${l.pass ? "" : ". Show on the map"}`}
            >
              <Group gap="xs" wrap="nowrap" align="flex-start">
                <ThemeIcon
                  size={24}
                  variant="light"
                  tone={l.pass ? "success" : "danger"}
                  aria-hidden
                >
                  {l.pass ? <IconCircleCheck size={16} /> : <IconCircleX size={16} />}
                </ThemeIcon>
                <Stack gap={2}>
                  <Text size="sm">
                    <b>{l.verdict}:</b> {l.sentence}
                  </Text>
                  {groupProblems(l.problems).map((g) => (
                    <Text key={g.issue} size="xs" c="dimmed">
                      {g.count > 1
                        ? `${capitalise(g.issue)} (${g.count} patient types, e.g. ${g.examples.join("; ")})`
                        : g.examples.length > 0
                          ? `${g.examples[0]}: ${g.issue}`
                          : capitalise(g.issue)}
                    </Text>
                  ))}
                </Stack>
              </Group>
            </UnstyledButton>
          ))}
      </Stack>
    </Panel>
  );
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
