import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { Select } from "@/components/ui";
import { patientsService } from "@/services/patients.service";

interface CampaignSelectProps {
  value: string | null | undefined;
  onChange: (campaignId: string | undefined) => void;
  label?: string;
}

/**
 * Which campaign brought the patient — the ad, the hoarding, the social post.
 * Optional: a walk-in who heard of the hospital some other way has none.
 * Shown only to those who may look campaigns up.
 */
export function CampaignSelect({
  value,
  onChange,
  label = "Came through campaign",
}: CampaignSelectProps) {
  const canLookUp = useHasPermission(P.MARKETING.CAMPAIGNS.LOOKUP);
  const { data: campaigns = [], isError } = useQuery({
    queryKey: ["campaign-lookup"],
    queryFn: () => patientsService.lookupMarketingCampaigns(),
    enabled: canLookUp,
    staleTime: 300_000,
  });
  if (!canLookUp) return null;
  return (
    <Select
      label={label}
      placeholder={isError ? "Campaigns could not be loaded" : "None"}
      data={campaigns.map((c) => ({
        value: c.id,
        label: c.code ? `${c.name} (${c.code})` : c.name,
      }))}
      value={value ?? null}
      onChange={(v) => onChange(v ?? undefined)}
      error={isError ? "Try again in a moment" : undefined}
      searchable
      clearable
    />
  );
}
