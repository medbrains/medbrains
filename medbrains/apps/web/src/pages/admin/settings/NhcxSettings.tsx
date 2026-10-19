import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text } from "@mantine/core";
import { getApiBase } from "@medbrains/api";
import type { NhcxConnectionTest, NhcxSettingsView } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
  TextArea,
  toast,
} from "@/components/ui";
import { nhcxSettingsService } from "@/services/nhcxSettings.service";

const KEY = ["nhcx", "settings"];
const pem = z
  .string()
  .trim()
  .refine((v) => v === "" || v.includes("-----BEGIN "), "Paste the PEM text, starting -----BEGIN");

const schema = z.object({
  environment: z.enum(["sandbox", "production"]),
  participant_code: z.string().trim().min(1, "Enter the participant code NHCX issued"),
  client_id: z.string().trim(),
  client_secret: z.string(),
  private_key_pem: pem,
  public_cert_pem: pem,
  gateway_jwt_public_key_pem: pem,
});
type FormValues = z.infer<typeof schema>;

const SOURCE_LABEL = {
  settings: { label: "Gateway keys saved here", tone: "success" },
  env: { label: "Using the server's ABDM keys", tone: "info" },
  none: { label: "No gateway keys", tone: "warning" },
} as const;

function toForm(data: NhcxSettingsView | undefined): FormValues {
  return {
    environment: data?.environment ?? "sandbox",
    participant_code: data?.participant_code ?? "",
    client_id: data?.client_id ?? "",
    client_secret: "",
    private_key_pem: "",
    public_cert_pem: data?.public_cert_pem ?? "",
    gateway_jwt_public_key_pem: data?.gateway_jwt_public_key_pem ?? "",
  };
}

/**
 * Settings → NHCX. The participant code, the gateway's client keys, this
 * hospital's key pair and the gateway's public key. The secret and private key
 * are sealed on the server and never shown again; blank keeps the saved one.
 */
export function NhcxSettings() {
  const queryClient = useQueryClient();
  const [test, setTest] = useState<NhcxConnectionTest | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: KEY,
    queryFn: nhcxSettingsService.get,
  });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), values: toForm(data) });
  const endpointUrl = useMemo(
    () => new URL(`${getApiBase()}/integrations/nhcx/hcx/v1`, window.location.origin).href,
    [],
  );
  const save = useMutation({
    mutationFn: (v: FormValues) =>
      nhcxSettingsService.save({
        ...v,
        client_secret: v.client_secret || undefined,
        private_key_pem: v.private_key_pem || undefined,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(KEY, saved);
      void queryClient.invalidateQueries({ queryKey: ["nhcx", "status"] });
      setTest(null);
      toast.success("Run “Test connection” to check them with the gateway.", {
        title: "NHCX settings saved",
      });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not save the NHCX settings" }),
  });
  const check = useMutation({ mutationFn: nhcxSettingsService.test, onSuccess: setTest });

  if (isError) {
    return (
      <Alert tone="danger" title="Could not load the NHCX settings">
        This does not mean NHCX is off — the settings failed to load.
      </Alert>
    );
  }
  const source = SOURCE_LABEL[data?.credentials_source ?? "none"];
  const pemField = (
    name: "public_cert_pem" | "gateway_jwt_public_key_pem" | "private_key_pem",
    label: string,
    description: string,
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <TextArea
          {...field}
          label={label}
          description={description}
          autosize
          minRows={3}
          maxRows={8}
          spellCheck={false}
          ff="monospace"
          error={form.formState.errors[name]?.message}
        />
      )}
    />
  );

  return (
    <Card>
      <Stack component="form" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <Stack gap={4}>
          <Text fw={600}>NHCX connection</Text>
          <Text size="sm" c="dimmed">
            What NHCX issued this hospital at onboarding. Claims, pre-authorisations and eligibility
            checks are encrypted for each payer and sent through the NHCX gateway.
          </Text>
          <Badge tone={source.tone}>{isLoading ? "Loading…" : source.label}</Badge>
        </Stack>
        <Stack gap={2}>
          <Text size="sm" fw={500}>
            Endpoint URL to register with NHCX
          </Text>
          <Text size="sm" ff="monospace">
            {endpointUrl}
          </Text>
        </Stack>
        <Controller
          control={form.control}
          name="environment"
          render={({ field }) => (
            <SegmentedControl
              aria-label="NHCX environment"
              value={field.value}
              onChange={field.onChange}
              data={[
                { value: "sandbox", label: "Sandbox (testing)" },
                { value: "production", label: "Production (live claims)" },
              ]}
            />
          )}
        />
        <Controller
          control={form.control}
          name="participant_code"
          render={({ field }) => (
            <Input
              {...field}
              label="Participant code"
              description="This hospital's HCX code — the sender on every claim."
              autoComplete="off"
              error={form.formState.errors.participant_code?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="client_id"
          render={({ field }) => (
            <Input
              {...field}
              label="Gateway client ID"
              description="Leave blank to use the server's ABDM client keys."
              autoComplete="off"
            />
          )}
        />
        <Controller
          control={form.control}
          name="client_secret"
          render={({ field }) => (
            <PasswordField
              {...field}
              label="Gateway client secret"
              autoComplete="new-password"
              description={
                data?.has_client_secret
                  ? "A secret is saved. Leave blank to keep it; type a new one to replace it."
                  : "Stored encrypted and never displayed again."
              }
            />
          )}
        />
        {pemField(
          "private_key_pem",
          "Private key (PEM)",
          data?.has_private_key
            ? "A private key is saved. Leave blank to keep it; paste a new one to replace it."
            : "Decrypts the payers' replies. Stored encrypted and never displayed again.",
        )}
        {pemField(
          "public_cert_pem",
          "Public certificate (PEM)",
          "The certificate registered with NHCX; payers encrypt their replies to it.",
        )}
        {pemField(
          "gateway_jwt_public_key_pem",
          "Gateway public key (PEM)",
          "Verifies that a callback really comes from the NHCX gateway.",
        )}
        {test && (
          <Alert
            tone={test.ok ? "success" : "danger"}
            title={test.ok ? "Connected" : "NHCX said no"}
          >
            {test.message}
          </Alert>
        )}
        <Stack gap="xs" align="flex-start">
          <Button type="submit" tone="primary" loading={save.isPending}>
            Save settings
          </Button>
          <Button
            tone="secondary"
            disabled={data?.credentials_source === "none"}
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
