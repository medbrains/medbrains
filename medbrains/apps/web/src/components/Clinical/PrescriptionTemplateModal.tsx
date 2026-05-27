import { Button, Group, Modal, Stack, Switch, Text, Textarea, TextInput } from "@mantine/core";
import { IconDeviceFloppy } from "@tabler/icons-react";

interface PrescriptionTemplateModalProps {
  opened: boolean;
  onClose: () => void;
  templateName: string;
  onTemplateNameChange: (val: string) => void;
  templateDesc: string;
  onTemplateDescChange: (val: string) => void;
  templateShared: boolean;
  onTemplateSharedChange: (val: boolean) => void;
  itemCount: number;
  onSave: () => void;
  canSaveTemplate: boolean;
  isSaving: boolean;
}

export function PrescriptionTemplateModal({
  opened,
  onClose,
  templateName,
  onTemplateNameChange,
  templateDesc,
  onTemplateDescChange,
  templateShared,
  onTemplateSharedChange,
  itemCount,
  onSave,
  canSaveTemplate,
  isSaving,
}: PrescriptionTemplateModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Save Prescription Set" size="sm">
      <Stack gap="sm">
        <TextInput
          label="Set Name"
          placeholder="e.g. Hypertension Standard"
          value={templateName}
          onChange={(e) => onTemplateNameChange(e.currentTarget.value)}
          disabled={!canSaveTemplate}
          required
        />
        <Textarea
          label="Description"
          placeholder="Optional description"
          value={templateDesc}
          onChange={(e) => onTemplateDescChange(e.currentTarget.value)}
          disabled={!canSaveTemplate}
          autosize
          minRows={2}
        />
        <Switch
          label="Share with department"
          description="Other doctors in your department can use this saved prescription set"
          checked={templateShared}
          onChange={(e) => onTemplateSharedChange(e.currentTarget.checked)}
          disabled={!canSaveTemplate}
        />
        <Text size="xs" c="dimmed">
          {itemCount} medication{itemCount !== 1 ? "s" : ""} will be saved
        </Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSave}
            loading={isSaving}
            disabled={!canSaveTemplate || !templateName.trim()}
            leftSection={<IconDeviceFloppy size={14} />}
          >
            Save Set
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
