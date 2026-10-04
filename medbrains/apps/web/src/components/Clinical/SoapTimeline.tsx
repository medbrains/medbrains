import { Badge, Card, Group, Tabs, Text, Timeline } from "@mantine/core";
import type { PatientConsultationHistoryRow } from "@medbrains/types";
import { IconCalendarStats } from "@tabler/icons-react";
import { useMemo } from "react";
import { RichTextEditor } from "@/components/ui";
import styles from "./soap-notes.module.scss";
import { SOAP_SECTIONS, type SoapSection, type SoapSectionKey } from "./soap-sections";

interface SoapTimelineEntry {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  status: string;
  value: string;
}

interface SoapSectionTimeline {
  section: SoapSection;
  entries: SoapTimelineEntry[];
}

function textValue(value: string | null | undefined): string {
  if (!value) return "";
  // Notes are now rich-text HTML — strip tags for plain-text previews/timeline.
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatNoteDate(value: string | null | undefined): string {
  if (!value) return "Unsaved";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatEncounterDate(value: string | null | undefined): string {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString([], {
    dateStyle: "medium",
  });
}

function getHistorySectionValue(note: PatientConsultationHistoryRow, key: SoapSectionKey): string {
  if (key === "chief_complaint") return textValue(note.chief_complaint);
  if (key === "examination") return textValue(note.examination);
  if (key === "history") return textValue(note.history);
  return textValue(note.plan);
}

function noteTitle(note: PatientConsultationHistoryRow): string {
  return `${note.encounter_type.toUpperCase()} visit - ${formatEncounterDate(note.encounter_date)}`;
}

function noteSubtitle(note: PatientConsultationHistoryRow): string {
  return [note.department_name, note.doctor_name ? `Dr. ${note.doctor_name}` : null]
    .filter(Boolean)
    .join(" - ");
}

function buildSectionTimelines(
  historyNotes: PatientConsultationHistoryRow[],
): SoapSectionTimeline[] {
  return SOAP_SECTIONS.map((section) => {
    const entries = historyNotes.reduce<SoapTimelineEntry[]>((acc, note) => {
      const value = getHistorySectionValue(note, section.key);
      if (value.length > 0) {
        acc.push({
          id: note.id,
          date: formatNoteDate(note.updated_at ?? note.created_at),
          title: noteTitle(note),
          subtitle: noteSubtitle(note),
          status: note.status,
          value,
        });
      }
      return acc;
    }, []);

    return { section, entries };
  });
}

interface SoapTimelineProps {
  historyNotes: PatientConsultationHistoryRow[];
  isLoading?: boolean;
  /** Masks or hides note text per the caller's field access. */
  soapText: (value: string) => string;
}

/** Each SOAP section across the patient's earlier visits. */
export function SoapTimeline({ historyNotes, isLoading, soapText }: SoapTimelineProps) {
  const sectionTimelines = useMemo(() => buildSectionTimelines(historyNotes), [historyNotes]);
  return (
    <Card withBorder radius="md" className={styles.noteShell}>
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <IconCalendarStats size={16} />
          <Text size="sm" fw={700}>
            Earlier notes
          </Text>
        </Group>
        {isLoading && (
          <Text size="xs" c="dimmed">
            Loading prior notes...
          </Text>
        )}
      </Group>
      <Tabs defaultValue="chief_complaint">
        <Tabs.List>
          {SOAP_SECTIONS.map((section) => (
            <Tabs.Tab key={section.key} value={section.key} leftSection={section.icon}>
              {section.letter}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {sectionTimelines.map(({ section, entries }) => (
          <Tabs.Panel key={section.key} value={section.key} pt="sm">
            {entries.length > 0 ? (
              <Timeline active={-1} bulletSize={28} lineWidth={2}>
                {entries.map((entry) => (
                  <Timeline.Item
                    key={`${section.key}-${entry.id}`}
                    color={section.color}
                    bullet={section.icon}
                    title={
                      <Group gap={8}>
                        <Text size="sm" fw={700}>
                          {entry.title}
                        </Text>
                        <Badge size="xs" color="gray">
                          {entry.status}
                        </Badge>
                      </Group>
                    }
                  >
                    <Text size="xs" c="dimmed" mb={4}>
                      {[entry.date, entry.subtitle].filter(Boolean).join(" - ")}
                    </Text>
                    <RichTextEditor value={soapText(entry.value)} readOnly minHeight={0} />
                  </Timeline.Item>
                ))}
              </Timeline>
            ) : (
              <Text size="sm" c="dimmed">
                {section.timelineEmpty}
              </Text>
            )}
          </Tabs.Panel>
        ))}
      </Tabs>
    </Card>
  );
}
