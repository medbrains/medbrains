/**
 * The DPDP notice, in the language the patient chose, and the purposes they
 * agree to one by one. Used at registration and from the patient's page.
 */
import { Checkbox, Paper, SegmentedControl, Stack, Text, TextInput } from "@mantine/core";
import type { DpdpNoticeLanguage, DpdpPurpose } from "@medbrains/types";
import { DPDP_LANGUAGES, DPDP_NOTICE, DPDP_PURPOSES } from "./dpdp-notice";

export interface DpdpNoticeValue {
  language: DpdpNoticeLanguage;
  purposes: DpdpPurpose[];
  noticeGiven: boolean;
  guardian: string;
}

interface DpdpNoticePanelProps {
  value: DpdpNoticeValue;
  onChange: (value: DpdpNoticeValue) => void;
  noticeError?: string;
}

export function DpdpNoticePanel({ value, onChange, noticeError }: DpdpNoticePanelProps) {
  const notice = DPDP_NOTICE[value.language];
  const set = (patch: Partial<DpdpNoticeValue>) => onChange({ ...value, ...patch });
  return (
    <Stack gap="sm" data-testid="dpdp-notice">
      <SegmentedControl
        aria-label="Notice language"
        data={DPDP_LANGUAGES}
        value={value.language}
        onChange={(language) => set({ language: language as DpdpNoticeLanguage })}
      />
      <Paper withBorder p="sm" lang={value.language}>
        <Stack gap="xs">
          <Text size="sm">{notice.collected}</Text>
          <Text size="sm" fw={600}>
            {notice.purposesIntro}
          </Text>
        </Stack>
      </Paper>
      <Checkbox.Group
        aria-label="Purposes agreed to"
        value={value.purposes}
        onChange={(purposes) => set({ purposes: purposes as DpdpPurpose[] })}
      >
        <Stack gap="xs" lang={value.language}>
          {DPDP_PURPOSES.map((purpose) => (
            <Checkbox key={purpose} value={purpose} label={notice.purposes[purpose]} />
          ))}
        </Stack>
      </Checkbox.Group>
      <Text size="sm" c="dimmed" lang={value.language}>
        {notice.rights}
      </Text>
      <TextInput
        label="Agreed by a parent or guardian"
        description="For a child, or a patient who cannot decide for themselves"
        placeholder="Their name"
        value={value.guardian}
        onChange={(event) => {
          const guardian = event.currentTarget.value;
          set({ guardian });
        }}
      />
      <Checkbox
        label="I have shown this notice to the patient in the language chosen"
        checked={value.noticeGiven}
        onChange={(event) => {
          const noticeGiven = event.currentTarget.checked;
          set({ noticeGiven });
        }}
        error={noticeError}
      />
    </Stack>
  );
}
