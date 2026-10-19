import { Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Card, Switch, toast } from "@/components/ui";
import { marketingService } from "@/services/marketing.service";

const KEY = ["marketing", "web-form"];

/**
 * The switch for the hospital website's enquiry form. While it is off the
 * public endpoint answers 404, so a form on the website files nothing here.
 */
export function WebFormCard() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(P.MARKETING.SETTINGS_MANAGE);
  const { data, isLoading, isError } = useQuery({
    queryKey: KEY,
    queryFn: () => marketingService.webForm(),
  });

  const save = useMutation({
    mutationFn: (enabled: boolean) => marketingService.updateWebForm({ enabled }),
    onSuccess: (saved) => {
      queryClient.setQueryData(KEY, saved);
      toast.success(
        saved.enabled ? "Website enquiries now land in Enquiries" : "The website form is off",
        { title: "Saved" },
      );
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not change the form" }),
  });

  if (isError) {
    return (
      <Alert tone="danger" title="Could not load the website form setting">
        This does not mean the form is off — the setting failed to load.
      </Alert>
    );
  }

  return (
    <Card>
      <Stack gap="xs">
        <Switch
          label="Accept enquiries from our website"
          description="A name and phone number sent from the website's form arrive in Enquiries as a new lead, tagged with the page or campaign that brought them."
          checked={data?.enabled ?? false}
          disabled={!canManage || isLoading || save.isPending}
          onChange={(e) => save.mutate(e.currentTarget.checked)}
        />
        {!canManage && (
          <Text size="xs" c="dimmed">
            You can see this setting but not change it.
          </Text>
        )}
      </Stack>
    </Card>
  );
}
