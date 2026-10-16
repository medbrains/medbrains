import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack } from "@mantine/core";
import { api } from "@medbrains/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Input, Modal, Select, toast } from "@/components/ui";
import { FORM_MODULES, toKey } from "./form-keys";

interface NewFormModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}

const schema = z.object({
  name: z.string().trim().min(2, "Give the form a name"),
  code: z.string().regex(/^[a-z][a-z0-9_]{1,62}$/, "Start with a letter; use only a-z, 0-9 and _"),
  module: z.string().min(1, "Pick the module that uses it"),
});
type NewForm = z.infer<typeof schema>;

export function NewFormModal({ opened, onClose, onCreated }: NewFormModalProps) {
  const queryClient = useQueryClient();
  const { control, handleSubmit, reset, setValue, getFieldState, formState } = useForm<NewForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", code: "", module: "" },
    mode: "onTouched",
  });
  const create = useMutation({
    mutationFn: (values: NewForm) => api.createFormTemplate(values),
    onSuccess: (template) => {
      void queryClient.invalidateQueries({ queryKey: ["form-templates"] });
      reset();
      onCreated(template.id);
    },
    onError: (error: Error) => toast.error(error.message, { title: "Form not created" }),
  });
  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal opened={opened} onClose={close} title="New form">
      <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate aria-label="New form">
        <Stack gap="sm">
          <Controller
            control={control}
            name="name"
            render={({ field, fieldState }) => (
              <Input
                label="Name"
                required
                {...field}
                error={fieldState.error?.message}
                onChange={(e) => {
                  field.onChange(e);
                  // The code follows the name until someone types their own.
                  if (!getFieldState("code").isDirty)
                    setValue("code", toKey(e.currentTarget.value));
                }}
              />
            )}
          />
          <Controller
            control={control}
            name="code"
            render={({ field, fieldState }) => (
              <Input
                label="Code"
                description="How the system refers to this form. It can't be changed later."
                required
                {...field}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="module"
            render={({ field, fieldState }) => (
              <Select
                label="Used in"
                required
                data={FORM_MODULES}
                value={field.value || null}
                onChange={(v) => field.onChange(v ?? "")}
                error={fieldState.error?.message}
              />
            )}
          />
          <Group justify="flex-end">
            <Button tone="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              tone="primary"
              type="submit"
              loading={create.isPending}
              disabled={formState.isSubmitting}
            >
              Create
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
