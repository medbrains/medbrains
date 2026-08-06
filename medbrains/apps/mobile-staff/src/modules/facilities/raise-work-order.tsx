/**
 * Raise a work order standing in front of the fault.
 *
 * The action existed on the facilities home and did nothing. Faults are found
 * by whoever is in the room — a nurse who sees water under a sink, a porter who
 * finds a lift door sticking — and the round trip to a desktop is where the
 * report gets lost. Most of them are never raised at all; they get mentioned to
 * someone and forgotten.
 *
 * Priority defaults to medium rather than to nothing. A reporter who is not a
 * maintenance engineer should not have to grade the fault before it can be
 * recorded, and an unset priority would mean the ticket sorts below everything.
 */

import { COLORS, FormScrollView, MobileTextField, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useState } from "react";
import { View } from "react-native";
import { Button, HelperText, SegmentedButtons, Text } from "react-native-paper";
import { raiseWorkOrder } from "../../api/facilities.js";
import { ReferenceMenu } from "../../components/reference-menu.js";
import { ScreenHeader } from "../../components/screen-header.js";

/** Mirrors MAINTENANCE_CATEGORIES on the web work-orders tab so the two agree. */
const CATEGORIES = [
  { id: "plumbing", name: "Plumbing" },
  { id: "electrical", name: "Electrical" },
  { id: "hvac", name: "HVAC" },
  { id: "civil", name: "Civil" },
  { id: "carpentry", name: "Carpentry" },
  { id: "painting", name: "Painting" },
  { id: "fire_safety", name: "Fire safety" },
  { id: "elevator", name: "Elevator" },
  { id: "generator", name: "Generator / DG set" },
  { id: "medical_gas", name: "Medical gas" },
  { id: "water_treatment", name: "Water treatment" },
  { id: "other", name: "Other" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const MIN_DESCRIPTION = 10;

export function RaiseWorkOrderScreen(): ReactNode {
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raised, setRaised] = useState<string | null>(null);

  const descriptionError =
    touched && description.trim().length < MIN_DESCRIPTION
      ? "Say what is wrong and where — this is all the engineer gets before they arrive."
      : null;

  const submit = async () => {
    setTouched(true);
    if (description.trim().length < MIN_DESCRIPTION) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const order = await raiseWorkOrder({
        description: description.trim(),
        priority,
        category: category || undefined,
        notes: notes.trim() || undefined,
      });
      setRaised(order.work_order_number);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not raise the work order.");
    } finally {
      setBusy(false);
    }
  };

  if (raised) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
        <ScreenHeader eyebrow="FACILITIES" title="Work order raised" description={raised} />
        <View style={{ padding: SPACING.md, gap: SPACING.sm }}>
          <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
            Maintenance can see it now. Quote {raised} if you need to chase it.
          </Text>
          <Button
            mode="contained"
            onPress={() => {
              setRaised(null);
              setCategory("");
              setPriority("medium");
              setDescription("");
              setNotes("");
              setTouched(false);
            }}
            accessibilityLabel="Raise another work order"
          >
            Raise another
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="FACILITIES"
        title="Raise a work order"
        description="Reported against your name."
      />
      <FormScrollView>
        <MobileTextField
          label="What is wrong, and where"
          value={description}
          onChangeText={setDescription}
          onBlur={() => setTouched(true)}
          multiline
          numberOfLines={4}
          error={Boolean(descriptionError)}
        />
        <HelperText type="error" visible={Boolean(descriptionError)}>
          {descriptionError ?? " "}
        </HelperText>

        <ReferenceMenu
          title="Trade"
          rows={CATEGORIES}
          selectedId={category}
          label={(row) => row.name}
          placeholder="Pick a trade (optional)"
          onSelect={(row) => setCategory(row.id)}
          onClear={() => setCategory("")}
        />

        <Text variant="labelLarge" style={{ color: COLORS.ink, marginTop: SPACING.xs }}>
          How urgent
        </Text>
        <SegmentedButtons
          value={priority}
          onValueChange={setPriority}
          buttons={PRIORITIES.map((p) => ({
            value: p.value,
            label: p.label,
            accessibilityLabel: `Priority ${p.label}`,
          }))}
        />
        <Text variant="bodySmall" style={{ color: COLORS.brandDeep, opacity: 0.7 }}>
          Critical means it is unsafe or stopping clinical work right now.
        </Text>

        <MobileTextField
          label="Anything else (optional)"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        {error && (
          <HelperText type="error" visible accessibilityRole="alert">
            {error}
          </HelperText>
        )}

        <Button
          mode="contained"
          onPress={submit}
          loading={busy}
          disabled={busy}
          accessibilityLabel="Raise work order"
        >
          {busy ? "Raising…" : "Raise work order"}
        </Button>
      </FormScrollView>
    </View>
  );
}
