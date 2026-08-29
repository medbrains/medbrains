import { Group, Radio, Select, Stack, Text, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useHasPermission } from "@medbrains/stores";
import type { MarketingPatientMatch } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Badge, Button, Card, Modal, toast } from "@/components/ui";
import { marketingService } from "@/services/marketing.service";

const REGISTER = "__register__";

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Not stated" },
];

/**
 * Turn an enquiry into a patient.
 *
 * Deliberately a choice rather than a button. The repo already carries the
 * scar from getting this wrong elsewhere: public booking matched patients on
 * phone number alone and put appointments on the wrong chart, because families
 * share a phone. A son rings about his mother, a daughter about her father, a
 * neighbour about somebody with no phone at all.
 *
 * So every patient on that number is shown — including the ones whose names do
 * not match, because "this is the son, not the mother" is exactly the
 * distinction an automatic matcher gets wrong. The desk has just spoken to
 * them and is the only party that can tell.
 */
export function ConvertLeadModal({
  contactId,
  contactName,
  opened,
  onClose,
}: {
  contactId: string;
  contactName: string | null;
  opened: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const canRegister = useHasPermission(P.PATIENTS.CREATE);
  const [choice, setChoice] = useState<string | null>(null);
  const [firstName, setFirstName] = useState(contactName?.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(contactName?.split(" ").slice(1).join(" ") ?? "");
  const [gender, setGender] = useState<string | null>("unknown");
  // DateInput hands back an ISO string, which is also what the API wants —
  // so it is kept as one rather than round-tripped through a Date.
  const [dob, setDob] = useState<string | null>(null);

  const {
    data: matches = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["marketing", "contacts", contactId, "patient-matches"],
    queryFn: () => marketingService.patientMatches(contactId),
    enabled: opened,
  });

  const convert = useMutation({
    mutationFn: () =>
      choice === REGISTER
        ? marketingService.convertContact(contactId, {
            action: "register",
            first_name: firstName.trim(),
            last_name: lastName.trim() || undefined,
            gender: gender ?? undefined,
            date_of_birth: dob ?? undefined,
          })
        : marketingService.convertContact(contactId, {
            action: "link",
            patient_id: choice ?? "",
          }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["marketing"] });
      toast.success(
        result.registered
          ? `Registered as ${result.uhid}`
          : `Linked to existing patient ${result.uhid}`,
        { title: "Enquiry converted" },
      );
      onClose();
    },
    onError: (error: Error) => toast.error(error.message, { title: "Could not convert" }),
  });

  const registering = choice === REGISTER;
  const canSubmit =
    choice !== null && (!registering || firstName.trim().length > 0) && !convert.isPending;

  return (
    <Modal opened={opened} onClose={onClose} title="Convert enquiry to patient" size="lg">
      <Stack gap="md">
        {isError && (
          <Alert tone="danger" title="Could not check for existing records">
            {/* An empty list and a failed lookup look identical, and one of
                them ends with a duplicate chart. */}
            Registering now risks creating a second record for someone already on file. Try again
            before continuing.
          </Alert>
        )}

        {!isLoading && matches.length > 0 && (
          <Alert tone="warning" title="This number is already on file">
            Families share phones. Check the name and date of birth before linking — attaching an
            enquiry to the wrong chart is harder to undo than registering twice.
          </Alert>
        )}

        <Radio.Group value={choice} onChange={setChoice}>
          <Stack gap="xs">
            {matches.map((match: MarketingPatientMatch) => (
              <Card key={match.patient_id} padding="sm">
                <Radio
                  value={match.patient_id}
                  label={
                    <Group gap="xs" wrap="wrap">
                      <Text fw={500}>
                        {match.first_name} {match.last_name}
                      </Text>
                      <Text size="xs" ff="monospace" c="dimmed">
                        {match.uhid}
                      </Text>
                      {match.name_matches ? (
                        <Badge tone="success" size="sm">
                          Name matches
                        </Badge>
                      ) : (
                        <Badge tone="warning" size="sm">
                          Different name
                        </Badge>
                      )}
                      <Text size="xs" c="dimmed">
                        {match.gender}
                        {match.date_of_birth ? ` · born ${match.date_of_birth}` : ""}
                      </Text>
                    </Group>
                  }
                />
              </Card>
            ))}

            {canRegister && (
              <Card padding="sm">
                <Radio
                  value={REGISTER}
                  label={
                    matches.length > 0
                      ? "None of these — register a new patient"
                      : "Register as a new patient"
                  }
                />
              </Card>
            )}
          </Stack>
        </Radio.Group>

        {registering && (
          <Stack gap="xs">
            <Group grow>
              <TextInput
                label="First name"
                required
                value={firstName}
                onChange={(event) => setFirstName(event.currentTarget.value)}
              />
              <TextInput
                label="Last name"
                value={lastName}
                onChange={(event) => setLastName(event.currentTarget.value)}
              />
            </Group>
            <Group grow>
              <Select
                label="Gender"
                data={GENDER_OPTIONS}
                value={gender}
                onChange={setGender}
                allowDeselect={false}
              />
              <DateInput
                label="Date of birth"
                placeholder="If they gave one"
                value={dob}
                onChange={setDob}
              />
            </Group>
            <Text size="xs" c="dimmed">
              The phone number on the enquiry is used. Anything missing can be completed at
              registration.
            </Text>
          </Stack>
        )}

        <Group justify="flex-end">
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="primary"
            disabled={!canSubmit}
            loading={convert.isPending}
            onClick={() => convert.mutate()}
          >
            {registering ? "Register and link" : "Link to this patient"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
