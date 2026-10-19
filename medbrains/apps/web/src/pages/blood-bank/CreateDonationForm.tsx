import { Group, NumberInput, Select, Stack, Textarea, TextInput } from "@mantine/core";
import { isBloodPressureValid } from "@medbrains/schemas";
import type { CreateDonationRequest } from "@medbrains/types";
import { useState } from "react";
import { BloodPressureInput, type BloodPressureValue } from "@/components";
import { Alert, Button } from "@/components/ui";
import { donorVitalsRefusal } from "./donor-vitals";

export function CreateDonationForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: CreateDonationRequest) => void;
  loading: boolean;
}) {
  const [bagNumber, setBagNumber] = useState("");
  const [donationType, setDonationType] = useState<string | null>("whole_blood");
  const [volumeMl, setVolumeMl] = useState<number>(450);
  const [campName, setCampName] = useState("");
  const [notes, setNotes] = useState("");
  const [weightKg, setWeightKg] = useState<number | "">("");
  const [hemoglobin, setHemoglobin] = useState<number | "">("");
  const [platelets, setPlatelets] = useState<number | "">("");
  const [bp, setBp] = useState<BloodPressureValue>({});
  const [pulse, setPulse] = useState<number | undefined>();
  const [temperatureC, setTemperatureC] = useState<number | undefined>();
  const vitalsRefusal = donorVitalsRefusal({
    systolic: bp.systolic,
    diastolic: bp.diastolic,
    pulse,
    temperatureC,
  });
  const bpValid = isBloodPressureValid(bp.systolic, bp.diastolic);
  const isApheresis = donationType !== null && donationType !== "whole_blood";

  return (
    <Stack>
      <TextInput
        label="Bag Number"
        required
        value={bagNumber}
        onChange={(e) => setBagNumber(e.currentTarget.value)}
      />
      <Select
        label="Donation Type"
        data={[
          { value: "whole_blood", label: "Whole Blood" },
          { value: "apheresis_platelets", label: "Apheresis Platelets" },
          { value: "apheresis_plasma", label: "Apheresis Plasma" },
        ]}
        value={donationType}
        onChange={setDonationType}
      />
      <NumberInput
        label="Volume (ml)"
        value={volumeMl}
        onChange={(v) => setVolumeMl(Number(v))}
        min={50}
        max={600}
      />
      <Group grow>
        <NumberInput
          label="Weight today (kg)"
          description="45 kg for 350 ml, 55 kg for 450 ml, 50 kg for apheresis"
          required
          value={weightKg}
          onChange={(v) => setWeightKg(v === "" ? "" : Number(v))}
          min={0}
          max={250}
          decimalScale={1}
        />
        <NumberInput
          label="Haemoglobin today (g/dL)"
          description="At least 12.5 g/dL"
          required
          value={hemoglobin}
          onChange={(v) => setHemoglobin(v === "" ? "" : Number(v))}
          min={0}
          max={25}
          decimalScale={1}
        />
      </Group>
      <BloodPressureInput label="Blood pressure today" value={bp} onChange={setBp} />
      <Group grow>
        <NumberInput
          label="Pulse today (/min)"
          description="60–100, regular"
          required
          value={pulse ?? ""}
          onChange={(v) => setPulse(typeof v === "number" ? v : undefined)}
          min={20}
          max={300}
          allowDecimal={false}
        />
        <NumberInput
          label="Temperature today (°C)"
          description="Afebrile, at most 37.5 °C"
          value={temperatureC ?? ""}
          onChange={(v) => setTemperatureC(typeof v === "number" ? v : undefined)}
          min={30}
          max={45}
          decimalScale={1}
        />
      </Group>
      {bpValid && vitalsRefusal && bp.systolic !== undefined && pulse !== undefined && (
        <Alert tone="danger" title="Donor must be deferred">
          {vitalsRefusal}
        </Alert>
      )}
      {isApheresis && (
        <NumberInput
          label="Platelet count (×10⁹/L)"
          description="At least 150 before apheresis; at most 2 apheresis donations a week, 24 a year"
          required
          value={platelets}
          onChange={(v) => setPlatelets(v === "" ? "" : Number(v))}
          min={0}
          max={1500}
        />
      )}
      <TextInput
        label="Camp Name"
        value={campName}
        onChange={(e) => setCampName(e.currentTarget.value)}
      />
      <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
      <Button
        tone="primary"
        onClick={() => {
          if (!bagNumber || weightKg === "" || hemoglobin === "") return;
          if (isApheresis && platelets === "") return;
          if (!bpValid || vitalsRefusal) return;
          onSubmit({
            bag_number: bagNumber,
            donation_type: (donationType as CreateDonationRequest["donation_type"]) ?? undefined,
            volume_ml: volumeMl,
            camp_name: campName || undefined,
            notes: notes || undefined,
            weight_kg: weightKg,
            hemoglobin_g_dl: hemoglobin,
            platelet_count: isApheresis && platelets !== "" ? platelets : undefined,
            systolic_bp: bp.systolic,
            diastolic_bp: bp.diastolic,
            pulse,
            temperature_c: temperatureC,
          });
        }}
        disabled={!bpValid || vitalsRefusal !== null}
        loading={loading}
      >
        Record Donation
      </Button>
    </Stack>
  );
}
