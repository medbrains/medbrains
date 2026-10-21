import { Group, Loader, Stack, Text } from "@mantine/core";
import { useHasAnyPermission } from "@medbrains/stores";
import { type AbdmProfileShare, P } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { PatientSearchSelect } from "@/components/PatientSearchSelect";
import { Alert, Badge, Button, Modal, Table } from "@/components/ui";
import { patientsService } from "@/services/patients.service";
import {
  likelyDuplicates,
  rankCandidates,
  type ShareCandidate,
  shareMatchRequest,
  shareName,
} from "./scanShare";

/** Candidates listed at most; the match endpoint returns up to 20. */
const CANDIDATE_LIMIT = 5;

export interface ScanShareFindTarget {
  share: AbdmProfileShare;
  /** `register`: the desk pressed Register and likely matches were found. */
  mode: "find" | "register";
}

/** The registration duplicate check, asked with what the share carried. */
export const shareCandidatesQuery = (share: AbdmProfileShare) => ({
  queryKey: ["abdm", "scan-share", "candidates", share.id],
  queryFn: () => patientsService.matchPatients(shareMatchRequest(share.profile)),
  staleTime: 60_000,
});

interface ScanShareFindDrawerProps {
  target: ScanShareFindTarget | null;
  onClose: () => void;
  onPick: (share: AbdmProfileShare, patientId: string) => void;
  onRegister: (share: AbdmProfileShare) => void;
}

/**
 * A share whose ABHA is on no patient here, for a person who may already be
 * registered (before ABHA): the likely matches by mobile, name and date of
 * birth, and a search. Picking one goes on to compare and link; registering
 * stays possible, after the warning.
 */
export function ScanShareFindDrawer({
  target,
  onClose,
  onPick,
  onRegister,
}: ScanShareFindDrawerProps) {
  return (
    <Modal opened={target !== null} onClose={onClose} title="Find existing patient" fullScreen>
      {target && <FindBody target={target} onPick={onPick} onRegister={onRegister} />}
    </Modal>
  );
}

interface FindBodyProps extends Omit<ScanShareFindDrawerProps, "target" | "onClose"> {
  target: ScanShareFindTarget;
}

function FindBody({ target, onPick, onRegister }: FindBodyProps) {
  const { share, mode } = target;
  const canMatch = useHasAnyPermission([P.PATIENTS.VIEW, P.PATIENTS.CREATE]);
  const matches = useQuery({ ...shareCandidatesQuery(share), enabled: canMatch });
  const ranked = matches.data ? rankCandidates(share.profile, matches.data) : [];
  const likely = matches.data ? likelyDuplicates(share.profile, matches.data) : [];
  const pick = (patientId: string) => onPick(share, patientId);

  return (
    <Stack>
      <Text size="sm">
        Shared by {shareName(share.profile)}
        {share.profile.mobile ? ` · ${share.profile.mobile}` : ""}
        {share.profile.date_of_birth ? ` · born ${share.profile.date_of_birth}` : ""}
      </Text>
      {mode === "register" && likely.length > 0 && (
        <Alert tone="warning" title="This may be an existing patient">
          Registering again would give the same person a second UHID. Link instead if one of these
          is them.
        </Alert>
      )}
      {!canMatch ? null : matches.isLoading ? (
        <Loader size="sm" />
      ) : matches.isError ? (
        <Alert tone="danger" title="Could not check for existing patients">
          Nobody has been compared — search below before registering.
        </Alert>
      ) : ranked.length === 0 ? (
        <Text size="sm" c="dimmed">
          No patient here shares this name, mobile or date of birth.
        </Text>
      ) : (
        <CandidateTable
          rows={ranked.slice(0, CANDIDATE_LIMIT)}
          likely={new Set(likely.map((c) => c.id))}
          onPick={pick}
        />
      )}
      <PatientSearchSelect
        value=""
        onChange={(id) => id && pick(id)}
        label="Search by name, phone or UHID"
        initialSearch={shareName(share.profile)}
        allowCreate={false}
      />
      {mode === "register" && (
        <Group justify="flex-end">
          <Button tone="secondary" onClick={() => onRegister(share)}>
            Register new anyway
          </Button>
        </Group>
      )}
    </Stack>
  );
}

interface CandidateTableProps {
  rows: ShareCandidate[];
  likely: Set<string>;
  onPick: (patientId: string) => void;
}

function CandidateTable({ rows, likely, onPick }: CandidateTableProps) {
  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Patient</Table.Th>
          <Table.Th>Born · mobile</Table.Th>
          <Table.Th>Matches on</Table.Th>
          <Table.Th>Action</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((c) => (
          <Table.Tr key={c.id}>
            <Table.Td>
              <Stack gap={0}>
                <Text size="sm">{[c.first_name, c.last_name].filter(Boolean).join(" ")}</Text>
                <Text size="xs" ff="monospace">
                  {c.uhid}
                </Text>
              </Stack>
            </Table.Td>
            <Table.Td>{[c.date_of_birth, c.phone].filter(Boolean).join(" · ") || "—"}</Table.Td>
            <Table.Td>
              <Group gap={4}>
                {c.sameMobile && <Badge tone="primary">Mobile</Badge>}
                {c.sameDob && <Badge tone="primary">Date of birth</Badge>}
                {c.similarName && <Badge tone="neutral">Name</Badge>}
              </Group>
            </Table.Td>
            <Table.Td>
              <Button
                size="xs"
                tone={likely.has(c.id) ? "primary" : "secondary"}
                onClick={() => onPick(c.id)}
              >
                {likely.has(c.id) ? "Link instead" : "Compare and link"}
              </Button>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
