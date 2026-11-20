import { api } from "@medbrains/api";
import type { NhcxParticipant } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Select } from "@/components/ui";
import { canSendTo } from "./nhcxSummary";

interface NhcxPayerSelectProps {
  value: string | null;
  onChange: (code: string | null, payer: NhcxParticipant | undefined) => void;
  enabled?: boolean;
  /** A form's validation message. */
  error?: string;
}

/** Pick the payer from the NHCX payer directory; a hand-entered payer without
 * an encryption certificate is listed but cannot be chosen (a registry payer
 * gets its certificate from NHCX on the first send). */
export function NhcxPayerSelect({ value, onChange, enabled = true, error }: NhcxPayerSelectProps) {
  const payers = useQuery({
    queryKey: ["nhcx-participants"],
    queryFn: () => api.listNhcxParticipants(),
    enabled,
  });
  const list = payers.data ?? [];
  return (
    <Select
      label="Payer"
      value={value}
      onChange={(code) =>
        onChange(
          code,
          list.find((p) => p.participant_code === code),
        )
      }
      data={list.map((p) => ({
        value: p.participant_code,
        label: canSendTo(p)
          ? `${p.participant_name} (${p.participant_code})`
          : `${p.participant_name} (${p.participant_code}) — no encryption certificate`,
        disabled: !canSendTo(p),
      }))}
      placeholder="Select the payer"
      searchable
      error={error ?? (payers.isError ? "Could not load the payer directory" : undefined)}
      nothingFoundMessage="No payers — refresh the NHCX payer directory first"
    />
  );
}
