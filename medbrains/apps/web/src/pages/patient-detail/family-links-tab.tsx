// PATIENT DetailFamilyLinksTab — split from patient-detail.tsx (pure move).

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Loader, Modal, Select, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { PatientDetailFamilyLinkFormInput } from "@medbrains/schemas";
import { patientDetailFamilyLinkFormSchema } from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { FamilyLinkRow, Patient } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Badge, Button, IconButton, Table } from "@/components/ui";
import {
  DEFAULT_PATIENT_FAMILY_LINK_FORM_VALUES,
  PATIENT_RELATIONSHIP_OPTIONS,
  toCreateFamilyLinkRequest,
} from "@/forms/patient-detail.form";
import { confirmDestructive } from "@/lib/confirm";
import { patientDetailService } from "@/services/patientDetail.service";

export function DetailFamilyLinksTab({ patientId }: { patientId: string }) {
  const canUpdate = useHasPermission(P.PATIENTS.UPDATE);
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedRelated, setSelectedRelated] = useState<Patient | null>(null);
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PatientDetailFamilyLinkFormInput>({
    resolver: zodResolver(patientDetailFamilyLinkFormSchema),
    defaultValues: DEFAULT_PATIENT_FAMILY_LINK_FORM_VALUES,
  });

  const { data: links = [], isLoading } = useQuery<FamilyLinkRow[]>({
    queryKey: ["patient-family-links", patientId],
    queryFn: () => patientDetailService.listFamilyLinks(patientId),
  });

  const createMutation = useMutation({
    mutationFn: (values: PatientDetailFamilyLinkFormInput) =>
      patientDetailService.createFamilyLink(patientId, toCreateFamilyLinkRequest(values)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-family-links", patientId] });
      notifications.show({ title: "Linked", message: "Family member linked", color: "success" });
      handleClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (linkId: string) => patientDetailService.deleteFamilyLink(patientId, linkId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-family-links", patientId] });
    },
  });

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    try {
      const result = await patientDetailService.listPatients({
        page: 1,
        per_page: 5,
        search: searchTerm.trim(),
      });
      setSearchResults(result.patients.filter((p) => p.id !== patientId));
    } catch {
      setSearchResults([]);
    }
  };

  const handleClose = () => {
    close();
    setSearchTerm("");
    setSearchResults([]);
    setSelectedRelated(null);
    reset(DEFAULT_PATIENT_FAMILY_LINK_FORM_VALUES);
  };

  if (isLoading) return <Loader size="sm" />;

  return (
    <Stack gap="md">
      {canUpdate && (
        <Group justify="flex-end">
          <Button tone="primary" leftSection={<IconPlus size={14} />} size="sm" onClick={open}>
            Link Family Member
          </Button>
        </Group>
      )}

      {links.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No family links
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Relationship</Table.Th>
              <Table.Th>UHID</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Phone</Table.Th>
              <Table.Th>Gender</Table.Th>
              {canUpdate && <Table.Th w={40} />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {links.map((l) => (
              <Table.Tr key={l.id}>
                <Table.Td>
                  <Badge size="sm">{l.relationship}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {l.related_uhid ?? "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{l.related_name ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{l.related_phone ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{l.related_gender ?? "—"}</Text>
                </Table.Td>
                {canUpdate && (
                  <Table.Td>
                    <IconButton
                      tone="danger"
                      size="sm"
                      onClick={() =>
                        confirmDestructive({
                          title: "Delete record",
                          message: "Permanently delete this record? This cannot be undone.",
                          onConfirm: () => deleteMutation.mutate(l.id),
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

      <Modal opened={opened} onClose={handleClose} title="Link Family Member">
        <Stack
          component="form"
          gap="sm"
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        >
          <Group>
            <TextInput
              placeholder="Search by UHID, name or phone"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button tone="primary" size="sm" onClick={handleSearch}>
              Search
            </Button>
          </Group>
          {searchResults.length > 0 && (
            <Table>
              <Table.Tbody>
                {searchResults.map((p) => (
                  <Table.Tr
                    key={p.id}
                    style={{
                      cursor: "pointer",
                      background:
                        selectedRelated?.id === p.id ? "var(--mb-nav-active-bg)" : undefined,
                    }}
                    onClick={() => {
                      setSelectedRelated(p);
                      setValue("related_patient_id", p.id, { shouldValidate: true });
                    }}
                  >
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {p.uhid}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {p.first_name} {p.last_name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {p.phone}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          {selectedRelated && (
            <Alert tone="info">
              Selected: {selectedRelated.uhid} — {selectedRelated.first_name}{" "}
              {selectedRelated.last_name}
            </Alert>
          )}
          {errors.related_patient_id?.message && (
            <Text size="xs" c="danger">
              {errors.related_patient_id.message}
            </Text>
          )}
          <Controller
            name="relationship"
            control={control}
            render={({ field }) => (
              <Select
                label="Relationship"
                data={PATIENT_RELATIONSHIP_OPTIONS}
                value={field.value}
                onChange={(value) => field.onChange(value ?? "spouse")}
                error={errors.relationship?.message}
                required
              />
            )}
          />
          <Group justify="flex-end">
            <Button tone="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              tone="primary"
              type="submit"
              loading={createMutation.isPending}
              disabled={!selectedRelated}
            >
              Link
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// ── Documents Tab (Detail Page) ────────────────────────────
