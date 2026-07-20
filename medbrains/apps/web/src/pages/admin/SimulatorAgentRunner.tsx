import { Box, Card, Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import type { SimulatorAgentProfile, SimulatorProfile } from "@medbrains/types";
import { IconRobot } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Button, MultiSelect, NumberField, Slider, Switch, TextArea } from "@/components/ui";
import { toast } from "@/components/ui/toast";

/** Locales the agent can drive the API in (mirrors the app's i18n set). */
const LOCALES: Array<{ value: string; label: string }> = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "ta", label: "Tamil" },
  { value: "ar", label: "Arabic" },
];

/** A minimal profile carrying the agent block — scripted fields are ignored
 *  server-side when `agent.enabled`, but the type requires them. */
function agentProfile(agent: SimulatorAgentProfile): SimulatorProfile {
  return {
    patients: 0,
    opd_pct: 0.9,
    er_pct: 0.1,
    branches: {
      lab_pct: 0.25,
      rad_pct: 0.15,
      ipd_escalation_pct: 0.1,
      rx_pct: 0.7,
      dispense_pct: 0.8,
    },
    er: { mlc_pct: 0.15, admit_pct: 0.3, triage_mix: { red: 0.1, yellow: 0.35, green: 0.55 } },
    approval_mode: "auto",
    agent,
  };
}

/** Factor-matrix builder — fans out Claude agents across roles × locales × goals. */
export function SimulatorAgentRunner() {
  const queryClient = useQueryClient();
  const [roles, setRoles] = useState<string[]>([]);
  const [locales, setLocales] = useState<string[]>(["en"]);
  const [goalsText, setGoalsText] = useState("");
  const [fleet, setFleet] = useState<number | string>(1);
  const [generations, setGenerations] = useState<number | string>(1);
  const [chaos, setChaos] = useState(15);
  const [autonomous, setAutonomous] = useState(false);
  const [hospitalOpd, setHospitalOpd] = useState<number | string>(200);
  const [sweepAll, setSweepAll] = useState(false);

  const { data: roleOptions = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: () => api.listRoles(),
  });

  const run = useMutation({
    mutationFn: async () => {
      const goals = goalsText
        .split("\n")
        .map((g) => g.trim())
        .filter(Boolean);
      const agent: SimulatorAgentProfile = {
        enabled: true,
        roles,
        departments: [],
        locales,
        goals,
        fleet_size: Number(fleet) || 1,
        chaos: (Number(chaos) || 0) / 100,
        generations_cap: Number(generations) || 1,
        auto_census: autonomous,
        hospital_daily_opd: Number(hospitalOpd) || 200,
        verify: true,
        sweep: sweepAll,
      };
      const schedule = await api.createSimulatorSchedule({
        name: autonomous ? "Autonomous agent sim (census-paced)" : "Agent simulation",
        description: autonomous
          ? "Self-running agents at real-hospital volume — no human trigger"
          : "LLM agents driving the live API as real roles",
        profile: agentProfile(agent),
        enabled: autonomous,
      });
      // Autonomous: the census pacer drives it on the 30s tick — no run-now.
      // One-off: kick it immediately.
      return autonomous ? schedule : api.runSimulatorNow(schedule.id);
    },
    onSuccess: () => {
      toast.success(
        autonomous
          ? "Autonomous simulation enabled — agents will run themselves at hospital volume."
          : "Agents are exploring the app…",
        { title: autonomous ? "Enabled" : "Started" },
      );
      void queryClient.invalidateQueries({ queryKey: ["simulator-runs"] });
    },
    onError: (err: Error) => toast.error(err.message, { title: "Could not start agent run" }),
  });

  const roleData = roleOptions.map((r) => ({ value: r.code, label: r.name }));

  return (
    <Card withBorder padding="lg">
      <Stack gap="md">
        <Box>
          <Text fw={600}>AI agent exploration</Text>
          <Text size="sm" c="dimmed">
            Claude agents log in as real roles and drive the live app, recording what they cannot do
            or find confusing. Findings appear on each run below.
          </Text>
        </Box>

        <Group grow align="flex-start">
          <MultiSelect
            label="Roles"
            placeholder="Pick roles to simulate"
            data={roleData}
            value={roles}
            onChange={setRoles}
            searchable
          />
          <MultiSelect label="Locales" data={LOCALES} value={locales} onChange={setLocales} />
        </Group>

        <TextArea
          label="Goals"
          description="One goal per line. Leave blank for a sensible default."
          value={goalsText}
          onChange={(e) => setGoalsText(e.currentTarget.value)}
          autosize
          minRows={2}
          placeholder={
            "Register a walk-in with fever and route to a doctor\nAdmit an ER patient after triage"
          }
        />

        <Group grow align="flex-end">
          <NumberField label="Agents per cell" value={fleet} onChange={setFleet} min={1} max={10} />
          <NumberField
            label="Self-improving generations"
            description="Each re-runs primed by the last; stops when nothing new is found."
            value={generations}
            onChange={setGenerations}
            min={1}
            max={5}
          />
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Chaos: {chaos}%
            </Text>
            <Slider value={chaos} onChange={setChaos} min={0} max={100} step={5} />
            <Text size="xs" c="dimmed">
              How often agents deliberately fumble, to find error paths.
            </Text>
          </Stack>
        </Group>

        <Box>
          <Switch
            label="Autonomous — run continuously at real-hospital volume"
            description="No cron, no clicking. The scheduler paces agent runs to today's census (hour-of-day × season), full volume."
            checked={autonomous}
            onChange={(e) => setAutonomous(e.currentTarget.checked)}
          />
          {autonomous ? (
            <NumberField
              label="Hospital size (expected OPD patients / day)"
              description="The pacer scales the daily volume and its hour-by-hour shape from this."
              value={hospitalOpd}
              onChange={setHospitalOpd}
              min={1}
              max={5000}
              w={320}
              mt="sm"
            />
          ) : null}
          <Switch
            mt="sm"
            label="Also sweep all endpoints for server errors"
            description="Per role, GET every list endpoint across all 300+ module routes and flag 5xx. No LLM cost."
            checked={sweepAll}
            onChange={(e) => setSweepAll(e.currentTarget.checked)}
          />
        </Box>

        {roles.length === 0 && (
          <Alert tone="warning" title="Pick at least one role">
            Agents run as a role — choose the roles to fan out over.
          </Alert>
        )}

        <Group justify="flex-end">
          <Button
            tone="primary"
            leftSection={<IconRobot size={16} />}
            onClick={() => run.mutate()}
            loading={run.isPending}
            disabled={roles.length === 0}
          >
            {autonomous ? "Enable autonomous runs" : "Run once now"}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
