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
import { useHasPermission } from "@medbrains/stores";
import {
  type ComplianceSettings,
  type FoodTiming,
  P,
  type PharmacyCatalog,
  type PrescriptionItemInput,
  type TimeOfDay,
} from "@medbrains/types";
import { IconChevronDown, IconChevronUp, IconClock, IconPlus } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  canAddItem: boolean;
  onAdd: (item: PrescriptionItemInput) => void;
}

export function PrescriptionItemEntry({
  drugCatalog,
  compliance,
  canAddItem,
  onAdd,
}: PrescriptionItemEntryProps) {
  const { t } = useTranslation("clinical");
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
  const hasPrescriptionWritePermission = useHasPermission(P.OPD.VISIT_UPDATE);
  const canViewStockDetail = useHasPermission(P.PHARMACY.STOCK_MANAGE);
  const canWritePrescription = canAddItem && hasPrescriptionWritePermission;

  // Drug fields
  const [drugName, setDrugName] = useState("");
  const [drugSearch, setDrugSearch] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | undefined>();
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
      .filter(
        (d) =>
          d.is_active &&
          (d.name.toLowerCase().includes(q) ||
            d.code.toLowerCase().includes(q) ||
            (d.generic_name?.toLowerCase().includes(q) ?? false)),
      )
      .slice(0, 20);
  }, [drugCatalog, drugSearch]);

  const handleDrugSelect = (drugId: string) => {
    if (!canWritePrescription) return;
    const drug = drugCatalog.find((d) => d.id === drugId);
    if (drug) {
      const label = drug.generic_name ? `${drug.name} (${drug.generic_name})` : drug.name;
      setDrugName(label);
      setDrugSearch(label);
      setSelectedCatalogId(drug.id);
      if (drug.unit && !dosage) setDosage(drug.unit);

      const warnings: string[] = [];
      if (compliance.show_controlled_warnings && drug.is_controlled)
        warnings.push("Controlled substance - NDPS register required");
      if (drug.drug_schedule === "X") warnings.push("Schedule X - duplicate prescription required");
      if (drug.formulary_status === "non_formulary" && compliance.enforce_formulary)
        warnings.push("Non-formulary drug - DTC approval may be required");
      if (drug.black_box_warning) warnings.push(drug.black_box_warning);
      if (drug.current_stock <= 0) {
        warnings.push(
          "Out of stock now - prescription is allowed; pharmacy will arrange, substitute, or partial-fill",
        );
      } else if (drug.reorder_level > 0 && drug.current_stock <= drug.reorder_level) {
        warnings.push(
          canViewStockDetail
            ? `Low stock - ${drug.current_stock} ${drug.unit ?? "units"} available in pharmacy`
            : "Low stock - pharmacy can review availability before dispensing",
        );
      }
      setDrugWarning(warnings.length > 0 ? warnings.join(" | ") : null);
    }
    combobox.closeDropdown();
  };

  const resetEntry = () => {
    setDrugName("");
    setDrugSearch("");
    setSelectedCatalogId(undefined);
    setDosage("");
    setFrequency(null);
    setDuration("");
    setRoute(null);
    setDrugWarning(null);
    setFoodTiming("any");
    setTimeSlots([]);
    setCustomInstruction("");
  };

  const canSubmitItem =
    canWritePrescription && drugName.trim() && dosage.trim() && frequency && duration.trim();

  const handleAddItem = () => {
    if (!canSubmitItem) return;

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
      catalog_item_id: selectedCatalogId,
    });
    resetEntry();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && canSubmitItem) {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    <>
      {/* Drug entry row */}
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <Combobox
          store={combobox}
          onOptionSubmit={handleDrugSelect}
          middlewares={{ flip: true, shift: true, size: true }}
          position="bottom-start"
          shadow="lg"
          withinPortal
          zIndex={3000}
        >
          <Combobox.Target>
            <InputBase
              placeholder={t("prescription.drugName")}
              value={drugSearch}
              disabled={!canWritePrescription}
              onChange={(e) => {
                setDrugSearch(e.currentTarget.value);
                setDrugName(e.currentTarget.value);
                combobox.openDropdown();
                combobox.updateSelectedOptionIndex();
              }}
              onFocus={() => combobox.openDropdown()}
              onBlur={() => {
                combobox.closeDropdown();
                setDrugSearch(drugName);
              }}
              onKeyDown={handleKeyDown}
              rightSectionPointerEvents="none"
              style={{ flex: 1 }}
              size="sm"
            />
          </Combobox.Target>
          <Combobox.Dropdown>
            <Combobox.Options mah={320} style={{ overflowY: "auto" }}>
              {filteredDrugs.map((drug) => (
                <DrugOption
                  key={drug.id}
                  drug={drug}
                  compliance={compliance}
                  canViewStockDetail={canViewStockDetail}
                />
              ))}
              {filteredDrugs.length === 0 && drugSearch.trim() && (
                <Combobox.Empty>
                  <Text size="xs">{t("prescription.typeCustomDrug")}</Text>
                </Combobox.Empty>
              )}
            </Combobox.Options>
          </Combobox.Dropdown>
        </Combobox>
        <TextInput
          placeholder={t("prescription.dosage")}
          value={dosage}
          disabled={!canWritePrescription}
          onChange={(e) => setDosage(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          w={100}
          size="sm"
        />
        <Select
          placeholder={t("prescription.frequency")}
          data={FREQUENCIES}
          value={frequency}
          onChange={setFrequency}
          disabled={!canWritePrescription}
          w={160}
          size="sm"
          searchable
        />
        <TextInput
          placeholder={t("prescription.duration")}
          value={duration}
          disabled={!canWritePrescription}
          onChange={(e) => setDuration(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          w={100}
          size="sm"
        />
        <Select
          placeholder={t("prescription.route")}
          data={ROUTES}
          value={route}
          onChange={setRoute}
          disabled={!canWritePrescription}
          w={120}
          size="sm"
          clearable
        />
        <Button
          size="sm"
          leftSection={<IconPlus size={14} />}
          onClick={handleAddItem}
          disabled={!canSubmitItem}
        >
          {t("common:add")}
        </Button>
      </Group>

      {/* Drug warning */}
      {drugWarning && (
        <Text size="xs" c="danger" fw={500}>
          {"\u26A0"} {drugWarning}
        </Text>
      )}

      {/* Timing picker toggle + panel */}
      <Button
        variant="subtle"
        size="xs"
        onClick={toggleTiming}
        disabled={!canWritePrescription}
        leftSection={<IconClock size={14} />}
        rightSection={timingOpen ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        style={{ alignSelf: "flex-start" }}
      >
        Timing & Instructions
      </Button>
      <Collapse expanded={timingOpen && canWritePrescription}>
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
function DrugOption({
  drug,
  compliance,
  canViewStockDetail,
}: {
  drug: PharmacyCatalog;
  compliance: ComplianceSettings;
  canViewStockDetail: boolean;
}) {
  return (
    <Combobox.Option value={drug.id}>
      <Group gap={4} wrap="nowrap">
        <div style={{ flex: 1 }}>
          <Text size="sm" fw={500}>
            {drug.name}
          </Text>
          {drug.generic_name && (
            <Text size="xs" c="dimmed">
              {drug.generic_name}
              {drug.inn_name && drug.inn_name !== drug.generic_name
                ? ` (INN: ${drug.inn_name})`
                : ""}
            </Text>
          )}
          <Text
            size="10px"
            c={
              drug.current_stock <= 0
                ? "danger"
                : drug.reorder_level > 0 && drug.current_stock <= drug.reorder_level
                  ? "warning"
                  : "dimmed"
            }
          >
            {stockAvailabilityText(drug, canViewStockDetail)}
          </Text>
        </div>
        <Group gap={2}>
          {drug.current_stock <= 0 && (
            <Badge size="xs" variant="light" color="danger">
              Out
            </Badge>
          )}
          {drug.current_stock > 0 &&
            drug.reorder_level > 0 &&
            drug.current_stock <= drug.reorder_level && (
              <Badge size="xs" variant="light" color="warning">
                Low
              </Badge>
            )}
          {compliance.show_schedule_badges && drug.drug_schedule && (
            <Badge
              size="xs"
              variant="light"
              color={
                drug.drug_schedule === "X" || drug.drug_schedule === "NDPS"
                  ? "danger"
                  : drug.drug_schedule === "H1"
                    ? "orange"
                    : "primary"
              }
            >
              Sch-{drug.drug_schedule}
            </Badge>
          )}
          {compliance.show_controlled_warnings && drug.is_controlled && (
            <Badge size="xs" variant="filled" color="danger">
              CTRL
            </Badge>
          )}
          {compliance.show_formulary_status && drug.formulary_status === "restricted" && (
            <Badge size="xs" variant="light" color="warning">
              Restricted
            </Badge>
          )}
          {compliance.show_formulary_status && drug.formulary_status === "non_formulary" && (
            <Badge size="xs" variant="light" color="slate">
              Non-Formulary
            </Badge>
          )}
          {compliance.show_aware_category && drug.aware_category && (
            <Badge
              size="xs"
              variant="light"
              color={
                drug.aware_category === "reserve"
                  ? "danger"
                  : drug.aware_category === "watch"
                    ? "orange"
                    : "success"
              }
            >
              {drug.aware_category.charAt(0).toUpperCase() + drug.aware_category.slice(1)}
            </Badge>
          )}
        </Group>
      </Group>
    </Combobox.Option>
  );
}

function stockAvailabilityText(drug: PharmacyCatalog, canViewStockDetail: boolean) {
  if (canViewStockDetail) {
    return `Stock ${drug.current_stock} ${drug.unit ?? "units"}`;
  }

  if (drug.current_stock <= 0) {
    return "Stock unavailable";
  }

  if (drug.reorder_level > 0 && drug.current_stock <= drug.reorder_level) {
    return "Low stock";
  }

  return "Available";
}
