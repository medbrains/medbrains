import { zodResolver } from "@hookform/resolvers/zod";
import {
  type MobileCampRegistrationFormInput,
  mobileCampRegistrationFormSchema,
} from "@medbrains/schemas";
import { useHasPermission } from "@medbrains/stores";
import type { Camp, CampRegistration, CreateCampRegistrationRequest } from "@medbrains/types";
import { P } from "@medbrains/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { FlatList, StyleSheet, View } from "react-native";
import {
  Banner,
  Button,
  Card,
  HelperText,
  SegmentedButtons,
  Snackbar,
  Text,
  TextInput,
} from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  mobilePatientJourneyText,
  MOBILE_CAMP_REGISTRATION_TEXT as TEXT,
} from "../../components/patientJourneyText";
import { duplicateOnRoll, indexRegisteredPhones } from "../../lib/campRoll";
import {
  drain,
  enqueue,
  inMemoryStore,
  type PendingRegistration,
  pendingCount,
} from "../../lib/registrationQueue";
import { patientService } from "../../services/patient.service";

/**
 * Registering people onto a camp, from the tablet the volunteer is holding.
 *
 * Mobile already carried every later step — vitals, lab orders, prescriptions,
 * dispensing, the queue — and not the one that starts them. The web form
 * assumes a desk; a camp registration desk is often a folding table, or a
 * volunteer standing at the door.
 *
 * Online only. There is no sync layer in this app, so a registration taken out
 * of signal is a registration lost. Say so on the screen rather than let a
 * volunteer discover it at the end of a session.
 */

const ROW_HEIGHT = 64;

/**
 * One mapping from what the volunteer typed to what the API takes, used by
 * both the send and the retry queue — a queued registration that reconstructs
 * its own payload is a queued registration that drifts from the live one.
 */
function toRequest(values: MobileCampRegistrationFormInput): CreateCampRegistrationRequest {
  return {
    camp_id: values.camp_id,
    person_name: values.person_name.trim(),
    age: values.age.trim() ? Number(values.age) : undefined,
    gender: values.gender || undefined,
    phone: values.phone.trim() || undefined,
    chief_complaint: values.chief_complaint.trim() || undefined,
    is_walk_in: true,
  };
}

// One queue for the session. Not persisted — see registrationQueue.ts:
// this survives a network blip, not the app being killed.
const queueStore = inMemoryStore();

/** This app resolves its own copy; it does not mount react-i18next. */
function campText(key: string, values?: Record<string, string | number | boolean>): string {
  return mobilePatientJourneyText(key, values);
}

const emptyForm: MobileCampRegistrationFormInput = {
  camp_id: "",
  person_name: "",
  age: "",
  gender: "",
  phone: "",
  chief_complaint: "",
};

export function CampRegistrationScreen() {
  const queryClient = useQueryClient();
  const canRegister = useHasPermission(P.CAMP.REGISTRATIONS_CREATE);
  const canSeeRoll = useHasPermission(P.CAMP.REGISTRATIONS_LIST);
  const [toast, setToast] = useState("");
  const [pending, setPending] = useState(0);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<MobileCampRegistrationFormInput>({
    resolver: zodResolver(mobileCampRegistrationFormSchema),
    defaultValues: emptyForm,
  });

  const campId = watch("camp_id");
  const phone = watch("phone");

  const { data: camps = [] } = useQuery({
    queryKey: ["mobile-camps", "active"],
    queryFn: () => patientService.listCamps({ status: "active" }),
  });

  const {
    data: roll = [],
    isError: rollFailed,
    isLoading: rollLoading,
  } = useQuery({
    queryKey: ["mobile-camp-roll", campId],
    // No limit parameter: the endpoint already caps at 500 rows server-side.
    queryFn: () => patientService.listCampRegistrations({ camp_id: campId }),
    enabled: canSeeRoll && Boolean(campId),
  });

  // Index the roll's phone numbers once. A camp re-registers the same person
  // repeatedly — someone sent back for a test returns to the desk and is
  // written down again — and a scan per keystroke would be a scan per
  // keystroke of a hundred rows.
  const registeredPhones = useMemo(() => indexRegisteredPhones(roll as CampRegistration[]), [roll]);

  const duplicateOf = duplicateOnRoll(registeredPhones, phone ?? "");

  const register = useMutation({
    mutationFn: (values: MobileCampRegistrationFormInput) =>
      patientService.createCampRegistration(toRequest(values)),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ["mobile-camp-roll", campId] });
      setToast(campText(TEXT.states.registered, { name: created.person_name }));
      // Signal is back: flush anything held from earlier in the session.
      if (pendingCount(queueStore) > 0) {
        void drain(queueStore, (item: PendingRegistration) =>
          patientService.createCampRegistration(item.payload).then(() => undefined),
        ).then((result) => {
          setPending(pendingCount(queueStore));
          if (result.abandoned.length > 0) {
            setToast(
              campText(TEXT.errors.registerAbandoned, {
                names: result.abandoned.map((row) => row.personName).join(", "),
              }),
            );
          }
        });
      }
      // Keep the camp; the next person is at the same camp.
      reset({ ...emptyForm, camp_id: campId });
    },
    onError: (_error, values) => {
      // Hold it rather than lose it. The volunteer has already turned to the
      // next person; nobody would find out until the roll came up short.
      enqueue(queueStore, {
        localId: `${values.camp_id}:${values.person_name}:${Date.now()}`,
        campId: values.camp_id,
        personName: values.person_name,
        payload: toRequest(values),
        attempts: 0,
      });
      setPending(pendingCount(queueStore));
      setToast(campText(TEXT.errors.registerQueued, { count: pendingCount(queueStore) }));
      reset({ ...emptyForm, camp_id: values.camp_id });
    },
  });

  if (!canRegister) {
    return (
      <SafeAreaView style={styles.screen}>
        <Banner visible icon="lock">
          {campText(TEXT.states.noPermission)}
        </Banner>
      </SafeAreaView>
    );
  }

  const campButtons = (camps as Camp[]).map((camp) => ({
    value: camp.id,
    label: camp.name,
  }));

  return (
    <SafeAreaView style={styles.screen}>
      <FlatList
        data={canSeeRoll ? (roll as CampRegistration[]) : []}
        keyExtractor={(row) => row.id}
        getItemLayout={(_, index) => ({
          length: ROW_HEIGHT,
          offset: ROW_HEIGHT * index,
          index,
        })}
        ListHeaderComponent={
          <View style={styles.form}>
            <Controller
              control={control}
              name="camp_id"
              render={({ field }) => (
                <View>
                  <Text variant="labelLarge">{campText(TEXT.fields.camp)}</Text>
                  {campButtons.length === 0 ? (
                    <HelperText type="info">{campText(TEXT.states.noCamps)}</HelperText>
                  ) : (
                    <SegmentedButtons
                      value={field.value}
                      onValueChange={field.onChange}
                      buttons={campButtons}
                    />
                  )}
                  <HelperText type="error" visible={Boolean(errors.camp_id)}>
                    {errors.camp_id ? campText(TEXT.errors.campRequired) : ""}
                  </HelperText>
                </View>
              )}
            />

            <Controller
              control={control}
              name="person_name"
              render={({ field }) => (
                <View>
                  <TextInput
                    label={campText(TEXT.fields.name)}
                    value={field.value}
                    onChangeText={field.onChange}
                    autoCapitalize="words"
                    error={Boolean(errors.person_name)}
                  />
                  <HelperText type="error" visible={Boolean(errors.person_name)}>
                    {errors.person_name ? campText(TEXT.errors.nameRequired) : ""}
                  </HelperText>
                </View>
              )}
            />

            <View style={styles.row}>
              <Controller
                control={control}
                name="age"
                render={({ field }) => (
                  <View style={styles.half}>
                    <TextInput
                      label={campText(TEXT.fields.age)}
                      value={field.value}
                      onChangeText={field.onChange}
                      keyboardType="number-pad"
                      error={Boolean(errors.age)}
                    />
                    <HelperText type="error" visible={Boolean(errors.age)}>
                      {errors.age ? campText(TEXT.errors.invalidAge) : ""}
                    </HelperText>
                  </View>
                )}
              />
              <Controller
                control={control}
                name="phone"
                render={({ field }) => (
                  <View style={styles.half}>
                    <TextInput
                      label={campText(TEXT.fields.phone)}
                      value={field.value}
                      onChangeText={field.onChange}
                      keyboardType="phone-pad"
                      error={Boolean(errors.phone)}
                    />
                    <HelperText type="error" visible={Boolean(errors.phone)}>
                      {errors.phone ? campText(TEXT.errors.invalidPhone) : ""}
                    </HelperText>
                  </View>
                )}
              />
            </View>

            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <SegmentedButtons
                  value={field.value}
                  onValueChange={field.onChange}
                  buttons={[
                    { value: "male", label: "M" },
                    { value: "female", label: "F" },
                    { value: "other", label: "Other" },
                  ]}
                />
              )}
            />

            <Controller
              control={control}
              name="chief_complaint"
              render={({ field }) => (
                <TextInput
                  label={campText(TEXT.fields.chiefComplaint)}
                  value={field.value}
                  onChangeText={field.onChange}
                  multiline
                />
              )}
            />

            {pending > 0 ? (
              <Banner visible icon="cloud-off-outline">
                {campText(TEXT.states.pending, { count: pending })}
              </Banner>
            ) : null}

            {duplicateOf ? (
              <Banner visible icon="account-alert">
                {campText(TEXT.duplicate.warning, { name: duplicateOf })}
              </Banner>
            ) : null}

            <Button
              mode="contained"
              style={styles.submit}
              contentStyle={styles.submitContent}
              loading={register.isPending}
              onPress={() => void handleSubmit((values) => register.mutate(values))()}
            >
              {campText(TEXT.actions.register)}
            </Button>

            {/* An outage must not read as an empty roll: "nobody registered
                yet" is what sends a volunteer to write the same person down a
                second time. */}
            {rollFailed ? (
              <Banner visible icon="alert">
                {campText(TEXT.errors.rollUnavailable)}
              </Banner>
            ) : null}

            {canSeeRoll && campId ? (
              <Text variant="titleMedium" style={styles.rollTitle}>
                {campText(TEXT.roll.title, { count: roll.length })}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          canSeeRoll && campId && !rollLoading && !rollFailed ? (
            <HelperText type="info">{campText(TEXT.roll.empty)}</HelperText>
          ) : null
        }
        renderItem={({ item }) => (
          <Card style={styles.rollRow}>
            <Card.Title
              title={item.person_name}
              subtitle={[item.registration_number, item.age ? `${item.age}y` : null, item.phone]
                .filter(Boolean)
                .join(" · ")}
            />
          </Card>
        )}
      />
      <Snackbar visible={Boolean(toast)} onDismiss={() => setToast("")}>
        {toast}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  form: { gap: 8, padding: 16 },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  // 48dp, above the 44px minimum target size: this is tapped hundreds of
  // times a session, often one-handed while holding a clipboard.
  submit: { marginTop: 8 },
  submitContent: { height: 48 },
  rollTitle: { marginTop: 16 },
  rollRow: { marginHorizontal: 16, marginBottom: 8, height: ROW_HEIGHT },
});
