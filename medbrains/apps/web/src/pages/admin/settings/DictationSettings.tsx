import { zodResolver } from "@hookform/resolvers/zod";
import { Loader, Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { type DictationConfig, P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, Button, Card, Input, Switch, toast } from "@/components/ui";
import { dictationService } from "@/services/dictation.service";

const KEY = ["dictation", "settings"];
const url = (scheme: RegExp, hint: string) => z.string().trim().regex(scheme, hint).max(200);
const LOCAL = /^https?:\/\/[^/:]+/;
const HTTPS = /^https:\/\/[^/:]+/;

const schema = z
  .object({
    stt_url: url(LOCAL, "An http:// address, for example http://127.0.0.1:8178"),
    llm_url: url(LOCAL, "An http:// address, for example http://127.0.0.1:11434"),
    llm_model: z.string().trim().min(1, "Name the local model, for example llama3.2"),
    cloud_enabled: z.boolean(),
    cloud_url: z.string().trim(),
    cloud_model: z.string().trim(),
    cloud_api_key_secret: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (!v.cloud_enabled) return;
    if (!HTTPS.test(v.cloud_url)) {
      ctx.addIssue({
        code: "custom",
        path: ["cloud_url"],
        message: "The cloud service must be https://",
      });
    }
    if (!v.cloud_api_key_secret) {
      ctx.addIssue({
        code: "custom",
        path: ["cloud_api_key_secret"],
        message: "Name the key's secret",
      });
    }
  });
type FormValues = z.infer<typeof schema>;

/** The stored configuration as form values (blank for unset optional fields). */
function toForm(data: DictationConfig | undefined): FormValues | undefined {
  if (!data) return undefined;
  return {
    ...data,
    cloud_url: data.cloud_url ?? "",
    cloud_model: data.cloud_model ?? "",
    cloud_api_key_secret: data.cloud_api_key_secret ?? "",
  };
}

/**
 * Settings → Dictation. Where doctors' dictation is transcribed (the
 * hospital's own whisper server) and which local model drafts the note. The
 * cloud transcription service is off unless turned on here: recordings would
 * then leave the hospital (RFCs/modules/RFC-MODULE-ai-dictation.md).
 */
export function DictationSettings() {
  const queryClient = useQueryClient();
  const canManage = useHasPermission(P.ADMIN.SETTINGS.DICTATION.MANAGE);
  const { data, isLoading, isError } = useQuery({
    queryKey: KEY,
    queryFn: dictationService.getDictationSettings,
    enabled: canManage,
  });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), values: toForm(data) });
  const save = useMutation({
    mutationFn: (v: FormValues) =>
      dictationService.saveDictationSettings({
        ...v,
        cloud_url: v.cloud_url || null,
        cloud_model: v.cloud_model || null,
        cloud_api_key_secret: v.cloud_api_key_secret || null,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(KEY, saved);
      toast.success("Doctors' next dictation uses these services.", { title: "Dictation saved" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Dictation settings not saved" }),
  });

  if (isLoading) return <Loader size="sm" />;
  // A failed read must not show the defaults as if they were the hospital's choice.
  if (isError || !canManage || !data) {
    return (
      <Alert tone="danger" title="Dictation settings could not be loaded">
        <Text size="sm">Reload the page; if it keeps failing, tell IT.</Text>
      </Alert>
    );
  }
  const cloudOn = form.watch("cloud_enabled");
  const text = (
    name: keyof Omit<FormValues, "cloud_enabled">,
    label: string,
    description: string,
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Input
          {...field}
          label={label}
          description={description}
          autoComplete="off"
          error={form.formState.errors[name]?.message}
        />
      )}
    />
  );

  return (
    <Card>
      <Stack component="form" maw={560} onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <Stack gap={4}>
          <Text fw={600}>Dictation</Text>
          <Text size="sm" c="dimmed">
            Doctors dictate the consultation note. Speech is transcribed on this hospital's own
            server and the note is drafted by a local model; the doctor reviews every section.
          </Text>
        </Stack>
        {text(
          "stt_url",
          "Speech-to-text server",
          "The whisper.cpp server on this hospital's machine.",
        )}
        {text("llm_url", "Local model server", "The Ollama server that drafts the note.")}
        {text("llm_model", "Local model", "The model's name on that server.")}
        <Controller
          control={form.control}
          name="cloud_enabled"
          render={({ field }) => (
            <Switch
              checked={field.value}
              onChange={(e) => field.onChange(e.currentTarget.checked)}
              label="Use a cloud transcription service instead"
              description="Off by default. When on, doctors' recordings are sent to that service."
            />
          )}
        />
        {cloudOn && (
          <>
            <Alert tone="warning" title="Recordings will leave the hospital">
              <Text size="sm">
                Patients' voices and details go to the cloud service. Use one with a data processing
                agreement that keeps the data in India (DPDP Act 2023).
              </Text>
            </Alert>
            {text("cloud_url", "Cloud service address", "An OpenAI-compatible https:// address.")}
            {text("cloud_model", "Cloud model", "For example whisper-1.")}
            {text(
              "cloud_api_key_secret",
              "Key secret name",
              "The secret holding the key, not the key.",
            )}
          </>
        )}
        <Button type="submit" tone="primary" loading={save.isPending} w="fit-content">
          Save
        </Button>
      </Stack>
    </Card>
  );
}
