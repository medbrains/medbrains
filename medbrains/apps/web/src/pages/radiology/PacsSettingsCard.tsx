/**
 * Where the hospital's PACS is (#226). With an address set, every new
 * imaging order goes onto the modality worklist, and studies the modalities
 * send come back to their orders. Read by the radiology desk; changed only by
 * whoever manages modalities.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { QueryError } from "@/components/QueryError";
import { Button, Card, Input, toast } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";

const schema = z.object({
  orthanc_url: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^https?:\/\/\S+$/.test(v),
      "An address like https://pacs.hospital.local:8042",
    ),
  orthanc_username: z.string().trim(),
});
type Form = z.infer<typeof schema>;

export function PacsSettingsCard() {
  const canManage = useHasPermission(P.RADIOLOGY.MODALITIES_MANAGE);
  const queryClient = useQueryClient();
  const config = useQuery({
    queryKey: ["radiology-pacs-config"],
    queryFn: () =>
      radiologyService.getRadiologyPacsConfig() as Promise<Partial<Form> & Record<string, unknown>>,
  });
  const form = useForm<Form>({
    resolver: zodResolver(schema),
    values: {
      orthanc_url: config.data?.orthanc_url ?? "",
      orthanc_username: config.data?.orthanc_username ?? "",
    },
  });
  const save = useMutation({
    mutationFn: (v: Form) =>
      radiologyService.updateRadiologyPacsConfig({
        ...(config.data ?? {}),
        ...v,
        viewer_type: "ohif",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["radiology-pacs-config"] });
      toast.success("New orders go onto the worklist; studies come back to their orders.", {
        title: "PACS saved",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "PACS not saved" }),
  });

  if (config.isError)
    return <QueryError error={config.error} onRetry={() => void config.refetch()} />;
  return (
    <Card withBorder padding="md">
      <form
        aria-label="PACS connection"
        noValidate
        onSubmit={form.handleSubmit((v) => save.mutate(v))}
      >
        <Stack gap="sm">
          <Text fw={600}>PACS</Text>
          <Text size="sm" c="dimmed">
            Orthanc address. Orders go onto its modality worklist; studies return by accession
            number. Leave empty to switch off.
          </Text>
          <Group align="flex-start" grow>
            <Controller
              control={form.control}
              name="orthanc_url"
              render={({ field, fieldState }) => (
                <Input
                  label="PACS address"
                  readOnly={!canManage}
                  {...field}
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="orthanc_username"
              render={({ field }) => (
                <Input
                  label="Username (if the PACS asks for one)"
                  readOnly={!canManage}
                  {...field}
                />
              )}
            />
          </Group>
          {canManage && (
            <Group justify="flex-end">
              <Button tone="primary" type="submit" loading={save.isPending}>
                Save
              </Button>
            </Group>
          )}
        </Stack>
      </form>
    </Card>
  );
}
