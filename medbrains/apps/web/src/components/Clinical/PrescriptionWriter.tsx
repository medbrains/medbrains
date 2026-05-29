import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  Group,
  Menu,
  Stack,
  Table,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import {
  type AllergyConflict,
  type ComplianceSettings,
  type CreatePrescriptionRequest,
  type CreatePrescriptionTemplateRequest,
  type DrugInteractionAlert,
  P,
  type PrescriptionItemInput,
  type PrescriptionTemplate,
  type PrescriptionWithItems,
  type TenantSettingsRow,
  type UpdatePrescriptionRequest,
} from "@medbrains/types";
import {
  IconAlertTriangle,
  IconBookmark,
  IconChevronDown,
  IconChevronUp,
  IconPencil,
  IconPill,
  IconPlus,
  IconPrinter,
  IconTemplate,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { instructionsDisplayText } from "@/lib/medication-timing-utils";
import { clinicalSupportService } from "@/services/clinicalSupport.service";
import { PrescriptionItemEntry } from "./PrescriptionItemEntry";
import { PrescriptionItemsTable } from "./PrescriptionItemsTable";
import { PrescriptionTemplateModal } from "./PrescriptionTemplateModal";
import styles from "./prescription-writer.module.scss";

interface PrescriptionWriterProps {
  encounterId: string;
  patientId?: string;
  prescriptions: PrescriptionWithItems[];
  canUpdate: boolean;
  onSave: (data: CreatePrescriptionRequest) => void;
  onUpdate?: (prescriptionId: string, data: UpdatePrescriptionRequest) => void;
  isSaving?: boolean;
  isUpdating?: boolean;
  onPrint?: (rx: PrescriptionWithItems) => void;
}

export function PrescriptionWriter({
  patientId,
  prescriptions,
  canUpdate,
  onSave,
  onUpdate,
  isSaving,
  isUpdating,
  onPrint,
}: PrescriptionWriterProps) {
  const { t } = useTranslation("clinical");
  const queryClient = useQueryClient();
  const [showForm, { toggle: toggleForm, close: closeForm }] = useDisclosure(false);
  const [editingPrescriptionId, setEditingPrescriptionId] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<PrescriptionItemInput[]>([]);
  const [rxNotes, setRxNotes] = useState("");
  const [notesOpen, { toggle: toggleNotes }] = useDisclosure(false);
  const [saveTemplateOpen, { open: openSaveTemplate, close: closeSaveTemplate }] =
    useDisclosure(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [templateShared, setTemplateShared] = useState(false);
  const hasPrescriptionWritePermission = useHasPermission(P.OPD.VISIT_UPDATE);
  const hasTemplateListPermission = useHasAnyPermission([
    P.OPD.QUEUE_VIEW,
    P.OPD.VISIT_UPDATE,
    P.PHARMACY.DISPENSING_CREATE,
  ]);
  const canWritePrescription = canUpdate && hasPrescriptionWritePermission;
  const canUseSavedRxSets = canWritePrescription && hasTemplateListPermission;

  // ── Data Queries ──
  const { data: drugCatalog = [] } = useQuery({
    queryKey: ["pharmacy-catalog"],
    queryFn: () => clinicalSupportService.listPharmacyCatalog(),
    staleTime: 300_000,
  });

  const { data: complianceRaw = [] } = useQuery<TenantSettingsRow[]>({
    queryKey: ["tenant-settings", "compliance"],
    queryFn: () => clinicalSupportService.getTenantSettings("compliance"),
    staleTime: 300_000,
  });

  const compliance = useMemo(() => {
    const defaults: ComplianceSettings = {
      enforce_drug_scheduling: false,
      enforce_ndps_tracking: false,
      enforce_formulary: false,
      enforce_drug_interactions: false,
      enforce_antibiotic_stewardship: false,
      enforce_lasa_warnings: false,
      enforce_max_dose_check: false,
      enforce_batch_tracking: false,
      show_schedule_badges: true,
      show_controlled_warnings: true,
      show_formulary_status: true,
      show_aware_category: true,
    };
    for (const row of complianceRaw) {
      const key = row.key as keyof ComplianceSettings;
      if (key in defaults) defaults[key] = row.value === true || row.value === "true";
    }
    return defaults;
  }, [complianceRaw]);

  const { data: templates = [] } = useQuery({
    queryKey: ["prescription-templates"],
    queryFn: () => clinicalSupportService.listPrescriptionTemplates(),
    enabled: canUseSavedRxSets,
    staleTime: 300_000,
  });

  // ── Template Mutations ──
  const saveTemplateMut = useMutation({
    mutationFn: (data: CreatePrescriptionTemplateRequest) =>
      clinicalSupportService.createPrescriptionTemplate(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prescription-templates"] });
      notifications.show({
        title: "Saved Rx set",
        message: `"${templateName}" saved`,
        color: "success",
      });
      closeSaveTemplate();
      setTemplateName("");
      setTemplateDesc("");
      setTemplateShared(false);
    },
    onError: () => {
      notifications.show({ title: "Error", message: "Failed to save template", color: "danger" });
    },
  });

  const deleteTemplateMut = useMutation({
    mutationFn: (id: string) => clinicalSupportService.deletePrescriptionTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prescription-templates"] });
      notifications.show({ title: "Deleted", message: "Saved Rx set removed", color: "warning" });
    },
  });

  // ── Drug Safety ──
  const [safetyAlerts, setSafetyAlerts] = useState<{
    interactions: DrugInteractionAlert[];
    allergy_conflicts: AllergyConflict[];
  }>({ interactions: [], allergy_conflicts: [] });

  const checkDrugSafety = async (items: PrescriptionItemInput[]) => {
    if (items.length === 0 || !compliance.enforce_drug_interactions) {
      setSafetyAlerts({ interactions: [], allergy_conflicts: [] });
      return;
    }
    try {
      setSafetyAlerts(
        await clinicalSupportService.checkDrugSafety({
          drug_names: items.map((i) => i.drug_name),
          patient_id: patientId,
        }),
      );
    } catch {
      /* don't block prescribing */
    }
  };

  // ── Handlers ──
  const handleAddItem = (item: PrescriptionItemInput) => {
    if (!canWritePrescription) return;
    const updated = [...pendingItems, item];
    setPendingItems(updated);
    checkDrugSafety(updated);
  };

  const handleRemoveItem = (index: number) => {
    if (!canWritePrescription) return;
    const updated = pendingItems.filter((_, i) => i !== index);
    setPendingItems(updated);
    checkDrugSafety(updated);
  };

  const handleSave = () => {
    if (!canWritePrescription || pendingItems.length === 0) return;
    if (editingPrescriptionId && onUpdate) {
      onUpdate(editingPrescriptionId, {
        notes: rxNotes.trim() || undefined,
        items: pendingItems,
      });
    } else {
      onSave({ notes: rxNotes.trim() || undefined, items: pendingItems });
    }
    setPendingItems([]);
    setRxNotes("");
    setEditingPrescriptionId(null);
    closeForm();
  };

  const handleCancelForm = () => {
    setPendingItems([]);
    setRxNotes("");
    setEditingPrescriptionId(null);
    closeForm();
  };

  const handleEditPrescription = (rx: PrescriptionWithItems) => {
    if (!canWritePrescription) return;
    setPendingItems(
      rx.items.map((item) => ({
        drug_name: item.drug_name,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        route: item.route ?? undefined,
        instructions: item.instructions ?? undefined,
        catalog_item_id: item.catalog_item_id ?? undefined,
      })),
    );
    setRxNotes(rx.prescription.notes ?? "");
    setEditingPrescriptionId(rx.prescription.id);
    if (!showForm) {
      toggleForm();
    }
  };

  const handleLoadTemplate = (tpl: PrescriptionTemplate) => {
    if (!canWritePrescription) return;
    setPendingItems(tpl.items);
    setEditingPrescriptionId(null);
    if (!showForm) toggleForm();
    notifications.show({
      title: "Saved Rx set loaded",
      message: `"${tpl.name}" loaded with ${tpl.items.length} items`,
      color: "primary",
    });
  };

  const handleSaveTemplate = () => {
    if (!canWritePrescription || !templateName.trim() || pendingItems.length === 0) return;
    saveTemplateMut.mutate({
      name: templateName.trim(),
      description: templateDesc.trim() || undefined,
      is_shared: templateShared,
      items: pendingItems,
    });
  };

  return (
    <Stack gap="sm">
      {/* Toolbar */}
      {canWritePrescription && (
        <Group>
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={showForm ? handleCancelForm : toggleForm}
            variant={showForm ? "light" : "filled"}
          >
            {showForm
              ? t("common:cancel")
              : editingPrescriptionId
                ? "Edit prescription"
                : t("prescription.newPrescription")}
          </Button>
          {canUseSavedRxSets && templates.length > 0 && (
            <Menu shadow="md" width={260}>
              <Menu.Target>
                <Button size="xs" variant="light" leftSection={<IconTemplate size={14} />}>
                  Saved Rx Sets
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {templates.map((tpl: PrescriptionTemplate) => (
                  <Menu.Item
                    key={tpl.id}
                    leftSection={<IconBookmark size={14} />}
                    rightSection={
                      <ActionIcon
                        variant="subtle"
                        color="danger"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canWritePrescription) return;
                          deleteTemplateMut.mutate(tpl.id);
                        }}
                        aria-label="Delete"
                      >
                        <IconTrash size={12} />
                      </ActionIcon>
                    }
                    onClick={() => handleLoadTemplate(tpl)}
                  >
                    <Text size="sm" fw={500}>
                      {tpl.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {tpl.items.length} items{tpl.is_shared ? " · Shared" : ""}
                    </Text>
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      )}

      {/* Entry form */}
      {showForm && canWritePrescription && (
        <Card padding="sm" radius="md" withBorder className={styles.writerCard}>
          <Stack gap="xs">
            <PrescriptionItemEntry
              drugCatalog={drugCatalog}
              compliance={compliance}
              canAddItem={canWritePrescription}
              onAdd={handleAddItem}
            />

            {/* Safety alerts */}
            {safetyAlerts.allergy_conflicts.length > 0 && (
              <Alert
                color="danger"
                icon={<IconAlertTriangle size={16} />}
                title="Allergy Conflict Detected"
                variant="light"
              >
                {safetyAlerts.allergy_conflicts.map((c) => (
                  <Text key={`${c.drug_name}:${c.allergen_name}:${c.severity ?? ""}`} size="xs">
                    <Text span fw={700}>
                      {c.drug_name}
                    </Text>{" "}
                    conflicts with allergy to{" "}
                    <Text span fw={700}>
                      {c.allergen_name}
                    </Text>
                    {c.severity && <> ({c.severity})</>}
                    {c.reaction && <> — {c.reaction}</>}
                  </Text>
                ))}
              </Alert>
            )}
            {safetyAlerts.interactions.length > 0 && (
              <Alert
                color="orange"
                icon={<IconAlertTriangle size={16} />}
                title="Drug Interaction Warning"
                variant="light"
              >
                {safetyAlerts.interactions.map((ia) => (
                  <Text key={`${ia.drug_a}:${ia.drug_b}:${ia.severity}`} size="xs">
                    <Badge
                      size="xs"
                      color={
                        ia.severity === "contraindicated"
                          ? "danger"
                          : ia.severity === "major"
                            ? "orange"
                            : "warning"
                      }
                      mr={4}
                    >
                      {ia.severity}
                    </Badge>
                    <Text span fw={700}>
                      {ia.drug_a}
                    </Text>{" "}
                    +{" "}
                    <Text span fw={700}>
                      {ia.drug_b}
                    </Text>
                    : {ia.description}
                    {ia.management && (
                      <Text size="xs" c="dimmed" mt={2}>
                        Management: {ia.management}
                      </Text>
                    )}
                  </Text>
                ))}
              </Alert>
            )}

            {/* Rx notes */}
            <Button
              variant="subtle"
              size="xs"
              onClick={toggleNotes}
              rightSection={notesOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
              style={{ alignSelf: "flex-start" }}
            >
              {t("prescription.instructions")}
            </Button>
            <Collapse expanded={notesOpen}>
              <Textarea
                placeholder={t("prescription.generalNotes")}
                value={rxNotes}
                onChange={(e) => setRxNotes(e.currentTarget.value)}
                autosize
                minRows={2}
                maxRows={4}
              />
            </Collapse>

            {/* Pending items table */}
            <PrescriptionItemsTable
              items={pendingItems}
              drugCatalog={drugCatalog}
              onRemoveItem={handleRemoveItem}
              onSave={handleSave}
              onOpenSaveTemplate={openSaveTemplate}
              canManagePrescription={canWritePrescription}
              isSaving={editingPrescriptionId ? isUpdating : isSaving}
            />
          </Stack>
        </Card>
      )}

      {/* Existing prescriptions */}
      {prescriptions.map((p) => (
        <ExistingPrescriptionCard
          key={p.prescription.id}
          rx={p}
          canUpdate={canWritePrescription}
          onEdit={handleEditPrescription}
          onPrint={onPrint}
        />
      ))}

      {!showForm && prescriptions.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          {t("prescription.noPrescriptions")}
        </Text>
      )}

      <PrescriptionTemplateModal
        opened={saveTemplateOpen && canWritePrescription}
        onClose={closeSaveTemplate}
        templateName={templateName}
        onTemplateNameChange={setTemplateName}
        templateDesc={templateDesc}
        onTemplateDescChange={setTemplateDesc}
        templateShared={templateShared}
        onTemplateSharedChange={setTemplateShared}
        itemCount={pendingItems.length}
        onSave={handleSaveTemplate}
        canSaveTemplate={canWritePrescription}
        isSaving={saveTemplateMut.isPending}
      />
    </Stack>
  );
}

/** Existing prescription display card */
function ExistingPrescriptionCard({
  rx,
  canUpdate,
  onEdit,
  onPrint,
}: {
  rx: PrescriptionWithItems;
  canUpdate: boolean;
  onEdit: (rx: PrescriptionWithItems) => void;
  onPrint?: (rx: PrescriptionWithItems) => void;
}) {
  const { t } = useTranslation("clinical");
  const editable =
    canUpdate &&
    !rx.pharmacy_order_id &&
    (!rx.pharmacy_status || ["pending_review", "on_hold", "rejected"].includes(rx.pharmacy_status));
  return (
    <Card padding="sm" radius="md" withBorder>
      <Group gap={8} mb="xs" justify="space-between">
        <Group gap={8}>
          <IconPill size={16} color="var(--mantine-color-primary-5)" />
          <Text size="xs" c="dimmed">
            {new Date(rx.prescription.created_at).toLocaleString()}
          </Text>
          {rx.prescription.notes && (
            <Text size="xs" c="dimmed" fs="italic">
              — {rx.prescription.notes}
            </Text>
          )}
          {rx.pharmacy_status && (
            <Badge size="xs" variant="light" color={editable ? "orange" : "teal"}>
              {editable ? "Editable before approval" : rx.pharmacy_status.replace(/_/g, " ")}
            </Badge>
          )}
        </Group>
        <Group gap={4}>
          {editable && (
            <Tooltip label="Edit before pharmacy approval">
              <ActionIcon
                variant="subtle"
                color="primary"
                size="sm"
                onClick={() => onEdit(rx)}
                aria-label="Edit prescription"
              >
                <IconPencil size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {onPrint && (
            <Tooltip label={t("prescription.print")}>
              <ActionIcon variant="subtle" size="sm" onClick={() => onPrint(rx)} aria-label="Print">
                <IconPrinter size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("prescription.drug")}</Table.Th>
            <Table.Th>{t("prescription.dosage")}</Table.Th>
            <Table.Th>{t("prescription.frequency")}</Table.Th>
            <Table.Th>{t("prescription.duration")}</Table.Th>
            <Table.Th>{t("prescription.route")}</Table.Th>
            <Table.Th>When to Take</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rx.items.map((item) => {
            const timing = instructionsDisplayText(item.instructions);
            return (
              <Table.Tr key={item.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {item.drug_name}
                  </Text>
                </Table.Td>
                <Table.Td>{item.dosage}</Table.Td>
                <Table.Td>
                  <Badge size="xs" variant="light">
                    {item.frequency}
                  </Badge>
                </Table.Td>
                <Table.Td>{item.duration}</Table.Td>
                <Table.Td>{item.route ?? "—"}</Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {timing ?? "—"}
                  </Text>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Card>
  );
}
