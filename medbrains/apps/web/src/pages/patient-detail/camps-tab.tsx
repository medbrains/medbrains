import { Group, Loader, Text } from "@mantine/core";
import { useHasPermission } from "@medbrains/stores";
import type { Camp, CampRegistration } from "@medbrains/types";
import { P } from "@medbrains/types";
import { IconTent } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { Alert, Badge, type BadgeTone, Button, Table } from "@/components/ui";
import { campService } from "@/services/camp.service";
import { formatDate } from "./shared";

const STATUS_TONES: Record<string, BadgeTone> = {
  registered: "neutral",
  screened: "info",
  referred: "warning",
  converted: "success",
};

/**
 * Every camp this patient has been through.
 *
 * The camp half of the link worked already: registering at a camp with a
 * patient in context stamps `camp_registrations.patient_id`. The other half
 * did not exist — the patient's own record had fourteen tabs and none of
 * them mentioned camps, so a person seen at three successive Sunday camps
 * had no camp history anywhere on their chart.
 *
 * `listCampRegistrations({ patient_id })` has always accepted that filter.
 * Nothing on the patient side called it.
 *
 * Camps are read once and indexed by id rather than fetched per row: a
 * patient with a dozen registrations would otherwise be a dozen requests for
 * a name and a date.
 */
export function CampsTab({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const canViewCamps = useHasPermission(P.CAMP.LIST);

  const {
    data: registrations,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["patient-camp-registrations", patientId],
    queryFn: () => campService.listCampRegistrations({ patient_id: patientId }),
    enabled: canViewCamps,
  });

  const { data: camps = [] } = useQuery({
    queryKey: ["camps"],
    queryFn: () => campService.listCamps(),
    enabled: canViewCamps,
    staleTime: 300_000,
  });
  const campsById = useMemo(() => new Map(camps.map((camp: Camp) => [camp.id, camp])), [camps]);

  if (!canViewCamps) {
    return (
      <Alert tone="warning">
        You do not have permission to read camps, so this patient's camp history is not shown rather
        than shown empty.
      </Alert>
    );
  }

  if (isError) {
    // An outage must not read as "never attended a camp" — that is a claim
    // about the patient, and it is the sort of thing a follow-up decision
    // gets made on.
    return <Alert tone="danger">This patient's camp history could not be read.</Alert>;
  }

  if (isLoading) return <Loader size="sm" />;

  if (!registrations || registrations.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        This patient has not been registered at a camp.
      </Text>
    );
  }

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Camp</Table.Th>
          <Table.Th>Registration</Table.Th>
          <Table.Th>Registered</Table.Th>
          <Table.Th>Service</Table.Th>
          <Table.Th>Complaint</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {registrations.map((registration: CampRegistration) => {
          const camp = campsById.get(registration.camp_id);
          return (
            <Table.Tr key={registration.id}>
              <Table.Td>
                <Group gap={6}>
                  <IconTent size={14} />
                  <Text size="sm">{camp ? camp.name : "—"}</Text>
                </Group>
                {camp && (
                  <Text size="xs" c="dimmed">
                    {camp.camp_code} · {camp.scheduled_date}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>{registration.registration_number}</Table.Td>
              <Table.Td>{formatDate(registration.created_at)}</Table.Td>
              <Table.Td>{registration.service_line ?? "—"}</Table.Td>
              <Table.Td>{registration.chief_complaint ?? "—"}</Table.Td>
              <Table.Td>
                <Badge tone={STATUS_TONES[registration.status] ?? "neutral"}>
                  {registration.status}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Button
                  tone="ghost"
                  size="xs"
                  onClick={() => navigate(`/camp/${registration.camp_id}`)}
                >
                  Open camp
                </Button>
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
