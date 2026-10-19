// Draw one campus's fence: its location (typed, or taken from this device)
// and the radius within which staff count as on site.

import { zodResolver } from "@hookform/resolvers/zod";
import { Group, Stack, Text } from "@mantine/core";
import type { CampusFence } from "@medbrains/types";
import { IconCurrentLocation } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { formatDistance, readPunchFix } from "@/components/Nurse/shiftLocation";
import { Button, Modal, NumberField, toast } from "@/components/ui";
import { hrService } from "@/services/hr.service";

/** Same bounds the server enforces. */
const MIN_RADIUS_M = 25;
const MAX_RADIUS_M = 5000;
const SUGGESTED_RADIUS_M = 300;
const COORD_DECIMALS = 6;

const schema = z
  .object({
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    radius_m: z.number().int().min(MIN_RADIUS_M).max(MAX_RADIUS_M).nullable(),
  })
  .refine((v) => (v.latitude === null) === (v.longitude === null), {
    message: "Give both latitude and longitude, or neither.",
    path: ["longitude"],
  })
  .refine((v) => v.radius_m === null || v.latitude !== null, {
    message: "Set the campus location before its fence radius.",
    path: ["radius_m"],
  });

type FenceForm = z.infer<typeof schema>;

interface CampusFenceModalProps {
  campus: CampusFence;
  onClose: () => void;
}

function toNumber(v: string | number): number | null {
  return typeof v === "number" ? v : null;
}

export function CampusFenceModal({ campus, onClose }: CampusFenceModalProps) {
  const qc = useQueryClient();
  const [fixNote, setFixNote] = useState<string | null>(null);
  const form = useForm<FenceForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      latitude: campus.latitude,
      longitude: campus.longitude,
      radius_m: campus.geofence_radius_m ?? (campus.latitude === null ? null : SUGGESTED_RADIUS_M),
    },
  });

  const save = useMutation({
    mutationFn: (v: FenceForm) => hrService.setCampusFence(campus.id, v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hr-geofence"] });
      toast.success(`${campus.name} saved`, { title: "Geofence" });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message, { title: "Geofence not saved" }),
  });

  const locate = useMutation({
    mutationFn: () => readPunchFix(globalThis.navigator?.geolocation),
    onSuccess: (out) => {
      if (!out.fix) {
        setFixNote(
          out.reason === "denied"
            ? "Location access is blocked for this site in your browser."
            : "This device could not find its location. Enter it instead.",
        );
        return;
      }
      const round = (n: number) => Number(n.toFixed(COORD_DECIMALS));
      form.setValue("latitude", round(out.fix.latitude), { shouldValidate: true });
      form.setValue("longitude", round(out.fix.longitude), { shouldValidate: true });
      if (form.getValues("radius_m") === null) form.setValue("radius_m", SUGGESTED_RADIUS_M);
      setFixNote(`Accurate to about ${formatDistance(out.fix.accuracy_m)}.`);
    },
  });

  const field = (name: keyof FenceForm, label: string, description?: string) => (
    <Controller
      name={name}
      control={form.control}
      render={({ field: f, fieldState }) => (
        <NumberField
          label={label}
          description={description}
          value={f.value ?? ""}
          onChange={(v) => f.onChange(toNumber(v))}
          onBlur={f.onBlur}
          error={fieldState.error?.message}
          decimalScale={name === "radius_m" ? 0 : COORD_DECIMALS}
        />
      )}
    />
  );

  return (
    <Modal
      opened
      onClose={onClose}
      title={`Geofence · ${campus.name}`}
      primaryAction={{
        label: "Save",
        onClick: form.handleSubmit((v) => save.mutate(v)),
        loading: save.isPending,
      }}
      secondaryAction={{ label: "Cancel", onClick: onClose }}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-end">
          <Text size="sm" c="dimmed">
            Stand at the campus to take its location from this device.
          </Text>
          <Button
            tone="secondary"
            size="xs"
            leftSection={<IconCurrentLocation size={16} />}
            loading={locate.isPending}
            onClick={() => locate.mutate()}
          >
            Use my current location
          </Button>
        </Group>
        {fixNote && (
          <Text size="xs" c="dimmed" role="status">
            {fixNote}
          </Text>
        )}
        {field("latitude", "Latitude")}
        {field("longitude", "Longitude")}
        {field(
          "radius_m",
          "Fence radius (metres)",
          `${MIN_RADIUS_M}–${MAX_RADIUS_M} m. Leave empty for no fence at this campus.`,
        )}
      </Stack>
    </Modal>
  );
}
