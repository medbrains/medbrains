import {
  Badge,
  Box,
  Button,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
} from "@mantine/core";
import { isBloodPressureValid, isHypertensiveCrisis } from "@medbrains/schemas";
import { useLocaleConfig } from "@medbrains/stores";
import type { CreateVitalRequest, TenantSettingsRow } from "@medbrains/types";
import {
  IconDroplet,
  IconHeartRateMonitor,
  IconLungs,
  IconRuler2,
  IconRulerMeasure,
  IconScale,
  IconTemperature,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SignatureHero } from "@/components/ui";
import {
  getHeightConfig,
  getTemperatureConfig,
  getWeightConfig,
  heightToCm,
  weightToKg,
} from "@/lib/vital-units";
import { bloodPressureSeverity } from "@/pages/opd/vitals-thresholds";
import { clinicalSupportService } from "@/services/clinicalSupport.service";
import { BloodPressureInput } from "./BloodPressureInput";
import styles from "./vitals-recorder.module.scss";

type RangeLevel = "normal" | "borderline" | "critical";

interface VitalConfig {
  key: string;
  labelKey: string;
  unit: string;
  icon: React.ReactNode;
  min: number;
  max: number;
  step: number;
  precision: number;
  ranges: { normal: [number, number]; borderline: [number, number]; critical: [number, number] };
}

function getRangeLevel(config: VitalConfig, value: number | undefined): RangeLevel | null {
  if (value === undefined) return null;
  const { normal, borderline } = config.ranges;
  if (value >= normal[0] && value <= normal[1]) return "normal";
  if (value >= borderline[0] && value <= borderline[1]) return "borderline";
  return "critical";
}

function getRangeLabel(config: VitalConfig): string {
  const { normal } = config.ranges;
  if (normal[0] === 0 && normal[1] >= 999) return "";
  return `${normal[0]}–${normal[1]}`;
}

function getRangeStatus(
  config: VitalConfig,
  value: number | undefined,
): { label: string; color: string } | null {
  if (value === undefined) return null;
  const [normalLow, normalHigh] = config.ranges.normal;
  const [borderlineLow, borderlineHigh] = config.ranges.borderline;
  if (value >= normalLow && value <= normalHigh) return { label: "Normal", color: "success" };
  if (value < normalLow) {
    return {
      label: value >= borderlineLow ? "Low" : "Critical low",
      color: value >= borderlineLow ? "warning" : "danger",
    };
  }
  return {
    label: value <= borderlineHigh ? "High" : "Critical high",
    color: value <= borderlineHigh ? "warning" : "danger",
  };
}

function computeBmi(weightKg: number | undefined, heightCm: number | undefined): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function getBmiCategory(bmi: number): { labelKey: string; color: string } {
  if (bmi < 18.5) return { labelKey: "vitals.underweight", color: "warning" };
  if (bmi < 25) return { labelKey: "vitals.normal", color: "success" };
  if (bmi < 30) return { labelKey: "vitals.overweight", color: "orange" };
  return { labelKey: "vitals.obese", color: "danger" };
}

function bloodPressureLevel(systolic?: number, diastolic?: number): RangeLevel | null {
  if (systolic === undefined || diastolic === undefined) return null;
  if (isHypertensiveCrisis(systolic, diastolic)) return "critical";
  return bloodPressureSeverity(systolic, diastolic) === "normal" ? "normal" : "borderline";
}

function computeMap(systolic: number | undefined, diastolic: number | undefined): number | null {
  if (!systolic || !diastolic) return null;
  return Math.round((systolic + 2 * diastolic) / 3);
}

interface VitalsRecorderProps {
  onSubmit?: (data: CreateVitalRequest) => void;
  onChange?: (data: CreateVitalRequest) => void;
  isSubmitting?: boolean;
  onCancel?: () => void;
  showActions?: boolean;
  showNotes?: boolean;
}

type VitalValues = Record<string, number | undefined>;

export function VitalsRecorder({
  onSubmit,
  onChange,
  isSubmitting,
  onCancel,
  showActions = true,
  showNotes = true,
}: VitalsRecorderProps) {
  const { t } = useTranslation("clinical");
  const localeConfig = useLocaleConfig();
  const [values, setValues] = useState<VitalValues>({});
  const [notes, setNotes] = useState("");
  const [showBpErrors, setShowBpErrors] = useState(false);

  // Load hospital-configurable vital fields (if customized in settings)
  const { data: clinicalSettings = [] } = useQuery<TenantSettingsRow[]>({
    queryKey: ["tenant-settings", "clinical"],
    queryFn: () => clinicalSupportService.getTenantSettings("clinical"),
    staleTime: 600_000,
  });
  const enabledVitals = useMemo(() => {
    const cfg = clinicalSettings.find((s) => s.key === "vital_parameters");
    if (cfg?.value && Array.isArray(cfg.value)) return new Set(cfg.value as string[]);
    return null; // null = show all defaults
  }, [clinicalSettings]);

  // Build vital configs dynamically based on locale
  const vitalConfigs = useMemo((): VitalConfig[] => {
    const tempCfg = getTemperatureConfig(localeConfig.temperature_unit);
    const weightCfg = getWeightConfig(localeConfig.weight_unit);
    const heightCfg = getHeightConfig(localeConfig.height_unit);

    return [
      {
        key: "temperature",
        labelKey: "vitals.temperature",
        unit: tempCfg.unit,
        icon: <IconTemperature size={18} />,
        min: tempCfg.min,
        max: tempCfg.max,
        step: tempCfg.step,
        precision: tempCfg.precision,
        ranges: {
          normal: tempCfg.normalRange,
          borderline: tempCfg.borderlineRange,
          critical: [0, 200],
        },
      },
      {
        key: "pulse",
        labelKey: "vitals.pulse",
        unit: "bpm",
        icon: <IconHeartRateMonitor size={18} />,
        min: 20,
        max: 250,
        step: 1,
        precision: 0,
        ranges: { normal: [60, 100], borderline: [50, 120], critical: [0, 300] },
      },
      {
        key: "spo2",
        labelKey: "vitals.spo2",
        unit: "%",
        icon: <IconDroplet size={18} />,
        min: 50,
        max: 100,
        step: 1,
        precision: 0,
        ranges: { normal: [95, 100], borderline: [90, 100], critical: [0, 100] },
      },
      {
        key: "respiratory_rate",
        labelKey: "vitals.respiratoryRate",
        unit: "/min",
        icon: <IconLungs size={18} />,
        min: 4,
        max: 60,
        step: 1,
        precision: 0,
        ranges: { normal: [12, 20], borderline: [10, 25], critical: [0, 60] },
      },
      {
        key: "weight",
        labelKey: "vitals.weight",
        unit: weightCfg.unit,
        icon: <IconScale size={18} />,
        min: weightCfg.min,
        max: weightCfg.max,
        step: weightCfg.step,
        precision: weightCfg.precision,
        ranges: {
          normal: weightCfg.normalRange,
          borderline: weightCfg.borderlineRange,
          critical: [0, 9999],
        },
      },
      {
        key: "height",
        labelKey: "vitals.height",
        unit: heightCfg.unit,
        icon: <IconRuler2 size={18} />,
        min: heightCfg.min,
        max: heightCfg.max,
        step: heightCfg.step,
        precision: heightCfg.precision,
        ranges: {
          normal: heightCfg.normalRange,
          borderline: heightCfg.borderlineRange,
          critical: [0, 9999],
        },
      },
      {
        // Charted for children (WHO head circumference-for-age); the growth
        // chart judges it, so no adult range is drawn here.
        key: "head_circumference",
        labelKey: "vitals.headCircumference",
        unit: "cm",
        icon: <IconRulerMeasure size={18} />,
        min: 20,
        max: 70,
        step: 0.1,
        precision: 1,
        ranges: { normal: [0, 999], borderline: [0, 999], critical: [0, 999] },
      },
    ];
  }, [localeConfig.temperature_unit, localeConfig.weight_unit, localeConfig.height_unit]);

  // Filter by hospital config (if set). null = show all.
  const filteredVitalConfigs = enabledVitals
    ? vitalConfigs.filter((v) => enabledVitals.has(v.key))
    : vitalConfigs;

  const showBp =
    !enabledVitals || enabledVitals.has("systolic_bp") || enabledVitals.has("diastolic_bp");
  const bpLevel = bloodPressureLevel(values.systolic_bp, values.diastolic_bp);

  // BMI calculation — convert display values to metric for computation
  const bmiValues = useMemo(() => {
    const rawWeight = values.weight;
    const rawHeight = values.height;
    const weightKg =
      rawWeight !== undefined ? weightToKg(rawWeight, localeConfig.weight_unit) : undefined;
    const heightCm =
      rawHeight !== undefined ? heightToCm(rawHeight, localeConfig.height_unit) : undefined;
    return { weightKg, heightCm };
  }, [values.weight, values.height, localeConfig.weight_unit, localeConfig.height_unit]);

  const bmi = useMemo(
    () => computeBmi(bmiValues.weightKg, bmiValues.heightCm),
    [bmiValues.weightKg, bmiValues.heightCm],
  );

  const map = useMemo(
    () => computeMap(values.systolic_bp, values.diastolic_bp),
    [values.systolic_bp, values.diastolic_bp],
  );

  const toRequest = (nextValues: VitalValues, nextNotes: string): CreateVitalRequest => {
    const req: CreateVitalRequest = {};
    // Temperature is stored as-entered (unit tracked separately)
    if (nextValues.temperature !== undefined) req.temperature = nextValues.temperature;
    if (nextValues.pulse !== undefined) req.pulse = nextValues.pulse;
    if (nextValues.systolic_bp !== undefined) req.systolic_bp = nextValues.systolic_bp;
    if (nextValues.diastolic_bp !== undefined) req.diastolic_bp = nextValues.diastolic_bp;
    if (nextValues.respiratory_rate !== undefined)
      req.respiratory_rate = nextValues.respiratory_rate;
    if (nextValues.spo2 !== undefined) req.spo2 = nextValues.spo2;
    // Convert weight/height to metric for storage
    if (nextValues.weight !== undefined) {
      req.weight_kg = Math.round(weightToKg(nextValues.weight, localeConfig.weight_unit) * 10) / 10;
    }
    if (nextValues.height !== undefined) {
      req.height_cm = Math.round(heightToCm(nextValues.height, localeConfig.height_unit) * 10) / 10;
    }
    if (nextValues.head_circumference !== undefined) {
      req.head_circumference_cm = Math.round(nextValues.head_circumference * 10) / 10;
    }
    if (nextNotes.trim()) req.notes = nextNotes.trim();
    return req;
  };

  const updateValues = (patch: VitalValues) => {
    setValues((prev) => {
      const next = { ...prev, ...patch };
      onChange?.(toRequest(next, notes));
      return next;
    });
  };

  const handleChange = (key: string, val: string | number) => {
    const num = typeof val === "string" ? (val === "" ? undefined : Number(val)) : val;
    updateValues({ [key]: num });
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    onChange?.(toRequest(values, value));
  };

  const handleSubmit = () => {
    if (!isBloodPressureValid(values.systolic_bp, values.diastolic_bp)) {
      setShowBpErrors(true);
      return;
    }
    onSubmit?.(toRequest(values, notes));
  };

  return (
    <Stack gap="md">
      <SignatureHero
        compact
        eyebrow={t("vitals.title", "Vitals")}
        title={t("vitals.recordVitals", "Record vitals")}
        subtitle={t("vitals.subtitle", "Capture the encounter's vital signs")}
        icon={<IconHeartRateMonitor size={20} />}
      />
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        {showBp && (
          <Box className={`${styles.vitalCard} ${styles.bpCard}`} data-level={bpLevel}>
            <BloodPressureInput
              label={t("vitals.bloodPressure", "Blood pressure")}
              value={{ systolic: values.systolic_bp, diastolic: values.diastolic_bp }}
              onChange={(bp) =>
                updateValues({ systolic_bp: bp.systolic, diastolic_bp: bp.diastolic })
              }
              showErrors={showBpErrors}
            />
            {bpLevel === "critical" && (
              <Badge size="xs" color="danger" variant="light" mt={4}>
                {t("vitals.hypertensiveCrisis", "Hypertensive crisis")}
              </Badge>
            )}
          </Box>
        )}
        {filteredVitalConfigs.map((config) => {
          const val = values[config.key];
          const level = getRangeLevel(config, val);
          const rangeLabel = getRangeLabel(config);
          const status = getRangeStatus(config, val);

          return (
            <div key={config.key} className={styles.vitalCard} data-level={level}>
              <Group gap={6} mb={4} wrap="nowrap">
                <ThemeIcon
                  variant="light"
                  size={28}
                  radius="md"
                  color={
                    level === "critical" ? "danger" : level === "borderline" ? "warning" : "primary"
                  }
                >
                  {config.icon}
                </ThemeIcon>
                <div>
                  <Text size="xs" fw={600} lh={1.2}>
                    {t(config.labelKey)}
                  </Text>
                  <Text size="xs" c="dimmed" lh={1}>
                    {config.unit}
                  </Text>
                </div>
              </Group>
              <NumberInput
                value={val ?? ""}
                onChange={(v) => handleChange(config.key, v)}
                min={config.min}
                max={config.max}
                step={config.step}
                decimalScale={config.precision}
                hideControls
                size="sm"
                placeholder="—"
                classNames={{ input: styles.vitalInput }}
              />
              <Group gap={4} mt={4} justify="center">
                {rangeLabel && (
                  <Text size="xs" c="dimmed" ta="center">
                    {rangeLabel} {config.unit}
                  </Text>
                )}
                {status && (
                  <Badge size="xs" color={status.color} variant="light">
                    {status.label}
                  </Badge>
                )}
              </Group>
            </div>
          );
        })}
      </SimpleGrid>

      {/* Auto-calculated values */}
      {(bmi !== null || map !== null) && (
        <Group gap="md">
          {bmi !== null && (
            <div className={styles.calcBadge}>
              <Text size="xs" c="dimmed">
                {t("vitals.bmi")}
              </Text>
              <Group gap={4}>
                <Text size="sm" fw={700}>
                  {bmi.toFixed(1)}
                </Text>
                <Badge size="xs" color={getBmiCategory(bmi).color} variant="light">
                  {t(getBmiCategory(bmi).labelKey)}
                </Badge>
              </Group>
            </div>
          )}
          {map !== null && (
            <div className={styles.calcBadge}>
              <Text size="xs" c="dimmed">
                {t("vitals.map")}
              </Text>
              <Text size="sm" fw={700}>
                {map} mmHg
              </Text>
            </div>
          )}
        </Group>
      )}

      {showNotes && (
        <Textarea
          label={t("vitals.notes")}
          placeholder={t("vitals.additionalObservations")}
          value={notes}
          onChange={(e) => handleNotesChange(e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={4}
        />
      )}

      {showActions && (
        <Group justify="flex-end">
          {onCancel && (
            <Button variant="default" size="sm" onClick={onCancel}>
              {t("common:cancel")}
            </Button>
          )}
          <Button size="sm" onClick={handleSubmit} loading={isSubmitting}>
            {t("vitals.recordVitals")}
          </Button>
        </Group>
      )}
    </Stack>
  );
}
