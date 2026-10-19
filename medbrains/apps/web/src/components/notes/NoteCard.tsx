import { Anchor, Group, Stack, Text } from "@mantine/core";
import type { StickyNote } from "@medbrains/types";
import { IconBell, IconCircleCheck, IconPin } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Badge, Card } from "@/components/ui";
import classes from "./notes.module.scss";

interface NoteCardProps {
  note: StickyNote;
  /** Show the author line — off on the reader's own notes. */
  showAuthor?: boolean;
  actions?: ReactNode;
}

const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

/** "From notification" with a link to the item, and when it resolved itself. */
function SourceLine({ note }: { note: StickyNote }) {
  return (
    <Group gap="xs">
      <Badge tone="info" leftSection={<IconBell size={12} aria-hidden />}>
        From notification
      </Badge>
      {note.source_url && (
        <Anchor component={Link} to={note.source_url} size="xs">
          Open the item
        </Anchor>
      )}
      {note.resolved_at ? (
        <Badge tone="success" leftSection={<IconCircleCheck size={12} aria-hidden />}>
          {`Resolved automatically ${when.format(new Date(note.resolved_at))}`}
        </Badge>
      ) : (
        note.auto_resolve && (
          <Text size="xs" c="dimmed">
            Clears itself when resolved
          </Text>
        )
      )}
    </Group>
  );
}

/** One note, in its colour, with where it is shared and when it clears. */
export function NoteCard({ note, showAuthor = true, actions }: NoteCardProps) {
  return (
    <Card
      className={classes.note}
      bg={`var(--mantine-color-${note.colour}-light)`}
      aria-label={note.pinned ? "Pinned note" : "Note"}
    >
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Text size="sm" className={classes.body}>
            {note.body}
          </Text>
          {note.pinned && <IconPin size={16} aria-label="Pinned" />}
        </Group>
        {note.is_system && <SourceLine note={note} />}
        {note.shares.length > 0 && (
          <Group gap={4}>
            {note.shares.map((s) => (
              <Badge key={s.id} tone="neutral">
                {s.label}
              </Badge>
            ))}
          </Group>
        )}
        <Group justify="space-between" gap="xs">
          <Text size="xs" c="dimmed">
            {showAuthor ? `${note.author_name} · ` : ""}
            {when.format(new Date(note.updated_at))}
            {note.expires_at ? ` · clears ${when.format(new Date(note.expires_at))}` : ""}
          </Text>
          {actions && <Group gap={4}>{actions}</Group>}
        </Group>
      </Stack>
    </Card>
  );
}
