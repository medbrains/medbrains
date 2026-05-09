import type { Module } from "@medbrains/mobile-shell";
import { type Camp, type CampPacketResponse, type CampSyncInboundEvent, P } from "@medbrains/types";
import { Card, COLORS, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { getCampPacket, listCamps, syncCampInbound } from "../api/camp.js";
import { EntityListScreen } from "../components/entity-list.js";
import { EntityRow } from "../components/entity-row.js";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";
import { ScreenHeader } from "../components/screen-header.js";
import { useFetch } from "../lib/use-fetch.js";

function CampHome(): ReactNode {
  const router = useModuleRouter();
  return (
    <ModuleHome
      eyebrow="FIELD"
      title="Camp Mode"
      description="Offline launch track for camp intake, screening, vitals, and sample collection."
      summaries={[
        { eyebrow: "SCOPE", count: "3", title: "Offline write types" },
        { eyebrow: "SYNC", count: "—", title: "Pending outbox" },
      ]}
      actions={[
        {
          id: "camps",
          label: "Select camp",
          description: "Open a camp and validate its segmented offline packet.",
          permission: P.CAMP.LIST,
          onPress: () => router.push("camps"),
        },
        {
          id: "intake",
          label: "Camp intake",
          description: "Open a camp first, then register walk-ins from the packet screen.",
          permission: P.CAMP.REGISTRATIONS_CREATE,
          badge: { label: "PACKET", tone: "neutral" },
        },
        {
          id: "screening",
          label: "Screening and vitals",
          description: "Capture vitals after intake is linked to the selected camp.",
          permission: P.CAMP.SCREENINGS_MANAGE,
          badge: { label: "PACKET", tone: "neutral" },
        },
        {
          id: "samples",
          label: "Lab samples",
          description: "Capture sample/barcode after intake is linked to the selected camp.",
          permission: P.CAMP.LAB_MANAGE,
          badge: { label: "PACKET", tone: "neutral" },
        },
      ]}
    />
  );
}

function CampListScreen(): ReactNode {
  const router = useModuleRouter();
  return (
    <EntityListScreen
      eyebrow="Camp Mode"
      title="Camps"
      description="Select a camp to validate the offline packet."
      fetcher={() => listCamps()}
      rowKey={(camp) => camp.id}
      renderRow={(camp) => (
        <EntityRow
          title={camp.name}
          subtitle={`${camp.camp_code} · ${camp.scheduled_date} · ${camp.venue_city ?? "No city"}`}
          badge={{ label: camp.status, tone: camp.status === "active" ? "success" : "neutral" }}
          onPress={() => router.push("packet", camp)}
        />
      )}
      emptyTitle="No camps available"
      emptyDescription="Create or approve a camp from the web command center."
    />
  );
}

function PacketScreen({ camp }: { camp: Camp }): ReactNode {
  const router = useModuleRouter();
  const { data, loading, error, refetch } = useFetch<CampPacketResponse>(
    () => getCampPacket(camp.id),
    [camp.id],
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="Packet"
        title={camp.name}
        description="Segmented data for field use. Patient master creation stays online."
      />
      {error && (
        <Empty
          title="Packet unavailable"
          description={error}
          actionLabel="Retry"
          onAction={refetch}
        />
      )}
      {!error && (
        <ScrollView contentContainerStyle={{ padding: SPACING.md }}>
          {loading && (
            <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
              Loading packet...
            </Text>
          )}
          {data && <PacketSummary packet={data} />}
          {data && (
            <Button mode="contained" onPress={() => router.push("intake", camp)}>
              Start camp intake
            </Button>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function PacketSummary({ packet }: { packet: CampPacketResponse }): ReactNode {
  return (
    <View style={{ gap: SPACING.sm }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
        <Metric label="Registrations" value={packet.registrations.length} />
        <Metric label="Screenings" value={packet.screenings.length} />
        <Metric label="Lab samples" value={packet.lab_samples.length} />
        <Metric label="Linked patients" value={packet.patient_summaries.length} />
        <Metric label="Readiness items" value={packet.remote_checklist.length} />
        <Metric label="Supplies" value={packet.supplies.length} />
      </View>
      <Card eyebrow="Packet" title={packet.packet_revision} pattern="aqua">
        <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
          Expires {new Date(packet.expires_at).toLocaleString()}
        </Text>
        <Text variant="bodySmall" style={{ color: COLORS.brandDeep, opacity: 0.75, marginTop: 4 }}>
          Includes camp data, team, intake records, screenings, sample records, recent vitals, and
          active allergy warnings for linked patients only.
        </Text>
      </Card>
      <Card
        eyebrow="Remote setup"
        title={packet.remote_setup?.status ?? "Not initialized"}
        pattern="copper"
      >
        <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
          Village/site readiness, IPC/BMW controls, referral route, staff briefing, and paper
          fallback must be completed before field use.
        </Text>
      </Card>
    </View>
  );
}

function IntakeScreen({ camp }: { camp: Camp }): ReactNode {
  const [personName, setPersonName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [createdRegistrationId, setCreatedRegistrationId] = useState<string | null>(null);
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [pulseRate, setPulseRate] = useState("");
  const [spo2, setSpo2] = useState("");
  const [temperature, setTemperature] = useState("");
  const [sampleType, setSampleType] = useState("");
  const [barcode, setBarcode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitRegistration(): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    const clientId = makeUuid();
    const event = makeSyncEvent("camp.registration.create", clientId, {
      camp_id: camp.id,
      person_name: personName,
      age: optionalNumber(age),
      gender: gender || undefined,
      phone: phone || undefined,
      chief_complaint: chiefComplaint || undefined,
      is_walk_in: true,
    });
    try {
      const response = await syncCampInbound({
        camp_id: camp.id,
        device_id: "mobile-staff-preview",
        events: [event],
      });
      const result = response.results[0];
      if (result?.server_entity_id) {
        setCreatedRegistrationId(result.server_entity_id);
      }
      setMessage(`Registration ${result?.status ?? "submitted"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitScreening(): Promise<void> {
    if (!createdRegistrationId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const event = makeSyncEvent("camp.screening.create", makeUuid(), {
      registration_id: createdRegistrationId,
      bp_systolic: optionalNumber(bpSystolic),
      bp_diastolic: optionalNumber(bpDiastolic),
      pulse_rate: optionalNumber(pulseRate),
      spo2: optionalNumber(spo2),
      temperature: optionalNumber(temperature),
    });
    try {
      const response = await syncCampInbound({
        camp_id: camp.id,
        device_id: "mobile-staff-preview",
        events: [event],
      });
      setMessage(`Screening ${response.results[0]?.status ?? "submitted"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Screening sync failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitLabSample(): Promise<void> {
    if (!createdRegistrationId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    const event = makeSyncEvent("camp.lab_sample.create", makeUuid(), {
      registration_id: createdRegistrationId,
      sample_type: sampleType,
      barcode: barcode || undefined,
    });
    try {
      const response = await syncCampInbound({
        camp_id: camp.id,
        device_id: "mobile-staff-preview",
        events: [event],
      });
      setMessage(`Lab sample ${response.results[0]?.status ?? "submitted"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lab sample sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="Intake"
        title={camp.name}
        description="Walk-in camp record first. Patient master/UHID linkage stays online after sync."
      />
      <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}>
        {message && (
          <Text variant="bodyMedium" style={{ color: COLORS.emerald }}>
            {message}
          </Text>
        )}
        {error && (
          <Text variant="bodyMedium" style={{ color: COLORS.red }}>
            {error}
          </Text>
        )}

        <Card eyebrow="Registration" title="Walk-in" pattern="aqua">
          <View style={{ gap: SPACING.sm }}>
            <TextInput label="Name" value={personName} onChangeText={setPersonName} />
            <TextInput label="Age" value={age} keyboardType="number-pad" onChangeText={setAge} />
            <TextInput label="Gender" value={gender} onChangeText={setGender} />
            <TextInput
              label="Phone"
              value={phone}
              keyboardType="phone-pad"
              onChangeText={setPhone}
            />
            <TextInput
              label="Chief complaint"
              value={chiefComplaint}
              onChangeText={setChiefComplaint}
            />
            <Button
              mode="contained"
              loading={busy}
              disabled={!personName || busy}
              onPress={submitRegistration}
            >
              Submit Registration
            </Button>
          </View>
        </Card>

        <Card eyebrow="Screening" title="Vitals" pattern="sky">
          <View style={{ gap: SPACING.sm }}>
            <TextInput
              label="BP systolic"
              keyboardType="number-pad"
              value={bpSystolic}
              onChangeText={setBpSystolic}
            />
            <TextInput
              label="BP diastolic"
              keyboardType="number-pad"
              value={bpDiastolic}
              onChangeText={setBpDiastolic}
            />
            <TextInput
              label="Pulse"
              keyboardType="number-pad"
              value={pulseRate}
              onChangeText={setPulseRate}
            />
            <TextInput label="SpO2" keyboardType="number-pad" value={spo2} onChangeText={setSpo2} />
            <TextInput
              label="Temperature"
              keyboardType="decimal-pad"
              value={temperature}
              onChangeText={setTemperature}
            />
            <Button
              mode="contained-tonal"
              loading={busy}
              disabled={!createdRegistrationId || busy}
              onPress={submitScreening}
            >
              Submit Vitals
            </Button>
          </View>
        </Card>

        <Card eyebrow="Lab" title="Sample" pattern="violet">
          <View style={{ gap: SPACING.sm }}>
            <TextInput label="Sample type" value={sampleType} onChangeText={setSampleType} />
            <TextInput label="Barcode" value={barcode} onChangeText={setBarcode} />
            <Button
              mode="contained-tonal"
              loading={busy}
              disabled={!createdRegistrationId || !sampleType || busy}
              onPress={submitLabSample}
            >
              Submit Sample
            </Button>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: number }): ReactNode {
  return (
    <View style={{ minWidth: 140, flexGrow: 1 }}>
      <Card eyebrow={label.toUpperCase()} title={String(value)}>
        <Text variant="bodySmall" style={{ color: COLORS.ink }}>
          In packet
        </Text>
      </Card>
    </View>
  );
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function makeSyncEvent(
  eventType: CampSyncInboundEvent["event_type"],
  clientEntityId: string,
  payload: Record<string, unknown>,
): CampSyncInboundEvent {
  return {
    idempotency_key: `${clientEntityId}:${eventType}`,
    event_type: eventType,
    client_entity_id: clientEntityId,
    occurred_at: new Date().toISOString(),
    payload,
  };
}

function makeUuid(): string {
  const cryptoApi = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = char === "x" ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

function CampScreen(): ReactNode {
  return (
    <ModuleRouter
      initial="home"
      screens={{
        home: <CampHome />,
        camps: <CampListScreen />,
        packet: (payload) => <PacketScreen camp={payload as Camp} />,
        intake: (payload) => <IntakeScreen camp={payload as Camp} />,
      }}
    />
  );
}

export const campModule: Module = {
  id: "camp",
  displayName: "Camp Mode",
  icon: () => null,
  requiredPermissions: [P.CAMP.LIST],
  navigator: CampScreen,
  offlineDocTypes: ["camp_registration", "camp_screening", "camp_lab_sample"],
};
