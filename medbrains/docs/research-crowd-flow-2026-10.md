# MedBrains Flow: crowd and occupancy intelligence for hospital buildings

*Feasibility and design brief, research only. 2026-10-20. Working name "VitalCore Hospital"; see §0 for why a rename is recommended.*

**Scope (user direction, 2026-10-20):** this is about the building: where the crowd is, how long people wait, and how to handle the crowd better. It is a separate product stream inside MedBrains. The main view is game-like, in the spirit of Project Hospital.

**Out of scope:** vital signs (respiration or heart rate from Wi-Fi or radar). That would be a medical device under CDSCO MDR 2017, and nothing here depends on it.

Labels used in this brief:
- **[repo]** is a fact checked in this codebase.
- **[src]** is an external source, linked inline.
- **[est]** is my own estimate. It is unverified and flagged as such.

---

## 0. Summary

1. **Most of the crowd is already in MedBrains.** Five existing data sets cover it:
   - token queues, with waiting count per department, pushed live;
   - appointments with check-in times;
   - visitor passes and gate check-in and check-out logs;
   - duty rosters;
   - the location hierarchy, which already has `campus → building → floor → wing → zone → room` levels.

   A **Phase 0 crowd view needs no hardware.** It is an estimate, labelled as one.
2. **Sensors add the people the system cannot see:** attendants, visitors without passes, and corridor or lift crush. Pick the sensor by zone type:
   - **door counters** (stereo, ToF or thermal) at entrances;
   - **existing Wi-Fi controller analytics** (Cisco Spaces, Aruba, Mist) for whole floors, if the hospital already owns them;
   - **small mmWave sensors** for small rooms and corridor segments.

   **Wi-Fi CSI is not ready for crowd counting in large halls.** The literature reports good accuracy only for about 10 people or fewer in a single stable room, and poor transfer to new rooms (§1.1).
3. **Load on clinical modules is negligible if built as specified:**
   - it is read-only;
   - it consumes the in-process queue broadcaster;
   - it runs one bounded aggregate query per tenant per minute;
   - it has its own partitioned tables and its own small DB pool.

   For a 1,000-OPD/day hospital that is about **0.02 added queries per second**, about **58k aggregate rows per day**, and **under 0.5 GB per year** (§A).
4. **It is worth buying for 300+ bed and multi-building hospitals.** It is marginal for 50–100 beds and not worth it for clinics (§B). The evidence that wait-time *display* alone raises satisfaction is mixed. The value comes from *acting* on it: opening counters and moving staff. Phase 0 can prove or disprove that from token data MedBrains already records.
5. **Rename the product.** "VitalCore" signals vital signs. That invites medical-device questions, from regulators and from buyers, that a crowd product does not need to answer. Suggested names are **MedBrains Flow** or **Concourse**.

**Safe to build now:** Phase 0. It is a role-gated, read-only, aggregate-only game-style building view driven by tokens, appointments, visitor logs and rosters. It needs no sensors, writes nothing to clinical tables, and stores no identities.

---

## 1. Sensing options for counts and density per zone

### 1.1 Comparison

Costs are per zone and are [est] street prices in India for October 2026, not quotes.

| Method | What it really measures | Realistic accuracy | Cost per zone | Privacy | Install effort | India availability | Best zone type |
|---|---|---|---|---|---|---|---|
| **Wi-Fi CSI, ESP32 node pair** | Disturbance of the Wi-Fi channel by bodies; count is inferred by an ML model | Small rooms with ≤10 people: roughly 86–98% in-domain. Examples: DeepCount 86.4% for ≤5 people ([arXiv 1903.05316](https://arxiv.org/abs/1903.05316)); 98.14% for ≤20 *stationary* people in a placement-optimised study ([PolyU / IEEE IoT-J 2025](https://ira.lib.polyu.edu.hk/handle/10397/117411)); MAE 0.35–0.41 for 5–10 people on ESP32-S3 ([NAIST thesis](https://naist.repo.nii.ac.jp/record/11764/files/R017974.pdf)). **No published large-hall results.** Accuracy drops in rooms the model was not trained in ([generalisability survey, arXiv 2503.08008](https://arxiv.org/abs/2503.08008); [UNSW foundation-model study, arXiv 2511.18792](https://arxiv.org/pdf/2511.18792.pdf)) | ₹1.5–2.5k hardware [est], plus per-room training effort | Excellent; no image, no identifier | Low hardware effort; **high per-room calibration** | ESP32-S3/C5/C6 easy to buy; tooling: Espressif `esp-csi`, Rust `esp-csi-rs` with C5 dual-band support ([docs.rs](https://docs.rs/crate/esp-csi-rs/0.10.1)) | Research only. Small consult rooms or rest rooms as presence or "busy/not", not counts |
| **Passive Wi-Fi/BLE probe counting** | Count of phones advertising | Weak. MAC randomisation makes one phone look like many; de-randomisation clustering reached 65–91% device identification ([see RateCount, arXiv 2507.03873](https://arxiv.org/abs/2507.03873)); a device is not a person (carry rate, two phones, bleed through walls) ([vendor caveats](https://www.vantagespace.com/glossary/occupancy-measurement-methods/wi-fi-probe-based-counting)) | ₹2–5k per sniffer [est] | **Poor.** A MAC is a device identifier, which is personal data under DPDP | Low | Easy | **Do not use.** Ruled out on privacy grounds |
| **Existing Wi-Fi controller analytics** (Cisco Spaces, HPE Aruba Central, Juniper Mist, Ruckus) | Associated and probing clients per AP, floor or zone, inside the hospital's own controller | Floor or zone **proxy**, not headcount. Mist: zone heatmaps against configured capacity; BLE zonal accuracy 3–5 m ([Mist docs](https://www.juniper.net/documentation/us/en/software/mist/mist-analytics/topics/topic-map/standard-analytics-occupancy.html), [room-usage use case](https://www.juniper.net/documentation/us/en/software/mist/location-services/topics/concept/room-usage-use-case.html)). Cisco Spaces Firehose emits `DEVICE_COUNT` per location each minute ([Cisco devnet](https://developer.cisco.com/docs/cisco-spaces-firehose/event-types/)), with a Campus→Building→Floor→Zone hierarchy ([Location Cloud API](https://developer.cisco.com/docs/cisco-spaces-location/)). Aruba Central exposes floor client counts, polled about every 5 min by integrators ([Mapped connector](https://docs.mapped.com/connectors/aruba-central-source)) | **₹0 hardware** if already owned; licence tiers (e.g. Cisco Spaces Extend/ACT) cost extra ([Cisco store](https://spaces.cisco.com/store/product/simon-healthcare-by-kontakt-io/)) | Hospital-controlled; MedBrains should take **counts only, never MACs** | Low: an API key plus a zone mapping | Common in Indian corporate hospitals | **Whole floors, large halls, trends.** Calibrate with a manual count |
| **mmWave people counter** | Radar point clouds tracked as people | HLK-LD2450 tracks only **3 targets** ([ESPHome](https://new.esphome.io/components/sensor/ld2450), [atomic14](https://www.atomic14.com/esp32/sensors/hlk-ld2450/)). TI IWR6843 reference design: ±10 cm, density 1 person/m², range up to 14 m ([TI TIDUE71](https://ti.com/lit/pdf/TIDUE71)); field reports say it undercounts above 5–6 people ([TI E2E](https://e2e.ti.com/support/sensors-group/sensors/f/sensors-forum/1176058/iwr6843isk-ods-people-counting)) | LD2450 + ESP32-S3: ₹2–3k; IWR6843-class commercial: ₹25–60k [est] | Very good; no image | Ceiling or wall mount, plus power | LD2450 sold in India ([probots.co.in](https://probots.co.in/hlk-ld2450-24ghz-mmwave-tracking-radar-sensor.html)); TI via distributors | **Small rooms, corridor segments, lift lobbies** |
| **Thermal or ToF overhead counter** at a door | Line crossings in and out | Vendor claims are typically 95–98%, with few independent tests. Butlr (thermal): 20,000+ sensors, mostly senior living ([MIT News 2025](https://news.mit.edu/2025/butlr-creates-smart-buildings-with-privacy-first-sensors-0211)). A thermal occupancy unit was trialled on NHS wards ([Medway, Derby repository](https://repository.derby.ac.uk/item/9z052/design-of-an-occupancy-monitoring-unit-a-thermal-imaging-based-people-counting-solution-for-socio-technical-energy-saving-systems-in-hospitals)) | ₹40k–1L per door [est]; Butlr is quote-based and imported | Very good; low-res heat only | Ceiling mount over the door; needs network | Thermal is imported; ToF available via integrators | **Entrances, ward doors, hall in/out → occupancy = ins − outs** (needs a nightly reset to fix drift) |
| **Camera, anonymised edge counting** (stereo 3D counters, or CCTV + edge model) | People detected in frames, counted on the device, frames discarded | Best for dense halls. Stereo 3D counters claim 97–98% ([Hikvision dual-lens](https://www.securityworldmarket.com/int/newsarchive/hikvision-introduces-dual-lens-ip-camera-for-people-counting)); Xovis claims 98% coverage in airport queues ([Passenger Terminal Today](https://passengerterminaltoday.com/?p=7177)). Validate at the peak hour on site | Stereo counter ~₹85k–1.2L (US list ~$1k) [est]; existing CCTV + edge box ₹30–60k per 4–8 cameras [est] | **Highest risk.** Faces are captured at the sensor even when discarded. Needs DPDP notice, no frame storage and no export, plus signage | Medium | Hikvision and CP Plus are widely available; Xovis via integrators | **Big waiting halls, queues at billing/pharmacy, ED waiting**, where counts above 30 matter |
| **Turnstile or door counter** (IR beam, access control) | Crossings | Good for single-file flow; poor for groups and wide doors | ₹5–20k [est]; access control may already exist | Excellent | Low | Ubiquitous | **Gates, lifts** (lift controller car-load data is often available from the vendor) |

### 1.2 What works where

- **Large waiting halls (OPD, 50–300 people).** Use door in/out counters at every entrance to the hall, plus the Wi-Fi controller proxy, both calibrated against MedBrains tokens (§3). Where accurate queue length matters, use stereo or camera counting with edge-only processing. CSI and LD2450 do not scale here.
- **Corridors.** Use a flow rate (people per minute past a line) from a door-style counter or mmWave, not occupancy.
- **Lifts.** Use the lift vendor's car-load or call data, or a counter in the lobby. A lift-lobby queue length from mmWave is good enough.
- **Wards and ICU visiting.** Use a door counter on the ward entrance and reconcile it with active visitor passes: counted heads minus patients minus staff on duty ≈ visitors.
- **Canteen and parking.** Use door counters, and the parking system's own boom-barrier count.

### 1.3 IEEE 802.11bf

IEEE Std 802.11bf-2025 (WLAN sensing amendment) was approved on 28 May 2025 and is now active ([ANSI webstore](https://webstore.ansi.org/standards/ieee/ieee80211bf2025), [overview arXiv 2207.04859](https://arxiv.org/pdf/2207.04859)). It standardises how a device *requests and reports* sensing measurements. It does not make counting accurate. Enterprise AP support will follow chipset refreshes. Revisit in 2027: if hospital APs expose 802.11bf sensing reports, the "existing Wi-Fi" row gets better at no hardware cost.

---

## 2. What hospitals do with crowd data

The evidence on outcomes is thin, and this brief says so wherever it applies.

| Use | Evidence | Action it drives |
|---|---|---|
| OPD waiting-hall load | AIIMS Delhi: LED status boards in the OPD since 2015 ([Medical Dialogues](https://medicaldialogues.in/amp/nadda-inaugrates-new-opd-with-digital-facilities-at-aiims-2)); crowd software aimed at cutting a ~6 h wait to 2 h ([Millennium Post](https://www.millenniumpost.in/delhi/delhi-249364)); a March 2025 memo extends its public Patient Care Dashboard to waiting lists and real-time emergency admission status ([AIIMS memo](https://aiims.edu/images/pdf/notice/director-9-7-25.pdf)) | Stagger appointment slots; open extra registration counters |
| Lab and pharmacy bottlenecks | A recurring theme even in the simulation genre: players find the choke point is test processing, and adding lab staff reduces the doctors needed ([Project Hospital Steam thread](https://steamcommunity.com/app/868360/discussions/0/1744480966998905950)). Real-world: closed-loop cycle-time work at Aravind Eye Hospital ([Health Services Insights 2023](https://doaj.org/article/c98047c596cb4014acb2c64cc728896d)) | Send phlebotomists to sample collection; open pharmacy window 2 |
| Space utilisation | NHS Loxford clinic sensor trial: 160,000 data points in a month; sensors found space staff believed was in use was empty ([Holyrood](https://www.holyrood.com/articles/news/new-scottish-sensor-technology-could-help-nhs-use-resources-more-efficiently)) | Re-allocate consult rooms |
| Occupancy limits and entry control | Salford Royal NHS: people counters + signage deciding "enter or wait" (vendor case study, demo room) ([Scan](https://www.scan.co.uk/case-studies/nhs-salford-royal-trust)) | Redirect via signage; enforce visitor limits |
| Waiting-time display | **Mixed.** A Saudi ED RCT found no significant satisfaction change, though patients preferred having estimates ([SMJ 2020](https://smj.org.sa/content/41/8/883.full.pdf)); a Canadian co-designed display improved satisfaction and understanding (poster, [CJEM](https://www.cambridge.org/core/journals/canadian-journal-of-emergency-medicine/article/mp27-publishing-emergency-department-wait-times-in-the-waiting-room-implementation-and-evaluation-of-a-codesigned-patient-centered-solution/367589B9A10C48C73FAE89A87BFA116B)); Press Ganey reported that informing patients of delays lifts scores ([amednews](https://amednews.com/article/20091019/business/310199992/6/)) | Live wait on TV, app, website and SMS |
| ED surge forecasting | Daily ED-visit forecasts reach <10% error; hourly is less studied ([systematic review, QIMS](https://qims.amegroups.org/article/view/102522/html); [BMC MIDM 2024](https://biomedcentral-bmcmedinformdecismak.publicaciones.saludcastillayleon.es/articles/10.1186/s12911-024-02788-6)) | Pre-position staff; Code Yellow readiness |
| Fire, evacuation, mass casualty | No hospital outcome study found. Per-floor headcount is an obvious input for an evacuation roll call | **Advisory only.** This is not a certified life-safety system |
| Infection-control density | Post-COVID spacing guidance exists generally; I found no Indian hospital norm that sets a numeric density per m² | Per-zone threshold set by the hospital's infection control committee |

---

## 3. Fit with MedBrains: what already exists

### 3.1 Data sources

| Need | Exists [repo] | Gap |
|---|---|---|
| Zones | `locations` with `level` enum `campus, building, floor, wing, zone, room, bed, station` and an `attributes` jsonb (`crates/medbrains-db/oracle/0001_baseline.sql`) | No floor-plan image and no zone polygon. Capacity m² is not modelled |
| Queues and waits | `tokens` (`module, scope, scope_id, counter_label, status, called_at, served_at, completed_at, token_date`); `crates/medbrains-tokens` (`counters.rs`, `queues.rs`, `station_flow.rs`, `board.rs` with display redaction) | Tokens map to department/scope, not to a `locations` zone. A mapping is needed |
| Live push | In-process `QueueBroadcaster` with `QueueEvent::{QueueUpdate{department_id, waiting_count, …}, TokenCalled, TokenStatusChanged}` (`crates/medbrains-server-core/src/queue_broadcast.rs`); WS handlers in `crates/medbrains-server/src/routes/ws.rs`, tenant-filtered after a cross-tenant announcement leak was fixed | Flow subscribes to it; no new events needed for tokens |
| Expected arrivals | `appointments` (`department_id, slot_start, slot_end, status, checked_in_at, booking_source`), `doctor_schedules`, `scheduling_waitlist` | none |
| Counters and stations | `stations` (`department_id, station_type, location_scope jsonb`), `camp_counters` | CLAUDE.md notes `stations` historically had **zero rows**. Phase 0 needs the station maker screen to actually be used |
| Staff on duty | `duty_rosters` × `shift_definitions`, `staff_location_assignments (user_id, location_id)`, `nurse_shift_assignments`, `attendance_records` | Roster is per department; zone-level placement is optional |
| Visitors | `visitor_registrations`, `visitor_passes (ward_id, bed_number, valid_until, status)`, `visitor_logs (check_in_at, check_out_at, gate)` | none. "Visitors inside now" = check-ins with no checkout |
| Bed state | `bed_states`; command-centre beds tab | none |
| Code Yellow | `mass_casualty_events (status activated/ongoing/scaling_down/deactivated, estimated_casualties)`; code-blue response in `crates/medbrains-nursing/src/code_blue_response.rs` | Flow shows an overlay; it does not drive codes |
| Command centre | `apps/web/src/pages/command-center.tsx` (tabs: overview, beds, discharge, transport, alerts-thresholds), guarded by `command_center.view`; `crates/medbrains-dashboard/src/management_kpis/` already has `opd_wait_minutes`, `pharmacy_wait_minutes`, `lab_tat_minutes`, `billing_lag_hours` with usual-day baselines | Flow becomes a new top-level page; its KPIs plug into the same catalogue |
| Devices and edge | `device_adapter_catalog` already has categories `environment_sensor` and `queue_display`; `crates/medbrains-bridge` (heartbeat, bounded SQLite `buffer.rs`, WSS/headscale transport, HL7/ASTM); `apps/edge` + `crates/medbrains-edge` (iroh peer sync) | Add device category `occupancy_sensor`, plus a bridge capability `crowd_counts` |
| TV boards | `apps/web/src/pages/tv-displays.tsx`; RN `apps/tv` is outgoing; native Compose-for-TV per `RFC-NATIVE-MOBILE.md` (no `app-tv` module in `apps/android` yet) | The patient-facing wait board is a new board type |
| Entitlement | `require_module_enabled` (`crates/medbrains-server-core/src/middleware/entitlement.rs`) | **Fails open** (allows on a missing row or a DB error). A paid add-on needs fail-closed (explicit `enabled`), otherwise every tenant gets Flow free |
| 3D/canvas precedent | `three@0.180` installed; `apps/web/src/components/BodySite/AnatomyScene.tsx` renders on demand, disposes every GPU resource, and takes colour from `--mb-anatomy-*` tokens | Reuse this pattern |

### 3.2 Phase 0 derived density (no sensors)

Per zone, recomputed each minute:

```
known_inside(zone) =
    waiting_tokens(zone)                       -- tokens issued/called, not completed, today
  + checked_in_not_seen(zone)                  -- appointments checked_in_at set, completed_at null
  + visitors_inside(zone)                      -- visitor_logs check_in, no check_out (ward zones via pass.ward_id)
  + staff_on_duty(zone)                        -- roster × shift window (count only)

estimated_people(zone) = known_inside × attendant_factor(zone)   -- per-zone calibration knob
```

`attendant_factor` is a per-zone setting, defaulting to 1.8 [est] for Indian OPDs where patients come with family. It is calibrated by one manual headcount at peak.

The UI always labels the result **"estimated"**, and shows it with a different texture from **"measured"**, which comes from sensors.

---

## 4. Product design: MedBrains Flow

### 4.1 What makes Project Hospital legible

Research limits: Reddit is not fetchable from this environment, and the Project Hospital fandom wiki returned HTTP 402. Confirmed facts:
- Steam lists "Design your very own hospital", specialised departments, and staff "from doctors to janitors" kept satisfied.
- Reviews are **Very Positive, 87% of 3,433** ([Steam](https://store.steampowered.com/app/868360/Project_Hospital/)).
- Player threads describe:
  - shared waiting areas between departments;
  - the lab as the real bottleneck;
  - "pause and check which resource the patient is waiting on" as the core fix loop ([thread 1](https://steamcommunity.com/app/868360/discussions/0/1646544348818488375), [thread 2](https://steamcommunity.com/app/868360/discussions/0/1752358461535394791)).
- The genre (Two Point Hospital) uses **visualisation modes**, e.g. a hygiene overlay ([via glossary quote](https://tur.proz.com/kudoz/7044614)).

Design lessons, combining those sources with genre conventions (the conventions are not verified against this specific game):

1. **One spatial truth.** The building *is* the dashboard: a top-down or isometric floor with named departments.
2. **Overlays, not pages.** The same map gets one lens at a time: crowd, wait, staff, bottleneck, codes.
3. **Click to inspect.** Any room opens a small panel answering why it is red and what it is waiting on.
4. **Time controls.** Pause, scrub back, play forward.
5. **Alerts point at the map.** Each alert is an icon on a room, not a toast with no location.
6. **Manageable equals few, clear levers.** Open a counter, move staff, redirect.
7. **Satisfaction comes from closing a loop:** you see red, act, and it turns green.

### 4.2 Translation to real data

| Game element | Flow equivalent | Data |
|---|---|---|
| Floor plan with departments | Isometric (or top-down) floor per building/floor; zones are tiles | `locations` hierarchy, plus optional uploaded plan |
| Patients walking | **Aggregate dots**, each = N people (N chosen so a floor never exceeds 2,000 dots), flowing between zones by observed token transitions (registration → consult → billing → pharmacy). **No identities, no per-person tracks** | `tokens` transitions aggregated per minute |
| Queue in front of a desk | A visible line of dots at each counter; its length = waiting tokens | `tokens` per `counter_label`/station |
| Waiting bubble | Wait badge `~14 min` on each counter (median of the last 30 min of call−issue, plus queue ÷ service rate) | `tokens.called_at − created` |
| Staff | Staff glyph count per zone (`3 nurses`), never names on the map | rosters |
| Overlays | Crowd heat · Wait times · Staff load (people per staff) · Bottlenecks (queue growth rate > service rate) · Emergency codes | all of the above |
| Time controls | Scrub the last 24 h / 7 days; **Play forward** 4 h from appointments plus history | `flow_zone_minute`, forecast |
| Quests | Recommendations: "Billing counter 3: open to cut the wait from 22 to 9 min" with Accept / Dismiss / Snooze, all logged | queue model (§4.5) |

### 4.3 Wireframes

**Main game view** (command centre, web, ≥1280 px):

```
┌ Flow · Main block · Floor G ▾ ─────────── [Crowd●][Wait][Staff][Bottleneck][Codes]  ⏸ ◀◀ ▶ ▶▶  Now 11:42 ┐
│                                                                                 │ QUESTS (3)            │
│        ╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾╲          ╱‾‾‾‾‾‾‾‾‾‾‾‾‾╲                                │ ▸ Billing ctr 3       │
│       ╱  OPD HALL A     ╲        ╱  REGISTRATION ╲      ╱‾‾‾‾‾‾‾‾╲              │   open → wait 22→9m   │
│      ╱ ■■■■■■■■ heavy    ╲──────╱  ■■■ busy       ╲────╱ LIFTS    ╲             │   [Accept][Snooze]    │
│      ╲ 142 est · ~31 min ╱      ╲ 38 · ~6 min     ╱    ╲ lobby 12 ╱             │ ▸ Lab collection      │
│       ╲ 👤×4  ⚠ growing ╱        ╲ 👤×3 ▸▸▸▸▸     ╱      ╲________╱              │   +2 phlebotomists    │
│        ╲_______________╱          ╲______________╱                               │ ▸ Ward 4 visitors     │
│               │  · · · ·  (aggregate flow dots)                                  │   14 > limit 8        │
│        ╱‾‾‾‾‾‾‾‾‾‾‾‾╲     ╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾╲     ╱‾‾‾‾‾‾‾‾‾‾‾‾╲                    │───────────────────────│
│       ╱ BILLING      ╲   ╱ PHARMACY       ╲   ╱ LAB SAMPLE   ╲                   │ TODAY'S GOALS (team)  │
│       ╲ ctr1 ▸▸▸▸▸▸  ╱   ╲ win1 ▸▸▸▸       ╱   ╲ ▸▸▸▸▸▸▸▸▸     ╱                   │ OPD wait ≤ 30m  ▓▓▓░  │
│        ╲ctr2 ▸▸▸ ~22m╱     ╲ win2 closed ~12m╱   ╲ ~27m ⚠     ╱                    │ No overcrowding ▓▓▓▓  │
│         ╲ctr3 closed╱       ╲______________╱     ╲____________╱                     │ streak: 4 days        │
│                                                                                 │                       │
│ Legend: ░ low  ▒ moderate  ▓ heavy  █ over limit  (also labelled with numbers)  │ [Table view]          │
│ est = estimated from queues/visits · ◉ = measured by sensor                     │                       │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 Timeline: 08:00 ▁▂▃▅▇█▇▅▃ 11:42 ┆ forecast ▅▅▆▇▆▄▂ 16:00     [drag to scrub / play forward]
```

**Zone inspect drawer** (click a zone):

```
┌ Billing · Floor G ─────────────── ✕ ┐
│ People now   58 est  (usual 31)      │
│ Wait         ~22 min (target 15)     │
│ Counters     2 open of 3             │
│ Service rate 1 token / 2.6 min / ctr │
│ Arrivals     next hour: 41 expected  │
│ Staff        2 cashiers on duty      │
│ ──────────────────────────────────── │
│ Why red: arrivals 41/h > capacity    │
│   2 × 23/h = 46/h only if no breaks  │
│ ──────────────────────────────────── │
│ [Open counter 3]  [Redirect signage] │
│ Last 4 h ▂▃▅▇▇ (sparkline + table)   │
└──────────────────────────────────────┘
```

**Patient-facing wait board** (TV, website, app). There is no map here, only clarity:

```
┌ Waiting times now · updated 11:42 ───────────────┐
│ Registration      ~6 min                          │
│ General Medicine  ~31 min   (Dr rooms 4, 5, 7)    │
│ Billing           ~22 min   → Counter 3 opening   │
│ Pharmacy          ~12 min                         │
│ Lab sample        ~27 min                         │
│ Quieter after 2 pm for Billing and Pharmacy       │
└───────────────────────────────────────────────────┘
```

**Admin: zones over a floor plan:**

```
┌ Flow setup · Main block · Floor G ─────────────────────────────┐
│ [Upload plan image]  Zones from hierarchy: 9 found              │
│ ┌──────────────────────────────┐  Zone          Capacity  Limit │
│ │ plan.png with polygons       │  OPD Hall A    180      150     │
│ │  click to add points,        │  Billing       60       45      │
│ │  Enter to close polygon      │  Ward 4 visit  —        8       │
│ └──────────────────────────────┘  Attendant factor  1.8         │
│ Sensors: 2 bound (door ctr E1, E2)   [Bind sensor]              │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 Gamification that helps without becoming creepy

Evidence:
- Consented workplace games raise positive affect, and *non-consented* ones lower it, with no performance gain among consenters ([Mollick & Rothbard, "Mandatory Fun"](https://papers.ssrn.com/abstract=2277103); [Wharton summary](https://knowledge.wharton.upenn.edu/article/people-love-games-but-does-gamification-work/)).
- Health-professions gamification evidence is mostly small trials and warns that game elements can distract ([JMIR 2019 systematic review](https://www.jmir.org/2019/3/E12994)).

So:
- **Do:**
  - team or department goals (wait target met, "no zone over limit" streak);
  - an end-of-shift summary ("you opened 2 counters, peak wait fell from 34 to 18 min");
  - opt-in per department;
  - goals set by the department head.
- **Don't:**
  - individual leaderboards;
  - per-person speed scores;
  - names on the map;
  - points tied to appraisal;
  - any metric that rewards rushing clinical care (consult minutes are never a goal).
- Goals measure the *system* (queue, wait), not the person.

### 4.5 Prediction and recommendations

- **Forecast.** Expected arrivals per zone per 15 min = booked appointments (`slot_start`) × the historical show-rate for that weekday and department, plus walk-ins from the same-weekday ×4-week baseline. This reuses the baseline logic in `management_kpis`. Bound it to a 0–8 h horizon. Start with seasonal-naive plus appointments; add a model only if the error stays above about 20% after 8 weeks of data.
- **Recommendations.** An M/M/c queue per counter group: given the arrival rate λ (forecast), the service rate μ (observed median), and c open counters, compute the expected wait. Recommend c+1 when W(c) > target and W(c+1) ≤ target. Each recommendation shows its numbers ("22 → 9 min"). Accept, dismiss and snooze are logged with user and time. The engine never acts by itself.

### 4.6 Data model

All tables are tenant-scoped with RLS. Names are proposals.

```
flow_zone_config      (tenant_id, location_id PK→locations, capacity, alert_limit, warn_pct,
                       attendant_factor, counter_group, map_polygon jsonb, is_public)
flow_floor_plans      (tenant_id, floor_location_id, image_asset_id, width, height)
flow_sensors          → reuse device_instances (category 'occupancy_sensor') + binding
                       (device_instance_id, location_id, kind: door|zone|wifi_controller, direction)
flow_zone_minute      (tenant_id, location_id, minute timestamptz, people_est, people_measured,
                       waiting, staff, visitors, source_mask, confidence)
                       PARTITION BY RANGE (minute) monthly; 31-day retention
flow_zone_15m         same columns, rolled up; 2-year retention
flow_alerts           (id, tenant_id, location_id, kind, level, value, limit, raised_at,
                       acked_by, acked_at, resolved_at)
flow_recommendations  (id, tenant_id, location_id, action, predicted_before, predicted_after,
                       created_at, decided_by, decision, decided_at)
```

There is no per-person row anywhere. Sensor payloads are counts only.

### 4.7 APIs

Each route has a permission defined in Rust first, per the Permissions First rule, and is gated by a **fail-closed** `require_module_enabled("flow")`.

| Route | Permission | Notes |
|---|---|---|
| `GET /api/flow/floors/{id}/live` | `flow.view` | One snapshot per screen (zones + counters + quests) |
| `WS  /ws/flow/{floor_id}` | `flow.view` | Snapshot diff every 5–10 s; bounded channel |
| `GET /api/flow/zones/{id}` | `flow.view` | Inspect drawer |
| `GET /api/flow/history?floor&from&to&bucket` | `flow.history.view` | Range ≤ 31 days at 1 min, ≤ 2 years at 15 min |
| `GET /api/flow/forecast?floor&hours≤8` | `flow.view` | |
| `POST /api/flow/alerts/{id}/ack` | `flow.alerts.ack` | Audited |
| `POST /api/flow/recommendations/{id}/decide` | `flow.recommendations.act` | Audited |
| `GET/PUT /api/flow/config/zones…`, `/floor-plans…` | `flow.config.manage` | Admin setup screen |
| `POST /api/bridge/flow/readings` | device key (bridge) | Counts only; schema-validated; rate-limited per device |
| `GET /api/public/wait-times?facility=` | none (public) | Only zones with `is_public`; cached 30 s; no counts below 5 shown |

PHI minimisation: the map, the TV board and the public endpoint never carry a patient name or token number. Ward visitor counts are shown only as numbers. The existing `board.rs` redaction stays the rule for anything token-derived.

### 4.8 Tech: rendering within the repo rules

- **Phase 0 (fastest): `echarts` `geo` with a registered SVG floor-plan asset, or a schematic block layout.** Zones are coloured regions with labels. Echarts is allowed because `@mantine/charts` has no floor-map or heatmap mark. The SVG is an imported asset, not TSX markup.
- **Game view: `three` (already installed)** with an `OrthographicCamera` at an isometric angle:
  - zones as extruded tiles;
  - flow dots as **one `InstancedMesh`** with a fixed cap of 2,000;
  - counter queues as instanced dots.

  Do not add PixiJS or deck.gl. Pixi v8 is fast ([Pixi blog](https://pixijs.com/blog/pixi-v8-launches)), but `three` already does the job and has an in-repo disposal pattern. deck.gl is geo-oriented.
- **Seam:** a new `@/components/ui/FloorMap`:
  - `factory`/`forwardRef`, exposing `classNames`/`styles`/`vars`;
  - props `{ floor, zones, overlay, time, onZoneSelect }`;
  - colours read from new theme tokens `--mb-flow-density-{0..4}`, `--mb-flow-dot`, `--mb-flow-queue`, defined for light and dark;
  - re-read on theme switch;
  - wrapped in `Box`;
  - the canvas element is created by three, so there is no raw TSX element.

  A sibling `FloorMapTable` renders the same data through the seam `Table`.
- **Accessibility (WCAG 2.2 AA):**
  - the canvas has `role="img"` with a live text summary ("Floor G: 2 zones over limit: Billing, Lab");
  - the **zone list/table is the keyboard surface**: Tab through it, Enter inspects, and the map highlights the focused zone;
  - density is shown by number + band label + hatch pattern, never colour alone;
  - `prefers-reduced-motion` gives a static map with no flow dots and no pulsing;
  - quests are real buttons with ≥24 px targets;
  - TV text is large.
- **Performance budget** (`docs/DEVICE-CONSTRAINED-RULES.md`: TV heap ≤120 MB, flat over uptime, cold start ≤4 s):
  - render on change, capped at 30 fps while dots animate, paused on `visibilitychange`;
  - fixed-size instance buffers and no per-frame allocation;
  - each snapshot replaces the last, never appends;
  - TVs load no history;
  - dispose everything on unmount (AnatomyScene pattern);
  - the WS reconnects with capped backoff;
  - last-good snapshot is shown with "stale since 11:40" rather than a blank board.
- **Floor plans:**
  1. **Default: infer from the hierarchy.** Floors → zones are auto-laid out as a schematic block grid (like a metro map). It needs no drawing and works on day one.
  2. **Optional:** an admin uploads a plan image and clicks polygon points per zone (stored normalised 0–1 in `map_polygon`).

  No CAD import (YAGNI).

### 4.9 Privacy by design

- Aggregate counts only, with no identity anywhere in the pipeline.
- Edge processing: sensors and cameras send counts; frames, CSI and MACs never leave the device.
- Small-number suppression on public displays.
- **DPDP:**
  - camera and probe methods capture personal data at the sensor, so they need notice signage in English and the local language, purpose limited to crowd management, and no retention of raw data;
  - main DPDP Rules obligations (notice, security, retention and erasure) apply from about **May 2027**, 18 months after notification in November 2025 ([Mondaq](https://www.mondaq.com/india/data-protection/1708164/digital-personal-data-protection-rules-2025-notified)); verify against the gazette;
  - design to them now.
- **Not a medical device:** Flow observes the building, not patients, and makes no clinical claim. Keep it that way. Copy never says "patient monitoring" or "fall detection".
- **AiLabel:** use the existing `AiLabel` (`components/ui/AiLabel.tsx`) on forecasts and recommendations, with an explainer ("based on booked appointments and the last 4 same weekdays"). Use an "estimated" badge on Phase-0 counts.

---

## A. Load and isolation

**Will Flow load the hospital modules?** No, if built to these rules.

1. **Read-only.** Flow writes only `flow_*` tables. It never writes tokens, appointments, visitors or clinical tables.
2. **Event-driven where events exist** [repo]:
   - the in-process `QueueBroadcaster` already emits `QueueUpdate{waiting_count}`, `TokenCalled` and `TokenStatusChanged`, and Flow subscribes in-process at zero extra DB cost;
   - `outbox_events` is an **outbound integration** queue (payments, `sms.token_called`, `opd.vitals.recorded`, …), not a domain event bus, so do not build on it;
   - there is **no read replica** in the codebase;
   - appointments, visitor logs and rosters have no events, so Flow reads them with **one bounded aggregate query per tenant per minute**, filtered to today and index-backed. If a replica appears later, point this pool at it.
3. **Its own pool:** a separate `PgPool` with `max_connections = 2` and `statement_timeout = 2 s`. Flow cannot starve the clinical pool.
4. **Its own process:** run the aggregator as a background service (like `nurse_call_escalation`), or as a separate binary for large tenants. The web view only reads `flow_*` tables.
5. **Per-tenant switch:** `module_config` code `flow`. **The gate must be fail-closed for this add-on.** Today's `require_module_enabled` fails open.

**Capacity, 1,000 OPD visits per day** [est]:

| Quantity | Estimate | Working |
|---|---|---|
| Token events consumed | ~12k/day, peak ~0.7/s | 1,000 patients × ~4 stations × ~3 state changes; 20% in peak hour. In-process, **0 DB queries** |
| Aggregate queries added | **1,440/day ≈ 0.017 qps** | 1 per minute per tenant |
| Rows written | 40 zones × 1,440 = **57,600/day** | One row per zone per minute |
| Storage | 1-min tier, 31 days: ~1.8M rows ≈ 180 MB. 15-min tier: 40 × 96 × 365 ≈ 1.4M rows/yr ≈ 140 MB/yr. **< 0.5 GB/yr total** | ~100 B per row incl. index |
| Sensor uplink | 1 event / 30 s × ~200 B = **~0.6 MB/day per node**; 20 nodes ≈ 12 MB/day | Versus raw CSI at ~100 Hz × 52 subcarriers × 4 B ≈ 20 KB/s ≈ **1.8 GB/day per link**, which is why raw CSI stays on the edge |
| WebSocket fan-out | ~2 KB gz snapshot / 5 s × 20 viewers ≈ **8 KB/s** | Command centre + TVs |
| Public wait endpoint | Cached 30 s, so ≤2 DB reads/min regardless of traffic | |

**Worst case:** a big multi-building tenant with 300 zones and 200 viewers. That is 432k rows/day (~1.5 GB/yr at the 15-min tier), 0.017 qps (unchanged), and ~80 KB/s of WS. It is still negligible next to clinical traffic.

**Guard rails:**
- every query is bounded (date filter, `LIMIT`, range caps);
- history ranges are capped;
- the bridge ingest is rate-limited per device and the public endpoint per IP;
- broadcast channels are bounded, and lagging receivers drop to the latest snapshot;
- a **circuit breaker** skips the minute aggregation when the Flow pool's p95 exceeds 500 ms or the main pool is saturated;
- the view then shows "stale"; it never retries in a tight loop.

---

## B. Is it worth it?

The evidence base is honest but weak:
- Wait-time display alone has mixed RCT evidence on satisfaction (§2).
- Space and sensor pilots show utilisation insight but rarely wait-time outcomes.
- No rigorous study found that a crowd dashboard by itself cuts waits.

The plausible value mechanism is **acting faster on bottlenecks**: opening a counter or moving phlebotomists. MedBrains can *measure* that, because tokens already record issue, call and serve times.

| Hospital | Verdict | Why |
|---|---|---|
| Clinic / single waiting room (<200 OPD/day) | **Not worth an add-on** | One room; staff can see the crowd. The existing token board suffices |
| 50–100 beds (200–500 OPD/day) | **Phase 0 only, maybe bundled** | Some value in billing/pharmacy counter decisions; sensors not justified |
| 300+ beds (1,000+ OPD/day) | **Worth buying**: Phase 0 + door counters at entrances and 2–3 halls | Multiple counter groups, real staffing levers, visitor pressure on wards |
| Multi-building / medical college (5k+ OPD/day) | **Strongest case** | Entrances, lifts, crowd safety, Code Yellow, public wait information (AIIMS is already going this way) |

**Cheapest proof before any hardware:**
1. Turn on Phase 0 for one 300+ bed customer.
2. Record a 4-week baseline of p50/p90 wait and counter idle % for billing, pharmacy and lab from existing tokens (`management_kpis` already computes `pharmacy_wait_minutes` and `lab_tat_minutes`).
3. Turn on recommendations for 4 weeks.
4. Compare at the same weekday and hour.

If the p90 wait does not drop by about 20% or more [est threshold], do not sell sensors.

**Commercials** (per `RFC-PLATFORM-COMMERCIAL.md`: editions, module-based packages):
- Flow is an add-on module code `flow`, priced per facility plus a per-zone tier.
- **Flow Base** (Phase 0, software only) can be bundled in 300+ bed editions.
- **Flow Sense** adds sensor ingestion, per zone.

Hardware kits [est]:

| Kit | Contents | Cost |
|---|---|---|
| **A. Software only** | none | ₹0 |
| **B. Entrance** | stereo/ToF counter per door + PoE | ₹60k–1.2L per door |
| **C. Small zone** | LD2450 + ESP32-S3 + PSU + enclosure | ₹2–3k per room/corridor segment |
| **D. Wi-Fi analytics connector** | API integration to the hospital's Cisco/Aruba/Mist; licence from their vendor | ₹0 hardware |
| **E. Hall camera** | edge counting on existing CCTV, edge box per 4–8 cameras | ₹30–60k |
| **Edge host** | existing counter PC running `medbrains-bridge`, or a mini PC per building | ₹15–25k |

A typical 300-bed pilot (4 entrances + 3 halls + 6 small zones) is roughly **₹3.5–6L of hardware** [est].

---

## 5. Phased plan

| Phase | Scope | Exit criteria |
|---|---|---|
| **0: game view from existing data** (no sensors) | Define `flow.*` permissions in Rust → generate TS → grant roles → fail-closed gate. Zone config and admin setup screen (zones from hierarchy, attendant factor, limits). Map tokens, stations and counters to zones (finish the stations maker usage). Aggregator (broadcaster + 1/min query) → `flow_zone_minute`. `FloorMap` seam (echarts schematic first, then three isometric) + `FloorMapTable`. Overlays: crowd (est), wait, staff, codes. Inspect drawer. History scrub (24 h). Tests: aggregator math, gate fail-closed, 403 without permission, no PHI in payload, reduced-motion snapshot. | A command-centre user at a pilot hospital uses it daily for 2 weeks; it adds <0.05 qps |
| **1: pilot sensors, 2–3 zones** | Device category `occupancy_sensor`; bridge capability `crowd_counts` (counts only, bounded SQLite buffer, heartbeat); Kit B at the OPD hall entrances + Kit C at a lift lobby or billing; or Kit D if the hospital owns Cisco/Aruba/Mist. "Measured" vs "estimated" rendering; calibration against a manual peak headcount. DPDP notice signage if any camera is used | Measured count within ±15% [est target] of manual counts at peak, 3 sessions |
| **2: prediction + recommendations** | Appointment-plus-history forecast with play-forward; M/M/c quests; accept, dismiss and snooze audit; alerts with thresholds and ack; team goals and shift summary (opt-in). The A/B proof from §B | p90 wait improvement measured, or the feature is cut back |
| **3: patient-facing waits + signage** | Public wait endpoint (cached, small-number suppression); TV wait board (web board now, Compose-for-TV when `app-tv` lands); website widget; patient app card; optional SMS "come at 2 pm" nudges via the existing `sms.*` outbox | Board runs 7 days with flat memory ≤120 MB; no PHI on any public surface |

Wi-Fi CSI stays a **research track**. Reproduce the public-dataset counting results offline (e.g. [WiCount ESP32-S3 dataset](https://huggingface.co/datasets/RS2002/WiCount/blob/refs%2Fpr%2F2/README.md)) before any CSI hardware enters a building. Revisit it with 802.11bf-capable APs.

---

## Open decisions for the user

1. **Product name:** "MedBrains Flow" vs "Concourse" vs keep "VitalCore" (not recommended).
2. **Paid add-on vs bundled:** whether Phase 0 is a paid add-on or bundled into 300+ bed editions.
3. **Default attendant factor**, and who owns zone limits (infection control committee vs facilities).
4. **Cameras:** whether camera-based counting is acceptable at all for the first customers. It is the most accurate for halls and the highest DPDP risk.
