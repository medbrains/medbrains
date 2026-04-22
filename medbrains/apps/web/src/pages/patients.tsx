import { useState } from "react";
import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Drawer,
  FileButton,
  Grid,
  Group,
  Image,
  Modal,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { useDebouncedValue, useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconBolt,
  IconCamera,
  IconCheck,
  IconEye,
  IconFile,
  IconLink,
  IconMapPin,
  IconPhone,
  IconPlus,
  IconSearch,
  IconStarFilled,
  IconTrash,
  IconUserPlus,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import type {
  AddressType,
  AllergySeverity,
  AllergyType,
  BloodGroup,
  ConsentCaptureMode,
  ConsentStatus,
  ConsentType,
  CreatePatientAddressRequest,
  CreatePatientAllergyRequest,
  CreatePatientConsentRequest,
  CreatePatientContactRequest,
  CreatePatientIdentifierRequest,
  CreatePatientRequest,
  FinancialClass,
  Gender,
  IdentifierType,
  MaritalStatus,
  Patient,
  PatientAddress,
  PatientAllergy,
  PatientCategory,
  PatientConsent,
  PatientContact,
  PatientIdentifier,
  RegistrationSource,
  RegistrationType,
  UpdatePatientRequest,
  FamilyLinkRow,
  CreateFamilyLinkRequest,
  PatientDocument,
  CreateDocumentRequest,
  MpiMatchResult,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { useNavigate } from "react-router";
import { DataTable, DynamicForm, PageHeader, StatusDot } from "../components";
import { useRequirePermission } from "../hooks/useRequirePermission";

const PER_PAGE = 20;

// #region Helpers

const genderColors: Record<string, string> = {
  male: "primary",
  female: "danger",
  other: "violet",
  unknown: "slate",
};

const categoryColors: Record<string, string> = {
  general: "slate",
  private: "teal",
  insurance: "primary",
  pmjay: "orange",
  cghs: "info",
  staff: "success",
  vip: "warning",
  mlc: "danger",
  esi: "lime",
  corporate: "violet",
  free: "primary",
  charity: "danger",
  research_subject: "violet",
  staff_dependent: "green.3",
};

const bloodGroupLabels: Record<string, string> = {
  a_positive: "A+",
  a_negative: "A-",
  b_positive: "B+",
  b_negative: "B-",
  ab_positive: "AB+",
  ab_negative: "AB-",
  o_positive: "O+",
  o_negative: "O-",
  unknown: "Unknown",
};

const registrationTypeLabels: Record<string, string> = {
  new: "New",
  revisit: "Revisit",
  transfer_in: "Transfer In",
  referral: "Referral",
  emergency: "Emergency",
  camp: "Camp",
  telemedicine: "Telemedicine",
  pre_registration: "Pre-Registration",
};

const severityColors: Record<string, string> = {
  mild: "success",
  moderate: "warning",
  severe: "orange",
  life_threatening: "danger",
};

const consentStatusColors: Record<string, string> = {
  granted: "success",
  denied: "danger",
  withdrawn: "slate",
  pending: "warning",
};

function formatDate(date: string | null | undefined): string {
  if (!date) return "-";
  try {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

function calculateAge(dob: string | null | undefined): string {
  if (!dob) return "";
  try {
    const birth = new Date(dob);
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      years--;
    }
    return `${years}y`;
  } catch {
    return "";
  }
}

function buildFullName(patient: Patient): string {
  const parts = [
    patient.prefix,
    patient.first_name,
    patient.middle_name,
    patient.last_name,
    patient.suffix,
  ].filter(Boolean);
  return parts.join(" ");
}

/** Map form field_code flat data from DynamicForm into CreatePatientRequest */
function mapFormDataToRequest(
  data: Record<string, unknown>,
): CreatePatientRequest {
  const address: Record<string, unknown> = {};
  const attributes: Record<string, unknown> = {};

  const directFields = new Set([
    "patient.first_name",
    "patient.last_name",
    "patient.date_of_birth",
    "patient.biological_sex",
    "patient.phone_primary",
    "patient.email",
    "patient.category",
    "patient.prefix",
    "patient.middle_name",
    "patient.suffix",
    "patient.father_name",
    "patient.guardian_name",
    "patient.guardian_relation",
    "patient.marital_status",
    "patient.religion",
    "patient.blood_group",
    "patient.occupation",
    "patient.phone_secondary",
    "patient.registration_type",
    "patient.registration_source",
    "patient.financial_class",
    "patient.is_medico_legal",
    "patient.mlc_number",
    "patient.is_vip",
  ]);

  for (const [key, value] of Object.entries(data)) {
    if (directFields.has(key) || !value) continue;
    if (key.startsWith("patient_addresses.")) {
      const field = key.replace("patient_addresses.", "");
      address[field] = value;
    } else {
      const attrKey = key.startsWith("patient.") ? key.slice(8) : key;
      attributes[attrKey] = value;
    }
  }

  const rawGender = data["patient.biological_sex"] as string | undefined;
  const gender = mapGender(rawGender);
  const rawCategory = data["patient.category"] as string | undefined;
  const category = mapCategory(rawCategory);

  return {
    first_name: (data["patient.first_name"] as string) ?? "",
    last_name: (data["patient.last_name"] as string) ?? "",
    date_of_birth: (data["patient.date_of_birth"] as string) || null,
    gender,
    phone: (data["patient.phone_primary"] as string) ?? "",
    email: (data["patient.email"] as string) || null,
    address: Object.keys(address).length > 0 ? address : null,
    category,
    prefix: (data["patient.prefix"] as string) || undefined,
    middle_name: (data["patient.middle_name"] as string) || undefined,
    suffix: (data["patient.suffix"] as string) || undefined,
    father_name: (data["patient.father_name"] as string) || undefined,
    guardian_name: (data["patient.guardian_name"] as string) || undefined,
    guardian_relation: (data["patient.guardian_relation"] as string) || undefined,
    marital_status: (data["patient.marital_status"] as MaritalStatus) || undefined,
    religion: (data["patient.religion"] as string) || undefined,
    blood_group: (data["patient.blood_group"] as BloodGroup) || undefined,
    occupation: (data["patient.occupation"] as string) || undefined,
    phone_secondary: (data["patient.phone_secondary"] as string) || undefined,
    registration_type: (data["patient.registration_type"] as RegistrationType) || undefined,
    registration_source: (data["patient.registration_source"] as RegistrationSource) || undefined,
    financial_class: (data["patient.financial_class"] as FinancialClass) || undefined,
    is_medico_legal: data["patient.is_medico_legal"] === true || data["patient.is_medico_legal"] === "true" || undefined,
    mlc_number: (data["patient.mlc_number"] as string) || undefined,
    is_vip: data["patient.is_vip"] === true || data["patient.is_vip"] === "true" || undefined,
    attributes,
  };
}

function mapGender(raw: string | undefined): Gender {
  if (!raw) return "unknown";
  const normalized = raw.toLowerCase();
  if (normalized === "male" || normalized === "m") return "male";
  if (normalized === "female" || normalized === "f") return "female";
  if (normalized === "other" || normalized === "transgender") return "other";
  return "unknown";
}

function mapCategory(raw: string | undefined): PatientCategory {
  if (!raw) return "general";
  const normalized = raw.toLowerCase().replace(/[\s-]/g, "_");
  const validCategories: PatientCategory[] = [
    "general",
    "private",
    "insurance",
    "pmjay",
    "cghs",
    "staff",
    "vip",
    "mlc",
    "esi",
    "corporate",
    "free",
    "charity",
    "research_subject",
    "staff_dependent",
  ];
  if (validCategories.includes(normalized as PatientCategory)) {
    return normalized as PatientCategory;
  }
  return "general";
}

/** Map a Patient record back to DynamicForm defaultValues keyed by field_code */
function mapPatientToFormDefaults(
  patient: Patient,
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {
    "patient.first_name": patient.first_name,
    "patient.last_name": patient.last_name,
    "patient.date_of_birth": patient.date_of_birth ?? "",
    "patient.biological_sex": patient.gender,
    "patient.phone_primary": patient.phone,
    "patient.email": patient.email ?? "",
    "patient.category": patient.category,
    "patient.uhid": patient.uhid,
    "patient.prefix": patient.prefix ?? "",
    "patient.middle_name": patient.middle_name ?? "",
    "patient.suffix": patient.suffix ?? "",
    "patient.father_name": patient.father_name ?? "",
    "patient.guardian_name": patient.guardian_name ?? "",
    "patient.guardian_relation": patient.guardian_relation ?? "",
    "patient.marital_status": patient.marital_status ?? "",
    "patient.religion": patient.religion ?? "",
    "patient.blood_group": patient.blood_group ?? "",
    "patient.occupation": patient.occupation ?? "",
    "patient.phone_secondary": patient.phone_secondary ?? "",
    "patient.registration_type": patient.registration_type,
    "patient.registration_source": patient.registration_source ?? "",
    "patient.financial_class": patient.financial_class,
    "patient.is_medico_legal": patient.is_medico_legal,
    "patient.mlc_number": patient.mlc_number ?? "",
    "patient.is_vip": patient.is_vip,
  };

  if (patient.address) {
    for (const [k, v] of Object.entries(patient.address)) {
      defaults[`patient_addresses.${k}`] = v;
    }
  }

  if (patient.attributes) {
    for (const [k, v] of Object.entries(patient.attributes)) {
      defaults[`patient.${k}`] = v;
    }
  }

  return defaults;
}

// #endregion

// #region Detail sub-components

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <Grid mb="xs">
      <Grid.Col span={4}>
        <Text size="sm" fw={500} c="dimmed">
          {label}
        </Text>
      </Grid.Col>
      <Grid.Col span={8}>
        <Text size="sm">{value || "-"}</Text>
      </Grid.Col>
    </Grid>
  );
}

// #endregion

// #region OverviewTab

function OverviewTab({ patient, onEdit, canUpdate }: { patient: Patient; onEdit: () => void; canUpdate: boolean }) {
  const fullName = buildFullName(patient);
  const age = calculateAge(patient.date_of_birth);

  return (
    <Box>
      {/* Header: photo + name + badges */}
      <Group mb="lg" align="flex-start">
        {patient.photo_url ? (
          <Image
            src={patient.photo_url}
            alt={fullName}
            w={80}
            h={80}
            radius="md"
            fit="cover"
          />
        ) : (
          <Avatar size={80} radius="md" color="primary">
            {patient.first_name[0]}{patient.last_name[0]}
          </Avatar>
        )}
        <PhotoUpdateButton patient={patient} canUpdate={canUpdate} />
        <Box style={{ flex: 1 }}>
          <Text size="lg" fw={700}>{fullName}</Text>
          {patient.full_name_local && (
            <Text size="sm" c="dimmed">{patient.full_name_local}</Text>
          )}
          <Group gap="xs" mt={4}>
            <Badge size="lg" variant="light">{patient.uhid}</Badge>
            <Badge color={patient.is_active ? "success" : "danger"} variant="light">
              {patient.is_active ? "Active" : "Inactive"}
            </Badge>
            {patient.is_vip && (
              <Badge color="warning" variant="light" leftSection={<IconStarFilled size={12} />}>
                VIP
              </Badge>
            )}
            {patient.is_medico_legal && (
              <Badge color="danger" variant="light" leftSection={<IconAlertTriangle size={12} />}>
                MLC{patient.mlc_number ? ` #${patient.mlc_number}` : ""}
              </Badge>
            )}
            {patient.is_unknown_patient && (
              <Badge color="orange" variant="light">Unknown Patient</Badge>
            )}
            {patient.is_deceased && (
              <Badge color="dark" variant="light">Deceased</Badge>
            )}
          </Group>
        </Box>
      </Group>

      {/* Demographics */}
      <Text size="sm" fw={600} mt="md" mb="xs">Demographics</Text>
      <DetailRow label="Date of Birth" value={
        patient.date_of_birth
          ? `${formatDate(patient.date_of_birth)}${age ? ` (${age})` : ""}${patient.is_dob_estimated ? " (estimated)" : ""}`
          : null
      } />
      <DetailRow label="Gender" value={patient.gender} />
      <DetailRow label="Marital Status" value={patient.marital_status} />
      <DetailRow label="Blood Group" value={patient.blood_group ? bloodGroupLabels[patient.blood_group] ?? patient.blood_group : null} />
      <DetailRow label="Religion" value={patient.religion} />
      <DetailRow label="Nationality" value={patient.nationality_id} />
      <DetailRow label="Occupation" value={patient.occupation} />
      <DetailRow label="Education" value={patient.education_level} />
      <DetailRow label="Birth Place" value={patient.birth_place} />

      {/* Contact */}
      <Text size="sm" fw={600} mt="md" mb="xs">Contact</Text>
      <DetailRow label="Phone" value={patient.phone} />
      <DetailRow label="Phone (Secondary)" value={patient.phone_secondary} />
      <DetailRow label="Email" value={patient.email} />
      <DetailRow label="Preferred Contact" value={patient.preferred_contact_method} />
      <DetailRow label="Preferred Language" value={patient.preferred_language} />

      {/* Registration */}
      <Text size="sm" fw={600} mt="md" mb="xs">Registration</Text>
      <DetailRow label="UHID" value={patient.uhid} />
      <DetailRow label="ABHA ID" value={patient.abha_id} />
      <DetailRow label="Category" value={patient.category} />
      <DetailRow label="Registration Type" value={registrationTypeLabels[patient.registration_type] ?? patient.registration_type} />
      <DetailRow label="Registration Source" value={patient.registration_source} />
      <DetailRow label="Financial Class" value={patient.financial_class} />
      <DetailRow label="Registered At" value={formatDate(patient.created_at)} />
      <DetailRow label="Last Visit" value={formatDate(patient.last_visit_date)} />
      <DetailRow label="Total Visits" value={String(patient.total_visits)} />

      {/* Family */}
      <Text size="sm" fw={600} mt="md" mb="xs">Family</Text>
      <DetailRow label="Father" value={patient.father_name} />
      <DetailRow label="Mother" value={patient.mother_name} />
      <DetailRow label="Spouse" value={patient.spouse_name} />
      {(patient.guardian_name || patient.guardian_relation) && (
        <DetailRow
          label="Guardian"
          value={
            [patient.guardian_name, patient.guardian_relation ? `(${patient.guardian_relation})` : null]
              .filter(Boolean)
              .join(" ") || null
          }
        />
      )}

      {canUpdate && (
        <Group justify="flex-end" mt="lg">
          <Button variant="light" onClick={onEdit}>
            Edit Patient
          </Button>
        </Group>
      )}
    </Box>
  );
}

// #endregion

// #region IdentifiersTab

function IdentifiersTab({ patient, canUpdate }: { patient: Patient; canUpdate: boolean }) {
  const queryClient = useQueryClient();
  const [modalOpen, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [idType, setIdType] = useState<string | null>(null);
  const [idNumber, setIdNumber] = useState("");
  const [issuingAuthority, setIssuingAuthority] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  const { data: identifiers = [], isLoading } = useQuery({
    queryKey: ["patients", patient.id, "identifiers"],
    queryFn: () => api.listPatientIdentifiers(patient.id),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePatientIdentifierRequest) =>
      api.createPatientIdentifier(patient.id, data),
    onSuccess: () => {
      notifications.show({ title: "Identifier added", message: "ID document recorded", color: "success" });
      queryClient.invalidateQueries({ queryKey: ["patients", patient.id, "identifiers"] });
      closeModal();
      resetForm();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePatientIdentifier(patient.id, id),
    onSuccess: () => {
      notifications.show({ title: "Deleted", message: "Identifier removed", color: "success" });
      queryClient.invalidateQueries({ queryKey: ["patients", patient.id, "identifiers"] });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  const resetForm = () => {
    setIdType(null);
    setIdNumber("");
    setIssuingAuthority("");
    setIsPrimary(false);
  };

  const handleSubmit = () => {
    if (!idType || !idNumber) return;
    createMutation.mutate({
      id_type: idType as IdentifierType,
      id_number: idNumber,
      issuing_authority: issuingAuthority || undefined,
      is_primary: isPrimary,
    });
  };

  const identifierTypeOptions = [
    { value: "aadhaar", label: "Aadhaar" },
    { value: "pan", label: "PAN" },
    { value: "voter_id", label: "Voter ID" },
    { value: "driving_license", label: "Driving License" },
    { value: "passport", label: "Passport" },
    { value: "ration_card", label: "Ration Card" },
    { value: "abha", label: "ABHA" },
    { value: "abha_address", label: "ABHA Address" },
    { value: "employee_id", label: "Employee ID" },
    { value: "national_id", label: "National ID" },
    { value: "uhid_external", label: "External UHID" },
  ];

  return (
    <Box>
      {canUpdate && (
        <Group justify="flex-end" mb="md">
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openModal}>
            Add Identifier
          </Button>
        </Group>
      )}

      {isLoading ? (
        <Text size="sm" c="dimmed">Loading...</Text>
      ) : identifiers.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="lg">No identifiers recorded</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Number</Table.Th>
              <Table.Th>Verified</Table.Th>
              <Table.Th>Primary</Table.Th>
              <Table.Th>Expiry</Table.Th>
              {canUpdate && <Table.Th />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {identifiers.map((identifier: PatientIdentifier) => (
              <Table.Tr key={identifier.id}>
                <Table.Td>
                  <Badge variant="light" size="sm">{identifier.id_type.replace(/_/g, " ")}</Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{identifier.id_number}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={identifier.is_verified ? "success" : "danger"} variant="light" size="sm">
                    {identifier.is_verified ? "Verified" : "Unverified"}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {identifier.is_primary && (
                    <ThemeIcon variant="light" color="warning" size="sm">
                      <IconStarFilled size={12} />
                    </ThemeIcon>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatDate(identifier.valid_until)}</Text>
                </Table.Td>
                {canUpdate && (
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="danger"
                      size="sm"
                      onClick={() => deleteMutation.mutate(identifier.id)}
                      loading={deleteMutation.isPending}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={modalOpen} onClose={closeModal} title="Add Identifier" size="md">
        <Stack>
          <Select
            label="ID Type"
            placeholder="Select type"
            data={identifierTypeOptions}
            value={idType}
            onChange={setIdType}
            required
          />
          <TextInput
            label="ID Number"
            placeholder="Enter ID number"
            value={idNumber}
            onChange={(e) => setIdNumber(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Issuing Authority"
            placeholder="e.g., Government of India"
            value={issuingAuthority}
            onChange={(e) => setIssuingAuthority(e.currentTarget.value)}
          />
          <Checkbox
            label="Primary identifier"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.currentTarget.checked)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={createMutation.isPending} disabled={!idType || !idNumber}>
              Add
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

// #endregion

// #region AddressesTab

function AddressesTab({ patient, canUpdate }: { patient: Patient; canUpdate: boolean }) {
  const queryClient = useQueryClient();
  const [modalOpen, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [addressType, setAddressType] = useState<string | null>("current");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [countryId, setCountryId] = useState("IN");
  const [addrIsPrimary, setAddrIsPrimary] = useState(false);

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["patients", patient.id, "addresses"],
    queryFn: () => api.listPatientAddresses(patient.id),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePatientAddressRequest) =>
      api.createPatientAddress(patient.id, data),
    onSuccess: () => {
      notifications.show({ title: "Address added", message: "Address recorded", color: "success" });
      queryClient.invalidateQueries({ queryKey: ["patients", patient.id, "addresses"] });
      closeModal();
      resetForm();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePatientAddress(patient.id, id),
    onSuccess: () => {
      notifications.show({ title: "Deleted", message: "Address removed", color: "success" });
      queryClient.invalidateQueries({ queryKey: ["patients", patient.id, "addresses"] });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  const resetForm = () => {
    setAddressType("current");
    setLine1("");
    setLine2("");
    setCity("");
    setPostalCode("");
    setCountryId("IN");
    setAddrIsPrimary(false);
  };

  const handleSubmit = () => {
    if (!addressType || !line1 || !city || !postalCode) return;
    createMutation.mutate({
      address_type: addressType as AddressType,
      address_line1: line1,
      address_line2: line2 || undefined,
      city,
      postal_code: postalCode,
      country_id: countryId,
      is_primary: addrIsPrimary,
    });
  };

  const addressTypeOptions = [
    { value: "current", label: "Current" },
    { value: "permanent", label: "Permanent" },
    { value: "correspondence", label: "Correspondence" },
    { value: "workplace", label: "Workplace" },
    { value: "temporary", label: "Temporary" },
  ];

  return (
    <Box>
      {canUpdate && (
        <Group justify="flex-end" mb="md">
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openModal}>
            Add Address
          </Button>
        </Group>
      )}

      {isLoading ? (
        <Text size="sm" c="dimmed">Loading...</Text>
      ) : addresses.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="lg">No addresses recorded</Text>
      ) : (
        <Stack>
          {addresses.map((addr: PatientAddress) => (
            <Card key={addr.id} withBorder padding="sm">
              <Group justify="space-between" mb="xs">
                <Group gap="xs">
                  <Badge variant="light" size="sm">{addr.address_type.replace(/_/g, " ")}</Badge>
                  {addr.is_primary && (
                    <Badge color="warning" variant="light" size="sm" leftSection={<IconStarFilled size={10} />}>
                      Primary
                    </Badge>
                  )}
                </Group>
                {canUpdate && (
                  <ActionIcon
                    variant="subtle"
                    color="danger"
                    size="sm"
                    onClick={() => deleteMutation.mutate(addr.id)}
                    loading={deleteMutation.isPending}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </Group>
              <Group gap={4} align="flex-start">
                <ThemeIcon variant="light" color="slate" size="sm" mt={2}>
                  <IconMapPin size={12} />
                </ThemeIcon>
                <Box>
                  <Text size="sm">{addr.address_line1}</Text>
                  {addr.address_line2 && <Text size="sm">{addr.address_line2}</Text>}
                  {addr.village_town && <Text size="sm">{addr.village_town}</Text>}
                  <Text size="sm">{[addr.city, addr.postal_code].filter(Boolean).join(" - ")}</Text>
                </Box>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <Modal opened={modalOpen} onClose={closeModal} title="Add Address" size="md">
        <Stack>
          <Select
            label="Address Type"
            data={addressTypeOptions}
            value={addressType}
            onChange={setAddressType}
            required
          />
          <TextInput
            label="Address Line 1"
            placeholder="Street, house number"
            value={line1}
            onChange={(e) => setLine1(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Address Line 2"
            placeholder="Area, landmark"
            value={line2}
            onChange={(e) => setLine2(e.currentTarget.value)}
          />
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="City"
                value={city}
                onChange={(e) => setCity(e.currentTarget.value)}
                required
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Postal Code"
                value={postalCode}
                onChange={(e) => setPostalCode(e.currentTarget.value)}
                required
              />
            </Grid.Col>
          </Grid>
          <TextInput
            label="Country ID"
            value={countryId}
            onChange={(e) => setCountryId(e.currentTarget.value)}
            required
          />
          <Checkbox
            label="Primary address"
            checked={addrIsPrimary}
            onChange={(e) => setAddrIsPrimary(e.currentTarget.checked)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={createMutation.isPending} disabled={!line1 || !city || !postalCode}>
              Add
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

// #endregion

// #region ContactsTab

function ContactsTab({ patient, canUpdate }: { patient: Patient; canUpdate: boolean }) {
  const queryClient = useQueryClient();
  const [modalOpen, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [contactName, setContactName] = useState("");
  const [relation, setRelation] = useState("");
  const [phone, setPhone] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [isNextOfKin, setIsNextOfKin] = useState(false);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["patients", patient.id, "contacts"],
    queryFn: () => api.listPatientContacts(patient.id),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePatientContactRequest) =>
      api.createPatientContact(patient.id, data),
    onSuccess: () => {
      notifications.show({ title: "Contact added", message: "Contact person recorded", color: "success" });
      queryClient.invalidateQueries({ queryKey: ["patients", patient.id, "contacts"] });
      closeModal();
      resetForm();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePatientContact(patient.id, id),
    onSuccess: () => {
      notifications.show({ title: "Deleted", message: "Contact removed", color: "success" });
      queryClient.invalidateQueries({ queryKey: ["patients", patient.id, "contacts"] });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  const resetForm = () => {
    setContactName("");
    setRelation("");
    setPhone("");
    setIsEmergency(false);
    setIsNextOfKin(false);
  };

  const handleSubmit = () => {
    if (!contactName || !relation || !phone) return;
    createMutation.mutate({
      contact_name: contactName,
      relation,
      phone,
      is_emergency_contact: isEmergency,
      is_next_of_kin: isNextOfKin,
    });
  };

  return (
    <Box>
      {canUpdate && (
        <Group justify="flex-end" mb="md">
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openModal}>
            Add Contact
          </Button>
        </Group>
      )}

      {isLoading ? (
        <Text size="sm" c="dimmed">Loading...</Text>
      ) : contacts.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="lg">No contacts recorded</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Relation</Table.Th>
              <Table.Th>Phone</Table.Th>
              <Table.Th>Emergency</Table.Th>
              <Table.Th>Next of Kin</Table.Th>
              {canUpdate && <Table.Th />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {contacts.map((contact: PatientContact) => (
              <Table.Tr key={contact.id}>
                <Table.Td><Text size="sm">{contact.contact_name}</Text></Table.Td>
                <Table.Td><Text size="sm">{contact.relation}</Text></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <IconPhone size={14} />
                    <Text size="sm">{contact.phone}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  {contact.is_emergency_contact && (
                    <Badge color="danger" variant="light" size="sm">Emergency</Badge>
                  )}
                </Table.Td>
                <Table.Td>
                  {contact.is_next_of_kin && (
                    <Badge color="primary" variant="light" size="sm">Next of Kin</Badge>
                  )}
                </Table.Td>
                {canUpdate && (
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="danger"
                      size="sm"
                      onClick={() => deleteMutation.mutate(contact.id)}
                      loading={deleteMutation.isPending}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={modalOpen} onClose={closeModal} title="Add Contact" size="md">
        <Stack>
          <TextInput
            label="Contact Name"
            placeholder="Full name"
            value={contactName}
            onChange={(e) => setContactName(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Relation"
            placeholder="e.g., Father, Spouse, Friend"
            value={relation}
            onChange={(e) => setRelation(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Phone"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.currentTarget.value)}
            required
          />
          <Checkbox
            label="Emergency contact"
            checked={isEmergency}
            onChange={(e) => setIsEmergency(e.currentTarget.checked)}
          />
          <Checkbox
            label="Next of kin"
            checked={isNextOfKin}
            onChange={(e) => setIsNextOfKin(e.currentTarget.checked)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={createMutation.isPending} disabled={!contactName || !relation || !phone}>
              Add
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

// #endregion

// #region AllergiesTab

function AllergiesTab({ patient, canUpdate }: { patient: Patient; canUpdate: boolean }) {
  const queryClient = useQueryClient();
  const [modalOpen, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [allergyType, setAllergyType] = useState<string | null>("drug");
  const [allergenName, setAllergenName] = useState("");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState<string | null>(null);

  const { data: allergies = [], isLoading } = useQuery({
    queryKey: ["patients", patient.id, "allergies"],
    queryFn: () => api.listPatientAllergies(patient.id),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePatientAllergyRequest) =>
      api.createPatientAllergy(patient.id, data),
    onSuccess: () => {
      notifications.show({ title: "Allergy added", message: "Allergy recorded", color: "success" });
      queryClient.invalidateQueries({ queryKey: ["patients", patient.id, "allergies"] });
      closeModal();
      resetForm();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePatientAllergy(patient.id, id),
    onSuccess: () => {
      notifications.show({ title: "Deleted", message: "Allergy removed", color: "success" });
      queryClient.invalidateQueries({ queryKey: ["patients", patient.id, "allergies"] });
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  const resetForm = () => {
    setAllergyType("drug");
    setAllergenName("");
    setReaction("");
    setSeverity(null);
  };

  const handleSubmit = () => {
    if (!allergyType || !allergenName) return;
    createMutation.mutate({
      allergy_type: allergyType as AllergyType,
      allergen_name: allergenName,
      reaction: reaction || undefined,
      severity: (severity as AllergySeverity) || undefined,
    });
  };

  const allergyTypeOptions = [
    { value: "drug", label: "Drug" },
    { value: "food", label: "Food" },
    { value: "environmental", label: "Environmental" },
    { value: "latex", label: "Latex" },
    { value: "contrast_dye", label: "Contrast Dye" },
    { value: "biological", label: "Biological" },
    { value: "other", label: "Other" },
  ];

  const severityOptions = [
    { value: "mild", label: "Mild" },
    { value: "moderate", label: "Moderate" },
    { value: "severe", label: "Severe" },
    { value: "life_threatening", label: "Life Threatening" },
  ];

  return (
    <Box>
      {patient.no_known_allergies === true && (
        <Badge color="success" variant="light" size="lg" mb="md">
          <Group gap={4}>
            <IconCheck size={14} />
            NKDA - No Known Drug Allergies
          </Group>
        </Badge>
      )}

      {canUpdate && (
        <Group justify="flex-end" mb="md">
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openModal}>
            Add Allergy
          </Button>
        </Group>
      )}

      {isLoading ? (
        <Text size="sm" c="dimmed">Loading...</Text>
      ) : allergies.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="lg">No allergies recorded</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Allergen</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Severity</Table.Th>
              <Table.Th>Reaction</Table.Th>
              {canUpdate && <Table.Th />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {allergies.map((allergy: PatientAllergy) => (
              <Table.Tr key={allergy.id}>
                <Table.Td><Text size="sm" fw={500}>{allergy.allergen_name}</Text></Table.Td>
                <Table.Td>
                  <Badge variant="light" size="sm">{allergy.allergy_type.replace(/_/g, " ")}</Badge>
                </Table.Td>
                <Table.Td>
                  {allergy.severity ? (
                    <Badge
                      color={severityColors[allergy.severity] ?? "slate"}
                      variant="light"
                      size="sm"
                    >
                      {allergy.severity.replace(/_/g, " ")}
                    </Badge>
                  ) : (
                    <Text size="sm" c="dimmed">-</Text>
                  )}
                </Table.Td>
                <Table.Td><Text size="sm">{allergy.reaction ?? "-"}</Text></Table.Td>
                {canUpdate && (
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="danger"
                      size="sm"
                      onClick={() => deleteMutation.mutate(allergy.id)}
                      loading={deleteMutation.isPending}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={modalOpen} onClose={closeModal} title="Add Allergy" size="md">
        <Stack>
          <Select
            label="Allergy Type"
            data={allergyTypeOptions}
            value={allergyType}
            onChange={setAllergyType}
            required
          />
          <TextInput
            label="Allergen Name"
            placeholder="e.g., Penicillin, Peanuts"
            value={allergenName}
            onChange={(e) => setAllergenName(e.currentTarget.value)}
            required
          />
          <Select
            label="Severity"
            data={severityOptions}
            value={severity}
            onChange={setSeverity}
            clearable
          />
          <Textarea
            label="Reaction"
            placeholder="Describe the reaction"
            value={reaction}
            onChange={(e) => setReaction(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSubmit} loading={createMutation.isPending} disabled={!allergyType || !allergenName}>
              Add
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

// #endregion

// #region ConsentsTab

function ConsentsTab({ patient, canUpdate }: { patient: Patient; canUpdate: boolean }) {
  const queryClient = useQueryClient();
  const [modalOpen, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [consentType, setConsentType] = useState<string | null>(null);
  const [consentStatus, setConsentStatus] = useState<string | null>("granted");
  const [consentedBy, setConsentedBy] = useState("");
  const [captureMode, setCaptureMode] = useState<string | null>("paper_signed");
  const [notes, setNotes] = useState("");

  const { data: consents = [], isLoading } = useQuery({
    queryKey: ["patients", patient.id, "consents"],
    queryFn: () => api.listPatientConsents(patient.id),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreatePatientConsentRequest) =>
      api.createPatientConsent(patient.id, data),
    onSuccess: () => {
      notifications.show({ title: "Consent recorded", message: "Consent status saved", color: "success" });
      queryClient.invalidateQueries({ queryKey: ["patients", patient.id, "consents"] });
      closeModal();
      resetForm();
    },
    onError: (err: Error) => {
      notifications.show({ title: "Failed", message: err.message, color: "danger" });
    },
  });

  const resetForm = () => {
    setConsentType(null);
    setConsentStatus("granted");
    setConsentedBy("");
    setCaptureMode("paper_signed");
    setNotes("");
  };

  const handleSubmit = () => {
    if (!consentType || !consentStatus || !consentedBy || !captureMode) return;
    createMutation.mutate({
      consent_type: consentType as ConsentType,
      consent_status: consentStatus as ConsentStatus,
      consented_by: consentedBy,
      capture_mode: captureMode as ConsentCaptureMode,
      notes: notes || undefined,
    });
  };

  const consentTypeOptions = [
    { value: "general_treatment", label: "General Treatment" },
    { value: "data_sharing", label: "Data Sharing" },
    { value: "abdm_linking", label: "ABDM Linking" },
    { value: "research_participation", label: "Research Participation" },
    { value: "sms_communication", label: "SMS Communication" },
    { value: "email_communication", label: "Email Communication" },
    { value: "photography", label: "Photography" },
    { value: "advance_directive", label: "Advance Directive" },
    { value: "organ_donation", label: "Organ Donation" },
    { value: "hie_participation", label: "HIE Participation" },
  ];

  const consentStatusOptions = [
    { value: "granted", label: "Granted" },
    { value: "denied", label: "Denied" },
    { value: "pending", label: "Pending" },
  ];

  const captureModeOptions = [
    { value: "paper_signed", label: "Paper Signed" },
    { value: "digital_signature", label: "Digital Signature" },
    { value: "biometric", label: "Biometric" },
    { value: "otp_verified", label: "OTP Verified" },
    { value: "verbal_recorded", label: "Verbal (Recorded)" },
  ];

  return (
    <Box>
      {canUpdate && (
        <Group justify="flex-end" mb="md">
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openModal}>
            Record Consent
          </Button>
        </Group>
      )}

      {isLoading ? (
        <Text size="sm" c="dimmed">Loading...</Text>
      ) : consents.length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="lg">No consents recorded</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Consented By</Table.Th>
              <Table.Th>Date</Table.Th>
              <Table.Th>Capture Mode</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {consents.map((consent: PatientConsent) => (
              <Table.Tr key={consent.id}>
                <Table.Td>
                  <Text size="sm">{consent.consent_type.replace(/_/g, " ")}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={consentStatusColors[consent.consent_status] ?? "slate"}
                    variant="light"
                    size="sm"
                  >
                    {consent.consent_status}
                  </Badge>
                </Table.Td>
                <Table.Td><Text size="sm">{consent.consented_by}</Text></Table.Td>
                <Table.Td><Text size="sm">{formatDate(consent.consent_date)}</Text></Table.Td>
                <Table.Td>
                  <Badge variant="light" size="sm" color="slate">
                    {consent.capture_mode.replace(/_/g, " ")}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={modalOpen} onClose={closeModal} title="Record Consent" size="md">
        <Stack>
          <Select
            label="Consent Type"
            placeholder="Select type"
            data={consentTypeOptions}
            value={consentType}
            onChange={setConsentType}
            required
          />
          <Select
            label="Status"
            data={consentStatusOptions}
            value={consentStatus}
            onChange={setConsentStatus}
            required
          />
          <TextInput
            label="Consented By"
            placeholder="Name of person giving consent"
            value={consentedBy}
            onChange={(e) => setConsentedBy(e.currentTarget.value)}
            required
          />
          <Select
            label="Capture Mode"
            data={captureModeOptions}
            value={captureMode}
            onChange={setCaptureMode}
            required
          />
          <Textarea
            label="Notes"
            placeholder="Additional notes"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeModal}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              loading={createMutation.isPending}
              disabled={!consentType || !consentStatus || !consentedBy || !captureMode}
            >
              Record
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

// #endregion

// #region FamilyLinksTab

const RELATIONSHIP_OPTIONS = [
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "spouse", label: "Spouse" },
  { value: "child", label: "Child" },
  { value: "sibling", label: "Sibling" },
  { value: "guardian", label: "Guardian" },
  { value: "other", label: "Other" },
];

function FamilyLinksTab({
  patient,
  canUpdate,
}: {
  patient: Patient;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [searchUhid, setSearchUhid] = useState("");
  const [relationship, setRelationship] = useState<string | null>("spouse");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedRelated, setSelectedRelated] = useState<Patient | null>(null);

  const { data: links = [] } = useQuery({
    queryKey: ["patients", patient.id, "family-links"],
    queryFn: () => api.listFamilyLinks(patient.id),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateFamilyLinkRequest) =>
      api.createFamilyLink(patient.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["patients", patient.id, "family-links"],
      });
      notifications.show({
        title: "Linked",
        message: "Family member linked",
        color: "success",
      });
      handleClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (linkId: string) =>
      api.deleteFamilyLink(patient.id, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["patients", patient.id, "family-links"],
      });
    },
  });

  const handleSearch = async () => {
    if (!searchUhid.trim()) return;
    try {
      const result = await api.listPatients({
        page: 1,
        per_page: 5,
        search: searchUhid.trim(),
      });
      setSearchResults(result.patients.filter((p) => p.id !== patient.id));
    } catch {
      setSearchResults([]);
    }
  };

  const handleClose = () => {
    close();
    setSearchUhid("");
    setSearchResults([]);
    setSelectedRelated(null);
    setRelationship("spouse");
  };

  const handleCreate = () => {
    if (!selectedRelated || !relationship) return;
    createMutation.mutate({
      related_patient_id: selectedRelated.id,
      relationship,
    });
  };

  return (
    <Box>
      {canUpdate && (
        <Group justify="flex-end" mb="sm">
          <Button leftSection={<IconPlus size={14} />} size="xs" onClick={open}>
            Link Family Member
          </Button>
        </Group>
      )}

      {(links as FamilyLinkRow[]).length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No family links
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Relationship</Table.Th>
              <Table.Th>UHID</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Phone</Table.Th>
              {canUpdate && <Table.Th w={40} />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(links as FamilyLinkRow[]).map((l) => (
              <Table.Tr key={l.id}>
                <Table.Td>
                  <Badge size="sm" variant="light">
                    {l.relationship}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {l.related_uhid ?? "—"}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{l.related_name ?? "—"}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{l.related_phone ?? "—"}</Text>
                </Table.Td>
                {canUpdate && (
                  <Table.Td>
                    <ActionIcon
                      variant="light"
                      color="danger"
                      size="sm"
                      onClick={() => deleteMutation.mutate(l.id)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={handleClose} title="Link Family Member">
        <Stack gap="sm">
          <Group>
            <TextInput
              placeholder="Search by UHID, name or phone"
              value={searchUhid}
              onChange={(e) => setSearchUhid(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button size="sm" onClick={handleSearch}>
              Search
            </Button>
          </Group>
          {searchResults.length > 0 && (
            <Table>
              <Table.Tbody>
                {searchResults.map((p) => (
                  <Table.Tr
                    key={p.id}
                    style={{
                      cursor: "pointer",
                      background:
                        selectedRelated?.id === p.id
                          ? "var(--mantine-color-blue-light)"
                          : undefined,
                    }}
                    onClick={() => setSelectedRelated(p)}
                  >
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {p.uhid}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {p.first_name} {p.last_name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {p.phone}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
          {selectedRelated && (
            <Alert color="primary">
              Selected: {selectedRelated.uhid} — {selectedRelated.first_name}{" "}
              {selectedRelated.last_name}
            </Alert>
          )}
          <Select
            label="Relationship"
            data={RELATIONSHIP_OPTIONS}
            value={relationship}
            onChange={setRelationship}
            required
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!selectedRelated || !relationship}
            >
              Link
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

// #endregion

// #region DocumentsTab

const DOCUMENT_TYPE_OPTIONS = [
  { value: "id_proof", label: "ID Proof" },
  { value: "consent_form", label: "Consent Form" },
  { value: "referral_letter", label: "Referral Letter" },
  { value: "photo", label: "Photo" },
  { value: "report", label: "Report" },
  { value: "prescription", label: "Prescription" },
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "insurance_card", label: "Insurance Card" },
  { value: "other", label: "Other" },
];

function DocumentsTab({
  patient,
  canUpdate,
}: {
  patient: Patient;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();
  const [opened, { open, close }] = useDisclosure(false);
  const [docType, setDocType] = useState<string | null>("id_proof");
  const [docName, setDocName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [notes, setNotes] = useState("");

  const { data: documents = [] } = useQuery({
    queryKey: ["patients", patient.id, "documents"],
    queryFn: () => api.listPatientDocuments(patient.id),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateDocumentRequest) =>
      api.createPatientDocument(patient.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["patients", patient.id, "documents"],
      });
      notifications.show({
        title: "Uploaded",
        message: "Document added",
        color: "success",
      });
      handleClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) =>
      api.deletePatientDocument(patient.id, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["patients", patient.id, "documents"],
      });
    },
  });

  const handleClose = () => {
    close();
    setDocType("id_proof");
    setDocName("");
    setFileUrl("");
    setNotes("");
  };

  const handleCreate = () => {
    if (!docType || !docName.trim() || !fileUrl.trim()) return;
    createMutation.mutate({
      document_type: docType,
      document_name: docName.trim(),
      file_url: fileUrl.trim(),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Box>
      {canUpdate && (
        <Group justify="flex-end" mb="sm">
          <Button leftSection={<IconPlus size={14} />} size="xs" onClick={open}>
            Add Document
          </Button>
        </Group>
      )}

      {(documents as PatientDocument[]).length === 0 ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No documents
        </Text>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Date</Table.Th>
              {canUpdate && <Table.Th w={40} />}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(documents as PatientDocument[]).map((d) => (
              <Table.Tr key={d.id}>
                <Table.Td>
                  <Badge size="sm" variant="light">
                    {d.document_type}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {d.document_name}
                  </Text>
                  {d.notes && (
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {d.notes}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="xs" c="dimmed">
                    {formatDate(d.created_at)}
                  </Text>
                </Table.Td>
                {canUpdate && (
                  <Table.Td>
                    <ActionIcon
                      variant="light"
                      color="danger"
                      size="sm"
                      onClick={() => deleteMutation.mutate(d.id)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={opened} onClose={handleClose} title="Add Document">
        <Stack gap="sm">
          <Select
            label="Document Type"
            data={DOCUMENT_TYPE_OPTIONS}
            value={docType}
            onChange={setDocType}
            required
          />
          <TextInput
            label="Document Name"
            placeholder="e.g. Aadhaar Card"
            value={docName}
            onChange={(e) => setDocName(e.currentTarget.value)}
            required
          />
          <TextInput
            label="File URL"
            placeholder="https://..."
            value={fileUrl}
            onChange={(e) => setFileUrl(e.currentTarget.value)}
            required
          />
          <Textarea
            label="Notes"
            placeholder="Optional notes"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!docType || !docName.trim() || !fileUrl.trim()}
            >
              Add
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}

// #endregion

// #region PhotoUpdate — helper for OverviewTab

function PhotoUpdateButton({
  patient,
  canUpdate,
}: {
  patient: Patient;
  canUpdate: boolean;
}) {
  const queryClient = useQueryClient();

  const photoMutation = useMutation({
    mutationFn: (url: string) => api.updatePatientPhoto(patient.id, url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      notifications.show({
        title: "Photo updated",
        message: "Patient photo has been updated",
        color: "success",
      });
    },
  });

  const handleFile = async (file: File | null) => {
    if (!file) return;

    // Validate file size (max 500KB for base64 storage)
    const MAX_SIZE = 500 * 1024;
    if (file.size > MAX_SIZE) {
      notifications.show({
        title: "File too large",
        message: "Photo must be less than 500KB. Please compress or resize.",
        color: "red",
      });
      return;
    }

    // Convert to base64 data URI for database storage.
    // TODO: Replace with proper object storage (S3/MinIO) upload for production.
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      photoMutation.mutate(dataUri);
    };
    reader.onerror = () => {
      notifications.show({
        title: "Upload failed",
        message: "Could not read the image file",
        color: "red",
      });
    };
    reader.readAsDataURL(file);
  };

  if (!canUpdate) return null;

  return (
    <FileButton onChange={handleFile} accept="image/*">
      {(props) => (
        <Tooltip label="Upload photo">
          <ActionIcon variant="light" size="sm" {...props}>
            <IconCamera size={14} />
          </ActionIcon>
        </Tooltip>
      )}
    </FileButton>
  );
}

// #endregion

// #region PatientEditForm

function PatientEditForm({
  patient,
  onSaved,
  onCancel,
}: {
  patient: Patient;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data: UpdatePatientRequest) =>
      api.updatePatient(patient.id, data),
    onSuccess: () => {
      notifications.show({
        title: "Patient updated",
        message: `${patient.uhid} has been updated`,
        color: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      onSaved();
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Update failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleSubmit = (data: Record<string, unknown>) => {
    const req = mapFormDataToRequest(data);
    updateMutation.mutate(req);
  };

  return (
    <DynamicForm
      formCode="patient_registration"
      onSubmit={handleSubmit}
      defaultValues={mapPatientToFormDefaults(patient)}
      onCancel={onCancel}
      isSubmitting={updateMutation.isPending}
      submitLabel="Save Changes"
    />
  );
}

// #endregion

// #region Main Page

export function PatientsPage() {
  useRequirePermission(P.PATIENTS.LIST);
  const canCreate = useHasPermission(P.PATIENTS.CREATE);
  const canUpdate = useHasPermission(P.PATIENTS.UPDATE);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // State
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<string | null>("overview");
  const [duplicateMatches, setDuplicateMatches] = useState<MpiMatchResult[]>([]);
  const [pendingRequest, setPendingRequest] = useState<CreatePatientRequest | null>(null);
  const [dupModalOpen, dupModalHandlers] = useDisclosure(false);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ["patients", page, debouncedSearch],
    queryFn: () =>
      api.listPatients({
        page,
        per_page: PER_PAGE,
        search: debouncedSearch || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (req: CreatePatientRequest) => api.createPatient(req),
    onSuccess: (patient) => {
      notifications.show({
        title: "Patient registered",
        message: `UHID: ${patient.uhid}`,
        color: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setDrawerOpen(false);
    },
    onError: (err: Error) => {
      notifications.show({
        title: "Registration failed",
        message: err.message,
        color: "danger",
      });
    },
  });

  const handleRegisterSubmit = async (data: Record<string, unknown>) => {
    const req = mapFormDataToRequest(data);
    // Check for duplicates via MPI before creating
    try {
      const matches = await api.matchPatients({
        first_name: req.first_name,
        last_name: req.last_name,
        date_of_birth: req.date_of_birth ?? undefined,
        phone: req.phone ?? undefined,
      });
      if (matches.length > 0) {
        setDuplicateMatches(matches);
        setPendingRequest(req);
        dupModalHandlers.open();
        return;
      }
    } catch {
      // If match endpoint fails, proceed with creation
    }
    createMutation.mutate(req);
  };

  const handleCreateAnyway = () => {
    if (pendingRequest) {
      createMutation.mutate(pendingRequest);
    }
    dupModalHandlers.close();
    setPendingRequest(null);
    setDuplicateMatches([]);
  };

  const openRegister = (quick: boolean) => {
    setQuickMode(quick);
    setDrawerOpen(true);
  };

  const openDetail = (patient: Patient) => {
    setSelectedPatient(patient);
    setDetailTab("overview");
    setDetailOpen(true);
  };

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;

  const columns = [
    {
      key: "uhid",
      label: "UHID",
      render: (row: Patient) => (
        <Text fw={600} size="sm">
          {row.uhid}
        </Text>
      ),
    },
    {
      key: "name",
      label: "Name",
      render: (row: Patient) => (
        <Group gap={6}>
          <Text size="sm">{buildFullName(row)}</Text>
          {row.is_vip && (
            <Tooltip label="VIP Patient">
              <ThemeIcon variant="light" color="warning" size="xs">
                <IconStarFilled size={10} />
              </ThemeIcon>
            </Tooltip>
          )}
          {row.is_medico_legal && (
            <Tooltip label={`MLC${row.mlc_number ? ` #${row.mlc_number}` : ""}`}>
              <ThemeIcon variant="light" color="danger" size="xs">
                <IconAlertTriangle size={10} />
              </ThemeIcon>
            </Tooltip>
          )}
        </Group>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (row: Patient) => row.phone || "-",
    },
    {
      key: "gender",
      label: "Gender",
      render: (row: Patient) => (
        <StatusDot color={genderColors[row.gender] ?? "slate"} label={row.gender} size="sm" />
      ),
    },
    {
      key: "blood_group",
      label: "Blood Group",
      render: (row: Patient) =>
        row.blood_group && row.blood_group !== "unknown" ? (
          <StatusDot color="danger" label={bloodGroupLabels[row.blood_group] ?? row.blood_group} size="sm" />
        ) : (
          <Text size="sm" c="dimmed">-</Text>
        ),
    },
    {
      key: "category",
      label: "Category",
      render: (row: Patient) => (
        <StatusDot color={categoryColors[row.category] ?? "slate"} label={row.category.replace(/_/g, " ")} size="sm" />
      ),
    },
    {
      key: "registration_type",
      label: "Reg. Type",
      render: (row: Patient) => (
        <StatusDot color="slate" label={registrationTypeLabels[row.registration_type] ?? row.registration_type} size="sm" />
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row: Patient) => (
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Quick view">
            <ActionIcon
              variant="subtle"
              color="primary"
              onClick={() => openDetail(row)}
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Full profile">
            <ActionIcon
              variant="subtle"
              color="teal"
              onClick={() => navigate(`/patients/${row.id}`)}
            >
              <IconUsers size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle="Registration & records"
        icon={<IconUsers size={20} stroke={1.5} />}
        color="teal"
        actions={
          <>
            <Button
              variant="light"
              leftSection={<IconBolt size={16} />}
              onClick={() => openRegister(true)}
            >
              Quick Register
            </Button>
            <Button
              leftSection={<IconUserPlus size={16} />}
              onClick={() => openRegister(false)}
              disabled={!canCreate}
            >
              Register Patient
            </Button>
          </>
        }
      />

      <DataTable<Patient>
        columns={columns}
        data={data?.patients ?? []}
        loading={isLoading}
        total={data?.total}
        rowKey={(row) => row.id}
        emptyIcon={<IconUsers size={32} />}
        emptyTitle="No patients found"
        emptyDescription={
          debouncedSearch
            ? "Try adjusting your search terms"
            : "Register your first patient to get started"
        }
        emptyAction={
          !debouncedSearch
            ? { label: "Register Patient", onClick: () => openRegister(false) }
            : undefined
        }
        page={page}
        totalPages={totalPages}
        perPage={PER_PAGE}
        onPageChange={setPage}
        toolbar={
          <TextInput
            placeholder="Search by UHID, name, or phone..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => handleSearchChange(e.currentTarget.value)}
            size="sm"
            style={{ maxWidth: 360 }}
          />
        }
      />

      {/* Registration Drawer */}
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={quickMode ? "Quick Registration" : "Register Patient"}
        position="right"
        size="100%"
        padding="md"
      >
        <DynamicForm
          formCode="patient_registration"
          quickMode={quickMode}
          onSubmit={handleRegisterSubmit}
          onCancel={() => setDrawerOpen(false)}
          isSubmitting={createMutation.isPending}
          submitLabel="Register"
        />
      </Drawer>

      {/* Patient Detail Drawer */}
      <Drawer
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={
          selectedPatient
            ? buildFullName(selectedPatient)
            : "Patient Details"
        }
        position="right"
        size="100%"
        padding="md"
      >
        {selectedPatient && (
          <Tabs value={detailTab} onChange={setDetailTab}>
            <Tabs.List mb="md">
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              <Tabs.Tab value="identifiers">IDs</Tabs.Tab>
              <Tabs.Tab value="addresses">Addresses</Tabs.Tab>
              <Tabs.Tab value="contacts">Contacts</Tabs.Tab>
              <Tabs.Tab value="allergies">Allergies</Tabs.Tab>
              <Tabs.Tab value="consents">Consents</Tabs.Tab>
              <Tabs.Tab value="family" leftSection={<IconLink size={14} />}>Family</Tabs.Tab>
              <Tabs.Tab value="documents" leftSection={<IconFile size={14} />}>Documents</Tabs.Tab>
              <Tabs.Tab value="edit">Edit</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="overview">
              <OverviewTab
                patient={selectedPatient}
                onEdit={() => setDetailTab("edit")}
                canUpdate={canUpdate}
              />
            </Tabs.Panel>

            <Tabs.Panel value="identifiers">
              <IdentifiersTab patient={selectedPatient} canUpdate={canUpdate} />
            </Tabs.Panel>

            <Tabs.Panel value="addresses">
              <AddressesTab patient={selectedPatient} canUpdate={canUpdate} />
            </Tabs.Panel>

            <Tabs.Panel value="contacts">
              <ContactsTab patient={selectedPatient} canUpdate={canUpdate} />
            </Tabs.Panel>

            <Tabs.Panel value="allergies">
              <AllergiesTab patient={selectedPatient} canUpdate={canUpdate} />
            </Tabs.Panel>

            <Tabs.Panel value="consents">
              <ConsentsTab patient={selectedPatient} canUpdate={canUpdate} />
            </Tabs.Panel>

            <Tabs.Panel value="family">
              <FamilyLinksTab patient={selectedPatient} canUpdate={canUpdate} />
            </Tabs.Panel>

            <Tabs.Panel value="documents">
              <DocumentsTab patient={selectedPatient} canUpdate={canUpdate} />
            </Tabs.Panel>

            <Tabs.Panel value="edit">
              <PatientEditForm
                patient={selectedPatient}
                onSaved={() => {
                  setDetailOpen(false);
                  setSelectedPatient(null);
                }}
                onCancel={() => setDetailTab("overview")}
              />
            </Tabs.Panel>
          </Tabs>
        )}
      </Drawer>

      {/* MPI Duplicate Detection Modal */}
      <Modal opened={dupModalOpen} onClose={() => { dupModalHandlers.close(); setPendingRequest(null); }} title="Potential Duplicates Found" size="lg">
        <Alert color="orange" icon={<IconAlertTriangle size={16} />} mb="md">
          The following existing patients match the registration data. Please verify before creating a new record.
        </Alert>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>UHID</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Phone</Table.Th>
              <Table.Th>Score</Table.Th>
              <Table.Th w={60} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {duplicateMatches.map((m) => (
              <Table.Tr key={m.patient.id}>
                <Table.Td><Text size="sm" fw={500}>{m.patient.uhid}</Text></Table.Td>
                <Table.Td><Text size="sm">{m.patient.first_name} {m.patient.last_name}</Text></Table.Td>
                <Table.Td><Text size="sm">{m.patient.phone ?? "—"}</Text></Table.Td>
                <Table.Td>
                  <Badge size="sm" color={m.score >= 0.8 ? "danger" : "orange"}>
                    {Math.round(m.score * 100)}%
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <ActionIcon variant="light" size="sm" onClick={() => { dupModalHandlers.close(); navigate(`/patients/${m.patient.id}`); }}>
                    <IconEye size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => { dupModalHandlers.close(); setPendingRequest(null); }}>Cancel</Button>
          <Button color="orange" onClick={handleCreateAnyway}>Create Anyway</Button>
        </Group>
      </Modal>
    </div>
  );
}

// #endregion
