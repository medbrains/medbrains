// The signed-in person's alert sounds: mute calm and attention, turn urgent
// down (never off). Saved in this browser per person; applies at once.

import { Group, Stack, Text } from "@mantine/core";
import { useAuthStore } from "@medbrains/stores";
import { IconPlayerPlay } from "@tabler/icons-react";
import { Button, Card, Slider, Switch } from "@/components/ui";
import { playAlertSound } from "@/lib/alert-sound-player";
import { DEFAULT_ALERT_SOUND_PREFS, useAlertSoundPrefsStore } from "@/lib/alert-sound-prefs";
import { type AlertSound, URGENT_VOLUME_FLOOR } from "@/lib/alert-sounds";

const PERCENT = 100;

function PreviewButton({ sound, label }: { sound: AlertSound; label: string }) {
  return (
    <Button
      tone="ghost"
      size="xs"
      leftSection={<IconPlayerPlay size={16} />}
      aria-label={`Play the ${label} sound`}
      onClick={() => void playAlertSound(sound, { ignorePrefs: true })}
    >
      Play
    </Button>
  );
}

export function AlertSoundsCard() {
  const userId = useAuthStore((state) => state.user?.id);
  const saved = useAlertSoundPrefsStore((state) => (userId ? state.byUser[userId] : undefined));
  const setPrefs = useAlertSoundPrefsStore((state) => state.setPrefs);
  if (!userId) return null;
  const prefs = { ...DEFAULT_ALERT_SOUND_PREFS, ...saved };

  return (
    <Card withBorder padding="lg" data-testid="alert-sounds-card">
      <Text fw={600}>Alert sounds</Text>
      <Text size="sm" c="dimmed" mb="md">
        Sounds for new notifications on this device. Urgent alerts (critical values and emergency
        codes) always sound.
      </Text>
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap">
          <Switch
            label="Calm: information and token calls"
            checked={!prefs.muteCalm}
            onChange={(event) => setPrefs(userId, { muteCalm: !event.currentTarget.checked })}
          />
          <PreviewButton sound="calm" label="calm" />
        </Group>
        <Group justify="space-between" wrap="nowrap">
          <Switch
            label="Attention: new notifications and results ready"
            checked={!prefs.muteAttention}
            onChange={(event) => setPrefs(userId, { muteAttention: !event.currentTarget.checked })}
          />
          <PreviewButton sound="attention" label="attention" />
        </Group>
        <Stack gap={4}>
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm" id="urgent-volume-label">
              Urgent volume (cannot be turned off)
            </Text>
            <PreviewButton sound="urgent" label="urgent" />
          </Group>
          <Slider
            aria-labelledby="urgent-volume-label"
            thumbLabel="Urgent alert volume"
            min={URGENT_VOLUME_FLOOR * PERCENT}
            max={PERCENT}
            step={5}
            value={Math.round(Math.max(prefs.urgentVolume, URGENT_VOLUME_FLOOR) * PERCENT)}
            label={(value) => `${value}%`}
            onChange={(value) => setPrefs(userId, { urgentVolume: value / PERCENT })}
          />
        </Stack>
      </Stack>
    </Card>
  );
}
