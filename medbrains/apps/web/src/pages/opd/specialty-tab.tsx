import { Stack, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import {
  IconArrowRight,
  IconBabyCarriage,
  IconBrain,
  IconHeartbeat,
  IconHeartHandshake,
  IconMicroscope,
  IconStethoscope,
  IconStretching,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { Alert, Button, Card } from "@/components/ui";
import { opdService } from "@/services/opd.service";

/**
 * A specialty module, and the departments it belongs to.
 *
 * `departmentCodes` is matched against the encounter's department so a
 * cardiology consultation offers the cath lab and a psychiatry one does not.
 * A specialty with no codes is offered everywhere -- palliative care is asked
 * for from any department.
 */
interface SpecialtyEntry {
  title: string;
  description: string;
  icon: ReactNode;
  path: string;
  permission: string;
  departmentCodes: readonly string[];
}

const SPECIALTIES: readonly SpecialtyEntry[] = [
  {
    title: "Cath Lab",
    description: "Interventional cardiology, STEMI pathway, hemodynamics",
    icon: <IconHeartbeat size={16} />,
    path: "/specialty/cath-lab",
    permission: "specialty.cath_lab.procedures.list",
    departmentCodes: ["CARDIOLOGY"],
  },
  {
    title: "Endoscopy",
    description: "GI procedures, scope management, biopsy tracking",
    icon: <IconMicroscope size={16} />,
    path: "/specialty/endoscopy",
    permission: "specialty.endoscopy.procedures.list",
    departmentCodes: ["GEN-SURGERY", "GEN-MEDICINE"],
  },
  {
    title: "Psychiatry",
    description: "MHCA 2017 compliance, ECT register, seclusion & restraint",
    icon: <IconBrain size={16} />,
    path: "/specialty/psychiatry",
    permission: "specialty.psychiatry.patients.list",
    departmentCodes: ["PSYCHIATRY"],
  },
  {
    title: "PMR & Audiology",
    description: "Rehabilitation plans, therapy sessions, audiometry",
    icon: <IconStretching size={16} />,
    path: "/specialty/pmr",
    permission: "specialty.pmr.plans.list",
    departmentCodes: ["PHYSIOTHERAPY", "ENT"],
  },
  {
    title: "Palliative",
    description: "Symptom control, care plans, family conferences",
    icon: <IconHeartHandshake size={16} />,
    path: "/specialty/palliative",
    permission: "specialty.palliative.plans.list",
    // Asked for from any department -- oncology, medicine, surgery alike.
    departmentCodes: [],
  },
  {
    title: "Maternity & OB-GYN",
    description: "Antenatal care, partogram, delivery records",
    icon: <IconBabyCarriage size={16} />,
    path: "/specialty/maternity",
    permission: "specialty.maternity.patients.list",
    departmentCodes: ["OBGYN"],
  },
  {
    title: "Ophthalmology & Dental",
    description: "Refraction, IOP, dental charting",
    icon: <IconStethoscope size={16} />,
    path: "/specialty/ophtho",
    permission: "specialty.ophtho.exams.list",
    departmentCodes: ["OPHTHALMOLOGY", "DENTAL"],
  },
] as const;

interface SpecialtyTabProps {
  patientId: string;
  encounterId: string;
  /** The encounter's department. Its code decides what is offered. */
  departmentId?: string | null;
}

/**
 * The specialty modules for the patient in front of you.
 *
 * These used to live behind a separate `/specialty` destination: a grid of
 * seven cards, reached from the sidebar, listing every procedure in the
 * hospital. A clinician mid-consultation had to leave the encounter, find
 * their patient in a ward-wide table and come back -- and the patient's own
 * identifier was never carried across, so the specialty form was filled in
 * from memory.
 *
 * Opening from here carries the patient and a return path, so the specialty
 * screen knows who this is and the way back is one click rather than a
 * re-navigation.
 */
export function SpecialtyTab({ patientId, encounterId, departmentId }: SpecialtyTabProps) {
  const navigate = useNavigate();

  // Same query key and staleTime the OPD queue uses, so this is served from
  // cache rather than costing a round trip on every tab open.
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => opdService.listDepartments(),
    staleTime: 600_000,
  });
  const departmentCode = useMemo(
    () => departments.find((d) => d.id === departmentId)?.code ?? null,
    [departments, departmentId],
  );

  // One unconditional hook per specialty, by literal. A hook cannot be called
  // inside a filter or a loop over the list -- doing exactly that is what
  // crashed the specialty index with "rendered more hooks than during the
  // previous render" -- so every check runs every time and the filtering
  // happens afterwards on plain booleans.
  const canCathLab = useHasPermission("specialty.cath_lab.procedures.list");
  const canEndoscopy = useHasPermission("specialty.endoscopy.procedures.list");
  const canPsychiatry = useHasPermission("specialty.psychiatry.patients.list");
  const canPmr = useHasPermission("specialty.pmr.plans.list");
  const canPalliative = useHasPermission("specialty.palliative.plans.list");
  const canMaternity = useHasPermission("specialty.maternity.patients.list");
  const canOphtho = useHasPermission("specialty.ophtho.exams.list");

  const { relevant, others } = useMemo(() => {
    const permitted: Record<string, boolean> = {
      "specialty.cath_lab.procedures.list": canCathLab,
      "specialty.endoscopy.procedures.list": canEndoscopy,
      "specialty.psychiatry.patients.list": canPsychiatry,
      "specialty.pmr.plans.list": canPmr,
      "specialty.palliative.plans.list": canPalliative,
      "specialty.maternity.patients.list": canMaternity,
      "specialty.ophtho.exams.list": canOphtho,
    };
    const allowed = SPECIALTIES.filter((s) => permitted[s.permission] === true);
    const code = departmentCode?.toUpperCase();
    return {
      relevant: allowed.filter(
        (s) => s.departmentCodes.length === 0 || (code ? s.departmentCodes.includes(code) : false),
      ),
      others: allowed.filter(
        (s) => s.departmentCodes.length > 0 && (code ? !s.departmentCodes.includes(code) : true),
      ),
    };
  }, [
    departmentCode,
    canCathLab,
    canEndoscopy,
    canPsychiatry,
    canPmr,
    canPalliative,
    canMaternity,
    canOphtho,
  ]);

  const open = (path: string) => {
    // The return path is validated on arrival by safeReturnPath, so a crafted
    // value cannot bounce a clinician off-site.
    const back = encodeURIComponent(`/opd/encounters/${encounterId}`);
    navigate(`${path}?patient_id=${encodeURIComponent(patientId)}&return=${back}`);
  };

  if (relevant.length === 0 && others.length === 0) {
    return (
      <Alert tone="info">
        You do not have access to any specialty module. This is a permission result, not a statement
        that none apply to this patient.
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      {relevant.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            For this department
          </Text>
          {relevant.map((s) => (
            <SpecialtyRow key={s.path} entry={s} onOpen={() => open(s.path)} />
          ))}
        </Stack>
      )}
      {others.length > 0 && (
        <Stack gap="xs">
          <Text size="sm" c="dimmed">
            Other specialties
          </Text>
          {others.map((s) => (
            <SpecialtyRow key={s.path} entry={s} onOpen={() => open(s.path)} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function SpecialtyRow({ entry, onOpen }: { entry: SpecialtyEntry; onOpen: () => void }) {
  return (
    <Card padding="sm">
      <Stack gap={4}>
        <Text fw={600} size="sm">
          {entry.icon} {entry.title}
        </Text>
        <Text size="xs" c="dimmed">
          {entry.description}
        </Text>
        <Button
          tone="secondary"
          size="xs"
          rightSection={<IconArrowRight size={14} />}
          onClick={onOpen}
          style={{ alignSelf: "flex-start" }}
        >
          Open for this patient
        </Button>
      </Stack>
    </Card>
  );
}
