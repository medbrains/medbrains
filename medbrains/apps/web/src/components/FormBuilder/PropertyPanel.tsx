import {
  ActionIcon,
  Badge,
  Button,
  Collapse,
  Divider,
  Group,
  ScrollArea,
  Select,
  Slider,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useFormBuilderStore } from "@medbrains/stores";
import type {
  FormBuilderFieldNode,
  FormBuilderSectionNode,
  FormBuilderValidationRule,
} from "@medbrains/types";
import {
  IconBook,
  IconChevronDown,
  IconChevronUp,
  IconClick,
  IconInfoCircle,
  IconPlus,
  IconShield,
  IconTrash,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { ConditionBuilder, conditionOneLiner } from "./ConditionBuilder";
import { ComputedEditor } from "./ComputedEditor";
import { ValidationLibrary } from "./ValidationLibrary";
import { RegulatoryBrowser } from "./RegulatoryBrowser";
import { DataSourceEditor } from "./DataSourceEditor";
import { FieldActionsEditor } from "./FieldActionsEditor";
import classes from "./form-builder.module.scss";

// ── Column Span Slider Marks ────────────────────────────

const COL_SPAN_MARKS = [
  { value: 3, label: "25%" },
  { value: 4, label: "33%" },
  { value: 6, label: "50%" },
  { value: 12, label: "100%" },
];

const DATA_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "textarea", label: "Textarea" },
  { value: "number", label: "Number" },
  { value: "decimal", label: "Decimal" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date & Time" },
  { value: "time", label: "Time" },
  { value: "select", label: "Dropdown (Select)" },
  { value: "multiselect", label: "Multi-Select" },
  { value: "radio", label: "Radio" },
  { value: "checkbox", label: "Checkbox" },
  { value: "boolean", label: "Boolean (Switch)" },
  { value: "file", label: "File Upload" },
  { value: "hidden", label: "Hidden" },
  { value: "computed", label: "Computed" },
  { value: "json", label: "JSON" },
  { value: "uuid_fk", label: "UUID Foreign Key" },
];

const OPTION_TYPES = new Set(["select", "multiselect", "radio", "checkbox"]);

const REQUIREMENT_OPTIONS = [
  { value: "mandatory", label: "Mandatory" },
  { value: "conditional", label: "Conditional" },
  { value: "recommended", label: "Recommended" },
  { value: "optional", label: "Optional" },
];

const SECTION_LAYOUT_OPTIONS = [
  { value: "single", label: "Single Column" },
  { value: "two-column", label: "Two Column" },
  { value: "three-column", label: "Three Column" },
];

const SECTION_ICON_OPTIONS = [
  // People (Tabler)
  { group: "People", items: [
    { value: "user", label: "User" },
    { value: "users", label: "Users" },
    { value: "nurse", label: "Nurse" },
    { value: "hi-doctor", label: "Doctor" },
    { value: "hi-nurse", label: "Health Nurse" },
  ]},
  // Hospital Departments (Healthicons)
  { group: "Departments", items: [
    { value: "hi-cardiology", label: "Cardiology" },
    { value: "hi-neurology", label: "Neurology" },
    { value: "hi-pediatrics", label: "Pediatrics" },
    { value: "hi-gynecology", label: "Gynecology" },
    { value: "hi-oncology", label: "Oncology" },
    { value: "hi-radiology", label: "Radiology" },
    { value: "hi-pharmacy", label: "Pharmacy" },
    { value: "hi-nephrology", label: "Nephrology" },
    { value: "hi-hematology", label: "Hematology" },
    { value: "hi-gastroenterology", label: "Gastroenterology" },
    { value: "hi-endocrinology", label: "Endocrinology" },
    { value: "hi-hepatology", label: "Hepatology" },
    { value: "hi-rheumatology", label: "Rheumatology" },
    { value: "hi-urology", label: "Urology" },
    { value: "hi-orthopaedics", label: "Orthopaedics" },
    { value: "hi-ophthalmology", label: "Ophthalmology" },
    { value: "hi-general-surgery", label: "General Surgery" },
    { value: "hi-geriatrics", label: "Geriatrics" },
    { value: "hi-psychology", label: "Psychology" },
    { value: "hi-respirology", label: "Respirology" },
    { value: "hi-vascular-surgery", label: "Vascular Surgery" },
    { value: "hi-obstetrics", label: "Obstetrics" },
    { value: "hi-ent", label: "ENT" },
    { value: "hi-palliative-care", label: "Palliative Care" },
    { value: "hi-physical-therapy", label: "Physical Therapy" },
    { value: "hi-dental-hygiene", label: "Dental Hygiene" },
  ]},
  // Hospital Units (Healthicons)
  { group: "Units", items: [
    { value: "hi-emergency", label: "Emergency" },
    { value: "hi-admissions", label: "Admissions" },
    { value: "hi-icu", label: "ICU" },
    { value: "hi-ccu", label: "CCU" },
    { value: "hi-critical-care", label: "Critical Care" },
    { value: "hi-burn-unit", label: "Burn Unit" },
    { value: "hi-opd", label: "OPD" },
    { value: "hi-inpatient", label: "Inpatient" },
    { value: "hi-outpatient", label: "Outpatient" },
    { value: "hi-biochemistry-lab", label: "Biochemistry Lab" },
  ]},
  // Anatomy (Healthicons)
  { group: "Anatomy", items: [
    { value: "hi-heart", label: "Heart Organ" },
    { value: "hi-lungs", label: "Lungs" },
    { value: "hi-kidneys", label: "Kidneys" },
    { value: "hi-stomach", label: "Stomach" },
    { value: "hi-intestine", label: "Intestine" },
    { value: "hi-gallbladder", label: "Gallbladder" },
    { value: "hi-pancreas", label: "Pancreas" },
    { value: "hi-spleen", label: "Spleen" },
    { value: "hi-thyroid", label: "Thyroid" },
    { value: "hi-spine", label: "Spine" },
    { value: "hi-skeleton", label: "Skeleton" },
    { value: "hi-joints", label: "Joints" },
    { value: "hi-body", label: "Body" },
    { value: "hi-eye", label: "Eye" },
    { value: "hi-ear", label: "Ear" },
    { value: "hi-foot", label: "Foot" },
    { value: "hi-tooth", label: "Tooth" },
  ]},
  // Medical Devices (Healthicons)
  { group: "Devices", items: [
    { value: "hi-stethoscope", label: "Stethoscope" },
    { value: "hi-microscope", label: "Microscope" },
    { value: "hi-syringe", label: "Syringe" },
    { value: "hi-thermometer", label: "Thermometer" },
    { value: "hi-bp-monitor", label: "BP Monitor" },
    { value: "hi-defibrillator", label: "Defibrillator" },
    { value: "hi-infusion-pump", label: "Infusion Pump" },
    { value: "hi-oxygen-tank", label: "Oxygen Tank" },
    { value: "hi-ventilator", label: "Ventilator" },
    { value: "hi-xray", label: "X-Ray" },
    { value: "hi-test-tubes", label: "Test Tubes" },
    { value: "hi-ultrasound", label: "Ultrasound" },
    { value: "hi-iv-bag", label: "IV Bag" },
    { value: "hi-pulse-oximeter", label: "Pulse Oximeter" },
  ]},
  // Clinical (mixed Tabler + Healthicons)
  { group: "Clinical", items: [
    { value: "stethoscope", label: "Stethoscope" },
    { value: "medical-cross", label: "Medical Cross" },
    { value: "heart", label: "Heart" },
    { value: "heart-rate", label: "Heart Rate" },
    { value: "activity", label: "Activity" },
    { value: "pill", label: "Pill" },
    { value: "capsule", label: "Capsule" },
    { value: "vaccine", label: "Vaccine" },
    { value: "thermometer", label: "Thermometer" },
    { value: "bandage", label: "Bandage" },
    { value: "microscope", label: "Microscope" },
    { value: "test-pipe", label: "Test Tube" },
    { value: "dna", label: "DNA" },
    { value: "virus", label: "Virus" },
    { value: "droplet", label: "Blood Drop" },
    { value: "lungs", label: "Lungs" },
    { value: "brain", label: "Brain" },
    { value: "bone", label: "Bone" },
    { value: "dental", label: "Dental" },
    { value: "eye", label: "Eye" },
    { value: "ear", label: "Ear" },
    { value: "face-mask", label: "Face Mask" },
    { value: "body-scan", label: "Body Scan" },
    { value: "report-medical", label: "Medical Report" },
    { value: "health-recognition", label: "Health Recognition" },
    { value: "ribbon-health", label: "Health Ribbon" },
    { value: "hi-allergies", label: "Allergies" },
    { value: "hi-diabetes", label: "Diabetes" },
    { value: "hi-asthma", label: "Asthma" },
    { value: "hi-blood-bag", label: "Blood Bag" },
    { value: "hi-blood-drop", label: "Blood Drop" },
    { value: "hi-medicine-bottle", label: "Medicine Bottle" },
    { value: "hi-prescription", label: "Prescription" },
    { value: "hi-medical-records", label: "Medical Records" },
    { value: "medicine-syrup", label: "Medicine Syrup" },
  ]},
  // Facility (Tabler + Healthicons)
  { group: "Facility", items: [
    { value: "building-hospital", label: "Hospital Building" },
    { value: "hospital", label: "Hospital" },
    { value: "hi-hospital", label: "Hospital (Health)" },
    { value: "bed", label: "Bed" },
    { value: "emergency-bed", label: "Emergency Bed" },
    { value: "ambulance", label: "Ambulance" },
    { value: "wheelchair", label: "Wheelchair" },
    { value: "hi-wheelchair", label: "Wheelchair (Health)" },
    { value: "crutches", label: "Crutches" },
  ]},
  // General (Tabler)
  { group: "General", items: [
    { value: "id", label: "ID Card" },
    { value: "phone", label: "Phone" },
    { value: "mail", label: "Mail" },
    { value: "map-pin", label: "Map Pin" },
    { value: "home", label: "Home" },
    { value: "shield", label: "Shield" },
    { value: "lock", label: "Lock" },
    { value: "file-text", label: "Document" },
    { value: "clipboard", label: "Clipboard" },
    { value: "calendar", label: "Calendar" },
    { value: "clock", label: "Clock" },
    { value: "currency-dollar", label: "Dollar" },
    { value: "currency-rupee", label: "Rupee" },
    { value: "credit-card", label: "Credit Card" },
    { value: "receipt", label: "Receipt" },
    { value: "alert-triangle", label: "Alert" },
    { value: "info-circle", label: "Info" },
    { value: "settings", label: "Settings" },
    { value: "photo", label: "Photo" },
    { value: "fingerprint", label: "Fingerprint" },
    { value: "list-check", label: "Checklist" },
    { value: "notes", label: "Notes" },
  ]},
];

const SECTION_COLOR_OPTIONS = [
  { value: "primary", label: "Blue" },
  { value: "info", label: "Cyan" },
  { value: "teal", label: "Teal" },
  { value: "success", label: "Green" },
  { value: "lime", label: "Lime" },
  { value: "warning", label: "Yellow" },
  { value: "orange", label: "Orange" },
  { value: "danger", label: "Red" },
  { value: "violet", label: "Purple" },
  { value: "primary", label: "Blue" },
  { value: "info", label: "Sky Blue" },
  { value: "teal", label: "Teal" },
  { value: "slate", label: "Gray" },
];

const VALIDATION_TYPE_OPTIONS = [
  { value: "required", label: "Required" },
  { value: "min_length", label: "Min Length" },
  { value: "max_length", label: "Max Length" },
  { value: "min", label: "Min Value" },
  { value: "max", label: "Max Value" },
  { value: "regex", label: "Regex Pattern" },
  { value: "custom_expr", label: "Custom Expression" },
];

// ── Section Properties ──────────────────────────────────

function SectionProperties({ section }: { section: FormBuilderSectionNode }) {
  const updateSection = useFormBuilderStore((s) => s.updateSection);
  const allFields = useFormBuilderStore((s) => s.fields);
  const [conditionOpen, conditionHandlers] = useDisclosure(false);

  const fieldOptions = useMemo(
    () => Object.values(allFields).map((f) => ({ value: f.fieldCode, label: f.label })),
    [allFields],
  );

  const sectionConditionSummary = useMemo(
    () => conditionOneLiner(section.condition, fieldOptions),
    [section.condition, fieldOptions],
  );

  return (
    <Stack gap="md">
      <div className={classes.propertySectionLabel}>Section Properties</div>

      <TextInput
        label="Name"
        size="sm"
        value={section.name}
        onChange={(e) => updateSection(section.id, { name: e.currentTarget.value })}
      />

      <TextInput
        label="Code"
        size="sm"
        value={section.code}
        onChange={(e) => updateSection(section.id, { code: e.currentTarget.value })}
      />

      <Select
        label="Layout"
        size="sm"
        data={SECTION_LAYOUT_OPTIONS}
        value={section.layout}
        onChange={(val) =>
          updateSection(section.id, {
            layout: (val as FormBuilderSectionNode["layout"]) ?? "single",
          })
        }
      />

      <Select
        label="Icon"
        size="sm"
        placeholder="None"
        clearable
        searchable
        data={SECTION_ICON_OPTIONS}
        value={section.icon ?? null}
        onChange={(val) =>
          updateSection(section.id, {
            icon: val || null,
          })
        }
      />

      <Select
        label="Color"
        size="sm"
        placeholder="Default (gray)"
        clearable
        data={SECTION_COLOR_OPTIONS}
        value={section.color ?? null}
        onChange={(val) =>
          updateSection(section.id, {
            color: val || null,
          })
        }
      />

      <Switch
        label="Collapsible"
        size="sm"
        checked={section.isCollapsible}
        onChange={(e) =>
          updateSection(section.id, {
            isCollapsible: e.currentTarget.checked,
          })
        }
      />

      {section.isCollapsible && (
        <Switch
          label="Default Open"
          size="sm"
          checked={section.isDefaultOpen}
          onChange={(e) =>
            updateSection(section.id, {
              isDefaultOpen: e.currentTarget.checked,
            })
          }
        />
      )}

      <Divider />

      <Button
        variant="subtle"
        size="xs"
        leftSection={<IconClick size={14} />}
        rightSection={conditionOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        onClick={conditionHandlers.toggle}
        justify="space-between"
        fullWidth
      >
        Visibility Condition
        {section.condition && (
          <Badge size="xs" variant="dot" color="primary" ml="xs" maw={140} style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {sectionConditionSummary ?? "Active"}
          </Badge>
        )}
      </Button>
      <Collapse expanded={conditionOpen}>
        <ConditionBuilder
          condition={section.condition}
          onChange={(condition) => updateSection(section.id, { condition })}
        />
      </Collapse>
    </Stack>
  );
}

// ── Options Editor (for select/multiselect/radio/checkbox) ──

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (options: string[]) => void;
}) {
  const [newOption, setNewOption] = useState("");

  const addOption = () => {
    const trimmed = newOption.trim();
    if (!trimmed || options.includes(trimmed)) return;
    onChange([...options, trimmed]);
    setNewOption("");
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    onChange(updated);
  };

  return (
    <Stack gap="xs">
      <div className={classes.propertySectionLabel}>Options</div>
      {options.map((opt, index) => (
        <Group key={index} gap="xs" wrap="nowrap">
          <TextInput
            size="xs"
            value={opt}
            onChange={(e) => updateOption(index, e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <ActionIcon size="sm" variant="subtle" color="danger" onClick={() => removeOption(index)} aria-label="Delete">
            <IconTrash size={12} />
          </ActionIcon>
        </Group>
      ))}
      <Group gap="xs" wrap="nowrap">
        <TextInput
          size="xs"
          placeholder="New option..."
          value={newOption}
          onChange={(e) => setNewOption(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addOption();
          }}
          style={{ flex: 1 }}
        />
        <ActionIcon size="sm" variant="light" color="primary" onClick={addOption} aria-label="Add">
          <IconPlus size={12} />
        </ActionIcon>
      </Group>
    </Stack>
  );
}

// ── Tab label with optional badge ────────────────────────

function TabLabel({ label, count, color }: { label: string; count?: number; color?: string }) {
  return (
    <Group gap={4} wrap="nowrap">
      <Text size="xs">{label}</Text>
      {count !== undefined && count > 0 && (
        <Badge size="xs" variant="filled" color={color ?? "primary"} circle>
          {count}
        </Badge>
      )}
    </Group>
  );
}

// ── Field Properties ────────────────────────────────────

function FieldProperties({ field }: { field: FormBuilderFieldNode }) {
  const updateField = useFormBuilderStore((s) => s.updateField);
  const addValidationRule = useFormBuilderStore((s) => s.addValidationRule);
  const removeValidationRule = useFormBuilderStore((s) => s.removeValidationRule);
  const updateFieldCondition = useFormBuilderStore((s) => s.updateFieldCondition);
  const updateFieldComputed = useFormBuilderStore((s) => s.updateFieldComputed);

  const [validationLibraryOpen, validationLibraryHandlers] = useDisclosure(false);
  const [regulatoryBrowserOpen, regulatoryBrowserHandlers] = useDisclosure(false);

  const handleAddValidation = () => {
    const newRule: FormBuilderValidationRule = {
      type: "required",
      value: true,
      message: "This field is required",
    };
    addValidationRule(field.id, newRule);
  };

  // Badge counts for tab indicators
  const validationCount = field.validationRules.length;
  const regulatoryCount = field.regulatoryClauses.length;
  const actionsCount = field.actions.length;
  const hasCondition = field.condition !== null;
  const hasDataSource = field.dataSource !== null && field.dataSource.type !== "static";
  const hasComputed = field.computedExpr !== null;
  const isOptionType = OPTION_TYPES.has(field.dataType);

  // Hint text for the (i) icon
  const hintParts: string[] = [];
  if (field.helpText) hintParts.push(field.helpText);
  if (hasCondition) hintParts.push("Has visibility condition");
  if (hasComputed) hintParts.push("Has computed expression");
  if (regulatoryCount > 0) hintParts.push(`${regulatoryCount} regulatory link(s)`);
  if (actionsCount > 0) hintParts.push(`${actionsCount} action(s)`);
  if (hasDataSource) hintParts.push(`Data source: ${field.dataSource?.type}`);

  return (
    <Stack gap="sm">
      {/* ── Core Properties (always visible) ─────────────── */}
      <Group gap="xs" justify="space-between">
        <div className={classes.propertySectionLabel}>Field Properties</div>
        {hintParts.length > 0 && (
          <Tooltip
            label={hintParts.join(" \u2022 ")}
            multiline
            w={240}
            withArrow
            position="left"
          >
            <ActionIcon variant="subtle" size="xs" color="primary" aria-label="Info">
              <IconInfoCircle size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      <Select
        label="Data Type"
        size="sm"
        data={DATA_TYPE_OPTIONS}
        value={field.dataType}
        searchable
        onChange={(val) => {
          if (!val) return;
          const newType = val as FormBuilderFieldNode["dataType"];
          const needsOptions = OPTION_TYPES.has(newType);
          const hadOptions = OPTION_TYPES.has(field.dataType);
          updateField(field.id, {
            dataType: newType,
            options: needsOptions && !hadOptions && !field.options?.length
              ? ["Option 1", "Option 2", "Option 3"]
              : needsOptions
                ? field.options
                : null,
          });
        }}
      />

      <TextInput
        label="Label"
        size="sm"
        value={field.label}
        onChange={(e) => updateField(field.id, { label: e.currentTarget.value })}
      />

      <TextInput
        label="Field Code"
        size="sm"
        value={field.fieldCode}
        onChange={(e) => updateField(field.id, { fieldCode: e.currentTarget.value })}
      />

      <div>
        <Text size="sm" fw={500} mb={4}>
          Width ({field.colSpan}/12 columns)
        </Text>
        <Slider
          min={1}
          max={12}
          step={1}
          marks={COL_SPAN_MARKS}
          value={field.colSpan}
          onChange={(val) => updateField(field.id, { colSpan: val })}
          label={(val) => `${val}/12`}
          mb="lg"
        />
      </div>

      <Select
        label="Requirement"
        size="sm"
        data={REQUIREMENT_OPTIONS}
        value={field.requirementLevel}
        onChange={(val) =>
          updateField(field.id, {
            requirementLevel: (val as FormBuilderFieldNode["requirementLevel"]) ?? "optional",
          })
        }
      />

      <TextInput
        label="Placeholder"
        size="sm"
        value={field.placeholder ?? ""}
        onChange={(e) =>
          updateField(field.id, {
            placeholder: e.currentTarget.value || null,
          })
        }
      />

      <Textarea
        label="Help Text"
        size="sm"
        autosize
        minRows={2}
        value={field.helpText ?? ""}
        onChange={(e) =>
          updateField(field.id, {
            helpText: e.currentTarget.value || null,
          })
        }
      />

      <TextInput
        label="Default Value"
        size="sm"
        value={field.defaultValue ?? ""}
        onChange={(e) =>
          updateField(field.id, {
            defaultValue: e.currentTarget.value || null,
          })
        }
      />

      <Group grow>
        <Select
          label="Field Icon"
          size="sm"
          data={SECTION_ICON_OPTIONS}
          value={field.icon ?? null}
          searchable
          clearable
          placeholder="None"
          onChange={(val) =>
            updateField(field.id, { icon: val || null })
          }
        />
        <Select
          label="Icon Position"
          size="sm"
          data={[
            { value: "left", label: "Left" },
            { value: "right", label: "Right" },
          ]}
          value={field.iconPosition}
          onChange={(val) =>
            updateField(field.id, {
              iconPosition: (val as "left" | "right") ?? "left",
            })
          }
        />
      </Group>

      <Switch
        label="Quick Mode"
        size="sm"
        checked={field.isQuickMode}
        onChange={(e) =>
          updateField(field.id, {
            isQuickMode: e.currentTarget.checked,
          })
        }
      />

      {/* ── Tabbed Sub-Properties ────────────────────────── */}
      <Divider my={4} />

      <Tabs defaultValue="options" variant="outline" keepMounted={false}>
        <Tabs.List grow>
          {isOptionType && (
            <Tabs.Tab value="options" fz="xs" p="xs">
              <TabLabel label="Options" count={hasDataSource ? 1 : 0} color="violet" />
            </Tabs.Tab>
          )}
          <Tabs.Tab value="visibility" fz="xs" p="xs">
            <TabLabel label="Visibility" count={hasCondition ? 1 : 0} color="primary" />
          </Tabs.Tab>
          <Tabs.Tab value="validation" fz="xs" p="xs">
            <TabLabel label="Validation" count={validationCount} color="primary" />
          </Tabs.Tab>
          <Tabs.Tab value="regulatory" fz="xs" p="xs">
            <TabLabel label="Regulatory" count={regulatoryCount} color="orange" />
          </Tabs.Tab>
          <Tabs.Tab value="actions" fz="xs" p="xs">
            <TabLabel label="Actions" count={actionsCount} color="teal" />
          </Tabs.Tab>
          {field.dataType === "computed" && (
            <Tabs.Tab value="computed" fz="xs" p="xs">
              <TabLabel label="Computed" count={hasComputed ? 1 : 0} color="success" />
            </Tabs.Tab>
          )}
        </Tabs.List>

        {/* ── Options + Data Source Tab ──────────────────── */}
        {isOptionType && (
          <Tabs.Panel value="options" pt="sm">
            <Stack gap="sm">
              <OptionsEditor
                options={field.options ?? []}
                onChange={(opts) => updateField(field.id, { options: opts.length > 0 ? opts : null })}
              />
              <Divider label="Data Source" labelPosition="center" />
              <DataSourceEditor field={field} />
            </Stack>
          </Tabs.Panel>
        )}

        {/* ── Visibility Condition Tab ──────────────────── */}
        <Tabs.Panel value="visibility" pt="sm">
          <ConditionBuilder
            condition={field.condition}
            onChange={(condition) => updateFieldCondition(field.id, condition)}
          />
        </Tabs.Panel>

        {/* ── Validation Rules Tab ─────────────────────── */}
        <Tabs.Panel value="validation" pt="sm">
          <Stack gap="sm">
            {field.validationRules.map((rule, index) => (
              <ValidationRuleRow
                key={index}
                rule={rule}
                index={index}
                fieldId={field.id}
                onRemove={() => removeValidationRule(field.id, index)}
              />
            ))}
            <Group gap="xs">
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={12} />}
                onClick={handleAddValidation}
              >
                Add Rule
              </Button>
              <Button
                size="xs"
                variant="subtle"
                leftSection={<IconBook size={12} />}
                onClick={validationLibraryHandlers.open}
              >
                Library
              </Button>
            </Group>
          </Stack>
        </Tabs.Panel>

        {/* ── Regulatory Tab ───────────────────────────── */}
        <Tabs.Panel value="regulatory" pt="sm">
          <Stack gap="sm">
            {field.regulatoryClauses.length > 0 ? (
              <Group gap={4} wrap="wrap">
                {field.regulatoryClauses.map((clause, i) => (
                  <Badge key={i} size="xs" variant="light" color="orange">
                    {clause.clause_code ?? clause.body_code}
                  </Badge>
                ))}
              </Group>
            ) : (
              <Text size="xs" c="dimmed">
                No regulatory links
              </Text>
            )}
            <Button
              size="xs"
              variant="light"
              leftSection={<IconShield size={12} />}
              onClick={regulatoryBrowserHandlers.open}
            >
              Browse Regulatory Bodies
            </Button>
          </Stack>
        </Tabs.Panel>

        {/* ── Actions Tab ──────────────────────────────── */}
        <Tabs.Panel value="actions" pt="sm">
          <FieldActionsEditor field={field} />
        </Tabs.Panel>

        {/* ── Computed Expression Tab ──────────────────── */}
        {field.dataType === "computed" && (
          <Tabs.Panel value="computed" pt="sm">
            <ComputedEditor
              expression={field.computedExpr}
              onChange={(expr) => updateFieldComputed(field.id, expr)}
            />
          </Tabs.Panel>
        )}
      </Tabs>

      {/* Modals */}
      <ValidationLibrary
        opened={validationLibraryOpen}
        onClose={validationLibraryHandlers.close}
        fieldId={field.id}
        currentRules={field.validationRules}
      />
      <RegulatoryBrowser
        opened={regulatoryBrowserOpen}
        onClose={regulatoryBrowserHandlers.close}
        fieldId={field.fieldMasterId || undefined}
      />
    </Stack>
  );
}

// ── Validation Rule Row ─────────────────────────────────

function ValidationRuleRow({
  rule,
  index,
  fieldId,
  onRemove,
}: {
  rule: FormBuilderValidationRule;
  index: number;
  fieldId: string;
  onRemove: () => void;
}) {
  const updateField = useFormBuilderStore((s) => s.updateField);
  const field = useFormBuilderStore((s) => s.fields[fieldId]);

  const updateRule = (updates: Partial<FormBuilderValidationRule>) => {
    if (!field) return;
    const newRules = [...field.validationRules];
    const existing = newRules[index];
    if (existing) {
      newRules[index] = { ...existing, ...updates };
      updateField(fieldId, { validationRules: newRules });
    }
  };

  return (
    <Group gap="xs" align="flex-end" wrap="nowrap">
      <Select
        size="xs"
        data={VALIDATION_TYPE_OPTIONS}
        value={rule.type}
        onChange={(val) =>
          updateRule({
            type: (val as FormBuilderValidationRule["type"]) ?? "required",
          })
        }
        style={{ flex: 1 }}
      />
      <TextInput
        size="xs"
        placeholder="Value"
        value={String(rule.value)}
        onChange={(e) => {
          const numVal = Number(e.currentTarget.value);
          updateRule({
            value: Number.isFinite(numVal) ? numVal : e.currentTarget.value,
          });
        }}
        style={{ flex: 1 }}
      />
      <TextInput
        size="xs"
        placeholder="Message"
        value={rule.message}
        onChange={(e) => updateRule({ message: e.currentTarget.value })}
        style={{ flex: 2 }}
      />
      <ActionIcon size="sm" variant="subtle" color="danger" onClick={onRemove} aria-label="Delete">
        <IconTrash size={12} />
      </ActionIcon>
    </Group>
  );
}

// ── Main Property Panel ─────────────────────────────────

export function PropertyPanel() {
  const selectedNodeId = useFormBuilderStore((s) => s.selectedNodeId);
  const sections = useFormBuilderStore((s) => s.sections);
  const fields = useFormBuilderStore((s) => s.fields);
  const formStatus = useFormBuilderStore((s) => s.form.status);
  const isLocked = formStatus === "active";

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;

    const section = sections[selectedNodeId];
    if (section) return { type: "section" as const, data: section };

    const field = fields[selectedNodeId];
    if (field) return { type: "field" as const, data: field };

    return null;
  }, [selectedNodeId, sections, fields]);

  return (
    <div className={classes.propertyPanel} style={isLocked ? { pointerEvents: "none", opacity: 0.6 } : undefined}>
      <div className={classes.propertyHeader} style={isLocked ? { pointerEvents: "auto", opacity: 1 } : undefined}>
        <Text size="sm" fw={600}>
          Properties
        </Text>
        {isLocked && (
          <Badge size="xs" variant="light" color="orange">
            Locked
          </Badge>
        )}
        {selectedNode && !isLocked && (
          <Badge size="xs" variant="light">
            {selectedNode.type === "section" ? "Section" : "Field"}
          </Badge>
        )}
      </div>

      {selectedNode ? (
        <ScrollArea className={classes.propertyContent} offsetScrollbars>
          {selectedNode.type === "section" ? (
            <SectionProperties section={selectedNode.data as FormBuilderSectionNode} />
          ) : (
            <FieldProperties field={selectedNode.data as FormBuilderFieldNode} />
          )}
        </ScrollArea>
      ) : (
        <div className={classes.propertyEmpty}>
          <IconClick size={32} stroke={1.2} />
          <Text size="sm" fw={500}>
            {isLocked ? "Read Only" : "No Selection"}
          </Text>
          <Text size="xs" c="dimmed">
            {isLocked
              ? "Create a new version to edit properties"
              : "Click a field or section to edit its properties"}
          </Text>
        </div>
      )}
    </div>
  );
}
