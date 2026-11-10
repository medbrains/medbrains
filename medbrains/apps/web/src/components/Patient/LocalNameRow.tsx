/**
 * The patient's name in their own script, beside the English one. Typing an
 * English name offers it in the chosen script; typing a name in an Indian
 * script offers its English spelling. Suggestions come from the server's
 * on-box rules (no network beyond our own) and are only ever offered — the
 * desk picks or edits.
 */
import { Grid, Group, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Select } from "@/components/ui";
import { patientsService } from "@/services/patients.service";

export const SCRIPTS = [
  { value: "devanagari", label: "Hindi / Marathi (देवनागरी)" },
  { value: "tamil", label: "Tamil (தமிழ்)" },
  { value: "telugu", label: "Telugu (తెలుగు)" },
  { value: "kannada", label: "Kannada (ಕನ್ನಡ)" },
  { value: "malayalam", label: "Malayalam (മലയാളം)" },
  { value: "bengali", label: "Bengali (বাংলা)" },
  { value: "gujarati", label: "Gujarati (ગુજરાતી)" },
  { value: "gurmukhi", label: "Punjabi (ਗੁਰਮੁਖੀ)" },
  { value: "odia", label: "Odia (ଓଡ଼ିଆ)" },
] as const;

/** Text in an Indian script (any character in U+0900–U+0D7F). */
export const isIndic = (text: string) => /[ऀ-ൿ]/.test(text);

interface LocalNameRowProps {
  /** The English name as typed so far. */
  englishName: string;
  value: string;
  onChange: (next: string) => void;
  /** Use an English spelling of the local name for the English name. */
  onUseEnglish: (name: string) => void;
}

export function LocalNameRow({ englishName, value, onChange, onUseEnglish }: LocalNameRowProps) {
  const { t } = useTranslation("patients");
  const canRegister = useHasPermission(P.PATIENTS.CREATE);
  const [script, setScript] = useState<string>("devanagari");
  const [english] = useDebouncedValue(englishName.trim(), 300);
  const [local] = useDebouncedValue(value.trim(), 300);
  const toScript = canRegister && english.length > 1 && !isIndic(english) && local.length === 0;
  const toEnglish = canRegister && isIndic(local) && english.length === 0;
  const suggestions = useQuery({
    queryKey: ["transliterate", toScript ? english : local, toScript ? script : "latin"],
    queryFn: () =>
      patientsService.transliterateName(toScript ? english : local, toScript ? script : "latin"),
    enabled: toScript || toEnglish,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const offered = suggestions.data?.suggestions ?? [];

  return (
    <Grid>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <Select
          label={t("registrationForm.localName.script", "Script")}
          data={SCRIPTS.map((s) => ({ value: s.value, label: s.label }))}
          value={script}
          onChange={(v) => v && setScript(v)}
          allowDeselect={false}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 8 }}>
        <Input
          label={t("registrationForm.localName.label", "Name in the patient's script")}
          description={t(
            "registrationForm.localName.help",
            "Optional. Search finds the patient from either spelling.",
          )}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          data-testid="field-full_name_local"
        />
      </Grid.Col>
      {offered.length > 0 && (
        <Grid.Col span={12}>
          <Group gap="xs" aria-live="polite">
            <Text size="sm" c="dimmed">
              {toScript
                ? t("registrationForm.localName.suggested", "Suggested:")
                : t("registrationForm.localName.suggestedEnglish", "English spelling:")}
            </Text>
            {offered.map((s) => (
              <Button
                key={s}
                tone="tertiary"
                size="compact-sm"
                onClick={() => (toScript ? onChange(s) : onUseEnglish(s))}
                aria-label={t("registrationForm.localName.use", "Use {{name}}", { name: s })}
              >
                {s}
              </Button>
            ))}
          </Group>
        </Grid.Col>
      )}
    </Grid>
  );
}
