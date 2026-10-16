import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, SegmentedControl, TextArea, toast } from "@/components/ui";
import { adminAccessService } from "@/services/adminAccess.service";

/** How long the access is asked for; access requests are always temporary. */
const DURATIONS = [
  { value: "8", label: "This shift" },
  { value: "24", label: "1 day" },
  { value: "168", label: "7 days" },
  { value: "720", label: "30 days" },
] as const;

const schema = z.object({
  reason: z.string().trim().min(10, "Say what you need to do, so the approver can decide"),
  hours: z.enum(["8", "24", "168", "720"]),
});
type FormValues = z.infer<typeof schema>;

interface RequestAccessFormProps {
  permission: string;
  onCancel: () => void;
}

export const OWN_PENDING_REQUESTS_KEY = ["iam-access-requests", "pending"] as const;

export function RequestAccessForm({ permission, onCancel }: RequestAccessFormProps) {
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "", hours: "8" },
  });

  const request = useMutation({
    mutationFn: (values: FormValues) =>
      adminAccessService.createIamAccessRequest({
        requested_permissions: [permission],
        reason: values.reason.trim(),
        requested_expires_at: new Date(Date.now() + Number(values.hours) * 3_600_000).toISOString(),
      }),
    onSuccess: () => {
      toast.success("Request sent. Your administrators have been notified.");
      queryClient.invalidateQueries({ queryKey: ["iam-access-requests"] });
      onCancel();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Stack
      component="form"
      gap="sm"
      w="100%"
      onSubmit={form.handleSubmit((values) => request.mutate(values))}
      aria-label="Request access"
    >
      <Controller
        control={form.control}
        name="reason"
        render={({ field, fieldState }) => (
          <TextArea
            {...field}
            label="Why do you need it?"
            description="Your administrators see this when they review the request."
            minRows={3}
            autoFocus
            withAsterisk
            error={fieldState.error?.message}
          />
        )}
      />
      <Stack gap={4}>
        <Text size="sm" fw={500} id="access-duration-label">
          For how long?
        </Text>
        <Controller
          control={form.control}
          name="hours"
          render={({ field }) => (
            <SegmentedControl
              aria-labelledby="access-duration-label"
              data={DURATIONS.map((d) => ({ value: d.value, label: d.label }))}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Stack>
      <Group gap="sm">
        <Button type="submit" tone="primary" loading={request.isPending}>
          Send request
        </Button>
        <Button tone="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </Group>
    </Stack>
  );
}
