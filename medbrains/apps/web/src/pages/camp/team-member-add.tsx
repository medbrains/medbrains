import { Select, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { P } from "@medbrains/types";
import { IconArrowLeft, IconUserPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { PageHeader } from "@/components";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { Alert, Button } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { campService } from "@/services/camp.service";
import { CAMP_TEAM_ROLES, campWorkPath } from "./shared";

/**
 * Adding somebody to a camp's team, on the screen its route already named.
 *
 * `camp/:campId/work/team/new` was routed and led to the camp workspace's
 * analytics tab; the form only opened as a right-hand drawer nested inside
 * the camp detail drawer — a panel within a panel, which is where this
 * particular pattern had got to.
 */
export function CampTeamMemberAddPage() {
  useRequirePermission(P.CAMP.UPDATE);

  const navigate = useNavigate();
  const { campId } = useParams();
  const [searchParams] = useSearchParams();
  const contextPatientId = searchParams.get("patient_id") ?? "";
  const qc = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState("volunteer");

  const backToCamp = () => navigate(campWorkPath(campId ?? "", contextPatientId, "analytics"));

  const { data: camp } = useQuery({
    queryKey: ["camp", campId],
    queryFn: () => campService.getCamp(campId ?? ""),
    enabled: Boolean(campId),
  });

  const addMember = useMutation({
    mutationFn: () =>
      campService.addCampTeamMember(campId ?? "", {
        employee_id: employeeId,
        role_in_camp: role,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["camp-team", campId] });
      notifications.show({
        title: "Team member added",
        message: "They are on this camp's team.",
        color: "success",
      });
      backToCamp();
    },
  });

  return (
    <Stack>
      <PageHeader
        title="Add Team Member"
        subtitle={camp ? `${camp.camp_code} · ${camp.name}` : undefined}
        icon={<IconUserPlus size={20} stroke={1.5} />}
        actions={
          <Button tone="secondary" leftSection={<IconArrowLeft size={14} />} onClick={backToCamp}>
            Camp
          </Button>
        }
      />
      {campId ? (
        <Stack maw={480}>
          <EmployeeSearchSelect value={employeeId} onChange={setEmployeeId} required />
          <Select
            label="Role"
            data={CAMP_TEAM_ROLES}
            value={role}
            onChange={(v) => setRole(v ?? "volunteer")}
          />
          <Text size="xs" c="dimmed">
            The role decides which roster the camp board reads them from: a doctor is rostered to a
            department, everyone else to a counter.
          </Text>
          <Button
            tone="primary"
            onClick={() => addMember.mutate()}
            loading={addMember.isPending}
            disabled={!employeeId}
          >
            Add
          </Button>
        </Stack>
      ) : (
        <Alert tone="warning">Camp id is missing from the route.</Alert>
      )}
    </Stack>
  );
}
