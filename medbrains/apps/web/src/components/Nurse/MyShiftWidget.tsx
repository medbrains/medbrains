import { Group, Menu, Text } from "@mantine/core";
import type { FatigueFlag, MyShiftResponse } from "@medbrains/types";
import {
  IconAlertTriangle,
  IconChevronDown,
  IconClockPause,
  IconClockPlay,
  IconMapPin,
  IconPlayerStop,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useEffectOnce } from "react-use";
import { Badge, Button, toast } from "@/components/ui";
import { hrService } from "@/services/hr.service";
import { FatigueAckModal } from "./FatigueAckModal";
import { describePunch, isGeofenceRefusal, readPunchFix } from "./shiftLocation";

const QK = ["my-shift"];

async function currentFix() {
  return (await readPunchFix(globalThis.navigator?.geolocation)).fix;
}

/** Say where an off-site or unlocated punch was made; on site needs no toast. */
function notePunch(resp: MyShiftResponse, title: string) {
  const state = describePunch(resp.punch);
  if (state?.tone === "warning") {
    toast.warning(`${state.label}. HR will see this punch flagged.`, { title });
  }
}

/** A blocked punch stays on screen until read: it says what to do next. */
function onPunchError(e: Error, title: string) {
  if (isGeofenceRefusal(e)) {
    toast.error(e.message, { title, autoClose: false });
  } else {
    toast.error(e.message, { title: "Shift" });
  }
}

function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function remainingLabel(endIso: string, now: number): { text: string; over: boolean } {
  const mins = Math.round((new Date(endIso).getTime() - now) / 60000);
  if (mins <= 0) return { text: `${-mins}m over`, over: true };
  const h = Math.floor(mins / 60);
  return { text: h > 0 ? `${h}h${mins % 60}m left` : `${mins}m left`, over: false };
}

/**
 * Navbar shift control — start / extend / pause / resume / end the staff
 * member's shift, always surfacing the shift end time + time remaining, with
 * an advisory fatigue check. Hidden for accounts with no linked employee.
 */
export function MyShiftWidget() {
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [ackFlags, setAckFlags] = useState<FatigueFlag[] | null>(null);

  useEffectOnce(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  });

  const { data, isError } = useQuery({
    queryKey: QK,
    queryFn: () => hrService.getMyShift(),
    retry: false,
    refetchOnWindowFocus: true,
  });

  const apply = (resp: MyShiftResponse) => {
    qc.setQueryData(QK, resp);
    if (resp.fatigue.flags.length > 0 && !resp.fatigue.acknowledged) {
      setAckFlags(resp.fatigue.flags);
    }
  };
  const onErr = (e: Error) => toast.error(e.message, { title: "Shift" });

  const start = useMutation({
    mutationFn: async () => hrService.startShift(await currentFix()),
    onSuccess: (resp) => {
      apply(resp);
      notePunch(resp, "Shift started");
    },
    onError: (e: Error) => onPunchError(e, "Shift not started"),
  });
  const extend = useMutation({
    mutationFn: (hours: number) => hrService.extendShift({ hours }),
    onSuccess: apply,
    onError: onErr,
  });
  const pause = useMutation({
    mutationFn: () => hrService.pauseShift(),
    onSuccess: apply,
    onError: onErr,
  });
  const resume = useMutation({
    mutationFn: () => hrService.resumeShift(),
    onSuccess: apply,
    onError: onErr,
  });
  const end = useMutation({
    mutationFn: async () => hrService.endShift(await currentFix()),
    onSuccess: (resp) => {
      apply(resp);
      notePunch(resp, "Shift ended");
      toast.info("Shift ended — complete any pending patient handoffs before you leave.", {
        title: "Handover",
      });
    },
    onError: (e: Error) => onPunchError(e, "Shift not ended"),
  });
  const ack = useMutation({
    mutationFn: (reason: string) => hrService.acknowledgeFatigue({ reason }),
    onSuccess: (resp) => {
      qc.setQueryData(QK, resp);
      setAckFlags(null);
    },
    onError: onErr,
  });

  // null = no employee record linked (e.g. super_admin) → no shift to clock.
  if (isError || !data) return null;

  const session = data.session;
  const fatigued = data.fatigue.flags.length > 0 && !data.fatigue.acknowledged;
  const busy =
    start.isPending || extend.isPending || pause.isPending || resume.isPending || end.isPending;

  // Off duty: offer to start.
  if (!session || session.session_status === "off" || session.session_status === "ended") {
    const sched = data.scheduled;
    const window =
      sched?.start_time && sched.end_time ? ` · ${sched.start_time}–${sched.end_time}` : "";
    return (
      <Button
        size="xs"
        tone="secondary"
        leftSection={<IconClockPlay size={14} />}
        style={{ flexShrink: 0 }}
        loading={start.isPending}
        onClick={() => start.mutate()}
      >
        {sched ? `Start ${sched.shift_type} shift${window}` : "Start shift"}
      </Button>
    );
  }

  const paused = session.session_status === "paused";
  const endIso = session.extended_until ?? session.planned_end;
  const rem = endIso ? remainingLabel(endIso, now) : null;

  const tone = fatigued ? "danger" : paused ? "secondary" : "primary";
  const punchState = describePunch(session.check_in_location);

  return (
    <>
      <Menu position="bottom-end" shadow="md" width={260}>
        <Menu.Target>
          <Button size="xs" tone={tone} rightSection={<IconChevronDown size={13} />} loading={busy}>
            <Group gap={6} wrap="nowrap">
              {fatigued && <IconAlertTriangle size={13} />}
              <Text size="xs" fw={600}>
                {paused ? "Paused" : "On shift"}
                {endIso ? ` · ends ${hhmm(endIso)}` : ""}
                {rem ? ` · ${rem.text}` : ""}
              </Text>
            </Group>
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          {punchState && (
            <>
              <Menu.Label>Clocked in</Menu.Label>
              <Group gap={6} px="sm" pb="xs" wrap="nowrap">
                <IconMapPin size={14} aria-hidden />
                <Badge size="sm" tone={punchState.tone}>
                  {punchState.label}
                </Badge>
              </Group>
              <Menu.Divider />
            </>
          )}
          {fatigued && (
            <>
              <Menu.Item
                color="red"
                leftSection={<IconAlertTriangle size={14} />}
                onClick={() => setAckFlags(data.fatigue.flags)}
              >
                Fatigue warning
              </Menu.Item>
              <Menu.Divider />
            </>
          )}
          {!paused && (
            <>
              <Menu.Label>Extend</Menu.Label>
              <Menu.Item onClick={() => extend.mutate(1)}>+1 hour</Menu.Item>
              <Menu.Item onClick={() => extend.mutate(2)}>+2 hours</Menu.Item>
              <Menu.Item onClick={() => extend.mutate(4)}>+4 hours</Menu.Item>
              <Menu.Divider />
            </>
          )}
          {paused ? (
            <Menu.Item leftSection={<IconClockPlay size={14} />} onClick={() => resume.mutate()}>
              Resume shift
            </Menu.Item>
          ) : (
            <Menu.Item leftSection={<IconClockPause size={14} />} onClick={() => pause.mutate()}>
              Pause (break)
            </Menu.Item>
          )}
          <Menu.Item
            color="red"
            leftSection={<IconPlayerStop size={14} />}
            onClick={() => end.mutate()}
          >
            End shift
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <FatigueAckModal
        opened={ackFlags !== null}
        onClose={() => setAckFlags(null)}
        flags={ackFlags ?? []}
        busy={ack.isPending}
        onAcknowledge={(reason) => ack.mutate(reason)}
      />
    </>
  );
}
