// BLOOD-BANK DonorsTab — split from blood-bank.tsx (pure move).

import { Group, Paper, Select, Stack, Text, Textarea, TextInput, Tooltip } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useDisclosure } from "@mantine/hooks";
import { useHasAnyPermission, useHasPermission } from "@medbrains/stores";
import type {
  AdverseReaction,
  BloodDonation,
  BloodDonor,
  CreateDonationRequest,
  CreateDonorRequest,
  UpdateDonationRequest,
} from "@medbrains/types";
import { BLOOD_GROUP_OPTIONS, bloodGroupLabel, P } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconDroplet,
  IconEye,
  IconMicroscope,
  IconPlus,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { PrintDocumentIconMenu } from "@/components/Print/PrintDocumentIconMenu";
import { Badge, Button, IconButton, Modal, Table, toast } from "@/components/ui";
import { bloodBankService } from "@/services/bloodBank.service";
import { CreateDonationForm } from "./CreateDonationForm";
import { DonorDeferralModal } from "./DonorDeferralModal";
import { TtiResultsDrawer } from "./TtiResultsDrawer";

const reactionTypeLabels: Record<string, string> = {
  vasovagal: "Vasovagal",
  hematoma: "Hematoma",
  nerve_injury: "Nerve Injury",
  citrate_reaction: "Citrate Reaction",
  allergic: "Allergic",
  other: "Other",
};

function parseAdverseReaction(raw: string | null): AdverseReaction | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdverseReaction;
  } catch {
    return null;
  }
}

function CreateDonorForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: CreateDonorRequest) => void;
  loading: boolean;
}) {
  const [donorNumber, setDonorNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bloodGroup, setBloodGroup] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState<string | null>(null);

  return (
    <Stack>
      <TextInput
        label="Donor Number"
        required
        value={donorNumber}
        onChange={(e) => setDonorNumber(e.currentTarget.value)}
      />
      <Group grow>
        <TextInput
          label="First Name"
          required
          value={firstName}
          onChange={(e) => setFirstName(e.currentTarget.value)}
        />
        <TextInput
          label="Last Name"
          required
          value={lastName}
          onChange={(e) => setLastName(e.currentTarget.value)}
        />
      </Group>
      <Select
        label="Blood Group"
        required
        data={BLOOD_GROUP_OPTIONS}
        value={bloodGroup}
        onChange={setBloodGroup}
      />
      <Select
        label="Gender"
        data={["male", "female", "other"]}
        value={gender}
        onChange={setGender}
        clearable
      />
      <DateInput
        label="Date of birth"
        description="Donors must be 18 to 65 on the day they give."
        required
        valueFormat="YYYY-MM-DD"
        maxDate={new Date()}
        value={dateOfBirth}
        onChange={setDateOfBirth}
      />
      <TextInput label="Phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
      <Button
        tone="primary"
        onClick={() => {
          if (!donorNumber || !firstName || !lastName || !bloodGroup || !dateOfBirth) return;
          onSubmit({
            donor_number: donorNumber,
            first_name: firstName,
            last_name: lastName,
            blood_group: bloodGroup,
            phone: phone || undefined,
            gender: gender ?? undefined,
            date_of_birth: dateOfBirth,
          });
        }}
        loading={loading}
      >
        Register
      </Button>
    </Stack>
  );
}

function DonorDetail({
  donor,
  onDonorChange,
}: {
  donor: BloodDonor;
  onDonorChange: (donor: BloodDonor) => void;
}) {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.BLOOD_BANK.DONORS_CREATE);
  const [donateOpen, { open: openDonate, close: closeDonate }] = useDisclosure(false);
  const [reactionDonation, setReactionDonation] = useState<BloodDonation | null>(null);
  const [ttiDonation, setTtiDonation] = useState<BloodDonation | null>(null);
  const canDefer = useHasPermission(P.BLOOD_BANK.DONORS_DEFER);
  const [deferralOpen, { open: openDeferral, close: closeDeferral }] = useDisclosure(false);
  // Screening results are a donor's infection status: their own permission.
  const canScreen = useHasAnyPermission([P.BLOOD_BANK.TTI_VIEW, P.BLOOD_BANK.TTI_RECORD]);

  const { data: donations } = useQuery({
    queryKey: ["blood-bank", "donations", donor.id],
    queryFn: () => bloodBankService.listDonations(donor.id),
  });

  const donateMut = useMutation({
    mutationFn: (d: CreateDonationRequest) => bloodBankService.createDonation(donor.id, d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blood-bank"] });
      closeDonate();
      toast.success("Blood donation has been recorded", { title: "Donation recorded" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not record donation" }),
  });

  const reactionMut = useMutation({
    mutationFn: ({ donationId, data }: { donationId: string; data: UpdateDonationRequest }) =>
      bloodBankService.updateDonation(donationId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blood-bank", "donations", donor.id] });
      setReactionDonation(null);
      toast.warning("Adverse reaction has been recorded", { title: "Reaction documented" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Could not record reaction" }),
  });

  return (
    <Stack>
      <Group>
        <Text fw={700}>
          {donor.first_name} {donor.last_name}
        </Text>
        <Badge tone="danger">{bloodGroupLabel(donor.blood_group)}</Badge>
        {donor.is_deferred && (
          <Badge tone="warning">
            {donor.deferral_until
              ? `Deferred until ${donor.deferral_until}`
              : "Deferred permanently"}
          </Badge>
        )}
        <PrintDocumentIconMenu
          idKind="donor"
          recordId={donor.id}
          recordLabel={donor.donor_number}
        />
      </Group>
      <Table>
        <Table.Tbody>
          <Table.Tr>
            <Table.Td>Donor #</Table.Td>
            <Table.Td>{donor.donor_number}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Phone</Table.Td>
            <Table.Td>{donor.phone ?? "—"}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Total Donations</Table.Td>
            <Table.Td>{donor.total_donations}</Table.Td>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>Last Donation</Table.Td>
            <Table.Td>
              {donor.last_donation ? new Date(donor.last_donation).toLocaleDateString() : "—"}
            </Table.Td>
          </Table.Tr>
        </Table.Tbody>
      </Table>

      <Group>
        {canCreate && (
          <Button tone="secondary" leftSection={<IconDroplet size={16} />} onClick={openDonate}>
            Record Donation
          </Button>
        )}
        {canDefer && (
          <Button tone="secondary" onClick={openDeferral}>
            {donor.is_deferred ? "Lift deferral" : "Defer donor"}
          </Button>
        )}
      </Group>
      {donor.is_deferred && donor.deferral_reason && (
        <Text size="sm">Deferral reason: {donor.deferral_reason}</Text>
      )}
      {canDefer && (
        <DonorDeferralModal
          donor={donor}
          opened={deferralOpen}
          onClose={closeDeferral}
          onSaved={(saved) => {
            closeDeferral();
            onDonorChange(saved);
          }}
        />
      )}

      <Text fw={600} mt="md">
        Donation History
      </Text>
      {donations?.length ? (
        <DataTable
          columns={[
            { key: "bag_number", label: "Bag #", render: (d: BloodDonation) => d.bag_number },
            { key: "donation_type", label: "Type", render: (d: BloodDonation) => d.donation_type },
            { key: "volume", label: "Volume", render: (d: BloodDonation) => `${d.volume_ml} ml` },
            {
              key: "date",
              label: "Date",
              render: (d: BloodDonation) => new Date(d.donated_at).toLocaleDateString(),
            },
            {
              key: "reaction",
              label: "Reaction",
              render: (d: BloodDonation) => {
                const reaction = parseAdverseReaction(d.adverse_reaction);
                return reaction ? (
                  <Tooltip
                    label={`${reactionTypeLabels[reaction.reaction_type] ?? reaction.reaction_type} — ${reaction.severity} — ${reaction.outcome}`}
                  >
                    <Badge tone="danger" leftSection={<IconAlertTriangle size={12} />}>
                      Adverse Reaction
                    </Badge>
                  </Tooltip>
                ) : (
                  <Text c="dimmed" size="sm">
                    None
                  </Text>
                );
              },
            },
            ...(canScreen
              ? [
                  {
                    key: "tti",
                    label: "Screening",
                    render: (d: BloodDonation) => (
                      <Button
                        tone="secondary"
                        size="compact-xs"
                        leftSection={<IconMicroscope size={12} />}
                        onClick={() => setTtiDonation(d)}
                      >
                        TTI results
                      </Button>
                    ),
                  },
                ]
              : []),
            ...(canCreate
              ? [
                  {
                    key: "actions",
                    label: "Actions",
                    render: (d: BloodDonation) => {
                      const reaction = parseAdverseReaction(d.adverse_reaction);
                      return !reaction ? (
                        <Button
                          tone="subtle-danger"
                          size="compact-xs"
                          leftSection={<IconAlertTriangle size={12} />}
                          onClick={() => setReactionDonation(d)}
                        >
                          Adverse Reaction
                        </Button>
                      ) : null;
                    },
                  },
                ]
              : []),
          ]}
          data={donations}
          rowKey={(d) => d.id}
        />
      ) : (
        <Text c="dimmed" size="sm">
          No donations recorded yet
        </Text>
      )}

      <Modal opened={donateOpen} onClose={closeDonate} title="Record Donation" fullScreen>
        <CreateDonationForm onSubmit={(d) => donateMut.mutate(d)} loading={donateMut.isPending} />
      </Modal>

      <TtiResultsDrawer donation={ttiDonation} onClose={() => setTtiDonation(null)} />

      <Modal
        opened={!!reactionDonation}
        onClose={() => setReactionDonation(null)}
        title="Document Adverse Reaction"
        size="md"
      >
        {reactionDonation && (
          <AdverseReactionForm
            donation={reactionDonation}
            onSubmit={(reaction) =>
              reactionMut.mutate({
                donationId: reactionDonation.id,
                data: { adverse_reaction: JSON.stringify(reaction) },
              })
            }
            loading={reactionMut.isPending}
          />
        )}
      </Modal>
    </Stack>
  );
}

function AdverseReactionForm({
  donation,
  onSubmit,
  loading,
}: {
  donation: BloodDonation;
  onSubmit: (reaction: AdverseReaction) => void;
  loading: boolean;
}) {
  const [reactionType, setReactionType] = useState<string | null>(null);
  const [severity, setSeverity] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [treatmentGiven, setTreatmentGiven] = useState("");
  const [outcome, setOutcome] = useState<string | null>(null);

  return (
    <Stack>
      <Paper p="sm" withBorder>
        <Text size="sm" c="dimmed">
          Donation: <strong>{donation.bag_number}</strong> on{" "}
          {new Date(donation.donated_at).toLocaleDateString()}
        </Text>
      </Paper>
      <Select
        label="Reaction Type"
        required
        data={[
          { value: "vasovagal", label: "Vasovagal" },
          { value: "hematoma", label: "Hematoma" },
          { value: "nerve_injury", label: "Nerve Injury" },
          { value: "citrate_reaction", label: "Citrate Reaction" },
          { value: "allergic", label: "Allergic" },
          { value: "other", label: "Other" },
        ]}
        value={reactionType}
        onChange={setReactionType}
      />
      <Select
        label="Severity"
        required
        data={[
          { value: "mild", label: "Mild" },
          { value: "moderate", label: "Moderate" },
          { value: "severe", label: "Severe" },
        ]}
        value={severity}
        onChange={setSeverity}
      />
      <Textarea
        label="Description"
        required
        placeholder="Describe the adverse reaction..."
        value={description}
        onChange={(e) => setDescription(e.currentTarget.value)}
        minRows={3}
      />
      <Textarea
        label="Treatment Given"
        required
        placeholder="Describe the treatment administered..."
        value={treatmentGiven}
        onChange={(e) => setTreatmentGiven(e.currentTarget.value)}
        minRows={2}
      />
      <Select
        label="Outcome"
        required
        data={[
          { value: "resolved", label: "Resolved" },
          { value: "referred", label: "Referred" },
          { value: "hospitalized", label: "Hospitalized" },
        ]}
        value={outcome}
        onChange={setOutcome}
      />
      <Button
        tone="danger"
        onClick={() => {
          if (!reactionType || !severity || !description || !treatmentGiven || !outcome) return;
          onSubmit({
            reaction_type: reactionType as AdverseReaction["reaction_type"],
            severity: severity as AdverseReaction["severity"],
            description,
            treatment_given: treatmentGiven,
            outcome: outcome as AdverseReaction["outcome"],
          });
        }}
        loading={loading}
      >
        Save Adverse Reaction
      </Button>
    </Stack>
  );
}

export function DonorsTab() {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.BLOOD_BANK.DONORS_CREATE);
  const [createOpen, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [detailDonor, setDetailDonor] = useState<BloodDonor | null>(null);
  const [bloodGroupFilter, setBloodGroupFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page), per_page: "20" };
  if (bloodGroupFilter) params.blood_group = bloodGroupFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["blood-bank", "donors", params],
    queryFn: () => bloodBankService.listBloodDonors(params),
  });

  const createMut = useMutation({
    mutationFn: (d: CreateDonorRequest) => bloodBankService.createBloodDonor(d),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["blood-bank", "donors"] });
      closeCreate();
      toast.success("New blood donor added", { title: "Donor registered" });
    },
  });

  const columns = [
    { key: "donor_number" as const, label: "Donor #", render: (d: BloodDonor) => d.donor_number },
    {
      key: "first_name" as const,
      label: "Name",
      render: (d: BloodDonor) => `${d.first_name} ${d.last_name}`,
    },
    {
      key: "blood_group" as const,
      label: "Blood Group",
      render: (d: BloodDonor) => <Badge tone="danger">{bloodGroupLabel(d.blood_group)}</Badge>,
    },
    {
      key: "total_donations" as const,
      label: "Donations",
      render: (d: BloodDonor) => String(d.total_donations),
    },
    {
      key: "is_deferred" as const,
      label: "Status",
      render: (d: BloodDonor) =>
        d.is_deferred ? (
          <Badge tone="warning">Deferred</Badge>
        ) : (
          <Badge tone="success">Active</Badge>
        ),
    },
    {
      key: "id" as const,
      label: "",
      render: (d: BloodDonor) => (
        <Tooltip label="View details">
          <IconButton tone="default" onClick={() => setDetailDonor(d)} aria-label="View details">
            <IconEye size={16} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Stack mt="md">
      <Group>
        <Select
          placeholder="Blood group"
          data={BLOOD_GROUP_OPTIONS}
          clearable
          value={bloodGroupFilter}
          onChange={setBloodGroupFilter}
          w={160}
        />
        {canCreate && (
          <Button tone="primary" leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Register Donor
          </Button>
        )}
      </Group>

      <DataTable
        columns={columns}
        data={data?.donors ?? []}
        loading={isLoading}
        rowKey={(d) => d.id}
        page={page}
        totalPages={data ? Math.ceil(data.total / data.per_page) : 1}
        onPageChange={setPage}
      />

      {/* Create Donor Drawer */}
      <Modal opened={createOpen} onClose={closeCreate} title="Register Blood Donor" fullScreen>
        <CreateDonorForm onSubmit={(d) => createMut.mutate(d)} loading={createMut.isPending} />
      </Modal>

      {/* Donor Detail Drawer */}
      <Modal
        opened={!!detailDonor}
        onClose={() => setDetailDonor(null)}
        title="Donor Details"
        fullScreen
      >
        {detailDonor && <DonorDetail donor={detailDonor} onDonorChange={setDetailDonor} />}
      </Modal>
    </Stack>
  );
}
