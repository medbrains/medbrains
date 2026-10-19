/**
 * One test case in the tester's panel (#4804): what to do, what should
 * happen, and the tester's answer. A fail or a block says why.
 */
import { Group, Stack, Text } from "@mantine/core";
import type { TestCaseResult, TestResultValue } from "@medbrains/types";
import { useState } from "react";
import { Badge, type BadgeTone, Button, Card, SegmentedControl, TextArea } from "@/components/ui";
import type { TestCase } from "./test-catalog";

interface TestCaseCardProps {
  testCase: TestCase;
  result: TestCaseResult | undefined;
  /** False when no cycle is open: answers cannot be recorded. */
  canRecord: boolean;
  saving: boolean;
  onSave: (result: TestResultValue, note: string) => void;
}

const TONE: Record<TestResultValue, BadgeTone> = {
  pass: "success",
  fail: "danger",
  blocked: "warning",
};
const LABEL: Record<TestResultValue, string> = { pass: "Pass", fail: "Fail", blocked: "Blocked" };

export function TestCaseCard({ testCase, result, canRecord, saving, onSave }: TestCaseCardProps) {
  const [choice, setChoice] = useState<TestResultValue | "">(result?.result ?? "");
  const [note, setNote] = useState(result?.note ?? "");
  const needsNote = choice === "fail" || choice === "blocked";
  const ready = choice !== "" && (!needsNote || note.trim().length >= 3);

  return (
    <Card withBorder padding="sm" aria-label={`Test case: ${testCase.title}`}>
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Text fw={600} size="sm">
            {testCase.title}
          </Text>
          {result ? (
            <Badge tone={TONE[result.result]}>{LABEL[result.result]}</Badge>
          ) : (
            <Badge tone="neutral">Not run</Badge>
          )}
        </Group>
        <Text size="xs" c="dimmed">
          {testCase.type} · {testCase.area}
        </Text>
        <Text size="sm">
          <strong>Do:</strong> {testCase.steps}
        </Text>
        <Text size="sm">
          <strong>Expect:</strong> {testCase.expected}
        </Text>
        {canRecord && (
          <>
            <SegmentedControl
              aria-label={`Result for ${testCase.title}`}
              size="xs"
              value={choice}
              onChange={(v) => setChoice(v as TestResultValue)}
              data={[
                { value: "pass", label: "Pass" },
                { value: "fail", label: "Fail" },
                { value: "blocked", label: "Blocked" },
              ]}
            />
            {needsNote && (
              <TextArea
                label="What happened"
                placeholder="What you saw instead, and where"
                autosize
                minRows={2}
                value={note}
                onChange={(e) => setNote(e.currentTarget.value)}
              />
            )}
            <Group justify="flex-end">
              <Button
                size="xs"
                tone="primary"
                disabled={!ready}
                loading={saving}
                onClick={() => choice && onSave(choice, note)}
              >
                Save result
              </Button>
            </Group>
          </>
        )}
        {result?.note && !canRecord && (
          <Text size="xs" c="dimmed">
            Note: {result.note}
          </Text>
        )}
      </Stack>
    </Card>
  );
}
