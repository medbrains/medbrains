import { Box, Group, Text, useMantineColorScheme } from "@mantine/core";
import { api } from "@medbrains/api";
import type { CounterDisplayState } from "@medbrains/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useEffectOnce } from "react-use";
import { Alert } from "@/components/ui";
import { playAlertSound } from "@/lib/alert-sound-player";
import { announcePaid, type VoiceLanguage } from "@/lib/board-voice";
import { Clock } from "@/pages/token-display";
import {
  CardView,
  IdleView,
  PaidView,
  QrView,
  ReconnectingView,
  SessionView,
} from "./CounterDisplayViews";
import classes from "./counter-display.module.scss";
import { announcePayment, viewOf } from "./display-machine";
import { useDisplayFeed } from "./useDisplayFeed";

/** Re-render on a clock while something on screen counts down or expires. */
function useNow(tickMs: number | null): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (tickMs === null) return;
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);
  return now;
}

interface CounterDisplayProps {
  /** The display's own device token, never a person's. */
  token: string;
}

/**
 * The customer display at a billing or pharmacy counter (#4883): idle with
 * the hospital's name, then the patient's payment as the cashier takes it,
 * the UPI QR, the card prompt, and "Paid ✓" with a chime and a spoken
 * thank-you. Opened at `/screen` on a tablet paired to the counter.
 */
export function CounterDisplay({ token }: CounterDisplayProps) {
  const { setColorScheme } = useMantineColorScheme();
  // Light on dark, whatever the tablet's browser last chose.
  useEffectOnce(() => setColorScheme("dark"));
  const [languages, setLanguages] = useState<VoiceLanguage[]>(["en"]);
  const announce = (state: CounterDisplayState) =>
    void announcePayment(state.amount_paise, {
      chime: () => playAlertSound("calm", { ignorePrefs: true }),
      speak: (rupees) => announcePaid(rupees, languages),
    });
  const { view, model, link } = useDisplayFeed(token, announce);

  // The counter speaks the languages its queue is set to speak.
  const voice = useQuery({
    queryKey: ["counter-display-voice", view?.station_id],
    queryFn: async () => {
      const config = await api.getBoardConfig({
        module: view?.station_type === "pharmacy_counter" ? "pharmacy" : "billing",
        scope: "station",
        scope_id: view?.station_id,
      });
      setLanguages(config.voice_languages);
      return config;
    },
    enabled: Boolean(view?.station_id),
    staleTime: 600_000,
  });

  // Tick only while something on screen counts down or is about to expire.
  const shown = viewOf(model, link, Date.now());
  const now = useNow(shown === "qr" || shown === "paid" ? 1_000 : null);
  const state = model.snapshot;
  // A browser will not play sound until the screen has been touched once.
  const [canSpeak, setCanSpeak] = useState(
    () => typeof navigator === "undefined" || (navigator.userActivation?.hasBeenActive ?? true),
  );
  useEffect(() => {
    if (canSpeak) return;
    const enable = () => setCanSpeak(true);
    window.addEventListener("pointerdown", enable, { once: true });
    window.addEventListener("keydown", enable, { once: true });
    return () => {
      window.removeEventListener("pointerdown", enable);
      window.removeEventListener("keydown", enable);
    };
  }, [canSpeak]);

  return (
    <Box
      component="main"
      className={classes.screen}
      bg="var(--mb-bg-canvas)"
      c="var(--mb-text-heading)"
      data-view={shown}
    >
      <Group justify="space-between" px="xl" py="md">
        <Text fz="1.25rem" fw={600}>
          {view ? `${view.hospital_name} · ${view.station_name}` : "MedBrains · Counter"}
        </Text>
        <Clock />
      </Group>
      {!canSpeak && (
        <Alert tone="warning" data-testid="cd-voice-blocked">
          Sound is off until someone taps this screen once.
        </Alert>
      )}
      {voice.isError && (
        <Alert tone="info">Could not read this counter&apos;s languages — speaking English.</Alert>
      )}
      <Box className={classes.body}>
        {shown === "reconnecting" && <ReconnectingView />}
        {shown === "idle" && <IdleView view={view} />}
        {shown === "session" && state && <SessionView state={state} />}
        {shown === "qr" && state && <QrView state={state} now={now} />}
        {shown === "card" && state && <CardView state={state} />}
        {shown === "paid" && model.paid && <PaidView state={model.paid} />}
      </Box>
    </Box>
  );
}
