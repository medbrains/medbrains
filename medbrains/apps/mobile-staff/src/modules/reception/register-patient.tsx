/**
 * Reception → register a new patient. Minimal handheld form: name,
 * gender, phone. The full registration screen lives on the web app;
 * mobile reception is a fast-path for walk-ins where the rest of
 * the demographics get captured later at the kiosk.
 */

import { useState } from "react";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Button, HelperText, SegmentedButtons, TextInput } from "react-native-paper";
import { COLORS, SPACING } from "@medbrains/ui-mobile";
import { createPatient } from "../../api/patients.js";
import type { CreatePatientPayload } from "../../api/patients.js";
import { useModuleRouter } from "../../components/module-router.js";
import { ScreenHeader } from "../../components/screen-header.js";

export function RegisterPatientScreen(): ReactNode {
  const router = useModuleRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const payload: CreatePatientPayload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        gender,
        phone: phone.trim() || undefined,
        date_of_birth: dob.trim() || undefined,
      };
      const created = await createPatient(payload);
      router.replace("patient-detail", created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  const valid = firstName.trim().length > 0 && lastName.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="RECEPTION"
        title="Register patient"
        description="Walk-in fast path. Capture only the essentials; demographics finish at kiosk."
      />
      <View style={{ padding: SPACING.md, gap: SPACING.sm }}>
        <TextInput
          mode="outlined"
          label="First name"
          value={firstName}
          onChangeText={setFirstName}
        />
        <TextInput
          mode="outlined"
          label="Last name"
          value={lastName}
          onChangeText={setLastName}
        />
        <SegmentedButtons
          value={gender}
          onValueChange={(v) => setGender(v as "male" | "female" | "other")}
          buttons={[
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
            { value: "other", label: "Other" },
          ]}
        />
        <TextInput
          mode="outlined"
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          mode="outlined"
          label="Date of birth (YYYY-MM-DD)"
          value={dob}
          onChangeText={setDob}
          autoCapitalize="none"
        />
        {error && (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        )}
        <Button
          mode="contained"
          loading={busy}
          disabled={!valid || busy}
          onPress={submit}
        >
          Register patient
        </Button>
        <Button mode="outlined" onPress={router.pop} disabled={busy}>
          Cancel
        </Button>
      </View>
    </View>
  );
}
