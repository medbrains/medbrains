/**
 * Registration's privacy step: the DPDP notice shown in the patient's
 * language and the purposes they agree to. Left untouched (an unconscious
 * emergency patient, say), nothing is recorded and the desk records it later
 * from the patient's page.
 */
import type { PatientRegistrationFormInput } from "@medbrains/schemas";
import { type Control, useController } from "react-hook-form";
import { DpdpNoticePanel } from "./DpdpNoticePanel";

interface DpdpRegistrationSectionProps {
  control: Control<PatientRegistrationFormInput>;
}

export function DpdpRegistrationSection({ control }: DpdpRegistrationSectionProps) {
  const language = useController({ control, name: "privacy_language" });
  const purposes = useController({ control, name: "privacy_purposes" });
  const given = useController({ control, name: "privacy_notice_given" });
  const guardian = useController({ control, name: "privacy_guardian" });
  return (
    <DpdpNoticePanel
      value={{
        language: language.field.value ?? "en",
        purposes: purposes.field.value ?? [],
        noticeGiven: given.field.value ?? false,
        guardian: guardian.field.value ?? "",
      }}
      onChange={(next) => {
        language.field.onChange(next.language);
        purposes.field.onChange(next.purposes);
        given.field.onChange(next.noticeGiven);
        guardian.field.onChange(next.guardian);
      }}
      noticeError={given.fieldState.error?.message}
    />
  );
}
