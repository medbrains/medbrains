import { Card, SimpleGrid, Text, ThemeIcon, UnstyledButton } from "@mantine/core";
import { usePermissionStore } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconBabyCarriage,
  IconBrain,
  IconHeartbeat,
  IconHeartHandshake,
  IconMicroscope,
  IconStethoscope,
  IconStretching,
} from "@tabler/icons-react";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { PageHeader } from "@/components";
import { useRequirePermission } from "@/hooks/useRequirePermission";

const SPECIALTIES = [
  {
    title: "Cath Lab",
    description: "Interventional cardiology, STEMI pathway, hemodynamics, device tracking",
    icon: IconHeartbeat,
    color: "danger",
    path: "/specialty/cath-lab",
    permission: "specialty.cath_lab.procedures.list",
  },
  {
    title: "Endoscopy",
    description: "GI procedures, scope management, HLD reprocessing, biopsy tracking",
    icon: IconMicroscope,
    color: "violet",
    path: "/specialty/endoscopy",
    permission: "specialty.endoscopy.procedures.list",
  },
  {
    title: "Psychiatry",
    description: "MHCA 2017 compliance, ECT register, seclusion & restraint, MHRB",
    icon: IconBrain,
    color: "primary",
    path: "/specialty/psychiatry",
    permission: "specialty.psychiatry.patients.list",
  },
  {
    title: "PMR & Audiology",
    description: "Rehabilitation plans, therapy sessions, audiometry, psychometric tests",
    icon: IconStretching,
    color: "teal",
    path: "/specialty/pmr",
    permission: "specialty.pmr.plans.list",
  },
  {
    title: "Palliative & Mortuary",
    description: "DNR orders, pain assessment, mortuary records, nuclear medicine",
    icon: IconHeartHandshake,
    color: "orange",
    path: "/specialty/palliative",
    permission: "specialty.palliative.dnr.list",
  },
  {
    title: "Maternity & OB-GYN",
    description: "ANC registration, labor & delivery, newborn records, postnatal care",
    icon: IconBabyCarriage,
    color: "danger",
    path: "/specialty/maternity",
    permission: "specialty.maternity.registrations.list",
  },
  {
    title: "Other Specialties",
    description: "Specialty templates, dialysis, chemotherapy, generic clinical records",
    icon: IconStethoscope,
    color: "info",
    path: "/specialty/other",
    permission: "specialty.other.records.list",
  },
];

export function SpecialtyIndexPage() {
  useRequirePermission(P.SPECIALTY.CATH_LAB.PROCEDURES_LIST);
  const navigate = useNavigate();

  // The filter used to call useHasPermission per specialty, inside the
  // callback — a hook in a loop. It survives only because SPECIALTIES is a
  // module constant, so the count never varies between renders; add one
  // conditionally and the page starts throwing.
  //
  // `hasPermission` reads through get() and its reference never changes, so
  // selecting it alone would leave this list stale after a permission
  // change. Subscribing to the two values it actually reads is what makes
  // the recompute fire.
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const userRole = usePermissionStore((state) => state.userRole);
  const userPermissions = usePermissionStore((state) => state.userPermissions);
  const visibleSpecialties = useMemo(
    () => SPECIALTIES.filter((specialty) => hasPermission(specialty.permission)),
    [hasPermission, userRole, userPermissions],
  );

  return (
    <div>
      <PageHeader title="Specialty Clinical" subtitle="Access specialty department modules" />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg" mt="md">
        {visibleSpecialties.map((s) => (
          <UnstyledButton key={s.path} onClick={() => navigate(s.path)}>
            <Card shadow="sm" padding="lg" radius="md" withBorder style={{ height: "100%" }}>
              <ThemeIcon size={40} radius="md" color={s.color} mb="sm">
                <s.icon size={24} />
              </ThemeIcon>
              <Text fw={600} size="lg">
                {s.title}
              </Text>
              <Text size="sm" c="dimmed" mt={4}>
                {s.description}
              </Text>
            </Card>
          </UnstyledButton>
        ))}
      </SimpleGrid>
    </div>
  );
}
