import { Card, Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { MedicalCertificate } from "@medbrains/types";
import { IconCertificate, IconPlus } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SignRecordButton } from "@/components/Signatures/SignRecordButton";
import { Badge, Button } from "@/components/ui";
import { opdService } from "@/services/opd.service";
import { LoadFailed } from "./load-failed";
import { NewCertificateModal } from "./new-certificate-modal";

interface CertificatesTabProps {
  patientId: string;
  encounterId: string;
  /** May issue a new certificate for this visit. */
  canUpdate: boolean;
}

/**
 * The medical certificates issued to the patient, each signable, and a form to issue a new one
 * from this visit. A failed read shows as a fault, never as "no certificates issued".
 */
export function CertificatesTab({ patientId, encounterId, canUpdate }: CertificatesTabProps) {
  const [createOpen, { open, close }] = useDisclosure(false);
  // A new form after each close, once its closing animation ends, so the next opening starts
  // empty and both animations still play.
  const [formKey, setFormKey] = useState(0);
  const {
    data: certificates = [],
    isLoading,
    error,
    isLoadingError,
    isRefetchError,
    refetch,
  } = useQuery<MedicalCertificate[]>({
    queryKey: ["patient-certificates", patientId],
    queryFn: () => opdService.listCertificates(patientId),
  });

  if (isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading certificates...
      </Text>
    );
  }
  return (
    <Stack gap="sm">
      {canUpdate && (
        <Group>
          <Button tone="primary" size="xs" leftSection={<IconPlus size={14} />} onClick={open}>
            New Certificate
          </Button>
        </Group>
      )}
      {(isLoadingError || isRefetchError) && (
        <LoadFailed what="Certificates" error={error} onRetry={refetch} stale={isRefetchError} />
      )}
      {certificates.map((cert) => (
        <CertificateCard key={cert.id} cert={cert} />
      ))}
      {certificates.length === 0 && !createOpen && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No certificates issued for this patient.
        </Text>
      )}
      <NewCertificateModal
        key={formKey}
        opened={createOpen}
        onClose={close}
        onClosed={() => setFormKey((k) => k + 1)}
        patientId={patientId}
        encounterId={encounterId}
      />
    </Stack>
  );
}

/** One issued certificate: its type and number, dates, diagnosis and remarks, and its signature. */
function CertificateCard({ cert }: { cert: MedicalCertificate }) {
  const typeLabel = cert.certificate_type.replace(/_/g, " ");
  return (
    <Card padding="sm" withBorder>
      <Group justify="space-between" mb="xs">
        <Group gap={8}>
          <IconCertificate size={16} color="var(--mantine-color-blue-5)" />
          <Badge size="sm">{typeLabel}</Badge>
          {cert.certificate_number && (
            <Text size="xs" c="dimmed" ff="monospace">
              {cert.certificate_number}
            </Text>
          )}
        </Group>
        <Group gap={8}>
          <Text size="xs" c="dimmed">
            {new Date(cert.issued_date).toLocaleDateString()}
          </Text>
          <SignRecordButton
            recordType="medical_certificate"
            authorId={cert.doctor_id}
            recordId={cert.id}
            summary={typeLabel}
          />
        </Group>
      </Group>
      {cert.diagnosis && (
        <Text size="sm">
          <Text span fw={500}>
            Diagnosis:
          </Text>{" "}
          {cert.diagnosis}
        </Text>
      )}
      {(cert.valid_from || cert.valid_to) && <ValidityLine cert={cert} />}
      {cert.remarks && (
        <Text size="xs" c="dimmed" fs="italic" mt={4}>
          {cert.remarks}
        </Text>
      )}
    </Card>
  );
}

/** "From: … — To: …", either end shown only when set. */
function ValidityLine({ cert }: { cert: MedicalCertificate }) {
  return (
    <Text size="xs" c="dimmed">
      {cert.valid_from ? `From: ${new Date(cert.valid_from).toLocaleDateString()}` : ""}
      {cert.valid_from && cert.valid_to ? " — " : ""}
      {cert.valid_to ? `To: ${new Date(cert.valid_to).toLocaleDateString()}` : ""}
    </Text>
  );
}
