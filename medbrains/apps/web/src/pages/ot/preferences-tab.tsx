// IPD PreferencesTab — split from ot.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Drawer, Group, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { OtSurgeonPreferenceFormInput } from "@medbrains/schemas";
import { otSurgeonPreferenceFormSchema } from "@medbrains/schemas";
import type { OtSurgeonPreference } from "@medbrains/types";
import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { DataTable, DoctorSearchSelect } from "@/components";
import { Button, toast } from "@/components/ui";
import {
  DEFAULT_OT_SURGEON_PREFERENCE_FORM_VALUES,
  toCreateSurgeonPreferenceRequest,
} from "@/forms/ot.form";
import { otService } from "@/services/ot.service";

function CreatePreferenceDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OtSurgeonPreferenceFormInput>({
    resolver: zodResolver(otSurgeonPreferenceFormSchema),
    defaultValues: DEFAULT_OT_SURGEON_PREFERENCE_FORM_VALUES,
  });

  const mutation = useMutation({
    mutationFn: (values: OtSurgeonPreferenceFormInput) =>
      otService.createSurgeonPreference(toCreateSurgeonPreferenceRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ot-surgeon-preferences"] });
      toast.success("Preference card saved", { title: "Created" });
      onClose();
      reset(DEFAULT_OT_SURGEON_PREFERENCE_FORM_VALUES);
    },
  });

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Surgeon Preference Card"
      position="right"
      size="xl"
    >
      <Stack component="form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <Controller
          control={control}
          name="surgeon_id"
          render={({ field }) => (
            <DoctorSearchSelect
              label="Surgeon"
              required
              value={field.value}
              onChange={field.onChange}
              error={errors.surgeon_id?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="procedure_name"
          render={({ field }) => (
            <TextInput
              label="Procedure Name"
              required
              {...field}
              error={errors.procedure_name?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="position"
          render={({ field }) => <TextInput label="Position" {...field} />}
        />
        <Controller
          control={control}
          name="skin_prep"
          render={({ field }) => <TextInput label="Skin Prep" {...field} />}
        />
        <Controller
          control={control}
          name="draping"
          render={({ field }) => <TextInput label="Draping" {...field} />}
        />
        <Controller
          control={control}
          name="special_instructions"
          render={({ field }) => <Textarea label="Special Instructions" {...field} />}
        />
        <Button tone="primary" type="submit" loading={mutation.isPending}>
          Save
        </Button>
      </Stack>
    </Drawer>
  );
}

export function PreferencesTab({ canManage }: { canManage: boolean }) {
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);

  const { data = [], isLoading } = useQuery<OtSurgeonPreference[]>({
    queryKey: ["ot-surgeon-preferences"],
    queryFn: () => otService.listSurgeonPreferences(),
  });

  const columns = [
    {
      key: "procedure_name",
      label: "Procedure",
      render: (r: OtSurgeonPreference) => (
        <Text size="sm" fw={500}>
          {r.procedure_name}
        </Text>
      ),
    },
    {
      key: "position",
      label: "Position",
      render: (r: OtSurgeonPreference) => <Text size="sm">{r.position ?? "\u2014"}</Text>,
    },
    {
      key: "skin_prep",
      label: "Skin Prep",
      render: (r: OtSurgeonPreference) => <Text size="sm">{r.skin_prep ?? "\u2014"}</Text>,
    },
    {
      key: "special_instructions",
      label: "Notes",
      render: (r: OtSurgeonPreference) => (
        <Text size="sm" lineClamp={1}>
          {r.special_instructions ?? "\u2014"}
        </Text>
      ),
    },
  ];

  return (
    <Stack>
      {canManage && (
        <Group>
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add Preference Card
          </Button>
        </Group>
      )}
      <DataTable columns={columns} data={data} loading={isLoading} rowKey={(r) => r.id} />
      <CreatePreferenceDrawer opened={createOpened} onClose={closeCreate} />
    </Stack>
  );
}
