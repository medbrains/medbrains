/**
 * Reception → the enquiry log.
 *
 * "Enquiry desk — Log enquiries + resolve" has been on the module home with a
 * permission on it and nothing behind it. The backend has had the log, the
 * create and the resolve since the front-office module shipped.
 *
 * # Accessibility
 *
 * The desk logs an enquiry while holding a phone in the other hand, so every
 * field is reachable and labelled, and the resolve control states what it will
 * do rather than relying on the row it sits in. Open and resolved are words
 * before they are colours.
 */

import { Badge, COLORS, EcgLoader, Empty, MobileTextField, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { Button, HelperText, Text } from "react-native-paper";
import type { FrontOfficeEnquiryLog } from "../../api/front-office.js";
import { listEnquiries, logEnquiry, resolveEnquiry } from "../../api/front-office.js";
import { ScreenHeader } from "../../components/screen-header.js";
import { useHasPermission } from "../../lib/permissions.js";
import { useFetch } from "../../lib/use-fetch.js";

/** WCAG 2.2 SC 2.5.8 and the mobile surface rules both put the floor at 44. */
const TAP_TARGET = 44;
const ROW_HEIGHT = 156;
const PAGE_SIZE = 100;

export function EnquiryDeskScreen(): ReactNode {
  const canLog = useHasPermission("front_office.enquiry.create");
  const [composing, setComposing] = useState(false);
  const { data, loading, error, refetch } = useFetch(() => listEnquiries(), []);

  const enquiries = useMemo(() => (data ?? []).slice(0, PAGE_SIZE), [data]);
  const open = useMemo(() => enquiries.filter((e) => !e.resolved).length, [enquiries]);

  const renderItem = useCallback(
    ({ item }: { item: FrontOfficeEnquiryLog }) => (
      <EnquiryRow canResolve={canLog} enquiry={item} onChanged={refetch} />
    ),
    [canLog, refetch],
  );

  return (
    <View style={{ backgroundColor: COLORS.canvas, flex: 1 }}>
      <ScreenHeader
        testID="screen-enquiry-desk"
        eyebrow="ENQUIRY DESK"
        title="Enquiries"
        description="What people asked, and what they were told."
        trailing={open > 0 ? <Badge label={`${open} open`} tone="warn" /> : undefined}
      />

      {canLog && (
        <View style={{ paddingHorizontal: SPACING.md, paddingTop: SPACING.md }}>
          <Button
            accessibilityHint="Opens a form to record a new enquiry"
            accessibilityLabel="Log an enquiry"
            mode="contained"
            onPress={() => setComposing((v) => !v)}
            style={{ justifyContent: "center", minHeight: TAP_TARGET }}
            testID="enquiry-log-open"
          >
            {composing ? "Cancel" : "Log an enquiry"}
          </Button>
        </View>
      )}

      {composing && canLog && (
        <LogEnquiryForm
          onDone={() => {
            setComposing(false);
            refetch();
          }}
        />
      )}

      {loading && (
        <View style={{ alignItems: "center", paddingVertical: SPACING.lg }}>
          <EcgLoader />
        </View>
      )}

      {!loading && error && (
        <Empty
          title="Couldn't load the enquiry log"
          description={`${error} — anything logged in the meantime is not lost, but it is not on this screen.`}
          actionLabel="Try again"
          onAction={refetch}
        />
      )}

      {!loading && !error && enquiries.length === 0 && (
        <Empty title="Nothing logged today" description="No enquiries have been recorded yet." />
      )}

      {!loading && !error && enquiries.length > 0 && (
        <FlatList
          accessibilityLabel={`${enquiries.length} enquiries, ${open} still open`}
          contentContainerStyle={{ gap: SPACING.sm, padding: SPACING.md }}
          data={enquiries}
          getItemLayout={itemLayout}
          initialNumToRender={8}
          keyExtractor={keyOf}
          removeClippedSubviews
          renderItem={renderItem}
          testID="enquiry-list"
          windowSize={5}
        />
      )}
    </View>
  );
}

function keyOf(enquiry: FrontOfficeEnquiryLog): string {
  return enquiry.id;
}

function itemLayout(_: unknown, index: number) {
  return { index, length: ROW_HEIGHT, offset: ROW_HEIGHT * index };
}

function EnquiryRow({
  canResolve,
  enquiry,
  onChanged,
}: {
  canResolve: boolean;
  enquiry: FrontOfficeEnquiryLog;
  onChanged: () => void;
}): ReactNode {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const who = enquiry.caller_name ?? "Caller";

  const submit = useCallback(async () => {
    if (answer.trim().length === 0) {
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await resolveEnquiry(enquiry.id, answer.trim());
      onChanged();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "That could not be recorded.");
    } finally {
      setBusy(false);
    }
  }, [answer, enquiry.id, onChanged]);

  return (
    <View
      accessibilityLabel={`${who}, ${enquiry.enquiry_type}, ${enquiry.resolved ? "resolved" : "open"}`}
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
        <Badge
          label={enquiry.resolved ? "Resolved" : "Open"}
          tone={enquiry.resolved ? "success" : "warn"}
        />
      </View>
      <Text style={{ color: COLORS.ink }}>{enquiry.enquiry_type}</Text>
      {enquiry.caller_phone ? (
        <Text style={{ color: COLORS.muted, fontFamily: "JetBrainsMono-Regular" }}>
          {enquiry.caller_phone}
        </Text>
      ) : null}
      {enquiry.response_text ? (
        <Text style={{ color: COLORS.muted }}>{enquiry.response_text}</Text>
      ) : null}

      {failure && (
        <HelperText type="error" visible accessibilityRole="alert">
          {failure}
        </HelperText>
      )}

      {canResolve && !enquiry.resolved && (
        <View style={{ gap: SPACING.sm }}>
          <MobileTextField
            accessibilityLabel={`What ${who} was told`}
            label="What they were told"
            multiline
            onChangeText={setAnswer}
            testID="enquiry-answer"
            value={answer}
          />
          <Button
            accessibilityHint="Records the answer and closes this enquiry"
            accessibilityLabel={`Resolve the enquiry from ${who}`}
            disabled={busy || answer.trim().length === 0}
            loading={busy}
            mode="contained"
            onPress={submit}
            style={{ justifyContent: "center", minHeight: TAP_TARGET }}
            testID="enquiry-resolve"
          >
            Resolve
          </Button>
        </View>
      )}
    </View>
  );
}

function LogEnquiryForm({ onDone }: { onDone: () => void }): ReactNode {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [what, setWhat] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const ready = what.trim().length > 0;

  const submit = useCallback(async () => {
    if (!ready) {
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await logEnquiry({
        caller_name: name.trim() || undefined,
        caller_phone: phone.trim() || undefined,
        enquiry_type: what.trim(),
      });
      onDone();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "The enquiry could not be logged.");
    } finally {
      setBusy(false);
    }
  }, [name, onDone, phone, ready, what]);

  return (
    <View style={{ gap: SPACING.sm, padding: SPACING.md }} testID="enquiry-log-form">
      <MobileTextField
        accessibilityLabel="What was asked"
        label="What was asked"
        onChangeText={setWhat}
        required
        testID="enquiry-what"
        value={what}
      />
      <MobileTextField
        accessibilityLabel="Caller's name"
        autoCapitalize="words"
        label="Caller's name"
        onChangeText={setName}
        testID="enquiry-caller"
        value={name}
      />
      <MobileTextField
        accessibilityLabel="Caller's phone number"
        keyboardType="phone-pad"
        label="Phone"
        onChangeText={setPhone}
        testID="enquiry-phone"
        value={phone}
      />

      {failure && (
        <HelperText type="error" visible accessibilityRole="alert">
          {failure}
        </HelperText>
      )}

      <Button
        accessibilityLabel="Save this enquiry"
        disabled={busy || !ready}
        loading={busy}
        mode="contained"
        onPress={submit}
        style={{ justifyContent: "center", minHeight: TAP_TARGET }}
        testID="enquiry-log-submit"
      >
        Save
      </Button>
    </View>
  );
}
