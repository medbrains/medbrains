/**
 * The tester's panel (#4804): shown only to test accounts (they hold
 * qa.test_cases.record; no built-in role does). Lists the signed-in role's
 * cases — this screen's first — and records Pass, Fail or Blocked in the open
 * test cycle. Shared test accounts: the person at the keyboard names themself.
 */
import { Affix, Group, Progress, Stack, Text } from "@mantine/core";
import { api } from "@medbrains/api";
import {
  useAuthStore,
  useHasPermission,
  useModuleStore,
  usePermissionStore,
} from "@medbrains/stores";
import { P, ROLE_TEMPLATES, type TestResultValue } from "@medbrains/types";
import { IconChecklist } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { Alert, Button, Input, Modal, SegmentedControl, toast } from "@/components/ui";
import { TestCaseCard } from "./TestCaseCard";
import { casesFor } from "./test-catalog";

type Filter = "screen" | "todo" | "failed" | "all";
const TESTER_KEY = "medbrains.tester-name";

function storedTester(): string {
  try {
    return localStorage.getItem(TESTER_KEY) ?? "";
  } catch {
    return "";
  }
}

export function TestCasesPanel() {
  const canRecord = useHasPermission(P.QA.TEST_CASES_RECORD);
  return canRecord ? <Panel /> : null;
}

function Panel() {
  const { t } = useTranslation("nav");
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role ?? "");
  const hasPermission = usePermissionStore((s) => s.hasPermission);
  const off = useModuleStore((s) => s.disabledModules);
  const [opened, setOpened] = useState(false);
  const [filter, setFilter] = useState<Filter>("screen");
  const [tester, setTester] = useState(storedTester);

  const cases = useMemo(
    () =>
      casesFor({ code: role, label: ROLE_TEMPLATES[role]?.label ?? role }, hasPermission, off, t),
    [role, hasPermission, off, t],
  );
  const cycle = useQuery({
    queryKey: ["qa-cycle"],
    queryFn: () => api.getOpenTestCycle(),
    enabled: opened,
  });
  const cycleId = cycle.data?.id;
  const results = useQuery({
    queryKey: ["qa-results", cycleId],
    queryFn: () => api.listTestResults(cycleId ?? ""),
    enabled: opened && !!cycleId,
  });
  const byCase = useMemo(
    () => new Map((results.data ?? []).map((r) => [r.case_id, r])),
    [results.data],
  );
  const save = useMutation({
    mutationFn: (v: { caseId: string; result: TestResultValue; note: string }) =>
      api.recordTestResult({
        case_id: v.caseId,
        result: v.result,
        note: v.note || null,
        tester_name: tester || null,
        screen_path: pathname,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["qa-results", cycleId] });
      toast.success("Result saved", { title: "Test cases" });
    },
    onError: (e: Error) => toast.error(e.message, { title: "Not saved" }),
  });

  const done = cases.filter((c) => byCase.has(c.id)).length;
  const shown = cases.filter((c) => {
    if (filter === "screen") return c.path === pathname || (!c.path && c.type === "Workflow");
    if (filter === "todo") return !byCase.has(c.id);
    if (filter === "failed") return byCase.get(c.id)?.result === "fail";
    return true;
  });

  return (
    <>
      {/* Bottom-left, clear of the help bubble. Affix, not a class: Mantine's Button sets position: relative, which
          beat the class's fixed and put 32px of scroll under every page. */}
      <Affix
        position={{ left: "var(--mantine-spacing-md)", bottom: "var(--mantine-spacing-md)" }}
        zIndex={200}
      >
        <Button
          tone="primary"
          size="sm"
          leftSection={<IconChecklist size={16} />}
          onClick={() => setOpened(true)}
        >
          Test cases
        </Button>
      </Affix>
      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={`Test cases — ${ROLE_TEMPLATES[role]?.label ?? role}`}
        fullScreen
      >
        <Stack gap="sm">
          {cycle.data === null && (
            <Alert tone="warning" title="No test cycle is open">
              You can read your cases, but results are saved only while a cycle is open. Ask whoever
              runs testing to open one.
            </Alert>
          )}
          {cycle.data && (
            <Text size="sm">
              Cycle: <strong>{cycle.data.name}</strong>
            </Text>
          )}
          <Input
            label="Your name"
            description="Test accounts are shared — your name goes with your results."
            value={tester}
            onChange={(e) => {
              setTester(e.currentTarget.value);
              try {
                localStorage.setItem(TESTER_KEY, e.currentTarget.value);
              } catch {
                // private window: the name is kept for this session only
              }
            }}
          />
          <Group justify="space-between">
            <Text size="sm">
              {done} of {cases.length} recorded
            </Text>
          </Group>
          <Progress
            value={cases.length ? (done / cases.length) * 100 : 0}
            aria-label="Cases recorded"
          />
          <SegmentedControl
            aria-label="Which cases"
            value={filter}
            onChange={(v) => setFilter(v as Filter)}
            data={[
              { value: "screen", label: "This screen" },
              { value: "todo", label: "To do" },
              { value: "failed", label: "Failed" },
              { value: "all", label: "All" },
            ]}
          />
          {shown.length === 0 && (
            <Text size="sm" c="dimmed">
              {filter === "screen" ? "No cases for this screen — try To do." : "Nothing here."}
            </Text>
          )}
          {shown.map((c) => (
            <TestCaseCard
              key={`${c.id}:${byCase.get(c.id)?.recorded_at ?? ""}`}
              testCase={c}
              result={byCase.get(c.id)}
              canRecord={!!cycleId}
              saving={save.isPending && save.variables?.caseId === c.id}
              onSave={(result, note) => save.mutate({ caseId: c.id, result, note })}
            />
          ))}
        </Stack>
      </Modal>
    </>
  );
}
