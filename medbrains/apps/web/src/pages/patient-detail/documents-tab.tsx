// PATIENT DetailDocumentsTab — split from patient-detail.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Loader, Modal, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { PatientDetailDocumentFormInput } from "@medbrains/schemas";
import { patientDetailDocumentFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { PatientDocument } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { PrintDocumentButton } from "@/components/Print/PrintDocumentButton";
import { Badge, Button, IconButton, Table } from "@/components/ui";
import {
  DEFAULT_PATIENT_DOCUMENT_FORM_VALUES,
  PATIENT_DOCUMENT_TYPE_OPTIONS,
  toCreatePatientDocumentRequest,
} from "@/forms/patient-detail.form";
import { confirmDestructive } from "@/lib/confirm";
import { patientDetailService } from "@/services/patientDetail.service";
import { formatDate } from "./shared";

export function DetailDocumentsTab({ patientId }: { patientId: string }) {
  const canUpdate = useHasPermission(P.PATIENTS.UPDATE);
  // Same split as the allergies tab: uploading is patients.update, deleting
  // is patients.delete.
  const canDelete = useHasPermission(P.PATIENTS.DELETE);
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PatientDetailDocumentFormInput>({
    resolver: zodResolver(patientDetailDocumentFormSchema),
    defaultValues: DEFAULT_PATIENT_DOCUMENT_FORM_VALUES,
  });

  const { data: documents = [], isLoading } = useQuery<PatientDocument[]>({
    queryKey: ["patient-documents", patientId],
    queryFn: () => patientDetailService.listPatientDocuments(patientId),
  });

  const createMutation = useMutation({
    mutationFn: (values: PatientDetailDocumentFormInput) =>
      patientDetailService.createPatientDocument(patientId, toCreatePatientDocumentRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-documents", patientId] });
      notifications.show({ title: "Added", message: "Document added", color: "success" });
      handleClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => patientDetailService.deletePatientDocument(patientId, docId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-documents", patientId] });
    },
  });

  const handleClose = () => {
    close();
    reset(DEFAULT_PATIENT_DOCUMENT_FORM_VALUES);
  };

  if (isLoading) return <Loader size="sm" />;

  return (
    <Stack gap="md">
      {/* Statutory consent forms held against the patient rather than an
          admission. Each had a print-data endpoint and no renderer; each
          button hides itself when the caller lacks the permission its own
          endpoint enforces. */}
      <Group gap="xs" wrap="wrap">
        <PrintDocumentButton documentKey="consent.hiv" recordId={patientId} />
        <PrintDocumentButton documentKey="consent.photo" recordId={patientId} />
        <PrintDocumentButton documentKey="consent.organ_donation" recordId={patientId} />
        <PrintDocumentButton documentKey="consent.abdm" recordId={patientId} />
      </Group>
      {canUpdate && (
        <Group justify="flex-end">
          <Button tone="primary" leftSection={<IconPlus size={14} />} size="sm" onClick={open}>
            Add Document
          </Button>
        </Group>
      )}

      {documents.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No documents uploaded
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Size</Table.Th>
              <Table.Th>Date</Table.Th>
              {canUpdate && <Table.Th w={40} />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {documents.map((d) => (
              <Table.Tr key={d.id}>
                <Table.Td>
                  <Badge size="sm">{d.document_type}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {d.document_name}
                  </Text>
                  {d.notes && (
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {d.notes}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {d.file_size ? `${Math.round(d.file_size / 1024)} KB` : "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {formatDate(d.created_at)}
                  </Text>
                </Table.Td>
                {canDelete && (
                  <Table.Td>
                    <IconButton
                      tone="danger"
                      size="sm"
                      onClick={() =>
                        confirmDestructive({
                          title: "Delete document",
                          message: "Permanently delete this document? This cannot be undone.",
                          onConfirm: () => deleteMutation.mutate(d.id),
                        })
                      }
                      aria-label="Delete"
                    >
                      <IconTrash size={14} />
                    </IconButton>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={handleClose} title="Add Document">
        <Stack
          component="form"
          gap="sm"
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        >
          <Controller
            name="document_type"
            control={control}
            render={({ field }) => (
              <Select
                label="Document Type"
                data={PATIENT_DOCUMENT_TYPE_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "id_proof")}
                error={errors.document_type?.message}
                required
              />
            )}
          />
          <Controller
            name="document_name"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Document Name"
                placeholder="e.g. Aadhaar Card"
                value={field.value}
                onChange={field.onChange}
                error={errors.document_name?.message}
                required
              />
            )}
          />
          <Controller
            name="file_url"
            control={control}
            render={({ field }) => (
              <TextInput
                label="File URL"
                placeholder="https://..."
                value={field.value}
                onChange={field.onChange}
                error={errors.file_url?.message}
                required
              />
            )}
          />
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <Textarea
                label="Notes"
                placeholder="Optional notes"
                value={field.value}
                onChange={field.onChange}
                error={errors.notes?.message}
              />
            )}
          />
          <Group justify="flex-end">
            <Button tone="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button tone="primary" type="submit" loading={createMutation.isPending}>
              Add
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Merge Tab (Detail Page) ────────────────────────────────
