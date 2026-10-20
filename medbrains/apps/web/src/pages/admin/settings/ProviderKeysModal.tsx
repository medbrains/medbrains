/**
 * Set a payment provider's keys. Write-only: a stored secret is never shown
 * — its field is left blank and says it is set; leaving it blank keeps it.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, Text } from "@mantine/core";
import type { ProviderSetup } from "@medbrains/types";
import { IconCheck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import {
  Alert,
  Button,
  Input,
  Modal,
  PasswordField,
  SegmentedControl,
  toast,
} from "@/components/ui";
import { paymentsService } from "@/services/payments.service";

export const ONLINE_SETTINGS_KEY = ["online-payment-settings"] as const;

const schema = z.object({
  mode: z.enum(["test", "live"]),
  values: z.record(z.string(), z.string()),
});
type KeysForm = z.infer<typeof schema>;

interface ProviderKeysModalProps {
  setup: ProviderSetup;
  onClose: () => void;
}

export function ProviderKeysModal({ setup, onClose }: ProviderKeysModalProps) {
  const queryClient = useQueryClient();
  const { control, handleSubmit } = useForm<KeysForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: setup.mode === "live" ? "live" : "test",
      values: Object.fromEntries(setup.fields.map((f) => [f.name, f.value ?? ""])),
    },
  });
  const save = useMutation({
    mutationFn: (form: KeysForm) =>
      paymentsService.setProviderKeys(setup.provider, {
        mode: form.mode,
        values: Object.fromEntries(Object.entries(form.values).filter(([, v]) => v.trim() !== "")),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ONLINE_SETTINGS_KEY });
      void queryClient.invalidateQueries({ queryKey: ["payment-capabilities"] });
      toast.success(`${setup.label} keys saved.`);
      onClose();
    },
  });
  // A required key not stored yet is a required field; the server checks again.
  const submit = handleSubmit((form) => save.mutate(form));

  return (
    <Modal opened onClose={onClose} title={`${setup.label} keys`}>
      <Stack gap="md" component="form" onSubmit={submit}>
        <Text size="sm" c="dimmed">
          Keys are stored for this hospital only and are never shown again. Leave a stored secret
          blank to keep it.
        </Text>
        <Controller
          control={control}
          name="mode"
          render={({ field }) => (
            <SegmentedControl
              aria-label="Keys for"
              value={field.value}
              onChange={field.onChange}
              data={[
                { value: "test", label: "Test keys" },
                { value: "live", label: "Live keys" },
              ]}
            />
          )}
        />
        {setup.fields.map((f) => (
          <Controller
            key={f.name}
            control={control}
            name={`values.${f.name}`}
            render={({ field }) =>
              f.secret ? (
                <PasswordField
                  label={f.label}
                  required={f.required && !f.set}
                  placeholder={f.set ? "Stored — leave blank to keep" : undefined}
                  autoComplete="off"
                  {...field}
                />
              ) : (
                <Input label={f.label} required={f.required} autoComplete="off" {...field} />
              )
            }
          />
        ))}
        {save.isError && (
          <Alert tone="danger" title="Keys not saved">
            {save.error.message}
          </Alert>
        )}
        <Button
          type="submit"
          tone="primary"
          loading={save.isPending}
          leftSection={<IconCheck size={16} />}
        >
          Save keys
        </Button>
      </Stack>
    </Modal>
  );
}
