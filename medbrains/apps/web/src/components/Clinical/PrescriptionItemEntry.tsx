import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Collapse,
  Combobox,
  Group,
  InputBase,
  Select,
  Text,
  TextInput,
  useCombobox,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconChevronDown,
  IconChevronUp,
  IconClock,
  IconPlus,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type {
  ComplianceSettings,
  FoodTiming,
  PharmacyCatalog,
  PrescriptionItemInput,
  TimeOfDay,
} from "@medbrains/types";
import { serializeTiming } from "../../lib/medication-timing-utils";
import { MedicationTimingPicker } from "./MedicationTimingPicker";

export const FREQUENCIES = [
  { value: "OD", label: "OD (Once daily)" },
  { value: "BD", label: "BD (Twice daily)" },
  { value: "TDS", label: "TDS (Thrice daily)" },
  { value: "QID", label: "QID (Four times)" },
  { value: "SOS", label: "SOS (As needed)" },
  { value: "PRN", label: "PRN (When required)" },
  { value: "STAT", label: "STAT (Immediately)" },
  { value: "HS", label: "HS (At bedtime)" },
];

export const ROUTES = [
  { value: "Oral", label: "Oral" },
  { value: "IV", label: "IV" },
  { value: "IM", label: "IM" },
  { value: "SC", label: "SC" },
  { value: "Topical", label: "Topical" },
  { value: "Inhalation", label: "Inhalation" },
  { value: "Sublingual", label: "Sublingual" },
  { value: "Rectal", label: "Rectal" },
];

interface PrescriptionItemEntryProps {
  drugCatalog: PharmacyCatalog[];
  compliance: ComplianceSettings;
  onAdd: (item: PrescriptionItemInput) => void;
}

export function PrescriptionItemEntry({
  drugCatalog,
  compliance,
  onAdd,
}: PrescriptionItemEntryProps) {
  const { t } = useTranslation("clinical");
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });

  // Drug fields
  const [drugName, setDrugName] = useState("");
  const [drugSearch, setDrugSearch] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState<string | null>(null);
  const [duration, setDuration] = useState("");
  const [route, setRoute] = useState<string | null>(null);
  const [drugWarning, setDrugWarning] = useState<string | null>(null);

  // Timing fields
  const [timingOpen, { toggle: toggleTiming }] = useDisclosure(false);
  const [foodTiming, setFoodTiming] = useState<FoodTiming>("any");
  const [timeSlots, setTimeSlots] = useState<TimeOfDay[]>([]);
  const [customInstruction, setCustomInstruction] = useState("");

  const filteredDrugs = useMemo(() => {
    if (!drugSearch.trim()) return drugCatalog.filter((d) => d.is_active).slice(0, 20);
    const q = drugSearch.toLowerCase();
    return drugCatalog
      .filter((d) =>
        d.is_active && (
          d.name.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          (d.generic_name?.toLowerCase().includes(q) ?? false)
        )
      )
      .slice(0, 20);
  }, [drugCatalog, drugSearch]);

  const handleDrugSelect = (drugId: string) => {
    const drug = drugCatalog.find((d) => d.id === drugId);
    if (drug) {
      const label = drug.generic_name ? `${drug.name} (${drug.generic_name})` : drug.name;
      setDrugName(label);
      setDrugSearch(label);
      if (drug.unit && !dosage) setDosage(drug.unit);

      const warnings: string[] = [];
      if (compliance.show_controlled_warnings && drug.is_controlled)
        warnings.push("Controlled substance \u2014 NDPS register required");
      if (drug.drug_schedule === "X")
        warnings.push("Schedule X \u2014 duplicate prescription required");
      if (drug.formulary_status === "non_formulary" && compliance.enforce_formulary)
        warnings.push("Non-formulary drug \u2014 DTC approval may be required");
      if (drug.black_box_warning)
        warnings.push(drug.black_box_warning);
      setDrugWarning(warnings.length > 0 ? warnings.join(" \u2022 ") : null);
    }
    combobox.closeDropdown();
  };

  const resetEntry = () => {
    setDrugName("");
    setDrugSearch("");
    setDosage("");
    setFrequency(null);
    setDuration("");
    setRoute(null);
    setDrugWarning(null);
    setFoodTiming("any");
    setTimeSlots([]);
    setCustomInstruction("");
  };

  const canAddItem = drugName.trim() && dosage.trim() && frequency && duration.trim();

  const handleAddItem = () => {
    if (!canAddItem) return;

    // Build structured timing instructions
    const hasTiming = foodTiming !== "any" || timeSlots.length > 0 || customInstruction.trim();
    const instructions = hasTiming
      ? serializeTiming({
          food_timing: foodTiming !== "any" ? foodTiming : undefined,
          time_slots: timeSlots.length > 0 ? timeSlots : undefined,
          custom_instruction: customInstruction.trim() || undefined,
        })
      : undefined;

    onAdd({
      drug_name: drugName.trim(),
      dosage: dosage.trim(),
      frequency: frequency as string,
      duration: duration.trim(),
      route: route ?? undefined,
      instructions,
    });
    resetEntry();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && canAddItem) {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    <>
      {/* Drug entry row */}
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <Combobox store={combobox} onOptionSubmit={handleDrugSelect}>
          <Combobox.Target>
            <InputBase
              placeholder={t("prescription.drugName")}
              value={drugSearch}
              onChange={(e) => {
                setDrugSearch(e.currentTarget.value);
                setDrugName(e.currentTarget.value);
                combobox.openDropdown();
                combobox.updateSelectedOptionIndex();
              }}
              onFocus={() => combobox.openDropdown()}
              onBlur={() => { combobox.closeDropdown(); setDrugSearch(drugName); }}
              onKeyDown={handleKeyDown}
              rightSectionPointerEvents="none"
              style={{ flex: 1 }}
              size="sm"
            />
          </Combobox.Target>
          <Combobox.Dropdown>
            <Combobox.Options>
              {filteredDrugs.map((drug) => (
                <DrugOption key={drug.id} drug={drug} compliance={compliance} />
              ))}
              {filteredDrugs.length === 0 && drugSearch.trim() && (
                <Combobox.Empty>
                  <Text size="xs">{t("prescription.typeCustomDrug")}</Text>
                </Combobox.Empty>
              )}
            </Combobox.Options>
          </Combobox.Dropdown>
        </Combobox>
        <TextInput placeholder={t("prescription.dosage")} value={dosage} onChange={(e) => setDosage(e.currentTarget.value)} onKeyDown={handleKeyDown} w={100} size="sm" />
        <Select placeholder={t("prescription.frequency")} data={FREQUENCIES} value={frequency} onChange={setFrequency} w={160} size="sm" searchable />
        <TextInput placeholder={t("prescription.duration")} value={duration} onChange={(e) => setDuration(e.currentTarget.value)} onKeyDown={handleKeyDown} w={100} size="sm" />
        <Select placeholder={t("prescription.route")} data={ROUTES} value={route} onChange={setRoute} w={120} size="sm" clearable />
        <Button size="sm" leftSection={<IconPlus size={14} />} onClick={handleAddItem} disabled={!canAddItem}>
          {t("common:add")}
        </Button>
      </Group>

      {/* Drug warning */}
      {drugWarning && (
        <Text size="xs" c="danger" fw={500}>{"\u26A0"} {drugWarning}</Text>
      )}

      {/* Timing picker toggle + panel */}
      <Button
        variant="subtle"
        size="xs"
        onClick={toggleTiming}
        leftSection={<IconClock size={14} />}
        rightSection={timingOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        style={{ alignSelf: "flex-start" }}
      >
        Timing & Instructions
      </Button>
      <Collapse expanded={timingOpen}>
        <MedicationTimingPicker
          foodTiming={foodTiming}
          onFoodTimingChange={setFoodTiming}
          timeSlots={timeSlots}
          onTimeSlotsChange={setTimeSlots}
          customInstruction={customInstruction}
          onCustomInstructionChange={setCustomInstruction}
          frequency={frequency ?? undefined}
        />
      </Collapse>
    </>
  );
}

/** Drug catalog dropdown option with regulatory badges */
function DrugOption({ drug, compliance }: { drug: PharmacyCatalog; compliance: ComplianceSettings }) {
  return (
    <Combobox.Option value={drug.id}>
      <Group gap={4} wrap="nowrap">
        <div style={{ flex: 1 }}>
          <Text size="sm" fw={500}>{drug.name}</Text>
          {drug.generic_name && (
            <Text size="xs" c="dimmed">
              {drug.generic_name}
              {drug.inn_name && drug.inn_name !== drug.generic_name ? ` (INN: ${drug.inn_name})` : ""}
            </Text>
          )}
        </div>
        <Group gap={2}>
          {compliance.show_schedule_badges && drug.drug_schedule && (
            <Badge size="xs" variant="light" color={drug.drug_schedule === "X" || drug.drug_schedule === "NDPS" ? "danger" : drug.drug_schedule === "H1" ? "orange" : "primary"}>
              Sch-{drug.drug_schedule}
            </Badge>
          )}
          {compliance.show_controlled_warnings && drug.is_controlled && (
            <Badge size="xs" variant="filled" color="danger">CTRL</Badge>
          )}
          {compliance.show_formulary_status && drug.formulary_status === "restricted" && (
            <Badge size="xs" variant="light" color="warning">Restricted</Badge>
          )}
          {compliance.show_formulary_status && drug.formulary_status === "non_formulary" && (
            <Badge size="xs" variant="light" color="slate">Non-Formulary</Badge>
          )}
          {compliance.show_aware_category && drug.aware_category && (
            <Badge size="xs" variant="light" color={drug.aware_category === "reserve" ? "danger" : drug.aware_category === "watch" ? "orange" : "success"}>
              {drug.aware_category.charAt(0).toUpperCase() + drug.aware_category.slice(1)}
            </Badge>
          )}
        </Group>
      </Group>
    </Combobox.Option>
  );
}
