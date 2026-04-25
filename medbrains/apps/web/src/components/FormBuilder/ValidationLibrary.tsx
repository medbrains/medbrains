import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useFormBuilderStore } from "@medbrains/stores";
import type { FormBuilderValidationRule } from "@medbrains/types";
import {
  IconCheck,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import classes from "./form-builder.module.scss";

// ── Validation Rule Templates ────────────────────────────

interface ValidationTemplate {
  id: string;
  category: string;
  name: string;
  rule: FormBuilderValidationRule;
}

const TEMPLATES: ValidationTemplate[] = [
  // Text
  { id: "required", category: "Text", name: "Required", rule: { type: "required", value: true, message: "This field is required" } },
  { id: "min-length-2", category: "Text", name: "Min Length (2)", rule: { type: "min_length", value: 2, message: "Must be at least 2 characters" } },
  { id: "max-length-255", category: "Text", name: "Max Length (255)", rule: { type: "max_length", value: 255, message: "Must be at most 255 characters" } },

  // Format
  { id: "email", category: "Format", name: "Email", rule: { type: "regex", value: "^[\\w.+-]+@[\\w-]+\\.[a-zA-Z]{2,}$", message: "Please enter a valid email" } },
  { id: "phone-india", category: "Format", name: "Phone (India)", rule: { type: "regex", value: "^[6-9]\\d{9}$", message: "Enter 10-digit mobile number" } },
  { id: "aadhaar", category: "Format", name: "Aadhaar", rule: { type: "regex", value: "^\\d{4}\\s?\\d{4}\\s?\\d{4}$", message: "Enter valid 12-digit Aadhaar" } },
  { id: "abha", category: "Format", name: "ABHA Number", rule: { type: "regex", value: "^\\d{14}$", message: "Enter valid 14-digit ABHA" } },
  { id: "pincode", category: "Format", name: "PIN Code", rule: { type: "regex", value: "^\\d{6}$", message: "Enter valid 6-digit PIN code" } },
  { id: "pan", category: "Format", name: "PAN", rule: { type: "regex", value: "^[A-Z]{5}\\d{4}[A-Z]$", message: "Enter valid PAN number" } },

  // Number
  { id: "positive", category: "Number", name: "Positive", rule: { type: "min", value: 0, message: "Must be a positive number" } },
  { id: "age-range", category: "Number", name: "Age (0-150)", rule: { type: "custom_expr", value: "value >= 0 && value <= 150", message: "Age must be 0-150" } },
  { id: "percentage", category: "Number", name: "Percentage", rule: { type: "custom_expr", value: "value >= 0 && value <= 100", message: "Must be 0-100%" } },

  // Clinical
  { id: "bp-systolic", category: "Clinical", name: "BP Systolic", rule: { type: "custom_expr", value: "value >= 50 && value <= 300", message: "BP systolic: 50-300 mmHg" } },
  { id: "bp-diastolic", category: "Clinical", name: "BP Diastolic", rule: { type: "custom_expr", value: "value >= 20 && value <= 200", message: "BP diastolic: 20-200 mmHg" } },
  { id: "temperature", category: "Clinical", name: "Temperature (F)", rule: { type: "custom_expr", value: "value >= 90 && value <= 110", message: "Temperature: 90-110 F" } },
  { id: "pulse", category: "Clinical", name: "Pulse", rule: { type: "custom_expr", value: "value >= 20 && value <= 250", message: "Pulse rate: 20-250 bpm" } },
  { id: "spo2", category: "Clinical", name: "SpO2", rule: { type: "custom_expr", value: "value >= 0 && value <= 100", message: "SpO2: 0-100%" } },
  { id: "weight-kg", category: "Clinical", name: "Weight (kg)", rule: { type: "custom_expr", value: "value > 0 && value <= 500", message: "Weight: 0-500 kg" } },
  { id: "height-cm", category: "Clinical", name: "Height (cm)", rule: { type: "custom_expr", value: "value > 0 && value <= 300", message: "Height: 0-300 cm" } },
];

const CATEGORIES = [...new Set(TEMPLATES.map((t) => t.category))];

const CATEGORY_COLORS: Record<string, string> = {
  Text: "primary",
  Format: "violet",
  Number: "success",
  Clinical: "danger",
};

// ── Component ────────────────────────────────────────────

interface ValidationLibraryProps {
  opened: boolean;
  onClose: () => void;
  fieldId: string;
  currentRules: FormBuilderValidationRule[];
}

export function ValidationLibrary({
  opened,
  onClose,
  fieldId,
  currentRules,
}: ValidationLibraryProps) {
  const addValidationRule = useFormBuilderStore((s) => s.addValidationRule);
  const [search, setSearch] = useState("");

  // Check which templates are already applied
  const appliedSet = useMemo(() => {
    const set = new Set<string>();
    for (const template of TEMPLATES) {
      const isApplied = currentRules.some(
        (r) => r.type === template.rule.type && String(r.value) === String(template.rule.value),
      );
      if (isApplied) set.add(template.id);
    }
    return set;
  }, [currentRules]);

  // Filter templates by search
  const filteredTemplates = useMemo(() => {
    if (!search.trim()) return TEMPLATES;
    const q = search.toLowerCase();
    return TEMPLATES.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.rule.message.toLowerCase().includes(q),
    );
  }, [search]);

  const handleApply = (template: ValidationTemplate) => {
    if (appliedSet.has(template.id)) return;
    addValidationRule(fieldId, { ...template.rule });
  };

  const handleApplyCategory = (category: string) => {
    const categoryTemplates = filteredTemplates.filter(
      (t) => t.category === category && !appliedSet.has(t.id),
    );
    for (const t of categoryTemplates) {
      addValidationRule(fieldId, { ...t.rule });
    }
  };

  // Group by category
  const groupedCategories = useMemo(() => {
    const groups: { category: string; templates: ValidationTemplate[] }[] = [];
    for (const cat of CATEGORIES) {
      const catTemplates = filteredTemplates.filter((t) => t.category === cat);
      if (catTemplates.length > 0) {
        groups.push({ category: cat, templates: catTemplates });
      }
    }
    return groups;
  }, [filteredTemplates]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={600} size="sm">
          Validation Rule Library
        </Text>
      }
      size="lg"
    >
      <Stack gap="md">
        <TextInput
          placeholder="Search rules..."
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          size="sm"
        />

        <ScrollArea h={400} offsetScrollbars>
          <Stack gap="lg">
            {groupedCategories.map(({ category, templates }) => {
              const unappliedCount = templates.filter((t) => !appliedSet.has(t.id)).length;

              return (
                <div key={category}>
                  <Group justify="space-between" mb="xs">
                    <Group gap="xs">
                      <Badge size="sm" variant="light" color={CATEGORY_COLORS[category] ?? "slate"}>
                        {category}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {templates.length} rules
                      </Text>
                    </Group>
                    {unappliedCount > 0 && (
                      <Button
                        size="compact-xs"
                        variant="subtle"
                        onClick={() => handleApplyCategory(category)}
                      >
                        Apply All ({unappliedCount})
                      </Button>
                    )}
                  </Group>

                  <Stack gap={4}>
                    {templates.map((template) => {
                      const isApplied = appliedSet.has(template.id);

                      return (
                        <Group
                          key={template.id}
                          className={classes.validationTemplateRow}
                          justify="space-between"
                          wrap="nowrap"
                          gap="xs"
                          px="sm"
                          py={6}
                          style={{
                            borderRadius: "var(--mantine-radius-sm)",
                            background: isApplied
                              ? "var(--mantine-color-gray-0)"
                              : "transparent",
                            opacity: isApplied ? 0.6 : 1,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text size="sm" fw={500} truncate>
                              {template.name}
                            </Text>
                            <Text size="xs" c="dimmed" truncate>
                              {template.rule.message}
                            </Text>
                          </div>

                          <Badge size="xs" variant="light" color="slate">
                            {template.rule.type}
                          </Badge>

                          {isApplied ? (
                            <Tooltip label="Already applied">
                              <ActionIcon size="sm" variant="subtle" color="success" disabled aria-label="Confirm">
                                <IconCheck size={14} />
                              </ActionIcon>
                            </Tooltip>
                          ) : (
                            <Tooltip label="Apply rule">
                              <ActionIcon
                                size="sm"
                                variant="light"
                                color="primary"
                                onClick={() => handleApply(template)}
                                aria-label="Add"
                              >
                                <IconPlus size={14} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      );
                    })}
                  </Stack>
                </div>
              );
            })}

            {groupedCategories.length === 0 && (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                No rules match your search.
              </Text>
            )}
          </Stack>
        </ScrollArea>
      </Stack>
    </Modal>
  );
}
