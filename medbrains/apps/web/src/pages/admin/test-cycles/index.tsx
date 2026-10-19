/**
 * Test cycles (#4804): whoever runs testing opens a cycle ("Pre go-live
 * round 1"), testers signed in as test_<role> record results in it from the
 * Test cases panel, and this page shows progress and every failure. One
 * cycle is open at a time; closing keeps its results.
 */
import { Group, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import { useHasPermission } from "@medbrains/stores";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Button, Card, Input, Select, toast } from "@/components/ui";
import { useRequirePermission } from "@/hooks/useRequirePermission";
import { CycleProgress } from "./CycleProgress";

export function TestCyclesPage() {
  useRequirePermission(P.QA.TEST_CYCLES_MANAGE);
  const canManage = useHasPermission(P.QA.TEST_CYCLES_MANAGE);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string | null>(null);

  const cycles = useQuery({
    queryKey: ["qa-cycles"],
    queryFn: () => api.listTestCycles(),
    enabled: canManage,
  });
  const open = cycles.data?.find((c) => !c.closed_at) ?? null;
  const shown = cycles.data?.find((c) => c.id === picked) ?? open ?? cycles.data?.[0] ?? null;
  const results = useQuery({
    queryKey: ["qa-results", shown?.id],
    queryFn: () => api.listTestResults(shown?.id ?? ""),
    enabled: !!shown,
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["qa-cycles"] });
    void queryClient.invalidateQueries({ queryKey: ["qa-cycle"] });
  };
  const start = useMutation({
    mutationFn: () => api.openTestCycle(name),
    onSuccess: (c) => {
      refresh();
      setName("");
      setPicked(c.id);
      toast.success(`${c.name} is open — testers can record results.`, { title: "Test cycle" });
    },
  });
  const close = useMutation({
    mutationFn: (id: string) => api.closeTestCycle(id),
    onSuccess: () => {
      refresh();
      toast.success("Closed. Its results are kept.", { title: "Test cycle" });
    },
  });
  const failure = start.error ?? close.error ?? cycles.error ?? results.error;

  return (
    <Stack gap="md">
      <PageHeader
        title="Test cycles"
        subtitle="Role testing rounds: testers record results from the Test cases panel while signed in as test_<role>."
      />
      {failure && (
        <Alert tone="danger" title="Something went wrong">
          {(failure as Error).message}
        </Alert>
      )}
      <Card withBorder padding="md">
        {open ? (
          <Group justify="space-between">
            <Text>
              Open: <strong>{open.name}</strong> since {new Date(open.opened_at).toLocaleString()}
            </Text>
            <Button
              tone="secondary"
              loading={close.isPending}
              onClick={() => close.mutate(open.id)}
            >
              Close cycle
            </Button>
          </Group>
        ) : (
          <form
            aria-label="Open a test cycle"
            onSubmit={(e) => {
              e.preventDefault();
              start.mutate();
            }}
          >
            <Group align="flex-end">
              <Input
                label="New cycle"
                placeholder="e.g. Pre go-live round 1"
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                w={320}
              />
              <Button
                type="submit"
                tone="primary"
                loading={start.isPending}
                disabled={name.trim().length < 3}
              >
                Open cycle
              </Button>
            </Group>
          </form>
        )}
      </Card>
      {(cycles.data?.length ?? 0) > 1 && (
        <Select
          label="Show cycle"
          w={320}
          value={shown?.id ?? null}
          onChange={setPicked}
          data={(cycles.data ?? []).map((c) => ({
            value: c.id,
            label: `${c.name}${c.closed_at ? " (closed)" : " (open)"}`,
          }))}
        />
      )}
      {shown ? (
        <CycleProgress cycleName={shown.name} results={results.data ?? []} />
      ) : (
        <Text c="dimmed">No test cycle yet. Open one to start a round of role testing.</Text>
      )}
    </Stack>
  );
}
