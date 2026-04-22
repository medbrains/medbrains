import {
  Button,
  Group,
  Modal,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
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
  isSaving,
}: PrescriptionTemplateModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Save Prescription Template" size="sm">
      <Stack gap="sm">
        <TextInput
          label="Template Name"
          placeholder="e.g. Hypertension Standard"
          value={templateName}
          onChange={(e) => onTemplateNameChange(e.currentTarget.value)}
          required
        />
        <Textarea
          label="Description"
          placeholder="Optional description"
          value={templateDesc}
          onChange={(e) => onTemplateDescChange(e.currentTarget.value)}
          autosize
          minRows={2}
        />
        <Switch
          label="Share with department"
          description="Other doctors in your department can use this template"
          checked={templateShared}
          onChange={(e) => onTemplateSharedChange(e.currentTarget.checked)}
        />
        <Text size="xs" c="dimmed">
          {itemCount} medication{itemCount !== 1 ? "s" : ""} will be saved
        </Text>
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose}>Cancel</Button>
          <Button
            onClick={onSave}
            loading={isSaving}
            disabled={!templateName.trim()}
            leftSection={<IconDeviceFloppy size={14} />}
          >
            Save Template
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
