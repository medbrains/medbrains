/**
 * Where the hospital's PACS is (#226). With an address set, every new
 * imaging order goes onto the modality worklist, and studies the modalities
 * send come back to their orders. Read by the radiology desk; changed only by
 * whoever manages modalities.
 *
 * The password is write-only: the server never sends it back, only whether
 * one is saved. A new address or username needs it entered again, so the
 * saved password can never follow the PACS to a new host.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { QueryError } from "@/components/QueryError";
import { Button, Card, Input, PasswordField, toast } from "@/components/ui";
import { radiologyService } from "@/services/radiology.service";

const savedSchema = z
  .object({
    orthanc_url: z.string().catch(""),
    orthanc_username: z.string().catch(""),
    password_set: z.boolean().catch(false),
  })
  .passthrough();
type Saved = z.infer<typeof savedSchema>;

const trimSlash = (v: string) => v.trim().replace(/\/+$/, "");

function formSchema(saved: Saved | undefined) {
  return z
    .object({
      orthanc_url: z
        .string()
        .trim()
        .refine(
          (v) => v === "" || /^https?:\/\/\S+$/.test(v),
          "An address like http://192.168.10.5:8042 or https://pacs.hospital.local",
        ),
      orthanc_username: z.string().trim(),
      orthanc_password: z.string(),
    })
    .superRefine((v, ctx) => {
      if (v.orthanc_url === "" || v.orthanc_username === "" || v.orthanc_password !== "") return;
      const moved =
        trimSlash(v.orthanc_url) !== trimSlash(saved?.orthanc_url ?? "") ||
        v.orthanc_username !== (saved?.orthanc_username ?? "");
      if (moved || !saved?.password_set) {
        ctx.addIssue({
          code: "custom",
          path: ["orthanc_password"],
          message: moved
            ? "Enter the password again: a new address or username needs it"
            : "Enter the PACS password",
        });
      }
    });
}
type Form = z.infer<ReturnType<typeof formSchema>>;

export function PacsSettingsCard() {
  const canManage = useHasPermission(P.RADIOLOGY.MODALITIES_MANAGE);
  const queryClient = useQueryClient();
  const config = useQuery({
    queryKey: ["radiology-pacs-config"],
    queryFn: async () => savedSchema.parse(await radiologyService.getRadiologyPacsConfig()),
  });
  const form = useForm<Form>({
    resolver: zodResolver(formSchema(config.data)),
    values: {
      orthanc_url: config.data?.orthanc_url ?? "",
      orthanc_username: config.data?.orthanc_username ?? "",
      orthanc_password: "",
    },
  });
  const save = useMutation({
    mutationFn: (v: Form) =>
      radiologyService.updateRadiologyPacsConfig({
        orthanc_url: v.orthanc_url,
        orthanc_username: v.orthanc_username,
        ...(v.orthanc_password === "" ? {} : { orthanc_password: v.orthanc_password }),
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
  const passwordSet = config.data?.password_set ?? false;
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
            Orthanc address on the hospital network or VPN. Orders go onto its modality worklist;
            studies return by accession number. Leave empty to switch off.
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
            {canManage && (
              <Controller
                control={form.control}
                name="orthanc_password"
                render={({ field, fieldState }) => (
                  <PasswordField
                    label="Password"
                    autoComplete="new-password"
                    description={
                      passwordSet ? "A password is saved. Leave blank to keep it." : "None saved"
                    }
                    {...field}
                    error={fieldState.error?.message}
                  />
                )}
              />
            )}
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
