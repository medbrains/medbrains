// BLOOD-BANK DonorsTab — split from blood-bank.tsx (pure move).

import {
  Drawer,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useHasPermission } from "@medbrains/stores";
import type {
  AdverseReaction,
  BloodDonation,
  BloodDonor,
  CreateDonationRequest,
  CreateDonorRequest,
  UpdateDonationRequest,
} from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconAlertTriangle, IconDroplet, IconEye, IconPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable } from "@/components";
import { Badge, Button, IconButton, Table, toast } from "@/components/ui";
import { bloodBankService } from "@/services/bloodBank.service";

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
        data={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]}
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
      <TextInput label="Phone" value={phone} onChange={(e) => setPhone(e.currentTarget.value)} />
      <Button
        tone="primary"
        onClick={() => {
          if (!donorNumber || !firstName || !lastName || !bloodGroup) return;
          onSubmit({
            donor_number: donorNumber,
            first_name: firstName,
            last_name: lastName,
            blood_group: bloodGroup,
            phone: phone || undefined,
            gender: gender ?? undefined,
          });
        }}
        loading={loading}
      >
        Register
      </Button>
    </Stack>
  );
}

function DonorDetail({ donor }: { donor: BloodDonor }) {
  const qc = useQueryClient();
  const canCreate = useHasPermission(P.BLOOD_BANK.DONORS_CREATE);
  const [donateOpen, { open: openDonate, close: closeDonate }] = useDisclosure(false);
  const [reactionDonation, setReactionDonation] = useState<BloodDonation | null>(null);

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
        <Badge tone="danger">{donor.blood_group}</Badge>
        {donor.is_deferred && <Badge tone="warning">Deferred until {donor.deferral_until}</Badge>}
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

      {canCreate && (
        <Button tone="secondary" leftSection={<IconDroplet size={16} />} onClick={openDonate}>
          Record Donation
        </Button>
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

      <Drawer
        opened={donateOpen}
        onClose={closeDonate}
        title="Record Donation"
        position="right"
        size="xl"
      >
        <CreateDonationForm onSubmit={(d) => donateMut.mutate(d)} loading={donateMut.isPending} />
      </Drawer>

      <Drawer
        opened={!!reactionDonation}
        onClose={() => setReactionDonation(null)}
        title="Document Adverse Reaction"
        position="right"
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
      </Drawer>
    </Stack>
  );
}

function CreateDonationForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: CreateDonationRequest) => void;
  loading: boolean;
}) {
  const [bagNumber, setBagNumber] = useState("");
  const [donationType, setDonationType] = useState<string | null>("whole_blood");
  const [volumeMl, setVolumeMl] = useState<number>(450);
  const [campName, setCampName] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Stack>
      <TextInput
        label="Bag Number"
        required
        value={bagNumber}
        onChange={(e) => setBagNumber(e.currentTarget.value)}
      />
      <Select
        label="Donation Type"
        data={[
          { value: "whole_blood", label: "Whole Blood" },
          { value: "apheresis_platelets", label: "Apheresis Platelets" },
          { value: "apheresis_plasma", label: "Apheresis Plasma" },
        ]}
        value={donationType}
        onChange={setDonationType}
      />
      <NumberInput
        label="Volume (ml)"
        value={volumeMl}
        onChange={(v) => setVolumeMl(Number(v))}
        min={50}
        max={600}
      />
      <TextInput
        label="Camp Name"
        value={campName}
        onChange={(e) => setCampName(e.currentTarget.value)}
      />
      <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
      <Button
        tone="primary"
        onClick={() => {
          if (!bagNumber) return;
          onSubmit({
            bag_number: bagNumber,
            donation_type: (donationType as CreateDonationRequest["donation_type"]) ?? undefined,
            volume_ml: volumeMl,
            camp_name: campName || undefined,
            notes: notes || undefined,
          });
        }}
        loading={loading}
      >
        Record Donation
      </Button>
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
      render: (d: BloodDonor) => <Badge tone="danger">{d.blood_group}</Badge>,
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
          data={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]}
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
      <Drawer
        opened={createOpen}
        onClose={closeCreate}
        title="Register Blood Donor"
        position="right"
        size="xl"
      >
        <CreateDonorForm onSubmit={(d) => createMut.mutate(d)} loading={createMut.isPending} />
      </Drawer>

      {/* Donor Detail Drawer */}
      <Drawer
        opened={!!detailDonor}
        onClose={() => setDetailDonor(null)}
        title="Donor Details"
        position="right"
        size="lg"
      >
        {detailDonor && <DonorDetail donor={detailDonor} />}
      </Drawer>
    </Stack>
  );
}
