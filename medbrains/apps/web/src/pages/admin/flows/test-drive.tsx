/**
 * Test drive (RFC §11.2.6): one sample patient per route through the
 * draft, shown on the map — stepping station by station, or, with reduced
 * motion, the steps listed — then the last 30 days replayed, in sentences.
 */
import { Group, List, Stack, Text, UnstyledButton } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import type { FlowStation, FlowTestDrive } from "@medbrains/types";
import { IconPlayerPlay, IconPlayerStop, IconSteeringWheel } from "@tabler/icons-react";
import { useState } from "react";
import { useInterval } from "react-use";
import { Alert, Badge, Button, Card, Panel } from "@/components/ui";
import styles from "./builder.module.scss";

/** Productive motion: one station every 600 ms. */
const STEP_MS = 600;

export interface TestDriveProps {
  drive: FlowTestDrive | undefined;
  running: boolean;
  error: string | null;
  /** Why the test drive cannot run yet, or null. */
  blocked: string | null;
  stations: FlowStation[];
  onRun: () => void;
  /** Highlight these stations on the map; null clears it. */
  onShow: (keys: string[] | null) => void;
}

export function TestDrive({
  drive,
  running,
  error,
  blocked,
  stations,
  onRun,
  onShow,
}: TestDriveProps) {
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<number | null>(null);
  const [step, setStep] = useState<number | null>(null);
  const name = (k: string) => stations.find((s) => s.key === k)?.name ?? k;
  const sample = picked === null ? undefined : drive?.samples[picked];

  useInterval(
    () => {
      if (!sample || step === null) return;
      const next = step + 1;
      if (next >= sample.route.length) {
        setStep(null);
        onShow(sample.route);
        return;
      }
      setStep(next);
      onShow([sample.route[next] as string]);
    },
    step === null ? null : STEP_MS,
  );

  const choose = (i: number) => {
    setPicked(i);
    setStep(null);
    onShow(drive?.samples[i]?.route ?? null);
  };
  const play = () => {
    if (!sample) return;
    setStep(0);
    onShow([sample.route[0] as string]);
  };

  return (
    <Panel
      title="Test drive"
      description="Sample patients run through this draft, then the last 30 days are replayed. Nothing reaches a patient."
      actions={
        <Button
          tone="primary"
          size="xs"
          leftSection={<IconSteeringWheel size={16} />}
          loading={running}
          disabled={Boolean(blocked)}
          onClick={onRun}
        >
          Run test drive
        </Button>
      }
    >
      <Stack gap="sm">
        {blocked && (
          <Text size="sm" c="dimmed">
            {blocked}
          </Text>
        )}
        {error && (
          <Alert tone="danger" title="The test drive did not run">
            {error}
          </Alert>
        )}
        {drive && (
          <>
            <Text size="sm" fw={600}>
              {drive.samples.length} sample {drive.samples.length === 1 ? "patient" : "patients"},
              one per route
            </Text>
            <Stack gap="xs">
              {drive.samples.map((s, i) => (
                <UnstyledButton
                  key={s.label}
                  className={styles.block}
                  onClick={() => choose(i)}
                  aria-pressed={picked === i}
                >
                  <Card withBorder padding="xs">
                    <Group justify="space-between" wrap="nowrap">
                      <Text size="sm" fw={picked === i ? 700 : 500}>
                        {s.label}
                      </Text>
                      <Badge tone="neutral">{s.route.length} stops</Badge>
                    </Group>
                  </Card>
                </UnstyledButton>
              ))}
            </Stack>
            {sample && (
              <Stack gap="xs">
                {!reduce && (
                  <Group>
                    <Button
                      tone="secondary"
                      size="xs"
                      leftSection={
                        step === null ? <IconPlayerPlay size={16} /> : <IconPlayerStop size={16} />
                      }
                      onClick={step === null ? play : () => setStep(null)}
                    >
                      {step === null ? "Watch it move along the map" : "Stop"}
                    </Button>
                  </Group>
                )}
                <List type="ordered" size="sm" aria-label={`Route for ${sample.label}`}>
                  {sample.route.map((k, i) => (
                    <List.Item key={k} fw={step === i ? 700 : undefined}>
                      {name(k)}
                      {step === i ? " (here now)" : ""}
                    </List.Item>
                  ))}
                </List>
              </Stack>
            )}
            <Stack gap={4} aria-label="What-if replay">
              <Text size="sm" fw={600}>
                What-if replay
              </Text>
              {drive.replay.sentences.map((line) => (
                <Text key={line} size="sm">
                  {line}
                </Text>
              ))}
            </Stack>
          </>
        )}
      </Stack>
    </Panel>
  );
}
