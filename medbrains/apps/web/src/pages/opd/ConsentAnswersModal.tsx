/** A consent's answers, shown against the exact questions they were given for. */
import { Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import type { FormAnswers, FormDefinition, ProcedureConsent } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { DynamicFields, useDynamicForm } from "@/components/DynamicForm";
import { QueryError } from "@/components/QueryError";
import { Modal } from "@/components/ui";

interface StoredForm {
  version?: number | null;
  answers?: FormAnswers;
  definition?: FormDefinition;
}

const NO_DEFINITION: FormDefinition = { sections: [] };

export function ConsentAnswersModal({
  consent,
  onClose,
}: {
  consent: ProcedureConsent | null;
  onClose: () => void;
}) {
  const stored = (consent?.body ?? {}) as StoredForm;
  const versionId = consent?.form_version_id ?? null;
  const version = useQuery({
    queryKey: ["form-version", versionId],
    queryFn: () => api.getFormVersion(versionId ?? ""),
    enabled: versionId !== null,
  });
  const definition = version.data?.definition ?? stored.definition ?? NO_DEFINITION;
  const view = useDynamicForm(definition, stored.answers);
  return (
    <Modal
      opened={consent !== null}
      onClose={onClose}
      title={consent?.procedure_name ?? "Consent"}
      size="lg"
    >
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          {version.data
            ? `Hospital consent form, version ${version.data.version}`
            : "Built-in consent form"}
        </Text>
        {version.isError && (
          <QueryError error={version.error} onRetry={() => void version.refetch()} />
        )}
        {stored.answers ? (
          <DynamicFields definition={definition} control={view.control} readOnly />
        ) : (
          <Text size="sm">This consent was taken before consent forms were configurable.</Text>
        )}
      </Stack>
    </Modal>
  );
}
