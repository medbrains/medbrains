import type { ErVisit } from "@medbrains/types";
import { IconGavel, IconHelpCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { OperationalSignal } from "@/components";

/**
 * A visit's medico-legal mark, in words: a registered MLC, or a possible one
 * the desk saved for a doctor to confirm (a handoff, so the queue shape).
 * Icon and shape differ as well as colour. Nothing for a visit that raised
 * no question.
 */
export function MlcSignal({
  size = "sm",
  visit,
}: {
  size?: "xs" | "sm";
  visit: Pick<ErVisit, "is_mlc" | "mlc_suspicion">;
}) {
  const { t } = useTranslation("emergency");
  if (visit.is_mlc) {
    return (
      <OperationalSignal
        icon={IconGavel}
        label={t("signals.mlc")}
        shape="diamond"
        size={size}
        tone="risk"
      />
    );
  }
  if (visit.mlc_suspicion !== "suspected") return null;
  return (
    <OperationalSignal
      icon={IconHelpCircle}
      label={t("signals.mlcSuspected")}
      shape="token"
      size={size}
      tone="blocked"
    />
  );
}
