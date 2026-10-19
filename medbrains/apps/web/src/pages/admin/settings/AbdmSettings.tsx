import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text } from "@mantine/core";
import type { AbdmConnectionTest } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  PasswordField,
  SegmentedControl,
  toast,
} from "@/components/ui";
import { abdmSettingsService } from "@/services/abdmSettings.service";

const KEY = ["abdm", "settings"];

const schema = z.object({
  environment: z.enum(["sandbox", "production"]),
  client_id: z.string().trim().min(1, "Enter the ABDM client ID"),
  client_secret: z.string(),
});
type FormValues = z.infer<typeof schema>;

const SOURCE_LABEL = {
  settings: { label: "Keys saved here", tone: "success" },
  env: { label: "Using the server's keys", tone: "info" },
  none: { label: "Not set up", tone: "warning" },
} as const;

/**
 * Settings → ABDM. The hospital's ABDM client ID and secret, and whether it
 * talks to the sandbox or production. The secret is sealed on the server and
 * never shown again; leaving it blank keeps the saved one.
 */
export function AbdmSettings() {
  const queryClient = useQueryClient();
  const [test, setTest] = useState<AbdmConnectionTest | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: KEY,
    queryFn: abdmSettingsService.get,
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      environment: data?.environment ?? "sandbox",
      client_id: data?.client_id ?? "",
      client_secret: "",
    },
  });
  const save = useMutation({
    mutationFn: (v: FormValues) =>
      abdmSettingsService.save({
        environment: v.environment,
        client_id: v.client_id,
        client_secret: v.client_secret || undefined,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(KEY, saved);
      setTest(null);
      toast.success("Run “Test connection” to check them with ABDM.", { title: "ABDM keys saved" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save the ABDM keys" }),
  });
  const check = useMutation({ mutationFn: abdmSettingsService.test, onSuccess: setTest });

  if (isError) {
    return (
      <Alert tone="danger" title="Could not load the ABDM settings">
        This does not mean ABDM is off — the settings failed to load.
      </Alert>
    );
  }
  const source = SOURCE_LABEL[data?.source ?? "none"];

  return (
    <Card>
      <Stack component="form" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <Stack gap={4}>
          <Text fw={600}>ABDM connection</Text>
          <Text size="sm" c="dimmed">
            The keys ABDM issued to this hospital, for ABHA creation and verification and, later,
            sharing health records. Use the sandbox keys until ABDM approves production.
          </Text>
          <Badge tone={source.tone}>{isLoading ? "Loading…" : source.label}</Badge>
        </Stack>
        <Controller
          control={form.control}
          name="environment"
          render={({ field }) => (
            <SegmentedControl
              aria-label="ABDM environment"
              value={field.value}
              onChange={field.onChange}
              data={[
                { value: "sandbox", label: "Sandbox (testing)" },
                { value: "production", label: "Production (live patients)" },
              ]}
            />
          )}
        />
        <Controller
          control={form.control}
          name="client_id"
          render={({ field }) => (
            <Input
              {...field}
              label="Client ID"
              autoComplete="off"
              error={form.formState.errors.client_id?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="client_secret"
          render={({ field }) => (
            <PasswordField
              {...field}
              label="Client secret"
              autoComplete="new-password"
              description={
                data?.has_secret
                  ? "A secret is saved. Leave blank to keep it; type a new one to replace it."
                  : "Shown once by ABDM. It is stored encrypted and never displayed again."
              }
            />
          )}
        />
        {test && (
          <Alert
            tone={test.ok ? "success" : "danger"}
            title={test.ok ? "Connected" : "ABDM said no"}
          >
            {test.message}
          </Alert>
        )}
        <Stack gap="xs" align="flex-start">
          <Button type="submit" tone="primary" loading={save.isPending}>
            Save keys
          </Button>
          <Button
            tone="secondary"
            disabled={data?.source === "none"}
            loading={check.isPending}
            onClick={() => check.mutate()}
          >
            Test connection
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}
