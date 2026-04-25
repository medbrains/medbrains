import { useMemo, useState } from "react";
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
import {
  IconAlertTriangle,
  IconBookmark,
  IconChevronDown,
  IconChevronUp,
  IconMedicineSyrup,
  IconPill,
  IconPlus,
  IconPrinter,
  IconTemplate,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@medbrains/api";
import type {
  ComplianceSettings,
  CreatePrescriptionRequest,
  CreatePrescriptionTemplateRequest,
  DrugInteractionAlert,
  AllergyConflict,
  PrescriptionItemInput,
  PrescriptionTemplate,
  PrescriptionWithItems,
  TenantSettingsRow,
} from "@medbrains/types";
import { instructionsDisplayText } from "../../lib/medication-timing-utils";
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
  isSaving?: boolean;
  onPrint?: (rx: PrescriptionWithItems) => void;
  onSendToPharmacy?: (rxId: string) => void;
}

export function PrescriptionWriter({
  patientId,
  prescriptions,
  canUpdate,
  onSave,
  isSaving,
  onPrint,
  onSendToPharmacy,
}: PrescriptionWriterProps) {
  const { t } = useTranslation("clinical");
  const queryClient = useQueryClient();
  const [showForm, { toggle: toggleForm, close: closeForm }] = useDisclosure(false);
  const [pendingItems, setPendingItems] = useState<PrescriptionItemInput[]>([]);
  const [rxNotes, setRxNotes] = useState("");
  const [notesOpen, { toggle: toggleNotes }] = useDisclosure(false);
  const [saveTemplateOpen, { open: openSaveTemplate, close: closeSaveTemplate }] = useDisclosure(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [templateShared, setTemplateShared] = useState(false);

  // ── Data Queries ──
  const { data: drugCatalog = [] } = useQuery({
    queryKey: ["pharmacy-catalog"],
    queryFn: () => api.listPharmacyCatalog(),
    staleTime: 300_000,
  });

  const { data: complianceRaw = [] } = useQuery<TenantSettingsRow[]>({
    queryKey: ["tenant-settings", "compliance"],
    queryFn: () => api.getTenantSettings("compliance"),
    staleTime: 300_000,
  });

  const compliance = useMemo(() => {
    const defaults: ComplianceSettings = {
      enforce_drug_scheduling: false, enforce_ndps_tracking: false, enforce_formulary: false,
      enforce_drug_interactions: false, enforce_antibiotic_stewardship: false, enforce_lasa_warnings: false,
      enforce_max_dose_check: false, enforce_batch_tracking: false, show_schedule_badges: true,
      show_controlled_warnings: true, show_formulary_status: true, show_aware_category: true,
    };
    for (const row of complianceRaw) {
      const key = row.key as keyof ComplianceSettings;
      if (key in defaults) defaults[key] = row.value === true || row.value === "true";
    }
    return defaults;
  }, [complianceRaw]);

  const { data: templates = [] } = useQuery({
    queryKey: ["prescription-templates"],
    queryFn: () => api.listPrescriptionTemplates(),
    staleTime: 300_000,
  });

  // ── Template Mutations ──
  const saveTemplateMut = useMutation({
    mutationFn: (data: CreatePrescriptionTemplateRequest) => api.createPrescriptionTemplate(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prescription-templates"] });
      notifications.show({ title: "Template saved", message: `"${templateName}" saved`, color: "success" });
      closeSaveTemplate();
      setTemplateName(""); setTemplateDesc(""); setTemplateShared(false);
    },
    onError: () => { notifications.show({ title: "Error", message: "Failed to save template", color: "danger" }); },
  });

  const deleteTemplateMut = useMutation({
    mutationFn: (id: string) => api.deletePrescriptionTemplate(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["prescription-templates"] });
      notifications.show({ title: "Deleted", message: "Template removed", color: "warning" });
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
      setSafetyAlerts(await api.checkDrugSafety({ drug_names: items.map((i) => i.drug_name), patient_id: patientId }));
    } catch { /* don't block prescribing */ }
  };

  // ── Handlers ──
  const handleAddItem = (item: PrescriptionItemInput) => {
    const updated = [...pendingItems, item];
    setPendingItems(updated);
    checkDrugSafety(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = pendingItems.filter((_, i) => i !== index);
    setPendingItems(updated);
    checkDrugSafety(updated);
  };

  const handleSave = () => {
    if (pendingItems.length === 0) return;
    onSave({ notes: rxNotes.trim() || undefined, items: pendingItems });
    setPendingItems([]); setRxNotes(""); closeForm();
  };

  const handleLoadTemplate = (tpl: PrescriptionTemplate) => {
    setPendingItems(tpl.items);
    if (!showForm) toggleForm();
    notifications.show({ title: "Template loaded", message: `"${tpl.name}" loaded with ${tpl.items.length} items`, color: "primary" });
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim() || pendingItems.length === 0) return;
    saveTemplateMut.mutate({ name: templateName.trim(), description: templateDesc.trim() || undefined, is_shared: templateShared, items: pendingItems });
  };

  return (
    <Stack gap="sm">
      {/* Toolbar */}
      {canUpdate && (
        <Group>
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={toggleForm} variant={showForm ? "light" : "filled"}>
            {showForm ? t("common:cancel") : t("prescription.newPrescription")}
          </Button>
          {templates.length > 0 && (
            <Menu shadow="md" width={260}>
              <Menu.Target>
                <Button size="xs" variant="light" leftSection={<IconTemplate size={14} />}>Templates</Button>
              </Menu.Target>
              <Menu.Dropdown>
                {templates.map((tpl: PrescriptionTemplate) => (
                  <Menu.Item key={tpl.id} leftSection={<IconBookmark size={14} />}
                    rightSection={<ActionIcon variant="subtle" color="danger" size="xs" onClick={(e) => { e.stopPropagation(); deleteTemplateMut.mutate(tpl.id); }} aria-label="Delete"><IconTrash size={12} /></ActionIcon>}
                    onClick={() => handleLoadTemplate(tpl)}>
                    <Text size="sm" fw={500}>{tpl.name}</Text>
                    <Text size="xs" c="dimmed">{tpl.items.length} items{tpl.is_shared ? " · Shared" : ""}</Text>
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      )}

      {/* Entry form */}
      {showForm && (
        <Card padding="sm" radius="md" withBorder className={styles.writerCard}>
          <Stack gap="xs">
            <PrescriptionItemEntry drugCatalog={drugCatalog} compliance={compliance} onAdd={handleAddItem} />

            {/* Safety alerts */}
            {safetyAlerts.allergy_conflicts.length > 0 && (
              <Alert color="danger" icon={<IconAlertTriangle size={16} />} title="Allergy Conflict Detected" variant="light">
                {safetyAlerts.allergy_conflicts.map((c, i) => (
                  <Text key={i} size="xs"><Text span fw={700}>{c.drug_name}</Text> conflicts with allergy to <Text span fw={700}>{c.allergen_name}</Text>{c.severity && <> ({c.severity})</>}{c.reaction && <> — {c.reaction}</>}</Text>
                ))}
              </Alert>
            )}
            {safetyAlerts.interactions.length > 0 && (
              <Alert color="orange" icon={<IconAlertTriangle size={16} />} title="Drug Interaction Warning" variant="light">
                {safetyAlerts.interactions.map((ia, i) => (
                  <Text key={i} size="xs">
                    <Badge size="xs" color={ia.severity === "contraindicated" ? "danger" : ia.severity === "major" ? "orange" : "warning"} mr={4}>{ia.severity}</Badge>
                    <Text span fw={700}>{ia.drug_a}</Text> + <Text span fw={700}>{ia.drug_b}</Text>: {ia.description}
                    {ia.management && <Text size="xs" c="dimmed" mt={2}>Management: {ia.management}</Text>}
                  </Text>
                ))}
              </Alert>
            )}

            {/* Rx notes */}
            <Button variant="subtle" size="xs" onClick={toggleNotes} rightSection={notesOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />} style={{ alignSelf: "flex-start" }}>
              {t("prescription.instructions")}
            </Button>
            <Collapse expanded={notesOpen}>
              <Textarea placeholder={t("prescription.generalNotes")} value={rxNotes} onChange={(e) => setRxNotes(e.currentTarget.value)} autosize minRows={2} maxRows={4} />
            </Collapse>

            {/* Pending items table */}
            <PrescriptionItemsTable items={pendingItems} onRemoveItem={handleRemoveItem} onSave={handleSave} onOpenSaveTemplate={openSaveTemplate} isSaving={isSaving} />
          </Stack>
        </Card>
      )}

      {/* Existing prescriptions */}
      {prescriptions.map((p) => (
        <ExistingPrescriptionCard key={p.prescription.id} rx={p} onPrint={onPrint} onSendToPharmacy={onSendToPharmacy} />
      ))}

      {!showForm && prescriptions.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="md">{t("prescription.noPrescriptions")}</Text>
      )}

      <PrescriptionTemplateModal
        opened={saveTemplateOpen} onClose={closeSaveTemplate}
        templateName={templateName} onTemplateNameChange={setTemplateName}
        templateDesc={templateDesc} onTemplateDescChange={setTemplateDesc}
        templateShared={templateShared} onTemplateSharedChange={setTemplateShared}
        itemCount={pendingItems.length} onSave={handleSaveTemplate} isSaving={saveTemplateMut.isPending}
      />
    </Stack>
  );
}

/** Existing prescription display card */
function ExistingPrescriptionCard({ rx, onPrint, onSendToPharmacy }: {
  rx: PrescriptionWithItems;
  onPrint?: (rx: PrescriptionWithItems) => void;
  onSendToPharmacy?: (rxId: string) => void;
}) {
  const { t } = useTranslation("clinical");
  return (
    <Card padding="sm" radius="md" withBorder>
      <Group gap={8} mb="xs" justify="space-between">
        <Group gap={8}>
          <IconPill size={16} color="var(--mantine-color-primary-5)" />
          <Text size="xs" c="dimmed">{new Date(rx.prescription.created_at).toLocaleString()}</Text>
          {rx.prescription.notes && <Text size="xs" c="dimmed" fs="italic">— {rx.prescription.notes}</Text>}
        </Group>
        <Group gap={4}>
          {onSendToPharmacy && (
            <Tooltip label="Send to Pharmacy"><ActionIcon variant="subtle" color="teal" size="sm" onClick={() => onSendToPharmacy(rx.prescription.id)} aria-label="Medicine Syrup"><IconMedicineSyrup size={14} /></ActionIcon></Tooltip>
          )}
          {onPrint && (
            <Tooltip label={t("prescription.print")}><ActionIcon variant="subtle" size="sm" onClick={() => onPrint(rx)} aria-label="Print"><IconPrinter size={14} /></ActionIcon></Tooltip>
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
                <Table.Td><Text size="sm" fw={500}>{item.drug_name}</Text></Table.Td>
                <Table.Td>{item.dosage}</Table.Td>
                <Table.Td><Badge size="xs" variant="light">{item.frequency}</Badge></Table.Td>
                <Table.Td>{item.duration}</Table.Td>
                <Table.Td>{item.route ?? "—"}</Table.Td>
                <Table.Td><Text size="xs" c="dimmed">{timing ?? "—"}</Text></Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Card>
  );
}
