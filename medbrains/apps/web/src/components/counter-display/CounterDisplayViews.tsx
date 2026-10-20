import { Box, Group, Stack, Text, Title } from "@mantine/core";
import type { CounterCardStatus, CounterDisplayState, CounterDisplayView } from "@medbrains/types";
import { IconCircleCheck, IconCreditCard, IconWifiOff } from "@tabler/icons-react";
import { QRCodeSVG } from "qrcode.react";
import { Divider, Image } from "@/components/ui";
import classes from "./counter-display.module.scss";
import { countdown, rupeesFromPaise } from "./display-machine";

const TENDER_LABEL: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
  online: "Online",
  advance: "Advance deposit",
  credit: "On account",
  link: "Payment link",
};

const CARD_STATUS: Record<CounterCardStatus, string> = {
  waiting: "Waiting for the card",
  approved: "Card approved",
  declined: "Card declined — please try again or pay another way",
  timed_out: "The machine timed out — the cashier will try again",
  cancelled: "Card payment cancelled",
};

export function IdleView({ view }: { view: CounterDisplayView | undefined }) {
  return (
    <Stack
      align="center"
      justify="center"
      gap="lg"
      className={classes.centre}
      data-testid="cd-idle"
    >
      {view?.logo_url && <Image src={view.logo_url} alt="" h={120} w="auto" fit="contain" />}
      <Title order={1} fz="3.5rem" ta="center">
        {view?.hospital_name ?? "Welcome"}
      </Title>
      {view && (
        <Text fz="2rem" c="dimmed">
          {view.station_name}
        </Text>
      )}
    </Stack>
  );
}

export function SessionView({ state }: { state: CounterDisplayState }) {
  return (
    <Stack gap="xl" className={classes.session} data-testid="cd-session">
      {state.patient && (
        <Title order={1} fz="3rem">
          Hello, {state.patient}
        </Title>
      )}
      <Stack gap="sm">
        {state.lines.map((line) => (
          <Group key={line.label} justify="space-between" className={classes.line}>
            <Text fz="1.75rem">{line.label}</Text>
            <Text fz="1.75rem" ff="monospace">
              {rupeesFromPaise(line.amount_paise)}
            </Text>
          </Group>
        ))}
      </Stack>
      <Divider />
      <Group justify="space-between">
        <Text fz="2.25rem" fw={600}>
          Total due
        </Text>
        <Text fz="3.5rem" fw={700} ff="monospace" data-testid="cd-total">
          {rupeesFromPaise(state.total_due_paise)}
        </Text>
      </Group>
      {state.tender && (
        <Text fz="1.75rem" c="dimmed">
          Paying by {TENDER_LABEL[state.tender] ?? state.tender} ·{" "}
          {rupeesFromPaise(state.amount_paise)}
        </Text>
      )}
    </Stack>
  );
}

export function QrView({ state, now }: { state: CounterDisplayState; now: number }) {
  const qr = state.qr;
  const left = countdown(qr?.close_by ?? null, now);
  return (
    <Stack align="center" justify="center" gap="lg" className={classes.centre} data-testid="cd-qr">
      <Text fz="2rem">Scan with any UPI app to pay</Text>
      <Box>
        {qr?.image_url ? (
          <Image src={qr.image_url} alt="UPI QR code" w={420} h={420} fit="contain" />
        ) : (
          <QRCodeSVG value={qr?.upi_uri ?? ""} size={420} marginSize={2} title="UPI QR code" />
        )}
      </Box>
      <Text fz="4rem" fw={700} ff="monospace">
        {rupeesFromPaise(state.amount_paise)}
      </Text>
      {left && (
        <Text fz="1.5rem" c="dimmed" data-testid="cd-countdown">
          This code closes in {left}
        </Text>
      )}
    </Stack>
  );
}

export function CardView({ state }: { state: CounterDisplayState }) {
  return (
    <Stack
      align="center"
      justify="center"
      gap="lg"
      className={classes.centre}
      data-testid="cd-card"
    >
      <IconCreditCard size={160} stroke={1.25} aria-hidden />
      <Title order={1} fz="3rem" ta="center">
        Insert or tap your card on the machine
      </Title>
      <Text fz="4rem" fw={700} ff="monospace">
        {rupeesFromPaise(state.amount_paise)}
      </Text>
      <Text fz="1.75rem" c="dimmed" role="status">
        {CARD_STATUS[state.card_status ?? "waiting"]}
      </Text>
    </Stack>
  );
}

export function PaidView({ state }: { state: CounterDisplayState }) {
  return (
    <Stack
      align="center"
      justify="center"
      gap="lg"
      className={classes.centre}
      role="status"
      aria-live="assertive"
      data-testid="cd-paid"
    >
      <IconCircleCheck size={180} stroke={1.25} color="var(--mb-success)" aria-hidden />
      <Title order={1} fz="4.5rem" ta="center">
        Paid ✓ {rupeesFromPaise(state.amount_paise)}
      </Title>
      <Text fz="2.5rem">Thank you</Text>
      {state.change_paise ? (
        <Text fz="2.5rem" fw={600} data-testid="cd-change">
          Your change: {rupeesFromPaise(state.change_paise)}
        </Text>
      ) : null}
    </Stack>
  );
}

export function ReconnectingView() {
  return (
    <Stack
      align="center"
      justify="center"
      gap="lg"
      className={classes.centre}
      role="status"
      data-testid="cd-reconnecting"
    >
      <IconWifiOff size={120} stroke={1.25} aria-hidden />
      <Title order={1} fz="3rem">
        Reconnecting…
      </Title>
      <Text fz="1.75rem" c="dimmed">
        Please check the amount with the cashier.
      </Text>
    </Stack>
  );
}
