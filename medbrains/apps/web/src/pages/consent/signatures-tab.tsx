// Consent SignaturesTab — split from consent.tsx (pure move).

import { Drawer, Group, Modal, Select, Stack, Text, Textarea, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import type { ConsentSignatureMetadata, CreateConsentSignatureRequest } from "@medbrains/types";
import { IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import type { Column } from "@/components/DataTable";
import { Badge, Button, IconButton } from "@/components/ui";
import { confirmDestructive } from "@/lib/confirm";
import { consentService } from "@/services/consent.service";

const SIGNATURE_TYPES = [
  { value: "pen_on_paper", label: "Pen on Paper" },
  { value: "digital_pen", label: "Digital Pen" },
  { value: "aadhaar_esign", label: "Aadhaar e-Sign" },
  { value: "biometric_thumb", label: "Biometric Thumb" },
  { value: "otp", label: "OTP" },
  { value: "video_consent", label: "Video Consent" },
  { value: "verbal_witness", label: "Verbal (Witness)" },
];

export function SignaturesTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const { data: signatures = [], isLoading } = useQuery({
    queryKey: ["consent-signatures", sourceFilter],
    queryFn: () =>
      consentService.listConsentSignatures({
        consent_source: sourceFilter ?? undefined,
      }),
  });

  const [detailSig, setDetailSig] = useState<ConsentSignatureMetadata | null>(null);

  const createMut = useMutation({
    mutationFn: (d: CreateConsentSignatureRequest) => consentService.createConsentSignature(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consent-signatures"] });
      close();
      notifications.show({ title: "Created", message: "Signature recorded", color: "success" });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not record signature", message: e.message, color: "red" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => consentService.deleteConsentSignature(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["consent-signatures"] });
      notifications.show({ title: "Deleted", message: "Signature removed", color: "danger" });
    },
    onError: (e: Error) =>
      notifications.show({ title: "Could not delete signature", message: e.message, color: "red" }),
  });

  const columns: Column<ConsentSignatureMetadata>[] = [
    {
      key: "consent_source",
      label: "Source",
      render: (r) => (
        <Badge tone={r.consent_source === "patient_consent" ? "primary" : "accent"} size="sm">
          {r.consent_source === "patient_consent" ? "Patient" : "Procedure"}
        </Badge>
      ),
    },
    {
      key: "consent_id",
      label: "Consent ID",
      render: (r) => (
        <Text size="sm" ff="monospace">
          {r.consent_id.slice(0, 8)}
        </Text>
      ),
    },
    {
      key: "signature_type",
      label: "Type",
      render: (r) => <Badge size="sm">{r.signature_type.replace(/_/g, " ")}</Badge>,
    },
    {
      key: "witness_name",
      label: "Witness",
      render: (r) => <Text size="sm">{r.witness_name ?? "—"}</Text>,
    },
    {
      key: "captured_at",
      label: "Captured",
      render: (r) => <Text size="sm">{new Date(r.captured_at).toLocaleString()}</Text>,
    },
    {
      key: "actions",
      label: "",
      render: (r) => (
        <Group gap={4}>
          <IconButton size="sm" onClick={() => setDetailSig(r)} aria-label="Search">
            <IconSearch size={14} />
          </IconButton>
          {canManage && (
            <IconButton
              tone="danger"
              size="sm"
              onClick={() =>
                confirmDestructive({
                  title: "Delete consent",
                  message: "Permanently delete this consent record? This cannot be undone.",
                  onConfirm: () => deleteMut.mutate(r.id),
                })
              }
              aria-label="Delete"
            >
              <IconTrash size={14} />
            </IconButton>
          )}
        </Group>
      ),
    },
  ];

  return (
    <>
      <Group mb="md" justify="space-between">
        <Select
          placeholder="Filter by source"
          data={[
            { value: "patient_consent", label: "Patient Consent" },
            { value: "procedure_consent", label: "Procedure Consent" },
          ]}
          value={sourceFilter}
          onChange={setSourceFilter}
          clearable
          w={220}
        />
        {canManage && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={open}>
            Add Signature
          </Button>
        )}
      </Group>
      <DataTable columns={columns} data={signatures} loading={isLoading} rowKey={(r) => r.id} />
      <Drawer opened={opened} onClose={close} title="Record Signature" position="right" size="lg">
        <SignatureForm onSubmit={(vals) => createMut.mutate(vals)} loading={createMut.isPending} />
      </Drawer>
      <Modal
        opened={!!detailSig}
        onClose={() => setDetailSig(null)}
        title="Signature Detail"
        size="lg"
      >
        {detailSig && (
          <Stack gap="xs">
            <Text size="sm">
              <strong>ID:</strong> {detailSig.id}
            </Text>
            <Text size="sm">
              <strong>Source:</strong> {detailSig.consent_source}
            </Text>
            <Text size="sm">
              <strong>Consent ID:</strong> {detailSig.consent_id}
            </Text>
            <Text size="sm">
              <strong>Type:</strong> {detailSig.signature_type.replace(/_/g, " ")}
            </Text>
            {detailSig.signature_image_url && (
              <Text size="sm">
                <strong>Signature Image:</strong> {detailSig.signature_image_url}
              </Text>
            )}
            {detailSig.video_consent_url && (
              <Text size="sm">
                <strong>Video:</strong> {detailSig.video_consent_url}
              </Text>
            )}
            {detailSig.aadhaar_esign_ref && (
              <Text size="sm">
                <strong>Aadhaar Ref:</strong> {detailSig.aadhaar_esign_ref}
              </Text>
            )}
            <Text size="sm">
              <strong>Witness:</strong> {detailSig.witness_name ?? "—"} (
              {detailSig.witness_designation ?? "—"})
            </Text>
            <Text size="sm">
              <strong>Doctor Signature:</strong> {detailSig.doctor_signature_url ?? "—"}
            </Text>
            <Text size="sm">
              <strong>Captured:</strong> {new Date(detailSig.captured_at).toLocaleString()}
            </Text>
            <Text size="sm">
              <strong>Captured By:</strong> {detailSig.captured_by ?? "—"}
            </Text>
          </Stack>
        )}
      </Modal>
    </>
  );
}

function SignatureForm({
  onSubmit,
  loading,
}: {
  onSubmit: (v: CreateConsentSignatureRequest) => void;
  loading: boolean;
}) {
  const [consentSource, setConsentSource] = useState<string | null>("patient_consent");
  const [consentId, setConsentId] = useState("");
  const [sigType, setSigType] = useState<string | null>("pen_on_paper");
  const [sigImageUrl, setSigImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [aadhaarRef, setAadhaarRef] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [witnessDesignation, setWitnessDesignation] = useState("");
  const [witnessSigUrl, setWitnessSigUrl] = useState("");
  const [doctorSigUrl, setDoctorSigUrl] = useState("");

  const handleSubmit = () => {
    onSubmit({
      consent_source: consentSource ?? "patient_consent",
      consent_id: consentId,
      signature_type: (sigType ??
        "pen_on_paper") as CreateConsentSignatureRequest["signature_type"],
      signature_image_url: sigImageUrl || undefined,
      video_consent_url: videoUrl || undefined,
      aadhaar_esign_ref: aadhaarRef || undefined,
      witness_name: witnessName || undefined,
      witness_designation: witnessDesignation || undefined,
      witness_signature_url: witnessSigUrl || undefined,
      doctor_signature_url: doctorSigUrl || undefined,
    });
  };

  return (
    <Stack>
      <Select
        label="Consent Source"
        data={[
          { value: "patient_consent", label: "Patient Consent" },
          { value: "procedure_consent", label: "Procedure Consent" },
        ]}
        value={consentSource}
        onChange={setConsentSource}
        required
      />
      <TextInput
        label="Consent ID (UUID)"
        required
        value={consentId}
        onChange={(e) => setConsentId(e.target.value)}
      />
      <Select
        label="Signature Type"
        data={SIGNATURE_TYPES}
        value={sigType}
        onChange={setSigType}
        required
      />
      <TextInput
        label="Signature Image URL"
        value={sigImageUrl}
        onChange={(e) => setSigImageUrl(e.target.value)}
      />
      <TextInput
        label="Video Consent URL"
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
      />
      <TextInput
        label="Aadhaar e-Sign Reference"
        value={aadhaarRef}
        onChange={(e) => setAadhaarRef(e.target.value)}
      />
      <TextInput
        label="Witness Name"
        value={witnessName}
        onChange={(e) => setWitnessName(e.target.value)}
      />
      <Textarea
        label="Witness Designation"
        value={witnessDesignation}
        onChange={(e) => setWitnessDesignation(e.target.value)}
      />
      <TextInput
        label="Witness Signature URL"
        value={witnessSigUrl}
        onChange={(e) => setWitnessSigUrl(e.target.value)}
      />
      <TextInput
        label="Doctor Signature URL"
        value={doctorSigUrl}
        onChange={(e) => setDoctorSigUrl(e.target.value)}
      />
      <Button tone="primary" onClick={handleSubmit} loading={loading}>
        Record Signature
      </Button>
    </Stack>
  );
}
