import type { Module } from "@medbrains/mobile-shell";
import {
  type Camp,
  type CampPacketDiagnosisHistory,
  type CampPacketMedicationHistory,
  type CampPacketPatientSummary,
  type CampPacketRegistrationHistory,
  type CampPacketResponse,
  type CampPacketVisitHistory,
  type CampPacketVital,
  type CampRegistration,
  type CampSyncInboundEvent,
  P,
} from "@medbrains/types";
import { Card, COLORS, Empty, SPACING } from "@medbrains/ui-mobile";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { getCampPacket, listCamps, syncCampInbound } from "../api/camp.js";
import { EntityListScreen } from "../components/entity-list.js";
import { EntityRow } from "../components/entity-row.js";
import { ModuleHome } from "../components/module-home.js";
import { ModuleRouter, useModuleRouter } from "../components/module-router.js";
import { ScreenHeader } from "../components/screen-header.js";

type PatientChartTab =
  | "summary"
  | "registrations"
  | "vitals"
  | "visits"
  | "diagnosis"
  | "medicines"
  | "current";

interface CampPatientPayload {
  packet: CampPacketResponse;
  registrationId: string;
  patientId: string | null;
}

interface PacketPatientRow {
  key: string;
  registration: CampRegistration;
  patient: CampPacketPatientSummary | null;
  searchText: string;
}

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
  const [packet, setPacket] = useState<CampPacketResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadPacket(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      setPacket(await getCampPacket(camp.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Packet download failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="Packet"
        title={camp.name}
        description="Download only this camp's assigned patient segment before leaving for the field."
      />
      {error && (
        <Empty
          title="Packet unavailable"
          description={error}
          actionLabel="Retry"
          onAction={downloadPacket}
        />
      )}
      {!error && (
        <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}>
          {loading && (
            <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
              Downloading local packet...
            </Text>
          )}
          {!packet && !loading && (
            <Card eyebrow="Local packet" title="Not downloaded" pattern="aqua">
              <Text variant="bodyMedium" style={{ color: COLORS.ink, marginBottom: SPACING.sm }}>
                Download camp data, assigned patient records, allergies, vitals, registration
                history, diagnoses, and medicines before travelling to the village.
              </Text>
              <Button mode="contained" onPress={downloadPacket}>
                Download Local Camp Packet
              </Button>
            </Card>
          )}
          {packet && (
            <PacketSummary
              packet={packet}
              onRefresh={downloadPacket}
              onOpenPatients={() => router.push("patients", packet)}
              onStartIntake={() => router.push("intake", camp)}
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}

function PacketSummary({
  packet,
  onRefresh,
  onOpenPatients,
  onStartIntake,
}: {
  packet: CampPacketResponse;
  onRefresh: () => void;
  onOpenPatients: () => void;
  onStartIntake: () => void;
}): ReactNode {
  const registrations = packet.registrations ?? [];
  const screenings = packet.screenings ?? [];
  const labSamples = packet.lab_samples ?? [];
  const patients = packet.patient_summaries ?? [];
  const visits = packet.visit_history ?? [];
  const medicines = packet.medication_history ?? [];
  const checklist = packet.remote_checklist ?? [];
  const supplies = packet.supplies ?? [];

  return (
    <View style={{ gap: SPACING.sm }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
        <Metric label="Registrations" value={registrations.length} />
        <Metric label="Screenings" value={screenings.length} />
        <Metric label="Lab samples" value={labSamples.length} />
        <Metric label="Linked patients" value={patients.length} />
        <Metric label="Past visits" value={visits.length} />
        <Metric label="Medicines" value={medicines.length} />
        <Metric label="Readiness items" value={checklist.length} />
        <Metric label="Supplies" value={supplies.length} />
      </View>
      <Card eyebrow="Packet" title={packet.packet_revision} pattern="aqua">
        <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
          Expires {new Date(packet.expires_at).toLocaleString()}
        </Text>
        <Text variant="bodySmall" style={{ color: COLORS.brandDeep, opacity: 0.75, marginTop: 4 }}>
          Includes camp data, team, intake records, patient search, registration history, prior
          visits, vitals, diagnosis history, medicines, and active allergy warnings for linked
          patients only.
        </Text>
      </Card>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm }}>
        <Button mode="contained" onPress={onOpenPatients}>
          Search Packet Patients
        </Button>
        <Button mode="contained-tonal" onPress={onStartIntake}>
          Start Camp Intake
        </Button>
        <Button mode="text" onPress={onRefresh}>
          Re-download
        </Button>
      </View>
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

function PatientRosterScreen({ packet }: { packet: CampPacketResponse }): ReactNode {
  const router = useModuleRouter();
  const [search, setSearch] = useState("");
  const rows = useMemo(() => buildPatientRows(packet), [packet]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.searchText.includes(q));
  }, [rows, search]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow="Packet patients"
        title="Patient Search"
        description="Search the downloaded camp packet without needing live network."
      />
      <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}>
        <TextInput
          label="Search name, UHID, phone, village, complaint"
          value={search}
          onChangeText={setSearch}
        />
        <Text variant="bodySmall" style={{ color: COLORS.brandDeep, opacity: 0.75 }}>
          {filtered.length} of {rows.length} packet records
        </Text>
        {filtered.length === 0 && (
          <Empty
            title="No packet patient found"
            description="Try UHID, name, phone last 4 digits, age, village, or complaint."
          />
        )}
        {filtered.map((row) => (
          <EntityRow
            key={row.key}
            title={row.patient?.display_name ?? row.registration.person_name}
            subtitle={patientRosterSubtitle(row)}
            badge={{
              label: row.patient ? "UHID" : "Walk-in",
              tone: row.patient ? "success" : "neutral",
            }}
            onPress={() =>
              router.push("patient", {
                packet,
                registrationId: row.registration.id,
                patientId: row.registration.patient_id,
              } satisfies CampPatientPayload)
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

function PatientChartScreen({ payload }: { payload: CampPatientPayload }): ReactNode {
  const router = useModuleRouter();
  const { packet, registrationId, patientId } = payload;
  const [tab, setTab] = useState<PatientChartTab>("summary");
  const packetRegistrations = packet.registrations ?? [];
  const packetPatients = packet.patient_summaries ?? [];
  const packetAllergies = packet.active_allergies ?? [];
  const packetVitals = packet.recent_vitals ?? [];
  const packetRegistrationHistory = packet.registration_history ?? [];
  const packetVisitHistory = packet.visit_history ?? [];
  const packetDiagnosisHistory = packet.diagnosis_history ?? [];
  const packetMedicationHistory = packet.medication_history ?? [];
  const packetScreenings = packet.screenings ?? [];
  const packetLabSamples = packet.lab_samples ?? [];
  const registration = packetRegistrations.find((r) => r.id === registrationId);
  const patient = patientId
    ? (packetPatients.find((summary) => summary.patient_id === patientId) ?? null)
    : null;
  const allergies = filterByPatient(packetAllergies, patientId);
  const vitals = filterByPatient(packetVitals, patientId);
  const registrations = filterRegistrationHistory(
    packetRegistrationHistory,
    patientId,
    registrationId,
  );
  const visits = filterByPatient(packetVisitHistory, patientId);
  const diagnoses = filterByPatient(packetDiagnosisHistory, patientId);
  const medicines = filterByPatient(packetMedicationHistory, patientId);
  const currentScreening = packetScreenings.find(
    (screening) => screening.registration_id === registrationId,
  );
  const currentSamples = packetLabSamples.filter(
    (sample) => sample.registration_id === registrationId,
  );

  if (!registration) {
    return (
      <Empty
        title="Patient record unavailable"
        description="This registration is not in the packet."
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.canvas }}>
      <ScreenHeader
        eyebrow={patient?.uhid ?? registration.registration_number}
        title={patient?.display_name ?? registration.person_name}
        description={patientChartSubtitle(patient, registration)}
      />
      <ScrollView contentContainerStyle={{ padding: SPACING.md, gap: SPACING.sm }}>
        <Button mode="text" onPress={router.pop}>
          Back to packet search
        </Button>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: SPACING.xs }}>
            {PATIENT_CHART_TABS.map((item) => (
              <Button
                key={item.id}
                mode={tab === item.id ? "contained" : "contained-tonal"}
                compact
                onPress={() => setTab(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </View>
        </ScrollView>

        {tab === "summary" && (
          <PatientSummaryTab
            patient={patient}
            registration={registration}
            allergies={allergies}
            latestVital={vitals[0] ?? null}
          />
        )}
        {tab === "registrations" && <RegistrationHistoryTab rows={registrations} />}
        {tab === "vitals" && <VitalsTab rows={vitals} />}
        {tab === "visits" && <VisitsTab rows={visits} />}
        {tab === "diagnosis" && <DiagnosisTab rows={diagnoses} />}
        {tab === "medicines" && <MedicinesTab rows={medicines} />}
        {tab === "current" && (
          <CurrentCampTab
            registration={registration}
            screening={currentScreening ?? null}
            samples={currentSamples}
          />
        )}
      </ScrollView>
    </View>
  );
}

const PATIENT_CHART_TABS: Array<{ id: PatientChartTab; label: string }> = [
  { id: "summary", label: "Summary" },
  { id: "registrations", label: "Registration History" },
  { id: "vitals", label: "Vitals" },
  { id: "visits", label: "Visits" },
  { id: "diagnosis", label: "Diagnosis" },
  { id: "medicines", label: "Medicines" },
  { id: "current", label: "Current Camp" },
];

function PatientSummaryTab({
  patient,
  registration,
  allergies,
  latestVital,
}: {
  patient: CampPacketPatientSummary | null;
  registration: CampRegistration;
  allergies: CampPacketResponse["active_allergies"];
  latestVital: CampPacketVital | null;
}): ReactNode {
  return (
    <View style={{ gap: SPACING.sm }}>
      <Card
        eyebrow="Identifiers"
        title={patient?.uhid ?? registration.registration_number}
        pattern="aqua"
      >
        <InfoLine label="Name" value={patient?.display_name ?? registration.person_name} />
        <InfoLine label="Age / gender" value={patientChartSubtitle(patient, registration)} />
        <InfoLine label="Phone" value={registration.phone ?? maskedPhone(patient?.phone_last4)} />
        <InfoLine label="Blood group" value={patient?.blood_group ?? "Not recorded"} />
        <InfoLine label="Chief complaint" value={registration.chief_complaint ?? "Not recorded"} />
      </Card>
      <Card
        eyebrow="Safety"
        title={
          allergies.length > 0
            ? `${allergies.length} allergy warning(s)`
            : "No active allergy in packet"
        }
        pattern={allergies.length > 0 ? "alert" : "success"}
      >
        {allergies.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
            No active allergy records were downloaded for this patient.
          </Text>
        ) : (
          allergies.map((allergy) => (
            <InfoLine
              key={`${allergy.patient_id}:${allergy.allergen_name}`}
              label={allergy.severity ?? allergy.allergy_type}
              value={`${allergy.allergen_name}${allergy.reaction ? ` - ${allergy.reaction}` : ""}`}
            />
          ))
        )}
      </Card>
      <Card
        eyebrow="Latest vitals"
        title={latestVital ? formatDateTime(latestVital.recorded_at) : "Not recorded"}
        pattern="sky"
      >
        {latestVital ? (
          <>
            <InfoLine label="BP" value={formatBp(latestVital)} />
            <InfoLine
              label="Pulse / SpO2"
              value={`${displayValue(latestVital.pulse)} bpm / ${displayValue(latestVital.spo2)}%`}
            />
            <InfoLine
              label="Weight / BMI"
              value={`${displayValue(latestVital.weight_kg)} kg / ${displayValue(latestVital.bmi)}`}
            />
          </>
        ) : (
          <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
            No vitals were downloaded for this patient.
          </Text>
        )}
      </Card>
    </View>
  );
}

function RegistrationHistoryTab({ rows }: { rows: CampPacketRegistrationHistory[] }): ReactNode {
  return (
    <HistoryList
      empty="No registration history in packet."
      rows={rows}
      render={(row) => (
        <Card
          key={row.registration_id}
          eyebrow={row.current_camp ? "Current camp" : row.camp_code}
          title={row.registration_number}
          pattern={row.current_camp ? "aqua" : "plain"}
        >
          <InfoLine label="Camp" value={row.camp_name} />
          <InfoLine label="Person" value={`${row.person_name}${row.age ? `, ${row.age}y` : ""}`} />
          <InfoLine label="Complaint" value={row.chief_complaint ?? "Not recorded"} />
          <InfoLine
            label="Place"
            value={[row.venue_city, row.venue_state].filter(Boolean).join(", ")}
          />
          <InfoLine label="Registered" value={formatDateTime(row.registered_at)} />
        </Card>
      )}
    />
  );
}

function VitalsTab({ rows }: { rows: CampPacketVital[] }): ReactNode {
  return (
    <HistoryList
      empty="No prior vitals in packet."
      rows={rows}
      render={(row) => (
        <Card
          key={`${row.encounter_id}:${row.recorded_at}`}
          eyebrow="Vitals"
          title={formatDateTime(row.recorded_at)}
          pattern="sky"
        >
          <InfoLine label="BP" value={formatBp(row)} />
          <InfoLine
            label="Pulse / RR / SpO2"
            value={`${displayValue(row.pulse)} / ${displayValue(row.respiratory_rate)} / ${displayValue(row.spo2)}%`}
          />
          <InfoLine
            label="Temp / BMI"
            value={`${displayValue(row.temperature)} C / ${displayValue(row.bmi)}`}
          />
          <InfoLine label="Notes" value={row.notes ?? "No notes"} />
        </Card>
      )}
    />
  );
}

function VisitsTab({ rows }: { rows: CampPacketVisitHistory[] }): ReactNode {
  return (
    <HistoryList
      empty="No prior visits in packet."
      rows={rows}
      render={(row) => (
        <Card
          key={row.encounter_id}
          eyebrow={row.encounter_type}
          title={formatDate(row.encounter_date)}
          pattern="plain"
        >
          <InfoLine label="Department" value={row.department_name ?? "Not recorded"} />
          <InfoLine label="Doctor" value={row.doctor_name ?? "Not recorded"} />
          <InfoLine label="Diagnosis" value={row.diagnosis_summary ?? "Not recorded"} />
          <InfoLine label="Medicines" value={row.prescription_summary ?? "Not recorded"} />
          <InfoLine label="Notes" value={row.notes ?? "No notes"} />
        </Card>
      )}
    />
  );
}

function DiagnosisTab({ rows }: { rows: CampPacketDiagnosisHistory[] }): ReactNode {
  return (
    <HistoryList
      empty="No diagnosis history in packet."
      rows={rows}
      render={(row) => (
        <Card
          key={`${row.encounter_id}:${row.description}`}
          eyebrow={row.icd_code ?? "Diagnosis"}
          title={row.description}
          pattern="copper"
        >
          <InfoLine label="Primary" value={row.is_primary ? "Yes" : "No"} />
          <InfoLine label="Severity" value={row.severity ?? "Not recorded"} />
          <InfoLine label="Certainty" value={row.certainty ?? "Not recorded"} />
          <InfoLine
            label="Onset"
            value={row.onset_date ? formatDate(row.onset_date) : "Not recorded"}
          />
        </Card>
      )}
    />
  );
}

function MedicinesTab({ rows }: { rows: CampPacketMedicationHistory[] }): ReactNode {
  return (
    <HistoryList
      empty="No medicine history in packet."
      rows={rows}
      render={(row) => (
        <Card
          key={`${row.prescription_id}:${row.drug_name}`}
          eyebrow={row.item_status}
          title={row.drug_name}
          pattern="violet"
        >
          <InfoLine label="Dose" value={`${row.dosage} - ${row.frequency}`} />
          <InfoLine label="Duration" value={row.duration} />
          <InfoLine label="Route" value={row.route ?? "Not recorded"} />
          <InfoLine label="Instructions" value={row.instructions ?? "None"} />
          <InfoLine label="Prescribed" value={formatDateTime(row.prescribed_at)} />
        </Card>
      )}
    />
  );
}

function CurrentCampTab({
  registration,
  screening,
  samples,
}: {
  registration: CampRegistration;
  screening: CampPacketResponse["screenings"][number] | null;
  samples: CampPacketResponse["lab_samples"];
}): ReactNode {
  return (
    <View style={{ gap: SPACING.sm }}>
      <Card eyebrow="Current registration" title={registration.registration_number} pattern="aqua">
        <InfoLine label="Status" value={registration.status} />
        <InfoLine label="Walk-in" value={registration.is_walk_in ? "Yes" : "No"} />
        <InfoLine label="Complaint" value={registration.chief_complaint ?? "Not recorded"} />
        <InfoLine label="Registered" value={formatDateTime(registration.created_at)} />
      </Card>
      <Card eyebrow="Current vitals" title={screening ? "Recorded" : "Not recorded"} pattern="sky">
        {screening ? (
          <>
            <InfoLine
              label="BP"
              value={`${displayValue(screening.bp_systolic)}/${displayValue(screening.bp_diastolic)} mmHg`}
            />
            <InfoLine
              label="Pulse / SpO2"
              value={`${displayValue(screening.pulse_rate)} bpm / ${displayValue(screening.spo2)}%`}
            />
            <InfoLine label="Finding" value={screening.findings ?? "Not recorded"} />
            <InfoLine label="Advice" value={screening.advice ?? "Not recorded"} />
          </>
        ) : (
          <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
            Vitals not recorded for this camp registration yet.
          </Text>
        )}
      </Card>
      <HistoryList
        empty="No lab samples for this registration."
        rows={samples}
        render={(sample) => (
          <Card key={sample.id} eyebrow="Sample" title={sample.sample_type} pattern="violet">
            <InfoLine label="Barcode" value={sample.barcode ?? "Not recorded"} />
            <InfoLine
              label="Status"
              value={sample.sent_to_lab ? "Sent to lab" : "Collected locally"}
            />
            <InfoLine label="Result" value={sample.result_summary ?? "Not available in packet"} />
            <InfoLine
              label="Collected"
              value={sample.collected_at ? formatDateTime(sample.collected_at) : "Not collected"}
            />
          </Card>
        )}
      />
    </View>
  );
}

function HistoryList<T>({
  rows,
  empty,
  render,
}: {
  rows: T[];
  empty: string;
  render: (row: T) => ReactNode;
}): ReactNode {
  if (rows.length === 0) {
    return <Empty title={empty} />;
  }
  return <View style={{ gap: SPACING.sm }}>{rows.map(render)}</View>;
}

function InfoLine({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <View style={{ marginBottom: 4 }}>
      <Text variant="labelSmall" style={{ color: COLORS.brandDeep, opacity: 0.7 }}>
        {label}
      </Text>
      <Text variant="bodyMedium" style={{ color: COLORS.ink }}>
        {value || "Not recorded"}
      </Text>
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

function buildPatientRows(packet: CampPacketResponse): PacketPatientRow[] {
  const patients = new Map(
    (packet.patient_summaries ?? []).map((patient) => [patient.patient_id, patient]),
  );
  return (packet.registrations ?? []).map((registration) => {
    const patient = registration.patient_id
      ? (patients.get(registration.patient_id) ?? null)
      : null;
    const searchText = [
      registration.person_name,
      registration.registration_number,
      registration.age?.toString(),
      registration.gender,
      registration.phone,
      registration.phone?.slice(-4),
      registration.address,
      registration.id_proof_number,
      registration.chief_complaint,
      registration.status,
      patient?.display_name,
      patient?.uhid,
      patient?.phone_last4,
      patient?.blood_group,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return {
      key: registration.id,
      registration,
      patient,
      searchText,
    };
  });
}

function patientRosterSubtitle(row: PacketPatientRow): string {
  const patient = row.patient;
  const registration = row.registration;
  const age = registration.age ?? patient?.age_years;
  return [
    patient?.uhid ?? registration.registration_number,
    age ? `${age}y` : null,
    registration.gender ?? patient?.gender,
    registration.chief_complaint,
  ]
    .filter(Boolean)
    .join(" · ");
}

function patientChartSubtitle(
  patient: CampPacketPatientSummary | null,
  registration: CampRegistration,
): string {
  const age = registration.age ?? patient?.age_years;
  return [
    age ? `${age} years` : null,
    registration.gender ?? patient?.gender,
    patient?.blood_group,
    patient?.last_visit_date ? `last visit ${formatDate(patient.last_visit_date)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function filterByPatient<T extends { patient_id: string }>(
  rows: T[],
  patientId: string | null,
): T[] {
  if (!patientId) return [];
  return rows.filter((row) => row.patient_id === patientId);
}

function filterRegistrationHistory(
  rows: CampPacketRegistrationHistory[],
  patientId: string | null,
  registrationId: string,
): CampPacketRegistrationHistory[] {
  return rows.filter((row) =>
    patientId ? row.patient_id === patientId : row.registration_id === registrationId,
  );
}

function maskedPhone(last4: string | null | undefined): string {
  return last4 ? `******${last4}` : "Not recorded";
}

function formatBp(vital: CampPacketVital): string {
  return `${displayValue(vital.systolic_bp)}/${displayValue(vital.diastolic_bp)} mmHg`;
}

function displayValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "--";
  return String(value);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
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
        patients: (payload) => <PatientRosterScreen packet={payload as CampPacketResponse} />,
        patient: (payload) => <PatientChartScreen payload={payload as CampPatientPayload} />,
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
