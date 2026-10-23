import { Checkbox, Stack, Text } from "@mantine/core";
import type { CreatePsychChallengeRequest, DirectiveChallengeGround } from "@medbrains/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Modal, Select, TextArea } from "@/components/ui";
import { psychiatryService } from "@/services/psychiatry.service";
import { APPLICANT_ROLES, CHALLENGE_GROUNDS } from "./labels";

interface ChallengeModalProps {
  directiveId: string | null;
  psychPatientId: string;
  onClose: () => void;
}

/** s.11: the application to the Board — the only lawful way not to follow
 *  a valid directive. Filing it does not suspend the directive. */
export function ChallengeModal({ directiveId, psychPatientId, onClose }: ChallengeModalProps) {
  const qc = useQueryClient();
  const [role, setRole] = useState<CreatePsychChallengeRequest["applicant_role"]>(
    "mental_health_professional",
  );
  const [grounds, setGrounds] = useState<DirectiveChallengeGround[]>([]);
  const [details, setDetails] = useState("");
  const file = useMutation({
    mutationFn: (id: string) =>
      psychiatryService.createChallenge(id, {
        applicant_role: role,
        grounds,
        details: details.trim(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["psych-challenges", psychPatientId] });
      setGrounds([]);
      setDetails("");
      onClose();
    },
  });
  return (
    <Modal
      opened={directiveId !== null}
      onClose={onClose}
      title="Apply to the Board (s.11)"
      primaryAction={{
        label: "File application",
        onClick: () => directiveId && file.mutate(directiveId),
        loading: file.isPending,
        disabled: grounds.length === 0 || !details.trim(),
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack gap="sm">
        <Text size="sm">The directive stays in force until the Board decides.</Text>
        <Select
          label="Applicant"
          data={APPLICANT_ROLES}
          value={role}
          onChange={(v) => v && setRole(v as CreatePsychChallengeRequest["applicant_role"])}
          allowDeselect={false}
        />
        <Checkbox.Group
          label="Grounds"
          value={grounds}
          onChange={(v) => setGrounds(v as DirectiveChallengeGround[])}
        >
          <Stack gap={4} mt={4}>
            {CHALLENGE_GROUNDS.map((g) => (
              <Checkbox key={g.value} value={g.value} label={g.label} />
            ))}
          </Stack>
        </Checkbox.Group>
        <TextArea
          label="Explain"
          required
          autosize
          minRows={3}
          value={details}
          onChange={(e) => setDetails(e.currentTarget.value)}
        />
        {file.isError && <Alert tone="danger">{file.error.message}</Alert>}
      </Stack>
    </Modal>
  );
}
