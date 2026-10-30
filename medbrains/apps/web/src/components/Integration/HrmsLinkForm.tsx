import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack } from "@mantine/core";
import type { HumanexConfigView } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Input, PasswordField, Select, Switch } from "@/components/ui";
import { toast } from "@/components/ui/toast";
import { adminAccessService } from "@/services/adminAccess.service";
import { hrmsService } from "@/services/hrms.service";

interface HrmsLinkFormProps {
  config: HumanexConfigView;
  onSaved: () => void;
}

const schema = z.object({
  base_url: z
    .string()
    .trim()
    .regex(/^https?:\/\/\S+$/, "Enter the Humanex address, starting with https://"),
  api_key: z.string().trim(),
  enabled: z.boolean(),
  system_user_id: z.string().min(1, "Choose who the pulled records are recorded as"),
});

type FormInput = z.infer<typeof schema>;

/** Where Humanex is, its key, and who the pulled rosters are recorded as. */
export function HrmsLinkForm({ config, onSaved }: HrmsLinkFormProps) {
  const queryClient = useQueryClient();
  const { data: users = [] } = useQuery({
    queryKey: ["setup-users"],
    queryFn: () => adminAccessService.listUsers(),
    staleTime: 300_000,
  });
  const userOptions = useMemo(
    () => users.map((u) => ({ value: u.id, label: `${u.full_name} (${u.username})` })),
    [users],
  );

  const keyRule = config.api_key_set
    ? schema
    : schema.refine((v) => v.api_key.length > 0, {
        path: ["api_key"],
        message: "Enter the API key Humanex issued for MedBrains",
      });
  const { control, handleSubmit, reset } = useForm<FormInput>({
    resolver: zodResolver(keyRule),
    defaultValues: {
      base_url: config.base_url ?? "",
      api_key: "",
      enabled: config.enabled,
      system_user_id: config.system_user_id ?? "",
    },
  });

  const save = useMutation({
    mutationFn: (v: FormInput) =>
      hrmsService.updateHumanexConfig({
        base_url: v.base_url,
        api_key: v.api_key || undefined,
        enabled: v.enabled,
        system_user_id: v.system_user_id,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["hrms-humanex-config"], saved);
      reset({
        ...saved,
        base_url: saved.base_url ?? "",
        api_key: "",
        system_user_id: saved.system_user_id ?? "",
      });
      toast.success("Humanex settings saved.");
      onSaved();
    },
    onError: (err: Error) => toast.error(err.message, { title: "Could not save" }),
  });

  return (
    <Stack gap="sm" component="form" onSubmit={handleSubmit((v) => save.mutate(v))}>
      <Controller
        name="base_url"
        control={control}
        render={({ field, fieldState }) => (
          <Input
            {...field}
            label="Humanex address"
            placeholder="https://humanex.example-hospital.in"
            error={fieldState.error?.message}
            required
          />
        )}
      />
      <Controller
        name="api_key"
        control={control}
        render={({ field, fieldState }) => (
          <PasswordField
            {...field}
            label="API key"
            description={config.api_key_set ? "A key is saved. Leave blank to keep it." : undefined}
            error={fieldState.error?.message}
            autoComplete="off"
          />
        )}
      />
      <Controller
        name="system_user_id"
        control={control}
        render={({ field, fieldState }) => (
          <Select
            {...field}
            label="Record pulled rosters and attendance as"
            data={userOptions}
            searchable
            error={fieldState.error?.message}
            required
          />
        )}
      />
      <Controller
        name="enabled"
        control={control}
        render={({ field: { value, onChange, ...rest } }) => (
          <Switch
            {...rest}
            checked={value}
            onChange={(e) => onChange(e.currentTarget.checked)}
            label="Pull from Humanex every 15 minutes"
          />
        )}
      />
      <Group justify="flex-end">
        <Button tone="primary" type="submit" loading={save.isPending}>
          Save
        </Button>
      </Group>
    </Stack>
  );
}
