import { Button, Group, Stack, Text, Textarea, ThemeIcon } from "@mantine/core";
import type {
  Consultation,
  CreateConsultationRequest,
  UpdateConsultationRequest,
} from "@medbrains/types";
import { IconBrain, IconClipboardList, IconEye, IconMessage } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import styles from "./soap-notes.module.scss";

interface SoapSection {
  key: "chief_complaint" | "examination" | "history" | "plan";
  letter: string;
  labelKey: string;
  fullLabelKey: string;
  color: string;
  icon: React.ReactNode;
  placeholderKey: string;
}

const SOAP_SECTIONS: SoapSection[] = [
  {
    key: "chief_complaint",
    letter: "S",
    labelKey: "soap.subjective",
    fullLabelKey: "soap.chiefComplaint",
    color: "primary",
    icon: <IconMessage size={16} />,
    placeholderKey: "soap.placeholderSubjective",
  },
  {
    key: "examination",
    letter: "O",
    labelKey: "soap.objective",
    fullLabelKey: "soap.examination",
    color: "teal",
    icon: <IconEye size={16} />,
    placeholderKey: "soap.placeholderObjective",
  },
  {
    key: "history",
    letter: "A",
    labelKey: "soap.assessment",
    fullLabelKey: "soap.clinicalAssessment",
    color: "violet",
    icon: <IconBrain size={16} />,
    placeholderKey: "soap.placeholderAssessment",
  },
  {
    key: "plan",
    letter: "P",
    labelKey: "soap.plan",
    fullLabelKey: "soap.treatmentPlan",
    color: "success",
    icon: <IconClipboardList size={16} />,
    placeholderKey: "soap.placeholderPlan",
  },
];

interface SOAPNotesProps {
  onSubmit: (data: CreateConsultationRequest | UpdateConsultationRequest) => void;
  defaultValues?: Partial<Consultation>;
  isSubmitting?: boolean;
  submitLabel?: string;
}

type SoapValues = Record<string, string>;

export function SOAPNotes({ onSubmit, defaultValues, isSubmitting, submitLabel }: SOAPNotesProps) {
  const { t } = useTranslation("clinical");
  const [values, setValues] = useState<SoapValues>(() => {
    const initial: SoapValues = {};
    for (const section of SOAP_SECTIONS) {
      initial[section.key] = (defaultValues?.[section.key] as string) ?? "";
    }
    return initial;
  });

  const handleChange = (key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = () => {
    const req: CreateConsultationRequest = {};
    if (values.chief_complaint?.trim()) req.chief_complaint = values.chief_complaint.trim();
    if (values.history?.trim()) req.history = values.history.trim();
    if (values.examination?.trim()) req.examination = values.examination.trim();
    if (values.plan?.trim()) req.plan = values.plan.trim();
    onSubmit(req);
  };

  const isEdit = Boolean(defaultValues);
  const label = submitLabel ?? (isEdit ? t("soap.updateNotes") : t("soap.saveNotes"));

  return (
    <Stack gap="sm">
      {SOAP_SECTIONS.map((section) => (
        <div
          key={section.key}
          className={styles.soapSection}
          style={{
            borderLeftColor: `var(--mantine-color-${section.color}-5)`,
          }}
        >
          <Group gap={8} mb={6}>
            <ThemeIcon variant="filled" color={section.color} size={24} radius="xl">
              <Text size="xs" fw={800} c="white" lh={1}>
                {section.letter}
              </Text>
            </ThemeIcon>
            <div>
              <Text size="sm" fw={600} lh={1.2}>
                {t(section.labelKey)}
              </Text>
              <Text size="xs" c="dimmed" lh={1}>
                {t(section.fullLabelKey)}
              </Text>
            </div>
          </Group>
          <Textarea
            value={values[section.key] ?? ""}
            onChange={(e) => handleChange(section.key, e.currentTarget.value)}
            placeholder={t(section.placeholderKey)}
            autosize
            minRows={3}
            maxRows={10}
          />
        </div>
      ))}

      <Group justify="flex-end">
        <Button size="sm" onClick={handleSubmit} loading={isSubmitting}>
          {label}
        </Button>
      </Group>
    </Stack>
  );
}
