/**
 * Admin: doctor profile directory and signature credential management.
 *
 * Doctor masters are credential records, not just user rows: council
 * registration, qualification, specialty, privileges, and signing readiness all
 * need to be visible before a doctor signs clinical records.
 */
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Divider,
  FileInput,
  Group,
  Image,
  Loader,
  Modal,
  MultiSelect,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { api } from "@medbrains/api";
import type {
  CreateDoctorRequest,
  DoctorProfile,
  SetupUser,
  SignatureCredential,
} from "@medbrains/types";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconKey,
  IconPhoto,
  IconPlus,
  IconRefresh,
  IconShieldCheck,
  IconSignature,
  IconStethoscope,
  IconUserCog,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../components/PageHeader";
import { useRequirePermission } from "../../hooks/useRequirePermission";

export function AdminDoctorsPage() {
  useRequirePermission("admin.doctors.list");

  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, createHandlers] = useDisclosure(false);
  const [credentialDoctor, setCredentialDoctor] = useState<DoctorProfile | null>(null);

  const { data: doctors = [], isLoading } = useQuery({
    queryKey: ["admin-doctors", search],
    queryFn: () => api.adminListDoctors({ search: search || undefined, limit: 200 }),
  });

  const { data: credentials = [], isLoading: credentialsLoading } = useQuery({
    queryKey: ["sig-credentials", "all"],
    queryFn: () => api.adminListSignatureCredentials({ include_revoked: true }),
  });

  const activeDefaultsByDoctor = useMemo(() => {
    const map = new Map<string, SignatureCredential>();
    const now = Date.now();
    for (const credential of credentials) {
      if (credential.revoked_at) continue;
      if (credential.valid_until && new Date(credential.valid_until).getTime() <= now) continue;
      if (credential.is_default) map.set(credential.doctor_user_id, credential);
    }
    return map;
  }, [credentials]);

  const activeCountsByDoctor = useMemo(() => {
    const map = new Map<string, number>();
    for (const credential of credentials) {
      if (credential.revoked_at) continue;
      map.set(credential.doctor_user_id, (map.get(credential.doctor_user_id) ?? 0) + 1);
    }
    return map;
  }, [credentials]);

  const activeDoctorCount = doctors.filter((doctor) => doctor.is_active).length;
  const readyToSignCount = doctors.filter((doctor) =>
    activeDefaultsByDoctor.has(doctor.user_id),
  ).length;
  const signingBlockedCount = Math.max(doctors.length - readyToSignCount, 0);

  const create = useMutation({
    mutationFn: (data: CreateDoctorRequest) => api.adminCreateDoctor(data),
    onSuccess: () => {
      notifications.show({
        title: "Doctor profile created",
        message: "Profile saved. Issue a signing credential before clinical sign-off.",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["admin-doctors"] });
      createHandlers.close();
    },
    onError: (err: Error) =>
      notifications.show({ title: "Create failed", message: err.message, color: "danger" }),
  });

  return (
    <div>
      <PageHeader
        title="Doctors"
        subtitle="Registration, clinical privileges, and signature readiness"
        icon={<IconUserCog size={20} stroke={1.5} />}
        actions={
          <Group gap="xs">
            <TextInput
              size="xs"
              placeholder="Search doctor, MCI, council..."
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              style={{ minWidth: 260 }}
            />
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={createHandlers.open}>
              Add doctor
            </Button>
          </Group>
        }
      />

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mb="md">
        <MetricCard label="Active doctors" value={activeDoctorCount} tone="primary" />
        <MetricCard label="Ready to sign" value={readyToSignCount} tone="success" />
        <MetricCard label="Credential missing" value={signingBlockedCount} tone="warning" />
      </SimpleGrid>

      {signingBlockedCount > 0 && (
        <Alert color="warning" icon={<IconAlertTriangle size={16} />} variant="light" mb="md">
          <Text size="sm">
            A doctor cannot sign prescriptions, lab reports, radiology reports, certificates, or
            discharge summaries until an active default signature credential is issued.
          </Text>
        </Alert>
      )}

      {isLoading && (
        <Card withBorder>
          <Group justify="center" py="xl">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              Loading doctor profiles...
            </Text>
          </Group>
        </Card>
      )}

      {!isLoading && doctors.length === 0 && (
        <Card withBorder>
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No doctors found.
          </Text>
        </Card>
      )}

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        {doctors.map((doctor) => {
          const defaultCredential = activeDefaultsByDoctor.get(doctor.user_id);
          const activeCredentialCount = activeCountsByDoctor.get(doctor.user_id) ?? 0;
          return (
            <DoctorProfileCard
              key={doctor.id}
              doctor={doctor}
              credentialsLoading={credentialsLoading}
              hasDefaultCredential={Boolean(defaultCredential)}
              activeCredentialCount={activeCredentialCount}
              onOpenCredentials={() => setCredentialDoctor(doctor)}
            />
          );
        })}
      </SimpleGrid>

      {createOpen && (
        <CreateDoctorModal
          opened={createOpen}
          onClose={createHandlers.close}
          onSubmit={(data) => create.mutate(data)}
          submitting={create.isPending}
          existingDoctors={doctors}
        />
      )}

      {credentialDoctor && (
        <CredentialsModal doctor={credentialDoctor} onClose={() => setCredentialDoctor(null)} />
      )}
    </div>
  );
}

function DoctorProfileCard({
  doctor,
  credentialsLoading,
  hasDefaultCredential,
  activeCredentialCount,
  onOpenCredentials,
}: {
  doctor: DoctorProfile;
  credentialsLoading: boolean;
  hasDefaultCredential: boolean;
  activeCredentialCount: number;
  onOpenCredentials: () => void;
}) {
  const displayName = `${doctor.prefix ? `${doctor.prefix} ` : ""}${doctor.display_name}`;

  return (
    <Card withBorder padding="md">
      <Stack gap="md">
        <Group align="flex-start" justify="space-between" wrap="nowrap">
          <Group align="flex-start" wrap="nowrap">
            <Avatar color="primary" radius="xl">
              {initials(doctor.display_name)}
            </Avatar>
            <Stack gap={4}>
              <Group gap="xs">
                <Text fw={700} size="md">
                  {displayName}
                </Text>
                {!doctor.is_active && (
                  <Badge color="red" size="xs">
                    Inactive
                  </Badge>
                )}
              </Group>
              <Text size="sm" c="dimmed">
                {doctor.qualification_string || "Qualification not recorded"}
              </Text>
              <Group gap={4}>
                {doctor.is_visiting ? (
                  <Badge size="xs" color="warning">
                    Visiting
                  </Badge>
                ) : (
                  <Badge size="xs" color="primary">
                    Full-time
                  </Badge>
                )}
                {doctor.subspecialty && (
                  <Badge size="xs" variant="light">
                    {doctor.subspecialty}
                  </Badge>
                )}
                {doctor.years_experience !== null && (
                  <Badge size="xs" variant="light">
                    {doctor.years_experience} yrs
                  </Badge>
                )}
              </Group>
            </Stack>
          </Group>

          <Tooltip label="Credential audit">
            <Button
              size="xs"
              variant="subtle"
              leftSection={<IconKey size={14} />}
              onClick={onOpenCredentials}
            >
              Audit
            </Button>
          </Tooltip>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          <ProfileFact label="MCI / NMC" value={doctor.mci_number} />
          <ProfileFact label="State council" value={doctor.state_council_number} />
          <ProfileFact label="Council name" value={doctor.state_council_name} />
          <ProfileFact
            label="Registration valid until"
            value={
              doctor.registration_valid_until
                ? new Date(doctor.registration_valid_until).toLocaleDateString()
                : null
            }
          />
        </SimpleGrid>

        <Divider />

        <Group align="flex-start" justify="space-between">
          <Stack gap={4}>
            <Text size="xs" c="dimmed" fw={600}>
              Clinical authority
            </Text>
            <Group gap={4}>
              {doctor.can_prescribe_schedule_x && <Badge size="xs">Schedule X</Badge>}
              {doctor.can_perform_surgery && <Badge size="xs">Surgery</Badge>}
              {doctor.can_sign_mlc && (
                <Badge size="xs" color="red">
                  MLC
                </Badge>
              )}
              {doctor.can_sign_death_certificate && (
                <Badge size="xs" color="red">
                  Death certificate
                </Badge>
              )}
              {!doctor.can_prescribe_schedule_x &&
                !doctor.can_perform_surgery &&
                !doctor.can_sign_mlc &&
                !doctor.can_sign_death_certificate && (
                  <Badge size="xs" variant="light">
                    Standard clinical signing
                  </Badge>
                )}
            </Group>
          </Stack>

          <CredentialStatus
            loading={credentialsLoading}
            hasDefault={hasDefaultCredential}
            activeCount={activeCredentialCount}
          />
        </Group>

        {!hasDefaultCredential && (
          <Button
            variant="light"
            color="warning"
            leftSection={<IconSignature size={14} />}
            onClick={onOpenCredentials}
          >
            Set up signature
          </Button>
        )}
      </Stack>
    </Card>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card withBorder padding="sm">
      <Group justify="space-between">
        <Stack gap={0}>
          <Text size="xs" c="dimmed">
            {label}
          </Text>
          <Text size="xl" fw={700}>
            {value}
          </Text>
        </Stack>
        <Badge color={tone} variant="light">
          Doctors
        </Badge>
      </Group>
    </Card>
  );
}

function ProfileFact({ label, value }: { label: string; value?: string | null }) {
  return (
    <Stack gap={1}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500}>
        {value || "-"}
      </Text>
    </Stack>
  );
}

function CredentialStatus({
  loading,
  hasDefault,
  activeCount,
}: {
  loading: boolean;
  hasDefault: boolean;
  activeCount: number;
}) {
  if (loading) {
    return (
      <Group gap="xs">
        <Loader size="xs" />
        <Text size="xs" c="dimmed">
          Checking credential...
        </Text>
      </Group>
    );
  }

  if (hasDefault) {
    return (
      <Stack gap={2} align="flex-end">
        <Badge size="sm" color="success" leftSection={<IconCircleCheck size={12} />}>
          Ready to sign
        </Badge>
        <Text size="xs" c="dimmed">
          {activeCount} active credential{activeCount === 1 ? "" : "s"}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap={2} align="flex-end">
      <Badge size="sm" color="warning" leftSection={<IconAlertTriangle size={12} />}>
        Credential missing
      </Badge>
      <Text size="xs" c="dimmed">
        Signing blocked
      </Text>
    </Stack>
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function CreateDoctorModal({
  opened,
  onClose,
  onSubmit,
  submitting,
  existingDoctors,
}: {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: CreateDoctorRequest) => void;
  submitting: boolean;
  existingDoctors: DoctorProfile[];
}) {
  const queryClient = useQueryClient();
  const [createUserOpen, createUserHandlers] = useDisclosure(false);
  const [userId, setUserId] = useState("");
  const [prefix, setPrefix] = useState("Dr.");
  const [displayName, setDisplayName] = useState("");
  const [qualification, setQualification] = useState("");
  const [mciNumber, setMciNumber] = useState("");
  const [stateCouncilNumber, setStateCouncilNumber] = useState("");
  const [stateCouncilName, setStateCouncilName] = useState("");
  const [subspecialty, setSubspecialty] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [isVisiting, setIsVisiting] = useState(false);
  const [canSignMlc, setCanSignMlc] = useState(false);
  const [canPerformSurgery, setCanPerformSurgery] = useState(false);

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["setup-users", "doctor-picker"],
    queryFn: () => api.listSetupUsers(),
    enabled: opened,
  });

  const linkedUserIds = useMemo(
    () => new Set(existingDoctors.map((doctor) => doctor.user_id)),
    [existingDoctors],
  );

  const doctorUserOptions = useMemo(
    () =>
      users
        .filter((user) => user.role === "doctor" && user.is_active)
        .map((user) => {
          const alreadyLinked = linkedUserIds.has(user.id) && user.id !== userId;
          return {
            value: user.id,
            label: `${user.full_name || user.username} (${user.username})${
              alreadyLinked ? " - profile exists" : ""
            }`,
            disabled: alreadyLinked,
          };
        }),
    [linkedUserIds, userId, users],
  );

  const applySelectedUser = (user: SetupUser) => {
    setUserId(user.id);
    setDisplayName(user.full_name || user.username);
    setQualification(user.qualification ?? "");
    setMciNumber(user.medical_registration_number ?? "");
    setSubspecialty(user.specialization ?? "");
  };

  const handleUserSelect = (value: string | null) => {
    setUserId(value ?? "");
    const selectedUser = users.find((user) => user.id === value);
    if (selectedUser) applySelectedUser(selectedUser);
  };

  return (
    <>
      <Modal opened={opened} onClose={onClose} title="Add doctor profile" size="lg">
        <Stack gap="sm">
          <Alert color="primary" icon={<IconStethoscope size={16} />} variant="light">
            <Text size="sm">
              Create or select the doctor login account first, then record council registration,
              unit, privileges, and signature readiness.
            </Text>
          </Alert>
          <Group align="flex-end" wrap="nowrap">
            <Select
              label="Linked doctor user"
              placeholder="Search by doctor name or username"
              data={doctorUserOptions}
              value={userId || null}
              onChange={handleUserSelect}
              searchable
              clearable
              required
              description="Doctor users with an existing profile are shown but disabled."
              rightSection={usersLoading ? <Loader size="xs" /> : undefined}
              style={{ flex: 1 }}
            />
            <Button
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={createUserHandlers.open}
            >
              Create user
            </Button>
          </Group>
          {doctorUserOptions.length === 0 && !usersLoading && (
            <Text size="xs" c="dimmed">
              No available doctor users. Create a user first, then continue this profile.
            </Text>
          )}
          <Group grow>
            <TextInput
              label="Prefix"
              value={prefix}
              onChange={(e) => setPrefix(e.currentTarget.value)}
            />
            <TextInput
              label="Display name"
              placeholder="Ravi Menon"
              value={displayName}
              onChange={(e) => setDisplayName(e.currentTarget.value)}
              required
            />
          </Group>
          <TextInput
            label="Qualification"
            placeholder="MBBS, MD General Medicine"
            value={qualification}
            onChange={(e) => setQualification(e.currentTarget.value)}
          />
          <Group grow>
            <TextInput
              label="MCI / NMC number"
              value={mciNumber}
              onChange={(e) => setMciNumber(e.currentTarget.value)}
            />
            <TextInput
              label="State council number"
              value={stateCouncilNumber}
              onChange={(e) => setStateCouncilNumber(e.currentTarget.value)}
            />
          </Group>
          <Group grow>
            <TextInput
              label="State council name"
              value={stateCouncilName}
              onChange={(e) => setStateCouncilName(e.currentTarget.value)}
            />
            <TextInput
              label="Specialty / unit"
              placeholder="General Medicine"
              value={subspecialty}
              onChange={(e) => setSubspecialty(e.currentTarget.value)}
            />
          </Group>
          <Group grow>
            <TextInput
              label="Years experience"
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.currentTarget.value)}
            />
            <Switch
              label="Visiting consultant"
              checked={isVisiting}
              onChange={(e) => setIsVisiting(e.currentTarget.checked)}
            />
          </Group>
          <Group>
            <Switch
              label="Can sign MLC"
              checked={canSignMlc}
              onChange={(e) => setCanSignMlc(e.currentTarget.checked)}
            />
            <Switch
              label="Can perform surgery"
              checked={canPerformSurgery}
              onChange={(e) => setCanPerformSurgery(e.currentTarget.checked)}
            />
          </Group>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button
              loading={submitting}
              disabled={!userId || !displayName}
              onClick={() =>
                onSubmit({
                  user_id: userId,
                  prefix: prefix || null,
                  display_name: displayName,
                  qualification_string: qualification || null,
                  mci_number: mciNumber || null,
                  state_council_number: stateCouncilNumber || null,
                  state_council_name: stateCouncilName || null,
                  subspecialty: subspecialty || null,
                  years_experience: yearsExperience ? Number(yearsExperience) : null,
                  is_visiting: isVisiting,
                  is_full_time: !isVisiting,
                  can_sign_mlc: canSignMlc,
                  can_perform_surgery: canPerformSurgery,
                })
              }
            >
              Create profile
            </Button>
          </Group>
        </Stack>
      </Modal>

      <CreateLinkedDoctorUserModal
        opened={createUserOpen}
        onClose={createUserHandlers.close}
        onCreated={(user) => {
          void queryClient.invalidateQueries({ queryKey: ["setup-users"] });
          applySelectedUser(user);
        }}
      />
    </>
  );
}

function CreateLinkedDoctorUserModal({
  opened,
  onClose,
  onCreated,
}: {
  opened: boolean;
  onClose: () => void;
  onCreated: (user: SetupUser) => void;
}) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [specialization, setSpecialization] = useState("");
  const [medicalRegistrationNumber, setMedicalRegistrationNumber] = useState("");
  const [qualification, setQualification] = useState("");

  const { data: departments = [], isLoading: departmentsLoading } = useQuery({
    queryKey: ["setup", "departments", "doctor-create"],
    queryFn: () => api.listDepartments(),
    enabled: opened,
  });

  const reset = () => {
    setFullName("");
    setUsername("");
    setEmail("");
    setPassword("");
    setDepartmentIds([]);
    setSpecialization("");
    setMedicalRegistrationNumber("");
    setQualification("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const createUser = useMutation({
    mutationFn: () =>
      api.createSetupUser({
        full_name: fullName.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
        role: "doctor",
        department_ids: departmentIds.length > 0 ? departmentIds : undefined,
        specialization: specialization.trim() || undefined,
        medical_registration_number: medicalRegistrationNumber.trim() || undefined,
        qualification: qualification.trim() || undefined,
      }),
    onSuccess: (user) => {
      notifications.show({
        title: "Doctor user created",
        message: "The login account is selected for this doctor profile.",
        color: "success",
      });
      void queryClient.invalidateQueries({ queryKey: ["setup-users"] });
      onCreated(user);
      reset();
      onClose();
    },
    onError: (err: Error) =>
      notifications.show({ title: "User create failed", message: err.message, color: "danger" }),
  });

  const canCreate =
    fullName.trim().length > 0 &&
    username.trim().length >= 3 &&
    email.includes("@") &&
    password.length >= 8;

  return (
    <Modal opened={opened} onClose={handleClose} title="Create doctor user" size="lg">
      <Stack gap="sm">
        <Alert color="primary" icon={<IconUserCog size={16} />} variant="light">
          <Text size="sm">
            This creates the login user with the doctor role. The doctor profile is still created in
            the previous form so council details and signing privileges are reviewed separately.
          </Text>
        </Alert>
        <Group grow>
          <TextInput
            label="Full name"
            placeholder="Dr. Ravi Menon"
            value={fullName}
            onChange={(e) => setFullName(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Username"
            placeholder="ravi.menon"
            value={username}
            onChange={(e) => setUsername(e.currentTarget.value)}
            required
          />
        </Group>
        <Group grow>
          <TextInput
            label="Email"
            placeholder="ravi.menon@hospital.local"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
          />
          <PasswordInput
            label="Temporary password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
            description="Minimum 8 characters. The user can change it after first login."
          />
        </Group>
        <MultiSelect
          label="Departments / units"
          placeholder={departmentsLoading ? "Loading departments..." : "Select departments"}
          data={departments.map((department) => ({
            value: department.id,
            label: `${department.name} (${department.department_type ?? "department"})`,
          }))}
          value={departmentIds}
          onChange={setDepartmentIds}
          searchable
          clearable
        />
        <Group grow>
          <TextInput
            label="Specialty / unit"
            placeholder="General Medicine"
            value={specialization}
            onChange={(e) => setSpecialization(e.currentTarget.value)}
          />
          <TextInput
            label="MCI / NMC registration"
            value={medicalRegistrationNumber}
            onChange={(e) => setMedicalRegistrationNumber(e.currentTarget.value)}
          />
        </Group>
        <TextInput
          label="Qualification"
          placeholder="MBBS, MD General Medicine"
          value={qualification}
          onChange={(e) => setQualification(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            loading={createUser.isPending}
            disabled={!canCreate}
            leftSection={<IconPlus size={14} />}
            onClick={() => createUser.mutate()}
          >
            Create and select user
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function CredentialsModal({ doctor, onClose }: { doctor: DoctorProfile; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [includeRevoked, setIncludeRevoked] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [signatureImageFile, setSignatureImageFile] = useState<File | null>(null);

  const { data: creds = [] } = useQuery({
    queryKey: ["sig-credentials", doctor.user_id, includeRevoked],
    queryFn: () =>
      api.adminListSignatureCredentials({
        doctor_user_id: doctor.user_id,
        include_revoked: includeRevoked,
      }),
  });

  const issue = useMutation({
    mutationFn: () =>
      api.adminIssueSignatureCredential({
        doctor_user_id: doctor.user_id,
        display_image_url: imageUrl || null,
        make_default: true,
      }),
    onSuccess: () => {
      notifications.show({
        title: "Credential issued",
        message: "Ed25519 keypair generated and set as default.",
        color: "success",
      });
      setImageUrl("");
      setSignatureImageFile(null);
      void queryClient.invalidateQueries({ queryKey: ["sig-credentials"] });
    },
    onError: (err: Error) =>
      notifications.show({ title: "Issue failed", message: err.message, color: "danger" }),
  });

  const revoke = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.adminRevokeSignatureCredential(id, { reason }),
    onSuccess: () => {
      notifications.show({ title: "Revoked", message: "Credential revoked.", color: "success" });
      void queryClient.invalidateQueries({ queryKey: ["sig-credentials"] });
    },
  });

  const handleSignatureImage = (file: File | null) => {
    setSignatureImageFile(file);
    if (!file) {
      setImageUrl("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      notifications.show({
        title: "Unsupported file",
        message: "Upload a PNG, JPEG, or WebP signature image.",
        color: "danger",
      });
      setSignatureImageFile(null);
      return;
    }
    if (file.size > 750_000) {
      notifications.show({
        title: "Signature too large",
        message: "Use a cropped signature image under 750 KB.",
        color: "danger",
      });
      setSignatureImageFile(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageUrl(reader.result);
      }
    };
    reader.onerror = () =>
      notifications.show({
        title: "Upload failed",
        message: "Could not read the signature image.",
        color: "danger",
      });
    reader.readAsDataURL(file);
  };

  return (
    <Modal opened onClose={onClose} title="Signature credentials" size="lg">
      <Stack gap="md">
        <Card withBorder padding="sm">
          <Stack gap="xs">
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="sm" fw={600}>
                  {doctor.display_name}
                </Text>
                <Text size="xs" c="dimmed">
                  {doctor.mci_number ?? doctor.state_council_number ?? "Registration not recorded"}
                </Text>
              </Stack>
              <Badge
                color={
                  creds.some((credential) => credential.is_default && !credential.revoked_at)
                    ? "success"
                    : "warning"
                }
              >
                {creds.some((credential) => credential.is_default && !credential.revoked_at)
                  ? "Default credential active"
                  : "No default credential"}
              </Badge>
            </Group>
            <FileInput
              size="sm"
              label="Upload signature image"
              description="Optional scanned signature image stamped onto PDFs and previews."
              placeholder="PNG, JPEG, or WebP under 750 KB"
              accept="image/png,image/jpeg,image/webp"
              clearable
              value={signatureImageFile}
              onChange={handleSignatureImage}
              leftSection={<IconPhoto size={14} />}
            />
            {imageUrl && (
              <Card withBorder padding="xs">
                <Group justify="space-between" align="center">
                  <Image src={imageUrl} alt="Signature preview" h={56} fit="contain" w={220} />
                  <Button
                    size="xs"
                    variant="subtle"
                    leftSection={<IconRefresh size={12} />}
                    onClick={() => {
                      setImageUrl("");
                      setSignatureImageFile(null);
                    }}
                  >
                    Clear
                  </Button>
                </Group>
              </Card>
            )}
            <TextInput
              size="sm"
              label="Or paste signature image URL"
              description="Use this when the image is already stored in object storage."
              placeholder="https://.../signature.png"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button
                size="xs"
                loading={issue.isPending}
                leftSection={<IconShieldCheck size={14} />}
                onClick={() => issue.mutate()}
              >
                Generate default Ed25519 credential
              </Button>
            </Group>
          </Stack>
        </Card>

        <Group justify="space-between">
          <Text size="sm" fw={600}>
            Credential audit ({creds.length})
          </Text>
          <Switch
            size="xs"
            label="Include revoked"
            checked={includeRevoked}
            onChange={(e) => setIncludeRevoked(e.currentTarget.checked)}
          />
        </Group>

        <Stack gap="xs">
          {creds.map((credential) => (
            <Card key={credential.id} withBorder padding="sm">
              <Group justify="space-between" align="flex-start">
                <Stack gap={4}>
                  <Group gap="xs">
                    <Badge size="xs">{credential.credential_type}</Badge>
                    {credential.is_default && (
                      <Badge size="xs" color="primary">
                        Default
                      </Badge>
                    )}
                    {credential.revoked_at && (
                      <Badge size="xs" color="red">
                        Revoked
                      </Badge>
                    )}
                    <Badge size="xs" variant="outline">
                      {credential.algorithm}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Issued {new Date(credential.created_at).toLocaleString()}
                    {credential.valid_until
                      ? `; valid until ${new Date(credential.valid_until).toLocaleString()}`
                      : "; no expiry set"}
                  </Text>
                  {credential.revoked_at && (
                    <Text size="xs" c="red">
                      Revoked {new Date(credential.revoked_at).toLocaleString()}:{" "}
                      {credential.revoked_reason ?? "-"}
                    </Text>
                  )}
                </Stack>
                {!credential.revoked_at && (
                  <Button
                    size="xs"
                    color="red"
                    variant="subtle"
                    onClick={() => {
                      const reason = window.prompt("Reason for revocation?");
                      if (reason) revoke.mutate({ id: credential.id, reason });
                    }}
                  >
                    Revoke
                  </Button>
                )}
              </Group>
            </Card>
          ))}
          {creds.length === 0 && (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No credentials yet. Generate one above before this doctor signs records.
            </Text>
          )}
        </Stack>
      </Stack>
    </Modal>
  );
}
