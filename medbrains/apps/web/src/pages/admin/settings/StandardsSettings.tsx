import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Group,
  Loader,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import {
  IconAlertCircle,
  IconCheck,
  IconDatabase,
  IconExternalLink,
  IconInfoCircle,
  IconPlugConnected,
  IconRefresh,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { clinicalSupportService } from "@/services/clinicalSupport.service";
import { labCatalogService } from "@/services/labCatalog.service";
import { pharmacyCatalogService } from "@/services/pharmacyCatalog.service";
import { radiologyService } from "@/services/radiology.service";
import { standardsService } from "@/services/standards.service";

type ReadinessStatus = "ready" | "partial" | "missing" | "blocked" | "loading";

interface StandardCard {
  key: string;
  title: string;
  standard: string;
  status: ReadinessStatus;
  metric: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

const STATUS_META: Record<ReadinessStatus, { label: string; color: string }> = {
  ready: { label: "Ready", color: "success" },
  partial: { label: "Partial", color: "orange" },
  missing: { label: "Needs setup", color: "danger" },
  blocked: { label: "Permission needed", color: "gray" },
  loading: { label: "Checking", color: "blue" },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function fhirResources(value: unknown): string[] {
  if (!isRecord(value)) return [];
  const rest = asArray(value.rest);
  return rest.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    return asArray(entry.resource)
      .map((resource) => (isRecord(resource) && hasText(resource.type) ? resource.type : null))
      .filter((resource): resource is string => resource !== null);
  });
}

function isFhirR4Capability(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return value.resourceType === "CapabilityStatement" && value.fhirVersion === "4.0.1";
}

function isPacsConfigured(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    hasText(value.orthanc_url) ||
    hasText(value.host) ||
    hasText(value.remote_ae_title) ||
    value.auto_sync === true
  );
}

function abdmFacilityStatus(value: unknown): "active" | "registered" | "missing" {
  if (!isRecord(value)) return "missing";
  if (value.abdm_facility_active === true && hasText(value.abdm_facility_id)) return "active";
  if (hasText(value.abdm_facility_id) || hasText(value.abdm_hcx_sender_code)) return "registered";
  return "missing";
}

function statusFromCoverage(total: number, mapped: number): ReadinessStatus {
  if (total === 0) return "missing";
  if (mapped === 0) return "missing";
  return mapped === total ? "ready" : "partial";
}

function ReadinessCard({ item }: { item: StandardCard }) {
  const meta = STATUS_META[item.status];
  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start">
          <ThemeIcon variant="light" color={meta.color} size="lg">
            {item.status === "ready" ? <IconCheck size={18} /> : <IconAlertCircle size={18} />}
          </ThemeIcon>
          <Badge color={meta.color} variant="light">
            {meta.label}
          </Badge>
        </Group>

        <div>
          <Text fw={700}>{item.title}</Text>
          <Text size="xs" c="dimmed">
            {item.standard}
          </Text>
        </div>

        <Text size="sm">{item.description}</Text>

        <Group justify="space-between" align="center">
          <Code>{item.metric}</Code>
          {item.actionHref && item.actionLabel ? (
            <Button
              component="a"
              href={item.actionHref}
              target={item.actionHref.startsWith("http") ? "_blank" : undefined}
              rel={item.actionHref.startsWith("http") ? "noreferrer" : undefined}
              size="xs"
              variant="light"
              rightSection={<IconExternalLink size={14} />}
            >
              {item.actionLabel}
            </Button>
          ) : null}
        </Group>
      </Stack>
    </Card>
  );
}

export function StandardsSettings() {
  const canUseTerminology = useHasPermission(P.OPD.QUEUE_VIEW);
  const canReadLab = useHasPermission(P.LAB.ORDERS_LIST);
  const canReadPharmacy = useHasPermission(P.PHARMACY.PRESCRIPTIONS_LIST);
  const canReadRadiology = useHasPermission(P.RADIOLOGY.ORDERS_LIST);
  const canReadAbdm = useHasPermission("abdm.hfr.view");

  const fhirQuery = useQuery({
    queryKey: ["standards", "fhir-metadata"],
    queryFn: () => standardsService.fhirMetadata(),
    staleTime: 300_000,
  });

  const icdQuery = useQuery({
    queryKey: ["standards", "terminology", "icd11", "fever"],
    queryFn: () =>
      clinicalSupportService.searchTerminology({
        system: "icd11",
        q: "fever",
        limit: 5,
      }),
    enabled: canUseTerminology,
    staleTime: 300_000,
  });

  const snomedQuery = useQuery({
    queryKey: ["standards", "terminology", "snomed", "fever"],
    queryFn: () =>
      clinicalSupportService.searchTerminology({
        system: "snomed",
        q: "fever",
        limit: 5,
      }),
    enabled: canUseTerminology,
    staleTime: 300_000,
  });

  const labCatalogQuery = useQuery({
    queryKey: ["standards", "lab-catalog"],
    queryFn: () => labCatalogService.listLabCatalog(),
    enabled: canReadLab,
    staleTime: 300_000,
  });

  const pharmacyCatalogQuery = useQuery({
    queryKey: ["standards", "pharmacy-catalog"],
    queryFn: () => pharmacyCatalogService.listPharmacyCatalog(),
    enabled: canReadPharmacy,
    staleTime: 300_000,
  });

  const pacsConfigQuery = useQuery({
    queryKey: ["standards", "pacs-config"],
    queryFn: () => radiologyService.getRadiologyPacsConfig(),
    enabled: canReadRadiology,
    staleTime: 300_000,
  });

  const dicomStudiesQuery = useQuery({
    queryKey: ["standards", "dicom-studies"],
    queryFn: () => radiologyService.listRadiologyDicomStudies(),
    enabled: canReadRadiology,
    staleTime: 300_000,
  });

  const abdmTenantQuery = useQuery({
    queryKey: ["standards", "abdm-tenant-hfr"],
    queryFn: () => standardsService.getTenantAbdmHfr(),
    enabled: canReadAbdm,
    staleTime: 300_000,
  });

  const abdmRegistrationsQuery = useQuery({
    queryKey: ["standards", "abdm-hfr-registrations"],
    queryFn: () => standardsService.getAbdmHfr(),
    enabled: canReadAbdm,
    staleTime: 300_000,
  });

  const standards = useMemo<StandardCard[]>(() => {
    const resources = fhirResources(fhirQuery.data);
    const fhirStatus: ReadinessStatus = fhirQuery.isLoading
      ? "loading"
      : fhirQuery.isError
        ? "missing"
        : isFhirR4Capability(fhirQuery.data) && resources.length >= 3
          ? "ready"
          : "partial";

    const icdCount = icdQuery.data?.length ?? 0;
    const snomedCount = snomedQuery.data?.length ?? 0;
    const terminologyStatus: ReadinessStatus = !canUseTerminology
      ? "blocked"
      : icdQuery.isLoading || snomedQuery.isLoading
        ? "loading"
        : icdQuery.isError || snomedQuery.isError || icdCount === 0
          ? "missing"
          : snomedCount > 0
            ? "ready"
            : "partial";

    const labRows = labCatalogQuery.data ?? [];
    const loincMapped = labRows.filter((row) => hasText(row.loinc_code)).length;
    const labStatus: ReadinessStatus = !canReadLab
      ? "blocked"
      : labCatalogQuery.isLoading
        ? "loading"
        : labCatalogQuery.isError
          ? "missing"
          : statusFromCoverage(labRows.length, loincMapped);

    const drugRows = pharmacyCatalogQuery.data ?? [];
    const codedDrugs = drugRows.filter(
      (row) =>
        hasText(row.inn_name) ||
        hasText(row.atc_code) ||
        hasText(row.rxnorm_code) ||
        hasText(row.snomed_code),
    ).length;
    const pharmacyStatus: ReadinessStatus = !canReadPharmacy
      ? "blocked"
      : pharmacyCatalogQuery.isLoading
        ? "loading"
        : pharmacyCatalogQuery.isError
          ? "missing"
          : statusFromCoverage(drugRows.length, codedDrugs);

    const pacsConfigured = isPacsConfigured(pacsConfigQuery.data);
    const dicomStudies = asArray(dicomStudiesQuery.data).length;
    const dicomStatus: ReadinessStatus = !canReadRadiology
      ? "blocked"
      : pacsConfigQuery.isLoading || dicomStudiesQuery.isLoading
        ? "loading"
        : pacsConfigQuery.isError || dicomStudiesQuery.isError
          ? "missing"
          : pacsConfigured && dicomStudies > 0
            ? "ready"
            : pacsConfigured || dicomStudies > 0
              ? "partial"
              : "missing";

    const facilityStatus = abdmFacilityStatus(abdmTenantQuery.data);
    const registrations = asArray(abdmRegistrationsQuery.data);
    const abdmStatus: ReadinessStatus = !canReadAbdm
      ? "blocked"
      : abdmTenantQuery.isLoading || abdmRegistrationsQuery.isLoading
        ? "loading"
        : abdmTenantQuery.isError || abdmRegistrationsQuery.isError
          ? "missing"
          : facilityStatus === "active"
            ? "ready"
            : facilityStatus === "registered" || registrations.length > 0
              ? "partial"
              : "missing";

    return [
      {
        key: "fhir",
        title: "FHIR R4 EHR Exchange",
        standard: "HL7 FHIR R4 4.0.1 / ABDM profile surface",
        status: fhirStatus,
        metric: resources.length > 0 ? resources.join(", ") : "No resources",
        description:
          "CapabilityStatement should advertise Patient, Encounter, Observation and Patient/$everything for EHR exchange clients.",
        actionLabel: "Open metadata",
        actionHref: "/api/fhir/metadata",
      },
      {
        key: "terminology",
        title: "Diagnosis Terminology",
        standard: "WHO ICD-11 primary + SNOMED CT secondary",
        status: terminologyStatus,
        metric: `ICD-11 ${icdCount} / SNOMED ${snomedCount}`,
        description:
          "OPD diagnosis entry uses the hospital primary diagnosis policy. ICD-11 remains the primary reporting code; SNOMED CT is stored as the linked clinical concept when licensed release data is available.",
      },
      {
        key: "loinc",
        title: "Lab Observation Codes",
        standard: "LOINC for lab tests and observations",
        status: labStatus,
        metric: `${loincMapped}/${labRows.length} mapped`,
        description:
          "Lab catalog rows need LOINC codes so reports and FHIR Observations can be exchanged without local-name ambiguity.",
        actionLabel: "Lab masters",
        actionHref: "#clinical-masters",
      },
      {
        key: "drug-codes",
        title: "Drug Coding",
        standard: "WHO INN / ATC / RxNorm / SNOMED CT",
        status: pharmacyStatus,
        metric: `${codedDrugs}/${drugRows.length} coded`,
        description:
          "Drug catalog rows should carry generic INN, ATC/RxNorm/SNOMED where available, plus regulatory schedule fields.",
        actionLabel: "Compliance",
        actionHref: "#compliance",
      },
      {
        key: "dicom",
        title: "Imaging Exchange",
        standard: "DICOM / DICOMweb readiness",
        status: dicomStatus,
        metric: pacsConfigured
          ? `${dicomStudies} studies + PACS config`
          : `${dicomStudies} studies`,
        description:
          "Radiology needs PACS/DICOM configuration, prior studies, viewer URLs, and later DICOMweb QIDO/WADO/STOW gateway coverage.",
        actionLabel: "Open studies",
        actionHref: "/radiology",
      },
      {
        key: "abdm",
        title: "ABDM Facility Setup",
        standard: "ABDM HFR/HIP readiness",
        status: abdmStatus,
        metric:
          facilityStatus === "active"
            ? "HFR active"
            : registrations.length > 0
              ? `${registrations.length} registration rows`
              : "Not registered",
        description:
          "ABDM exchange requires facility registration, consent flow, audit logging, and FHIR-compatible care-context exports.",
      },
    ];
  }, [
    abdmRegistrationsQuery.data,
    abdmRegistrationsQuery.isError,
    abdmRegistrationsQuery.isLoading,
    abdmTenantQuery.data,
    abdmTenantQuery.isError,
    abdmTenantQuery.isLoading,
    canReadAbdm,
    canReadLab,
    canReadPharmacy,
    canReadRadiology,
    canUseTerminology,
    dicomStudiesQuery.data,
    dicomStudiesQuery.isError,
    dicomStudiesQuery.isLoading,
    fhirQuery.data,
    fhirQuery.isError,
    fhirQuery.isLoading,
    icdQuery.data,
    icdQuery.isError,
    icdQuery.isLoading,
    labCatalogQuery.data,
    labCatalogQuery.isError,
    labCatalogQuery.isLoading,
    pacsConfigQuery.data,
    pacsConfigQuery.isError,
    pacsConfigQuery.isLoading,
    pharmacyCatalogQuery.data,
    pharmacyCatalogQuery.isError,
    pharmacyCatalogQuery.isLoading,
    snomedQuery.data,
    snomedQuery.isError,
    snomedQuery.isLoading,
  ]);

  const readyCount = standards.filter((item) => item.status === "ready").length;
  const readinessPercent = Math.round((readyCount / standards.length) * 100);
  const anyLoading = standards.some((item) => item.status === "loading");

  const refreshAll = () => {
    fhirQuery.refetch();
    icdQuery.refetch();
    labCatalogQuery.refetch();
    pharmacyCatalogQuery.refetch();
    pacsConfigQuery.refetch();
    dicomStudiesQuery.refetch();
    abdmTenantQuery.refetch();
    abdmRegistrationsQuery.refetch();
  };

  return (
    <Stack gap="lg">
      <Alert icon={<IconInfoCircle size={20} />} color="primary" variant="light">
        <Text size="sm">
          This is the setup checkpoint for EHR exchange standards. It does not create a separate
          standards service; it verifies the existing clinical, lab, pharmacy, radiology, FHIR and
          ABDM surfaces that real hospitals need before integrations go live.
        </Text>
      </Alert>

      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={4}>Standards Readiness</Title>
          <Text size="sm" c="dimmed">
            EHR/FHIR, terminology coding, PACS/DICOM, ABDM and catalog mapping readiness.
          </Text>
        </div>
        <Button
          variant="light"
          leftSection={anyLoading ? <Loader size={14} /> : <IconRefresh size={16} />}
          onClick={refreshAll}
        >
          Recheck
        </Button>
      </Group>

      <Card withBorder padding="md" radius="md">
        <Group justify="space-between" mb="xs">
          <Text fw={600}>Go-live readiness</Text>
          <Badge color={readinessPercent >= 80 ? "success" : "orange"}>{readinessPercent}%</Badge>
        </Group>
        <Progress value={readinessPercent} color={readinessPercent >= 80 ? "success" : "orange"} />
        <Text size="xs" c="dimmed" mt="xs">
          {readyCount} of {standards.length} standards areas are fully ready.
        </Text>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2, xl: 3 }}>
        {standards.map((item) => (
          <ReadinessCard key={item.key} item={item} />
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card withBorder padding="md" radius="md">
          <Group gap="sm" mb="sm">
            <ThemeIcon variant="light" color="primary">
              <IconShieldCheck size={18} />
            </ThemeIcon>
            <Title order={5}>Required Operational Setup</Title>
          </Group>
          <Stack gap="xs">
            <Text size="sm">
              Patient registration must capture UHID and ABHA/health ID where used.
            </Text>
            <Text size="sm">
              OPD diagnosis must default to ICD-11 selection; SNOMED CT is secondary and ICD-10 is
              only for legacy payer/statutory exports when configured.
            </Text>
            <Text size="sm">
              Lab tests need LOINC mapping before external diagnostic reports are exchanged.
            </Text>
            <Text size="sm">
              Lab records are viewed in Lab order details and Patient Detail &gt; Lab Orders.
            </Text>
            <Text size="sm">
              Pharmacy catalog needs INN, ATC/RxNorm/SNOMED and regulatory schedule fields.
            </Text>
            <Text size="sm">
              Radiology must route studies through PACS/DICOM with viewer URLs and audit trail.
            </Text>
            <Text size="sm">
              DICOM studies are viewed in Radiology &gt; DICOM Studies and Patient Detail &gt;
              Imaging.
            </Text>
          </Stack>
        </Card>

        <Card withBorder padding="md" radius="md">
          <Group gap="sm" mb="sm">
            <ThemeIcon variant="light" color="teal">
              <IconPlugConnected size={18} />
            </ThemeIcon>
            <Title order={5}>Reference Baselines</Title>
          </Group>
          <Stack gap="xs">
            <Button component="a" href="https://hl7.org/fhir/R4/" target="_blank" variant="subtle">
              HL7 FHIR R4
            </Button>
            <Button
              component="a"
              href="https://icd.who.int/icdapi"
              target="_blank"
              variant="subtle"
            >
              WHO ICD API
            </Button>
            <Button
              component="a"
              href="https://www.snomedctnrc.in/standards/snomed-ct"
              target="_blank"
              variant="subtle"
            >
              NRCeS CSNOtk / SNOMED CT
            </Button>
            <Button
              component="a"
              href="https://www.dicomstandard.org/using/dicomweb/"
              target="_blank"
              variant="subtle"
            >
              DICOMweb
            </Button>
          </Stack>
        </Card>
      </SimpleGrid>

      <Card withBorder padding="md" radius="md">
        <Group gap="sm" mb="sm">
          <ThemeIcon variant="light" color="gray">
            <IconDatabase size={18} />
          </ThemeIcon>
          <Title order={5}>Implementation Boundary</Title>
        </Group>
        <Text size="sm" c="dimmed">
          Current implementation is read/check focused: FHIR R4 read endpoints, official ICD-11
          search, mapped catalog coverage, DICOM study visibility and ABDM facility status. The next
          backend steps are FHIR document/bundle validation, terminology-server sync jobs, SNOMED
          enablement, legacy ICD-10 export mapping, and DICOMweb gateway operations.
        </Text>
      </Card>
    </Stack>
  );
}
