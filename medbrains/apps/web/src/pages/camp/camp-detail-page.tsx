import { Loader, Stack, Text } from "@mantine/core";
import { P } from "@medbrains/types";
import { IconArrowLeft, IconTent } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { PageHeader } from "@/components";
import { Alert, Badge, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { campService } from "@/services/camp.service";
import { CampDetail } from "./camp-detail";
import { CAMP_STATUS_COLORS, campLandingPath, campWorkPath } from "./shared";

/**
 * One camp: its team, its supplies and its running totals.
 *
 * This was a right-hand drawer opened from the camps list, holding the whole
 * of CampDetail — team management, supply reservations and the stat cards.
 * It had no address, so a coordinator could not send anybody to a particular
 * camp, and the team page it now links to (`work/team/new`) had nowhere
 * sensible to come back to.
 *
 * `/camp/:campId` is a new route rather than a repointed facade: unlike the
 * other camp screens, nobody had published an address for this one.
 */
export function CampDetailPage() {
  useRequirePermission(P.CAMP.LIST);

  const navigate = useNavigate();
  const { campId } = useParams();
  const [searchParams] = useSearchParams();
  const contextPatientId = searchParams.get("patient_id") ?? "";

  const {
    data: camp,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["camp", campId],
    queryFn: () => campService.getCamp(campId ?? ""),
    enabled: Boolean(campId),
  });

  return (
    <Stack>
      <PageHeader
        title={camp ? camp.name : "Camp"}
        subtitle={camp ? `${camp.camp_code} · ${camp.scheduled_date}` : undefined}
        icon={<IconTent size={20} stroke={1.5} />}
        actions={
          <>
            {camp && (
              <Button
                tone="primary"
                onClick={() => navigate(campWorkPath(camp.id, contextPatientId))}
              >
                Work this camp
              </Button>
            )}
            <Button
              tone="secondary"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => navigate(campLandingPath(contextPatientId))}
            >
              Camps
            </Button>
          </>
        }
      />
      {!campId ? (
        <Alert tone="warning">Camp id is missing from the route.</Alert>
      ) : isError ? (
        // Distinct from "not found": the camp may well exist and the read
        // failed. Saying "no such camp" to a coordinator holding the code
        // sends them looking for a mistake they did not make.
        <Alert tone="danger">This camp could not be read. Retrying automatically.</Alert>
      ) : isLoading ? (
        <Stack align="center" py="xl">
          <Loader />
          <Text c="dimmed">Loading camp…</Text>
        </Stack>
      ) : camp ? (
        <Stack>
          <Badge tone={CAMP_STATUS_COLORS[camp.status] ?? "neutral"} variant="light">
            {camp.status}
          </Badge>
          <CampDetail camp={camp} />
        </Stack>
      ) : (
        <Alert tone="warning">No camp with that id.</Alert>
      )}
    </Stack>
  );
}
