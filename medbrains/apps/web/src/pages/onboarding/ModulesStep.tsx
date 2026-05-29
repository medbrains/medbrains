import { Badge, Button, Stack, Switch, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useOnboardingStore } from "@medbrains/stores";
import { IconCheck, IconDatabase } from "@tabler/icons-react";
import { useState } from "react";
import { onboardingService } from "@/services/onboarding.service";
import classes from "./onboarding.module.scss";

interface Props {
  onNext: () => void;
  onBack: () => void;
}

interface ModuleDef {
  code: string;
  name: string;
  description: string;
  depends_on: string[];
  has_masters: boolean;
}

const DEFAULT_MODULES: ModuleDef[] = [
  {
    code: "registration",
    name: "Patient Registration",
    description: "Patient registration, UHID generation, demographics",
    depends_on: [],
    has_masters: false,
  },
  {
    code: "opd",
    name: "OPD",
    description: "Outpatient department queues, consultations, prescriptions",
    depends_on: ["registration"],
    has_masters: true,
  },
  {
    code: "ipd",
    name: "IPD",
    description: "Inpatient admissions, bed management, discharge",
    depends_on: ["registration"],
    has_masters: true,
  },
  {
    code: "lab",
    name: "Laboratory / LIS",
    description: "Lab test catalog, orders, results, verification",
    depends_on: [],
    has_masters: true,
  },
  {
    code: "pharmacy",
    name: "Pharmacy",
    description: "Drug catalog, dispensing, stock management",
    depends_on: [],
    has_masters: true,
  },
  {
    code: "billing",
    name: "Billing & Revenue",
    description: "Invoices, payments, charge master, insurance",
    depends_on: ["registration"],
    has_masters: true,
  },
  {
    code: "radiology",
    name: "Radiology / RIS",
    description: "Imaging orders, PACS integration, reporting",
    depends_on: [],
    has_masters: true,
  },
  {
    code: "blood_bank",
    name: "Blood Bank",
    description: "Blood inventory, cross-match, transfusion",
    depends_on: [],
    has_masters: false,
  },
  {
    code: "ot",
    name: "Operation Theatre",
    description: "Surgery scheduling, OT management",
    depends_on: ["ipd"],
    has_masters: false,
  },
  {
    code: "emergency",
    name: "Emergency",
    description: "Triage, emergency admissions, trauma protocols",
    depends_on: ["registration"],
    has_masters: false,
  },
  {
    code: "nursing",
    name: "Nursing",
    description: "Nursing assessments, care plans, task management",
    depends_on: ["ipd"],
    has_masters: false,
  },
  {
    code: "diet",
    name: "Diet & Nutrition",
    description: "Meal planning, therapeutic diets, kitchen management",
    depends_on: ["ipd"],
    has_masters: false,
  },
  {
    code: "hr",
    name: "Human Resources",
    description: "Staff management, attendance, payroll",
    depends_on: [],
    has_masters: false,
  },
  {
    code: "inventory",
    name: "Inventory & Stores",
    description: "Purchase orders, stock management, vendors",
    depends_on: [],
    has_masters: false,
  },
  {
    code: "reports",
    name: "Reports & Analytics",
    description: "Dashboards, MIS reports, data analytics",
    depends_on: [],
    has_masters: false,
  },
];

export function ModulesStep({ onNext, onBack }: Props) {
  const moduleStatuses = useOnboardingStore((s) => s.moduleStatuses);
  const setModuleStatus = useOnboardingStore((s) => s.setModuleStatus);
  const [seeding, setSeeding] = useState<string | null>(null);
  const [seeded, setSeeded] = useState<Set<string>>(new Set());

  const getStatus = (code: string) => moduleStatuses[code] ?? "available";

  const handleToggle = (code: string, enabled: boolean) => {
    if (enabled) {
      // Auto-enable dependencies
      const mod = DEFAULT_MODULES.find((m) => m.code === code);
      if (mod) {
        const missingDeps = mod.depends_on.filter((dep) => getStatus(dep) !== "enabled");
        for (const dep of missingDeps) {
          setModuleStatus(dep, "enabled");
        }
        if (missingDeps.length > 0) {
          notifications.show({
            title: "Dependencies enabled",
            message: `Also enabled: ${missingDeps.join(", ")}`,
            color: "primary",
          });
        }
      }
    } else {
      // Warn about dependents
      const dependents = DEFAULT_MODULES.filter(
        (m) => getStatus(m.code) === "enabled" && m.depends_on.includes(code),
      );
      if (dependents.length > 0) {
        const names = dependents.map((m) => m.name).join(", ");
        notifications.show({
          title: "Warning",
          message: `The following modules depend on this one: ${names}. They may not work correctly.`,
          color: "orange",
        });
      }
    }

    setModuleStatus(code, enabled ? "enabled" : "disabled");
  };

  const handleSeedMasters = async (moduleCode: string) => {
    setSeeding(moduleCode);
    try {
      const result = await onboardingService.seedModuleMasters({ module_code: moduleCode });
      if (result.seeded.length > 0) {
        setSeeded((prev) => new Set([...prev, moduleCode]));
        notifications.show({
          title: "Master data seeded",
          message: `Seeded: ${result.seeded.join(", ")}`,
          color: "success",
        });
      } else {
        notifications.show({
          title: "No templates",
          message: result.message ?? "No master data templates for this module",
          color: "warning",
        });
      }
    } catch {
      notifications.show({
        title: "Error",
        message: "Failed to seed master data. You can configure it later from settings.",
        color: "danger",
      });
    } finally {
      setSeeding(null);
    }
  };

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Enable or disable modules based on your hospital&apos;s needs. For enabled modules with
        master data templates, click &quot;Seed Defaults&quot; to pre-populate configuration. You
        can change these later from the admin settings.
      </Text>

      <div className={classes.moduleGrid}>
        {DEFAULT_MODULES.map((mod) => {
          const isEnabled = getStatus(mod.code) === "enabled";
          const isSeeded = seeded.has(mod.code);
          return (
            <div key={mod.code} className={classes.moduleCard}>
              <div className={classes.moduleInfo}>
                <Title order={6}>{mod.name}</Title>
                <Text size="xs" c="dimmed" mt={4}>
                  {mod.description}
                </Text>
                {mod.depends_on.length > 0 && (
                  <Text size="xs" c="orange" mt={4}>
                    Requires: {mod.depends_on.join(", ")}
                  </Text>
                )}
                {isEnabled && mod.has_masters && (
                  <Button
                    variant="light"
                    size="xs"
                    mt={8}
                    leftSection={isSeeded ? <IconCheck size={14} /> : <IconDatabase size={14} />}
                    color={isSeeded ? "success" : "primary"}
                    loading={seeding === mod.code}
                    disabled={isSeeded}
                    onClick={() => handleSeedMasters(mod.code)}
                  >
                    {isSeeded ? (
                      <>
                        Defaults seeded{" "}
                        <Badge size="xs" ml={4} color="success">
                          done
                        </Badge>
                      </>
                    ) : (
                      "Seed Defaults"
                    )}
                  </Button>
                )}
              </div>
              <Switch
                checked={isEnabled}
                onChange={(e) => handleToggle(mod.code, e.currentTarget.checked)}
              />
            </div>
          );
        })}
      </div>

      <div className={classes.navButtons}>
        <Button variant="default" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </Stack>
  );
}
