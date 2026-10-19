/**
 * One test cycle's progress (#4804): per role, how many of its cases are
 * recorded and how they came out; then every failure with the tester's note.
 */
import { Stack, Text } from "@mantine/core";
import { useModuleStore } from "@medbrains/stores";
import { ROLE_TEMPLATES, type TestCaseResult } from "@medbrains/types";
import { IconDownload } from "@tabler/icons-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { casesFor, type TestCase } from "@/components/qa/test-catalog";
import { Badge, Button, Table } from "@/components/ui";

const ADMINS = new Set(["super_admin", "hospital_admin"]);

interface CycleProgressProps {
  cycleName: string;
  results: TestCaseResult[];
}

function csv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => `"${c.replaceAll('"', '""')}"`).join(",")).join("\n");
}

export function CycleProgress({ cycleName, results }: CycleProgressProps) {
  const { t } = useTranslation("nav");
  const off = useModuleStore((s) => s.disabledModules);
  const catalogue = useMemo(() => {
    const byRole = new Map<string, TestCase[]>();
    for (const [code, tpl] of Object.entries(ROLE_TEMPLATES)) {
      if (ADMINS.has(code)) continue;
      const granted = new Set(tpl.permissions);
      byRole.set(
        code,
        casesFor({ code, label: tpl.label }, (p) => granted.has(p), off, t),
      );
    }
    return byRole;
  }, [off, t]);
  const titles = useMemo(
    () => new Map([...catalogue.values()].flat().map((c) => [c.id, c.title])),
    [catalogue],
  );
  const rows = [...catalogue.entries()].map(([code, cases]) => {
    const ids = new Set(cases.map((c) => c.id));
    const mine = results.filter((r) => r.role === code && ids.has(r.case_id));
    const count = (v: string) => mine.filter((r) => r.result === v).length;
    return {
      code,
      label: ROLE_TEMPLATES[code]?.label ?? code,
      total: cases.length,
      pass: count("pass"),
      fail: count("fail"),
      blocked: count("blocked"),
    };
  });
  const problems = results.filter((r) => r.result !== "pass");

  const download = () => {
    const body = csv([
      ["Role", "Case", "Title", "Result", "Note", "Tester", "Account", "Screen", "Recorded"],
      ...results.map((r) => [
        ROLE_TEMPLATES[r.role]?.label ?? r.role,
        r.case_id,
        titles.get(r.case_id) ?? "",
        r.result,
        r.note ?? "",
        r.tester_name ?? "",
        r.recorded_by ?? "",
        r.screen_path ?? "",
        r.recorded_at,
      ]),
    ]);
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cycleName.replace(/[^\w-]+/g, "_")}-results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack gap="md">
      <Table aria-label="Progress by role">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Role</Table.Th>
            <Table.Th>Recorded</Table.Th>
            <Table.Th>Pass</Table.Th>
            <Table.Th>Fail</Table.Th>
            <Table.Th>Blocked</Table.Th>
            <Table.Th>Not run</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.code}>
              <Table.Td>{r.label}</Table.Td>
              <Table.Td>
                {r.pass + r.fail + r.blocked} of {r.total}
              </Table.Td>
              <Table.Td>{r.pass}</Table.Td>
              <Table.Td>{r.fail > 0 ? <Badge tone="danger">{r.fail}</Badge> : 0}</Table.Td>
              <Table.Td>{r.blocked > 0 ? <Badge tone="warning">{r.blocked}</Badge> : 0}</Table.Td>
              <Table.Td>{r.total - r.pass - r.fail - r.blocked}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Text fw={600}>Failures and blocks ({problems.length})</Text>
      {problems.length === 0 ? (
        <Text size="sm" c="dimmed">
          None recorded.
        </Text>
      ) : (
        <Table aria-label="Failures and blocks">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Role</Table.Th>
              <Table.Th>Case</Table.Th>
              <Table.Th>Result</Table.Th>
              <Table.Th>What happened</Table.Th>
              <Table.Th>Who / when</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {problems.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>{ROLE_TEMPLATES[r.role]?.label ?? r.role}</Table.Td>
                <Table.Td>{titles.get(r.case_id) ?? r.case_id}</Table.Td>
                <Table.Td>
                  <Badge tone={r.result === "fail" ? "danger" : "warning"}>{r.result}</Badge>
                </Table.Td>
                <Table.Td>{r.note}</Table.Td>
                <Table.Td>
                  {r.tester_name ?? r.recorded_by} · {new Date(r.recorded_at).toLocaleString()}
                  {r.screen_path ? ` · ${r.screen_path}` : ""}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      <Button
        tone="secondary"
        leftSection={<IconDownload size={16} />}
        onClick={download}
        disabled={results.length === 0}
        style={{ alignSelf: "flex-start" }}
      >
        Download results (CSV)
      </Button>
    </Stack>
  );
}
