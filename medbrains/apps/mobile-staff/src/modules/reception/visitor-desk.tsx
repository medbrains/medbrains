/**
 * Reception → the visitor desk.
 *
 * The module home has advertised "Visitor passes — Issue, check-in, revoke"
 * with a permission on it and no screen behind it. The backend has had the
 * whole thing since the front-office module shipped: registrations, passes,
 * check-in and check-out, revocation with a reason.
 *
 * # Accessibility
 *
 * A reception desk is used one-handed, at speed, by whoever is on shift —
 * including staff using VoiceOver or a switch, and staff who cannot
 * distinguish the amber of an expiring pass from the green of a live one. So:
 * every control is a real button at 44px or more; every state is a word as
 * well as a colour; the list announces its own count; and each row names the
 * visitor in its label rather than leaving a screen reader to read "button".
 */

import {
  Badge,
  COLORS,
  EcgLoader,
  Empty,
  FormScrollView,
  MobileTextField,
  SPACING,
} from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { Button, HelperText, Text } from "react-native-paper";
import type { VisitorPass, VisitorRegistration } from "../../api/front-office.js";
import {
  checkInVisitor,
  checkOutVisitor,
  issuePass,
  listPasses,
  listVisitors,
  registerVisitor,
  revokePass,
} from "../../api/front-office.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useHasPermission } from "../../lib/permissions.js";
import { useFetch } from "../../lib/use-fetch.js";
import { activePasses, overduePasses } from "./visitor-passes.js";

/** WCAG 2.2 SC 2.5.8 and the mobile surface rules both put the floor at 44. */
const TAP_TARGET = 44;
const ROW_HEIGHT = 168;
/** A desk works today's passes. The building's history is not this screen. */
const PAGE_SIZE = 100;

export function VisitorDeskScreen(): ReactNode {
  const canIssue = useHasPermission("front_office.passes.create");
  const canRegister = useHasPermission("front_office.visitors.create");
  const [composing, setComposing] = useState(false);

  const passesQuery = useFetch(() => listPasses(), []);
  const visitorsQuery = useFetch(() => listVisitors(), []);

  const now = Date.now();
  const passes = useMemo(() => (passesQuery.data ?? []).slice(0, PAGE_SIZE), [passesQuery.data]);
  const live = useMemo(() => activePasses(passes, now), [passes, now]);
  const overdue = useMemo(() => overduePasses(passes, now), [passes, now]);

  const byRegistration = useMemo(() => {
    const index = new Map<string, VisitorRegistration>();
    for (const visitor of visitorsQuery.data ?? []) {
      index.set(visitor.id, visitor);
    }
    return index;
  }, [visitorsQuery.data]);

  const refetchAll = useCallback(() => {
    passesQuery.refetch();
    visitorsQuery.refetch();
  }, [passesQuery, visitorsQuery]);

  const renderItem = useCallback(
    ({ item }: { item: VisitorPass }) => (
      <PassRow
        canIssue={canIssue}
        nowMs={now}
        onChanged={refetchAll}
        pass={item}
        visitor={item.registration_id ? byRegistration.get(item.registration_id) : undefined}
      />
    ),
    [byRegistration, canIssue, now, refetchAll],
  );

  return (
    <View style={{ backgroundColor: COLORS.canvas, flex: 1 }}>
      <ScreenHeader
        testID="screen-visitor-desk"
        eyebrow="VISITOR DESK"
        title="Visitor passes"
        description="Issue a pass, check somebody in, and see who is still inside."
        trailing={
          overdue.length > 0 ? (
            <Badge label={`${overdue.length} overdue`} tone="alert" />
          ) : undefined
        }
      />

      {/* Announced as one sentence rather than three badges, so a screen
          reader gives the desk the shape of the shift in a single stop. */}
      <View
        accessibilityRole="summary"
        accessibilityLabel={`${live.length} passes valid now, ${overdue.length} past their end time.`}
        style={{ flexDirection: "row", gap: SPACING.sm, padding: SPACING.md }}
      >
        <Badge label={`${live.length} valid now`} tone="success" />
        <Badge
          label={`${overdue.length} past end time`}
          tone={overdue.length > 0 ? "alert" : "neutral"}
        />
      </View>

      {canRegister && (
        <View style={{ paddingHorizontal: SPACING.md }}>
          <Button
            accessibilityHint="Opens a form to register a visitor and issue their pass"
            accessibilityLabel="Register a visitor"
            mode="contained"
            onPress={() => setComposing((open) => !open)}
            style={{ justifyContent: "center", minHeight: TAP_TARGET }}
            testID="visitor-desk-register"
          >
            {composing ? "Cancel" : "Register a visitor"}
          </Button>
        </View>
      )}

      {/* While registering, the form is the screen. Two reasons, and the
          second is the one that matters: a desk is either working the list or
          taking somebody's details, and a form sharing a screen with a list it
          cannot scroll puts its own last field under the keyboard. */}
      {composing && canRegister ? (
        <RegisterVisitorForm
          canIssue={canIssue}
          onDone={() => {
            setComposing(false);
            refetchAll();
          }}
        />
      ) : null}

      {!composing && passesQuery.loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}

      {/* An unreadable list is not an empty one, and at a door the difference
          decides whether somebody is let through on trust. */}
      {!composing && !passesQuery.loading && passesQuery.error && (
        <Empty
          title="Couldn't load today's passes"
          description={`${passesQuery.error} — do not read this as nobody being inside; check the gate register.`}
          actionLabel="Try again"
          onAction={refetchAll}
        />
      )}

      {!composing && !passesQuery.loading && !passesQuery.error && passes.length === 0 && (
        <Empty title="No passes today" description="Nobody has been issued a visitor pass yet." />
      )}

      {!composing && !passesQuery.loading && !passesQuery.error && passes.length > 0 && (
        <FlatList
          accessibilityLabel={`${passes.length} visitor passes`}
          contentContainerStyle={{ gap: SPACING.sm, padding: SPACING.md }}
          data={passes}
          getItemLayout={itemLayout}
          initialNumToRender={8}
          keyExtractor={keyOf}
          removeClippedSubviews
          renderItem={renderItem}
          testID="visitor-pass-list"
          windowSize={5}
        />
      )}
    </View>
  );
}

function keyOf(pass: VisitorPass): string {
  return pass.id;
}

function itemLayout(_: unknown, index: number) {
  return { index, length: ROW_HEIGHT, offset: ROW_HEIGHT * index };
}

/** The state as a word. Colour repeats it; it never carries it alone. */
function passState(
  pass: VisitorPass,
  nowMs: number,
): { label: string; tone: "success" | "warn" | "alert" | "neutral" } {
  if (pass.status === "revoked") {
    return { label: "Revoked", tone: "neutral" };
  }
  if (pass.status !== "active") {
    return { label: "Closed", tone: "neutral" };
  }
  return Date.parse(pass.valid_until) <= nowMs
    ? { label: "Past end time", tone: "alert" }
    : { label: "Valid now", tone: "success" };
}

function PassRow({
  canIssue,
  nowMs,
  onChanged,
  pass,
  visitor,
}: {
  canIssue: boolean;
  nowMs: number;
  onChanged: () => void;
  pass: VisitorPass;
  visitor?: VisitorRegistration;
}): ReactNode {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const state = passState(pass, nowMs);
  const who = visitor?.visitor_name ?? "Visitor";

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      setFailure(null);
      try {
        await action();
        onChanged();
      } catch (err) {
        setFailure(err instanceof Error ? err.message : "That could not be recorded.");
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  return (
    <View
      accessibilityLabel={`${who}, pass ${pass.pass_number}, ${state.label}`}
      style={{
        backgroundColor: COLORS.panel,
        borderColor: COLORS.rule,
        borderWidth: 1,
        gap: SPACING.xs,
        padding: SPACING.md,
      }}
    >
      <View style={{ flexDirection: "row", gap: SPACING.sm, justifyContent: "space-between" }}>
        <Text variant="titleMedium" style={{ color: COLORS.ink }}>
          {who}
        </Text>
        <Badge label={state.label} tone={state.tone} />
      </View>
      <Text style={{ color: COLORS.muted, fontFamily: "JetBrainsMono-Regular" }}>
        {pass.pass_number}
        {pass.bed_number ? ` · BED ${pass.bed_number}` : ""}
      </Text>
      {visitor?.relationship ? (
        <Text style={{ color: COLORS.muted }}>{visitor.relationship}</Text>
      ) : null}

      {failure && (
        <HelperText type="error" visible accessibilityRole="alert">
          {failure}
        </HelperText>
      )}

      {canIssue && pass.status === "active" && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
          <Button
            accessibilityLabel={`Check ${who} in`}
            disabled={busy}
            mode="contained"
            onPress={() => run(() => checkInVisitor(pass.id))}
            style={{ justifyContent: "center", minHeight: TAP_TARGET }}
            testID="visitor-check-in"
          >
            Check in
          </Button>
          <Button
            accessibilityLabel={`Check ${who} out`}
            disabled={busy}
            mode="outlined"
            onPress={() => run(() => checkOutVisitor(pass.id))}
            style={{ justifyContent: "center", minHeight: TAP_TARGET }}
            testID="visitor-check-out"
          >
            Check out
          </Button>
          <Button
            accessibilityHint="Ends the pass. The reason is recorded."
            accessibilityLabel={`Revoke ${who}'s pass`}
            disabled={busy}
            mode="text"
            onPress={() => run(() => revokePass(pass.id, "Revoked at the desk"))}
            style={{ justifyContent: "center", minHeight: TAP_TARGET }}
            testID="visitor-revoke"
          >
            Revoke
          </Button>
        </View>
      )}
    </View>
  );
}

/**
 * Register a visitor and, in the same breath, issue their pass.
 *
 * Two records at the desk are one act at the door. Splitting them across two
 * screens is how a visitor ends up registered with no pass, standing in front
 * of somebody who now has to work out which of the two steps was missed.
 */
function RegisterVisitorForm({
  canIssue,
  onDone,
}: {
  canIssue: boolean;
  onDone: () => void;
}): ReactNode {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [bed, setBed] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const ready = name.trim().length > 0;

  const submit = useCallback(async () => {
    if (!ready) {
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const visitor = await registerVisitor({
        phone: phone.trim() || undefined,
        relationship: relationship.trim() || undefined,
        visitor_name: name.trim(),
      });
      if (canIssue) {
        await issuePass({
          bed_number: bed.trim() || undefined,
          registration_id: visitor.id,
        });
      }
      onDone();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "The visitor could not be registered.");
    } finally {
      setBusy(false);
    }
  }, [bed, canIssue, name, onDone, phone, ready, relationship]);

  return (
    <FormScrollView
      contentContainerStyle={{ gap: SPACING.sm, padding: SPACING.md }}
      testID="visitor-register-form"
    >
      <MobileTextField
        accessibilityLabel="Visitor's name"
        autoCapitalize="words"
        label="Visitor's name"
        onChangeText={setName}
        required
        testID="visitor-name"
        value={name}
      />
      <MobileTextField
        accessibilityLabel="Visitor's phone number"
        keyboardType="phone-pad"
        label="Phone"
        onChangeText={setPhone}
        testID="visitor-phone"
        value={phone}
      />
      <MobileTextField
        accessibilityLabel="Relationship to the patient"
        label="Relationship to the patient"
        onChangeText={setRelationship}
        testID="visitor-relationship"
        value={relationship}
      />
      <MobileTextField
        accessibilityLabel="Bed the visitor is going to"
        label="Bed"
        onChangeText={setBed}
        testID="visitor-bed"
        value={bed}
      />

      {failure && (
        <HelperText type="error" visible accessibilityRole="alert">
          {failure}
        </HelperText>
      )}

      <Button
        accessibilityHint={
          canIssue
            ? "Registers the visitor and issues their pass"
            : "Registers the visitor. Issuing a pass needs a different permission."
        }
        accessibilityLabel="Register the visitor"
        disabled={busy || !ready}
        loading={busy}
        mode="contained"
        onPress={submit}
        style={{ justifyContent: "center", minHeight: TAP_TARGET }}
        testID="visitor-register-submit"
      >
        {canIssue ? "Register and issue pass" : "Register visitor"}
      </Button>
    </FormScrollView>
  );
}
