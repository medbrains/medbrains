import { api } from "@medbrains/api";
import type { NhcxParticipant } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Select } from "@/components/ui";

interface NhcxPayerSelectProps {
  value: string | null;
  onChange: (code: string | null, payer: NhcxParticipant | undefined) => void;
  enabled?: boolean;
}

/** Pick the payer from the NHCX payer directory; payers without an
 * encryption certificate are listed but cannot be chosen. */
export function NhcxPayerSelect({ value, onChange, enabled = true }: NhcxPayerSelectProps) {
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
        label: p.has_encryption_cert
          ? `${p.participant_name} (${p.participant_code})`
          : `${p.participant_name} (${p.participant_code}) — no encryption certificate`,
        disabled: !p.has_encryption_cert,
      }))}
      placeholder="Select the payer"
      searchable
      error={payers.isError ? "Could not load the payer directory" : undefined}
      nothingFoundMessage="No payers — add one in the NHCX payer directory first"
    />
  );
}
