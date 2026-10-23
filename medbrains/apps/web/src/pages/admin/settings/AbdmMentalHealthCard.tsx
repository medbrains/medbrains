import { Stack, Text } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Card, Switch } from "@/components/ui";
import { abdmSettingsService } from "@/services/abdmSettings.service";

const KEY = ["abdm", "mental-health-sharing"];

/**
 * Mental Healthcare Act 2017 s.23: psychiatric visits are kept out of ABDM by
 * default. On, they are shared only for patients who have also consented to
 * that category on their psychiatric record.
 */
export function AbdmMentalHealthCard() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: KEY,
    queryFn: abdmSettingsService.mentalHealthSharing,
  });
  const save = useMutation({
    mutationFn: (enabled: boolean) => abdmSettingsService.saveMentalHealthSharing({ enabled }),
    onSuccess: (next) => qc.setQueryData(KEY, next),
  });
  return (
    <Card withBorder padding="lg">
      <Stack gap="sm">
        <Text fw={600}>Mental-health records</Text>
        <Text size="sm" c="dimmed">
          Psychiatric visits — those with a mental-health diagnosis or seen in a psychiatry
          department — are never offered, linked or sent through ABDM while this is off. When on,
          they are shared only for a patient who has consented to that category on their psychiatric
          record.
        </Text>
        {isError ? (
          <Alert tone="danger">The setting could not be loaded. {error.message}</Alert>
        ) : (
          <Switch
            label="Allow sharing with the patient's consent"
            checked={data?.enabled ?? false}
            disabled={isLoading || save.isPending}
            onChange={(e) => save.mutate(e.currentTarget.checked)}
          />
        )}
        {save.isError && <Alert tone="danger">{save.error.message}</Alert>}
      </Stack>
    </Card>
  );
}
