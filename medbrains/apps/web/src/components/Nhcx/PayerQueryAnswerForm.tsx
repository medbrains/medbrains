import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack } from "@mantine/core";
import { api } from "@medbrains/api";
import type { NhcxAttachableDocument } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button, MultiSelect, TextArea, toast } from "@/components/ui";

const answerSchema = z.object({
  text: z.string().trim().min(1, "Write the answer").max(4000, "Keep it under 4,000 characters"),
  document_ids: z.array(z.string()).max(20, "Attach at most 20 documents"),
});
type AnswerForm = z.infer<typeof answerSchema>;

interface PayerQueryAnswerFormProps {
  queryId: string;
  priorAuthId: string;
  documents: NhcxAttachableDocument[];
}

/** Answer a payer's query: text plus documents already on the pre-auth. */
export function PayerQueryAnswerForm({
  queryId,
  priorAuthId,
  documents,
}: PayerQueryAnswerFormProps) {
  const queryClient = useQueryClient();
  const form = useForm<AnswerForm>({
    resolver: zodResolver(answerSchema),
    defaultValues: { text: "", document_ids: [] },
  });
  const answer = useMutation({
    mutationFn: (values: AnswerForm) => api.answerNhcxPayerQuery(queryId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["preauth-nhcx", priorAuthId] });
      void queryClient.invalidateQueries({ queryKey: ["nhcx-sla"] });
      toast.success("Your answer is on its way to the payer.", { title: "Answer sent" });
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Answer not sent" }),
  });

  return (
    <Stack gap="xs" component="form" onSubmit={form.handleSubmit((v) => answer.mutate(v))}>
      <Controller
        control={form.control}
        name="text"
        render={({ field, fieldState }) => (
          <TextArea
            label="Answer"
            autosize
            minRows={2}
            required
            error={fieldState.error?.message}
            {...field}
          />
        )}
      />
      <Controller
        control={form.control}
        name="document_ids"
        render={({ field, fieldState }) => (
          <MultiSelect
            label="Attach documents"
            placeholder={documents.length ? "Choose documents" : "No documents on this pre-auth"}
            data={documents.map((d) => ({
              value: d.id,
              label: d.file_name ? `${d.document_type} — ${d.file_name}` : d.document_type,
            }))}
            disabled={documents.length === 0}
            error={fieldState.error?.message}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      <Group justify="flex-end">
        <Button type="submit" size="xs" loading={answer.isPending}>
          Send answer
        </Button>
      </Group>
    </Stack>
  );
}
