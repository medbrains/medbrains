import { Grid, Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { type FormDefinition, type FormTemplateDetail, P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { QueryError } from "@/components/QueryError";
import { Alert, Button, Drawer, Input, toast } from "@/components/ui";
import { FormPreview } from "./FormPreview";
import { SectionEditor } from "./SectionEditor";
import { VersionList } from "./VersionList";

export interface DraftForm {
  name: string;
  draft: FormDefinition;
}

interface FormEditorDrawerProps {
  templateId: string | null;
  onClose: () => void;
}

export function FormEditorDrawer({ templateId, onClose }: FormEditorDrawerProps) {
  const detail = useQuery({
    queryKey: ["form-template", templateId],
    queryFn: () => api.getFormTemplate(templateId ?? ""),
    enabled: templateId !== null,
  });
  return (
    <Drawer
      opened={templateId !== null}
      onClose={onClose}
      position="right"
      size="100%"
      title={detail.data?.template.name ?? "Form"}
    >
      {detail.isError && <QueryError error={detail.error} onRetry={() => void detail.refetch()} />}
      {detail.data && <FormEditor key={detail.data.template.updated_at} detail={detail.data} />}
    </Drawer>
  );
}

function FormEditor({ detail }: { detail: FormTemplateDetail }) {
  const { template, versions } = detail;
  const canManage = useHasPermission(P.FORMS.TEMPLATES.MANAGE);
  const canPublish = useHasPermission(P.FORMS.TEMPLATES.PUBLISH);
  const readOnly = !canManage;
  const queryClient = useQueryClient();
  const form = useForm<DraftForm>({ values: { name: template.name, draft: template.draft } });
  const sections = useFieldArray({ control: form.control, name: "draft.sections" });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["form-template", template.id] });
    void queryClient.invalidateQueries({ queryKey: ["form-templates"] });
  };
  const save = useMutation({
    mutationFn: (values: DraftForm) => api.updateFormTemplate(template.id, values),
  });
  const publish = useMutation({
    mutationFn: async (values: DraftForm) => {
      await api.updateFormTemplate(template.id, values);
      return api.publishFormTemplate(template.id);
    },
    onSuccess: (version) => {
      refresh();
      toast.success(`Staff now fill in version ${version.version}.`, { title: "Published" });
    },
  });
  const retire = useMutation({
    mutationFn: () => api.retireFormTemplate(template.id),
    onSuccess: () => {
      refresh();
      toast.success("Staff go back to the built-in form, if there is one.", { title: "Retired" });
    },
  });
  const failure = (save.error ?? publish.error ?? retire.error) as Error | null;

  return (
    <form
      aria-label="Form editor"
      noValidate
      onSubmit={form.handleSubmit((values) =>
        save.mutate(values, {
          onSuccess: () => {
            refresh();
            toast.success("Draft saved. Staff still see the published version.", {
              title: "Saved",
            });
          },
        }),
      )}
    >
      <Stack gap="md">
        {failure && (
          <Alert tone="danger" title="That didn't work">
            {failure.message}
          </Alert>
        )}
        {template.status === "retired" && (
          <Alert tone="info" title="This form is retired">
            Staff no longer fill it in. Records already taken keep their version. Publish it again
            to bring it back.
          </Alert>
        )}
        <Group align="flex-end">
          <Input label="Name" readOnly={readOnly} {...form.register("name")} style={{ flex: 1 }} />
          <Text size="sm" c="dimmed">
            Code {template.code} ·{" "}
            {template.published_version
              ? `live: v${template.published_version}`
              : "not published yet"}
          </Text>
        </Group>
        <Grid>
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Stack gap="md">
              {sections.fields.map((section, index) => (
                <SectionEditor
                  key={section.id}
                  control={form.control}
                  index={index}
                  readOnly={readOnly}
                  onRemove={() => sections.remove(index)}
                />
              ))}
              {!readOnly && (
                <Button
                  tone="secondary"
                  onClick={() => sections.append({ title: "New section", fields: [] })}
                >
                  Add section
                </Button>
              )}
            </Stack>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Stack gap="md">
              <FormPreview control={form.control} />
              <VersionList versions={versions} />
            </Stack>
          </Grid.Col>
        </Grid>
        {!readOnly && (
          <Group justify="flex-end">
            {template.status !== "retired" && (
              <Button
                tone="danger-ghost"
                onClick={() => retire.mutate()}
                loading={retire.isPending}
              >
                Retire
              </Button>
            )}
            <Button tone="secondary" type="submit" loading={save.isPending}>
              Save draft
            </Button>
            {canPublish && (
              <Button
                tone="primary"
                loading={publish.isPending}
                onClick={form.handleSubmit((values) => publish.mutate(values))}
              >
                Publish
              </Button>
            )}
          </Group>
        )}
      </Stack>
    </form>
  );
}
