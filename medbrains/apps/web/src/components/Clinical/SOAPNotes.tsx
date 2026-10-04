import { Box, Card, Group, SimpleGrid, Stack, Text, ThemeIcon } from "@mantine/core";
import { useFieldAccess, useHasPermission } from "@medbrains/stores";
import { type Consultation, P, type PatientConsultationHistoryRow } from "@medbrains/types";
import { fieldAccessText } from "@medbrains/utils";
import { useTranslation } from "react-i18next";
import { RichTextEditor } from "@/components/ui";
import { SoapNoteEditor, type SoapNoteValues, soapPlainText } from "./SoapNoteEditor";
import { SoapTimeline } from "./SoapTimeline";
import styles from "./soap-notes.module.scss";
import { SOAP_SECTIONS } from "./soap-sections";

interface SOAPNotesProps {
  /** The visit's saved note, if it has one. */
  consultation?: Partial<Consultation> | null;
  /** What the editor starts from: the saved note, or a template. */
  initialValues: SoapNoteValues;
  /** Persist the note; absent when the caller may only read. */
  onSave?: (values: SoapNoteValues) => Promise<void>;
  historyNotes?: PatientConsultationHistoryRow[];
  isHistoryLoading?: boolean;
}

/** The note's four sections as stored, or "" for each. */
export function soapValuesFrom(consultation?: Partial<Consultation> | null): SoapNoteValues {
  return {
    chief_complaint: consultation?.chief_complaint ?? "",
    examination: consultation?.examination ?? "",
    history: consultation?.history ?? "",
    plan: consultation?.plan ?? "",
  };
}

/**
 * The visit's SOAP note: written in place by a doctor who may edit it,
 * read by anyone else, with the patient's earlier notes beneath.
 */
export function SOAPNotes({
  consultation,
  initialValues,
  onSave,
  historyNotes = [],
  isHistoryLoading,
}: SOAPNotesProps) {
  const hasWritePermission = useHasPermission(P.OPD.VISIT_UPDATE);
  const access = useFieldAccess("opd.soap_note");
  const canEdit = Boolean(onSave) && hasWritePermission && access === "edit";
  const canShowText = access !== "hidden";
  const soapText = (value: string) => fieldAccessText(access, value);

  return (
    <Stack gap="sm">
      {canEdit && onSave ? (
        <SoapNoteEditor initialValues={initialValues} onSave={onSave} />
      ) : (
        <SoapNoteView consultation={consultation} soapText={soapText} />
      )}
      <SoapTimeline
        historyNotes={canShowText ? historyNotes : []}
        isLoading={isHistoryLoading}
        soapText={soapText}
      />
    </Stack>
  );
}

function SoapNoteView({
  consultation,
  soapText,
}: {
  consultation?: Partial<Consultation> | null;
  soapText: (value: string) => string;
}) {
  const { t } = useTranslation("clinical");
  const values = soapValuesFrom(consultation);
  const hasNote = SOAP_SECTIONS.some((section) => soapPlainText(values[section.key]) !== "");

  return (
    <Card withBorder radius="md" className={styles.noteShell}>
      <Text fw={700} size="sm" mb="sm">
        Consultation note
      </Text>
      {hasNote ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          {SOAP_SECTIONS.map((section) => (
            <Box
              key={section.key}
              className={styles.sectionSummary}
              style={{ borderTopColor: `var(--mantine-color-${section.color}-5)` }}
            >
              <Group gap={8} mb={6}>
                <ThemeIcon variant="light" color={section.color} size={24}>
                  <Text size="xs" fw={800}>
                    {section.letter}
                  </Text>
                </ThemeIcon>
                <Text size="sm" fw={700}>
                  {t(section.labelKey)}
                </Text>
              </Group>
              {soapPlainText(values[section.key]) !== "" ? (
                <RichTextEditor value={soapText(values[section.key])} readOnly minHeight={0} />
              ) : (
                <Text size="sm" c="dimmed">
                  Not documented in this visit.
                </Text>
              )}
            </Box>
          ))}
        </SimpleGrid>
      ) : (
        <Text size="sm" c="dimmed">
          No consultation note for this visit yet.
        </Text>
      )}
    </Card>
  );
}
