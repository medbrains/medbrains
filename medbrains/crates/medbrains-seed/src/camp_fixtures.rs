use chrono::NaiveDate;
use serde_json::json;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

const PATIENTS_PER_RURAL_CAMP: usize = 75;

struct RuralCampSite {
    code: &'static str,
    name: &'static str,
    camp_type: &'static str,
    status: &'static str,
    village: &'static str,
    block: &'static str,
    district: &'static str,
    state: &'static str,
    pincode: &'static str,
    landmark: &'static str,
    latitude: f64,
    longitude: f64,
    scheduled_date: &'static str,
    referral_facility: &'static str,
    referral_phone: &'static str,
    expected_footfall: i32,
}

struct CampStaff {
    username: &'static str,
    employee_code: &'static str,
    role_in_camp: &'static str,
    phone: &'static str,
}

struct ChecklistSeed {
    category: &'static str,
    code: &'static str,
    label: &'static str,
    nabh_chapter: &'static str,
}

struct SupplySeed {
    category: &'static str,
    item_name: &'static str,
    unit: &'static str,
    planned_qty: &'static str,
    batch_no: Option<&'static str>,
    expiry_date: Option<&'static str>,
    critical: bool,
}

#[derive(sqlx::FromRow)]
struct UserLite {
    id: Uuid,
    full_name: String,
    email: Option<String>,
}

#[derive(sqlx::FromRow)]
struct RuralEncounterBackfill {
    encounter_id: Uuid,
    patient_id: Uuid,
    seed_index: i64,
}

struct DiagnosisSeed {
    icd_code: &'static str,
    description: &'static str,
    severity: &'static str,
    snomed_display: &'static str,
}

struct MedicationSeed {
    drug_name: &'static str,
    dosage: &'static str,
    frequency: &'static str,
    duration: &'static str,
    route: &'static str,
    instructions: &'static str,
}

const RURAL_CAMP_SITES: &[RuralCampSite] = &[
    RuralCampSite {
        code: "RURAL-SVG-001",
        name: "Kallal Block Multi-Specialty Rural Camp",
        camp_type: "general_health",
        status: "active",
        village: "Kallal",
        block: "Kallal",
        district: "Sivaganga",
        state: "Tamil Nadu",
        pincode: "630305",
        landmark: "Government Higher Secondary School",
        latitude: 9.8884,
        longitude: 78.6696,
        scheduled_date: "2026-05-09",
        referral_facility: "Alagappa Medical College & Hospital",
        referral_phone: "04565-240100",
        expected_footfall: 240,
    },
    RuralCampSite {
        code: "RURAL-RMD-002",
        name: "Paramakudi Hypertension and Diabetes Camp",
        camp_type: "specialized",
        status: "setup",
        village: "Nainarkoil",
        block: "Paramakudi",
        district: "Ramanathapuram",
        state: "Tamil Nadu",
        pincode: "623707",
        landmark: "Panchayat Union Primary School",
        latitude: 9.5455,
        longitude: 78.5912,
        scheduled_date: "2026-05-10",
        referral_facility: "Ramanathapuram Government Medical College",
        referral_phone: "04567-221100",
        expected_footfall: 210,
    },
    RuralCampSite {
        code: "RURAL-PDK-003",
        name: "Aranthangi Eye Screening Camp",
        camp_type: "eye_screening",
        status: "approved",
        village: "Avudaiyarkoil",
        block: "Aranthangi",
        district: "Pudukkottai",
        state: "Tamil Nadu",
        pincode: "614618",
        landmark: "Community Marriage Hall",
        latitude: 10.0701,
        longitude: 78.9585,
        scheduled_date: "2026-05-11",
        referral_facility: "Pudukkottai District Hospital",
        referral_phone: "04322-222300",
        expected_footfall: 180,
    },
    RuralCampSite {
        code: "RURAL-THN-004",
        name: "Cumbum Valley General Health Camp",
        camp_type: "general_health",
        status: "approved",
        village: "Lower Camp",
        block: "Cumbum",
        district: "Theni",
        state: "Tamil Nadu",
        pincode: "625516",
        landmark: "Primary Health Centre Annexe",
        latitude: 9.7354,
        longitude: 77.2847,
        scheduled_date: "2026-05-13",
        referral_facility: "Theni Government Medical College",
        referral_phone: "04546-244100",
        expected_footfall: 220,
    },
    RuralCampSite {
        code: "RURAL-WYD-005",
        name: "Mananthavady Tribal Health Camp",
        camp_type: "general_health",
        status: "planned",
        village: "Thirunelly",
        block: "Mananthavady",
        district: "Wayanad",
        state: "Kerala",
        pincode: "670646",
        landmark: "Tribal Extension Office",
        latitude: 11.9128,
        longitude: 76.0162,
        scheduled_date: "2026-05-16",
        referral_facility: "Wayanad Government Medical College",
        referral_phone: "04936-202200",
        expected_footfall: 160,
    },
    RuralCampSite {
        code: "RURAL-PKD-006",
        name: "Palakkad Border Screening Camp",
        camp_type: "specialized",
        status: "planned",
        village: "Kozhinjampara",
        block: "Chittur",
        district: "Palakkad",
        state: "Kerala",
        pincode: "678555",
        landmark: "Village Office Campus",
        latitude: 10.7411,
        longitude: 76.7829,
        scheduled_date: "2026-05-18",
        referral_facility: "District Hospital Palakkad",
        referral_phone: "0491-2534000",
        expected_footfall: 190,
    },
    RuralCampSite {
        code: "RURAL-CRN-007",
        name: "Kollegal Dental and General Camp",
        camp_type: "dental",
        status: "planned",
        village: "Hanur",
        block: "Kollegal",
        district: "Chamarajanagar",
        state: "Karnataka",
        pincode: "571439",
        landmark: "Gram Panchayat Hall",
        latitude: 12.1048,
        longitude: 77.3109,
        scheduled_date: "2026-05-21",
        referral_facility: "Chamarajanagar Institute of Medical Sciences",
        referral_phone: "08226-222085",
        expected_footfall: 170,
    },
    RuralCampSite {
        code: "RURAL-CTR-008",
        name: "Chittoor Rural Outreach Camp",
        camp_type: "general_health",
        status: "planned",
        village: "Gudipala",
        block: "Chittoor Rural",
        district: "Chittoor",
        state: "Andhra Pradesh",
        pincode: "517132",
        landmark: "Mandal Parishad School",
        latitude: 13.1883,
        longitude: 79.1487,
        scheduled_date: "2026-05-23",
        referral_facility: "Chittoor Government District Hospital",
        referral_phone: "08572-233090",
        expected_footfall: 200,
    },
];

const CAMP_STAFF: &[CampStaff] = &[
    CampStaff {
        username: "camp_rohit",
        employee_code: "CAMP-ROHIT",
        role_in_camp: "Camp coordinator",
        phone: "9003100101",
    },
    CampStaff {
        username: "dr_ravi",
        employee_code: "CAMP-DR-RAVI",
        role_in_camp: "Medical officer",
        phone: "9003100102",
    },
    CampStaff {
        username: "nurse_anita",
        employee_code: "CAMP-NURSE-ANITA",
        role_in_camp: "Triage and vitals nurse",
        phone: "9003100103",
    },
    CampStaff {
        username: "lab_suresh",
        employee_code: "CAMP-LAB-SURESH",
        role_in_camp: "Sample collection technician",
        phone: "9003100104",
    },
    CampStaff {
        username: "recept_meera",
        employee_code: "CAMP-REG-MEERA",
        role_in_camp: "Registration desk",
        phone: "9003100105",
    },
];

const CHECKLIST: &[ChecklistSeed] = &[
    ChecklistSeed {
        category: "site_safety",
        code: "site_lighting_power",
        label: "Site lighting, backup power and charging point verified",
        nabh_chapter: "FMS",
    },
    ChecklistSeed {
        category: "site_safety",
        code: "water_sanitation",
        label: "Safe drinking water, toilets and hand-wash station available",
        nabh_chapter: "FMS/HIC",
    },
    ChecklistSeed {
        category: "infection_control",
        code: "hand_hygiene_ppe",
        label: "Hand hygiene station, PPE and disinfection workflow ready",
        nabh_chapter: "HIC",
    },
    ChecklistSeed {
        category: "infection_control",
        code: "biomedical_waste_bins",
        label: "BMW color-coded bins and sharps container placed",
        nabh_chapter: "HIC/ROM",
    },
    ChecklistSeed {
        category: "patient_rights",
        code: "privacy_screen",
        label: "Privacy screens for examination and counselling available",
        nabh_chapter: "PRE",
    },
    ChecklistSeed {
        category: "patient_rights",
        code: "education_material",
        label: "Patient education material in local language available",
        nabh_chapter: "PRE",
    },
    ChecklistSeed {
        category: "clinical",
        code: "triage_referral_protocol",
        label: "Triage, emergency referral and transport protocol briefed",
        nabh_chapter: "AAC/COP",
    },
    ChecklistSeed {
        category: "clinical",
        code: "two_identifier_check",
        label: "Two identifier check enforced before screening and sample collection",
        nabh_chapter: "PSQ",
    },
    ChecklistSeed {
        category: "records",
        code: "offline_packet_downloaded",
        label: "Offline packet downloaded, device charged and paper fallback ready",
        nabh_chapter: "IMS",
    },
    ChecklistSeed {
        category: "records",
        code: "consent_register_ready",
        label: "Consent/refusal register and witness process ready",
        nabh_chapter: "PRE/IMS",
    },
    ChecklistSeed {
        category: "logistics",
        code: "crowd_flow_marked",
        label: "Queue, waiting, triage, screening and exit flow marked",
        nabh_chapter: "FMS",
    },
    ChecklistSeed {
        category: "logistics",
        code: "ambulance_route_confirmed",
        label: "Ambulance pickup point and referral route confirmed",
        nabh_chapter: "AAC/FMS",
    },
];

const SUPPLIES: &[SupplySeed] = &[
    SupplySeed {
        category: "equipment",
        item_name: "Digital BP apparatus",
        unit: "nos",
        planned_qty: "6",
        batch_no: None,
        expiry_date: None,
        critical: true,
    },
    SupplySeed {
        category: "equipment",
        item_name: "Pulse oximeter",
        unit: "nos",
        planned_qty: "8",
        batch_no: None,
        expiry_date: None,
        critical: true,
    },
    SupplySeed {
        category: "equipment",
        item_name: "Glucometer",
        unit: "nos",
        planned_qty: "4",
        batch_no: None,
        expiry_date: None,
        critical: true,
    },
    SupplySeed {
        category: "consumable",
        item_name: "Lancets",
        unit: "pcs",
        planned_qty: "500",
        batch_no: Some("LNC-RURAL-26"),
        expiry_date: Some("2027-12-31"),
        critical: true,
    },
    SupplySeed {
        category: "consumable",
        item_name: "Glucose strips",
        unit: "pcs",
        planned_qty: "500",
        batch_no: Some("GST-RURAL-26"),
        expiry_date: Some("2027-06-30"),
        critical: true,
    },
    SupplySeed {
        category: "ppe",
        item_name: "Examination gloves",
        unit: "pairs",
        planned_qty: "800",
        batch_no: Some("PPE-GLOVE-26"),
        expiry_date: Some("2028-03-31"),
        critical: true,
    },
    SupplySeed {
        category: "biomedical_waste",
        item_name: "Yellow biomedical waste bags",
        unit: "bags",
        planned_qty: "40",
        batch_no: Some("BMW-YEL-26"),
        expiry_date: None,
        critical: true,
    },
    SupplySeed {
        category: "biomedical_waste",
        item_name: "White sharps container",
        unit: "nos",
        planned_qty: "12",
        batch_no: Some("BMW-SHARP-26"),
        expiry_date: None,
        critical: true,
    },
    SupplySeed {
        category: "document",
        item_name: "Consent and referral forms",
        unit: "sets",
        planned_qty: "300",
        batch_no: None,
        expiry_date: None,
        critical: true,
    },
    SupplySeed {
        category: "it",
        item_name: "Android tablet with local HTTPS trust",
        unit: "nos",
        planned_qty: "6",
        batch_no: None,
        expiry_date: None,
        critical: true,
    },
];

const FIRST_NAMES: &[&str] = &[
    "Arumugam",
    "Selvi",
    "Muthu",
    "Kavitha",
    "Ramesh",
    "Meenakshi",
    "Murugan",
    "Jayanthi",
    "Suresh",
    "Revathi",
    "Prakash",
    "Lakshmi",
    "Kannan",
    "Fathima",
    "Rahman",
    "Mary",
    "Joseph",
    "Anitha",
    "Gopal",
    "Valli",
];

const LAST_NAMES: &[&str] = &[
    "Kumar", "Devi", "Pillai", "Nair", "Reddy", "Gowda", "Shetty", "Das", "Bai", "Rao", "M", "S",
];

const CHIEF_COMPLAINTS: &[&str] = &[
    "Fever and body pain",
    "Cough with throat irritation",
    "Headache and high BP screening",
    "Diabetes follow-up screening",
    "Blurred vision while reading",
    "Joint pain and fatigue",
    "Dental pain",
    "General wellness check",
    "Breathlessness on exertion",
    "Antenatal wellness counselling",
];

pub(super) async fn seed_rural_camp_fixtures(
    pool: &PgPool,
    tenant_id: Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    let Some(general_dept_id) = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM departments WHERE tenant_id = $1 AND code = 'GEN-MEDICINE'",
    )
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    else {
        tracing::warn!("GEN-MEDICINE department not found, skipping rural camp fixtures");
        tx.commit().await?;
        return Ok(());
    };

    let Some(coordinator_user_id) = user_id_by_username(&mut tx, tenant_id, "camp_rohit").await?
    else {
        tracing::warn!("camp_rohit user not found, skipping rural camp fixtures");
        tx.commit().await?;
        return Ok(());
    };

    let existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM camps WHERE tenant_id = $1 AND camp_code LIKE 'RURAL-%'",
    )
    .bind(tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    if existing > 0 {
        let history_backfilled =
            backfill_existing_rural_patient_history(&mut tx, tenant_id, coordinator_user_id)
                .await?;
        tracing::debug!(
            history_backfilled,
            "Rural camp fixtures already seeded, applied history backfill"
        );
        tx.commit().await?;
        return Ok(());
    }

    let staff_employees = ensure_camp_staff_employees(&mut tx, tenant_id, general_dept_id).await?;

    let mut total_registrations = 0usize;
    let mut total_screenings = 0usize;
    let mut total_lab_samples = 0usize;

    for (site_index, site) in RURAL_CAMP_SITES.iter().enumerate() {
        let camp_id = insert_camp(
            &mut tx,
            tenant_id,
            general_dept_id,
            coordinator_user_id,
            site,
        )
        .await?;

        seed_team(&mut tx, tenant_id, camp_id, &staff_employees).await?;
        seed_remote_setup(&mut tx, tenant_id, camp_id, coordinator_user_id, site).await?;
        seed_checklist(&mut tx, tenant_id, camp_id, coordinator_user_id, site).await?;
        seed_supplies(&mut tx, tenant_id, camp_id, site_index).await?;

        for person_index in 0..PATIENTS_PER_RURAL_CAMP {
            let scope = SeedPersonScope {
                tenant_id,
                camp_id,
                general_dept_id,
                coordinator_user_id,
                site,
                site_index,
            };
            let registration = seed_camp_person(&mut tx, &scope, person_index).await?;

            total_registrations += 1;
            if registration.screened {
                total_screenings += 1;
            }
            if registration.lab_sampled {
                total_lab_samples += 1;
            }
        }

        sqlx::query(
            "UPDATE camps SET actual_participants = $3 \
             WHERE tenant_id = $1 AND id = $2",
        )
        .bind(tenant_id)
        .bind(camp_id)
        .bind(i32::try_from(PATIENTS_PER_RURAL_CAMP).unwrap_or(i32::MAX))
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    tracing::info!(
        camps = RURAL_CAMP_SITES.len(),
        registrations = total_registrations,
        screenings = total_screenings,
        lab_samples = total_lab_samples,
        "Seeded rural camp fixtures"
    );

    Ok(())
}

async fn insert_camp(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    department_id: Uuid,
    created_by: Uuid,
    site: &RuralCampSite,
) -> Result<Uuid, sqlx::Error> {
    sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO camps \
         (tenant_id, camp_code, name, camp_type, status, organizing_department_id, \
          scheduled_date, start_time, end_time, venue_name, venue_address, venue_city, \
          venue_state, venue_pincode, venue_latitude, venue_longitude, expected_participants, \
          actual_participants, budget_allocated, logistics_notes, equipment_list, is_free, \
          discount_percentage, approved_by, approved_at, created_by) \
         VALUES ($1, $2, $3, $4::camp_type, $5::camp_status, $6, \
          $7::date, '08:30', '16:30', $8, $9, $10, \
          $11, $12, $13, $14, $15, \
          0, 0, $16, $17, true, \
          100, $18, CASE WHEN $5 IN ('approved', 'setup', 'active') THEN now() ELSE NULL END, $18) \
         ON CONFLICT (tenant_id, camp_code) DO UPDATE SET \
          name = EXCLUDED.name, status = EXCLUDED.status, scheduled_date = EXCLUDED.scheduled_date \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(site.code)
    .bind(site.name)
    .bind(site.camp_type)
    .bind(site.status)
    .bind(department_id)
    .bind(site.scheduled_date)
    .bind(site.landmark)
    .bind(format!(
        "{}, {}, {}, {}, {}",
        site.landmark, site.village, site.block, site.district, site.pincode
    ))
    .bind(site.village)
    .bind(site.state)
    .bind(site.pincode)
    .bind(site.latitude)
    .bind(site.longitude)
    .bind(site.expected_footfall)
    .bind(format!(
        "Remote rural site: referral route to {}; privacy screens, BMW bins, water, power and paper fallback required.",
        site.referral_facility
    ))
    .bind(json!({
        "stations": [
            "registration",
            "triage",
            "doctor_review",
            "sample_collection",
            "pharmacy_counselling",
            "referral_desk"
        ],
        "offline_packet": true,
        "paper_fallback_forms": true
    }))
    .bind(created_by)
    .fetch_one(&mut **tx)
    .await
}

async fn ensure_camp_staff_employees(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    department_id: Uuid,
) -> Result<Vec<Uuid>, sqlx::Error> {
    let mut ids = Vec::with_capacity(CAMP_STAFF.len());

    for staff in CAMP_STAFF {
        let Some(user) = user_by_username(tx, tenant_id, staff.username).await? else {
            continue;
        };
        let (first_name, last_name) = split_name(&user.full_name);
        let employee_id = sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO employees \
             (tenant_id, user_id, employee_code, first_name, last_name, phone, email, \
              employment_type, status, department_id, qualifications, address, emergency_contact, notes) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, \
              'permanent', 'active', $8, $9, $10, $11, $12) \
             ON CONFLICT (tenant_id, employee_code) DO UPDATE SET \
              user_id = EXCLUDED.user_id, phone = EXCLUDED.phone, email = EXCLUDED.email, \
              department_id = EXCLUDED.department_id, updated_at = now() \
             RETURNING id",
        )
        .bind(tenant_id)
        .bind(user.id)
        .bind(staff.employee_code)
        .bind(first_name)
        .bind(last_name)
        .bind(staff.phone)
        .bind(user.email)
        .bind(department_id)
        .bind(json!([
            {
                "credential": "Rural camp orientation",
                "valid_for": "2026 camp season"
            }
        ]))
        .bind(json!({
            "line1": "Alagappa Medical College & Hospital",
            "city": "Karaikudi",
            "state": "Tamil Nadu"
        }))
        .bind(json!({
            "name": "Camp control room",
            "phone": "04565-240100"
        }))
        .bind(staff.role_in_camp)
        .fetch_one(&mut **tx)
        .await?;

        ids.push(employee_id);
    }

    Ok(ids)
}

async fn seed_team(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    camp_id: Uuid,
    employee_ids: &[Uuid],
) -> Result<(), sqlx::Error> {
    for (idx, employee_id) in employee_ids.iter().enumerate() {
        let role = CAMP_STAFF
            .get(idx)
            .map(|staff| staff.role_in_camp)
            .unwrap_or("Camp team member");
        sqlx::query(
            "INSERT INTO camp_team_members \
             (tenant_id, camp_id, employee_id, role_in_camp, is_confirmed, notes) \
             VALUES ($1, $2, $3, $4, true, 'Seeded rural camp team member') \
             ON CONFLICT (tenant_id, camp_id, employee_id) DO UPDATE SET \
              role_in_camp = EXCLUDED.role_in_camp, is_confirmed = true, updated_at = now()",
        )
        .bind(tenant_id)
        .bind(camp_id)
        .bind(employee_id)
        .bind(role)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

async fn seed_remote_setup(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    camp_id: Uuid,
    coordinator_user_id: Uuid,
    site: &RuralCampSite,
) -> Result<(), sqlx::Error> {
    let ready = matches!(site.status, "active" | "setup" | "approved");
    sqlx::query(
        "INSERT INTO camp_remote_setups \
         (tenant_id, camp_id, village_name, block_name, district_name, site_landmark, latitude, \
          longitude, expected_footfall, site_contact_name, site_contact_phone, \
          local_authority_name, local_authority_phone, referral_facility_name, \
          referral_facility_phone, ambulance_contact_name, ambulance_contact_phone, \
          emergency_route_notes, network_plan, power_plan, water_sanitation_plan, privacy_plan, \
          crowd_control_plan, bmw_plan, infection_control_plan, status, readiness_score, \
          completed_by, completed_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, \
          $8, $9, 'Village health volunteer', '9003100200', \
          'Panchayat president', '9003100201', $10, \
          $11, '108 ambulance desk', '108', \
          $12, $13, $14, $15, $16, \
          $17, $18, $19, $20, $21, \
          CASE WHEN $20 = 'ready' THEN $22 ELSE NULL END, CASE WHEN $20 = 'ready' THEN now() ELSE NULL END) \
         ON CONFLICT (tenant_id, camp_id) DO UPDATE SET \
          village_name = EXCLUDED.village_name, status = EXCLUDED.status, \
          readiness_score = EXCLUDED.readiness_score, updated_at = now()",
    )
    .bind(tenant_id)
    .bind(camp_id)
    .bind(site.village)
    .bind(site.block)
    .bind(site.district)
    .bind(site.landmark)
    .bind(site.latitude)
    .bind(site.longitude)
    .bind(site.expected_footfall)
    .bind(site.referral_facility)
    .bind(site.referral_phone)
    .bind(format!(
        "Primary route from {} to {}; emergency vehicle pickup at {} gate.",
        site.village, site.referral_facility, site.landmark
    ))
    .bind("Primary mobile data, local router for staff devices, paper fallback if network drops.")
    .bind("Generator plus charged tablets and power banks for registration and vitals desks.")
    .bind("Panchayat water point, hand-wash station and separate toilet access verified.")
    .bind("Screens for examination desk; display uses token numbers instead of full names.")
    .bind("Separate entry, triage, sample collection and exit queues marked with rope barriers.")
    .bind("Yellow/red/white/blue BMW segregation with sharps container and return manifest.")
    .bind("Hand hygiene, PPE, surface disinfection and needle-stick response briefed.")
    .bind(if ready { "ready" } else { "draft" })
    .bind(if ready { 92 } else { 64 })
    .bind(coordinator_user_id)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

async fn seed_checklist(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    camp_id: Uuid,
    coordinator_user_id: Uuid,
    site: &RuralCampSite,
) -> Result<(), sqlx::Error> {
    for (idx, item) in CHECKLIST.iter().enumerate() {
        let status = if matches!(site.status, "planned") && idx % 5 == 0 {
            "pending"
        } else if site.code == "RURAL-WYD-005" && item.code == "network_plan" {
            "issue"
        } else {
            "ok"
        };
        sqlx::query(
            "INSERT INTO camp_remote_checklist_items \
             (tenant_id, camp_id, category, code, label, nabh_chapter, required, status, \
              notes, checked_by, checked_at) \
             VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, \
              CASE WHEN $7 = 'ok' THEN now() ELSE NULL END) \
             ON CONFLICT (tenant_id, camp_id, code) DO UPDATE SET \
              status = EXCLUDED.status, notes = EXCLUDED.notes, updated_at = now()",
        )
        .bind(tenant_id)
        .bind(camp_id)
        .bind(item.category)
        .bind(item.code)
        .bind(item.label)
        .bind(item.nabh_chapter)
        .bind(status)
        .bind(format!("{} - {}", site.village, item.label))
        .bind(coordinator_user_id)
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

async fn seed_supplies(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    camp_id: Uuid,
    site_index: usize,
) -> Result<(), sqlx::Error> {
    for supply in SUPPLIES {
        let packed_adjustment = i32::try_from(site_index % 3).unwrap_or(0);
        sqlx::query(
            "INSERT INTO camp_supply_items \
             (tenant_id, camp_id, category, item_name, unit, planned_qty, packed_qty, \
              batch_no, expiry_date, is_critical, shortage_notes) \
             VALUES ($1, $2, $3, $4, $5, $6::numeric, \
              GREATEST($6::numeric - $7::numeric, 0), $8, $9::date, $10, $11)",
        )
        .bind(tenant_id)
        .bind(camp_id)
        .bind(supply.category)
        .bind(supply.item_name)
        .bind(supply.unit)
        .bind(supply.planned_qty)
        .bind(packed_adjustment)
        .bind(supply.batch_no)
        .bind(supply.expiry_date)
        .bind(supply.critical)
        .bind(if packed_adjustment > 0 && supply.critical {
            Some("Packed short by field store; verify before departure")
        } else {
            None
        })
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

struct SeededRegistration {
    screened: bool,
    lab_sampled: bool,
}

struct SeedPersonScope<'a> {
    tenant_id: Uuid,
    camp_id: Uuid,
    general_dept_id: Uuid,
    coordinator_user_id: Uuid,
    site: &'a RuralCampSite,
    site_index: usize,
}

async fn seed_camp_person(
    tx: &mut Transaction<'_, Postgres>,
    scope: &SeedPersonScope<'_>,
    person_index: usize,
) -> Result<SeededRegistration, sqlx::Error> {
    let tenant_id = scope.tenant_id;
    let camp_id = scope.camp_id;
    let department_id = scope.general_dept_id;
    let user_id = scope.coordinator_user_id;
    let site = scope.site;
    let site_index = scope.site_index;

    let linked_patient = person_index % 5 != 0;
    let first = FIRST_NAMES[(person_index + site_index) % FIRST_NAMES.len()];
    let last = LAST_NAMES[(person_index * 3 + site_index) % LAST_NAMES.len()];
    let gender = match person_index % 4 {
        0 => "female",
        1 | 2 => "male",
        _ => "female",
    };
    let age = 18 + i32::try_from((person_index * 7 + site_index * 3) % 62).unwrap_or(0);
    let phone = format!("9{:09}", 100_000_000 + site_index * 10_000 + person_index);
    let name = format!("{first} {last}");
    let complaint = CHIEF_COMPLAINTS[(person_index + site_index * 2) % CHIEF_COMPLAINTS.len()];
    let uhid = format!("{}-{:04}", site.code, person_index + 1);
    let dob = dob_from_age(age, person_index);

    let patient_id = if linked_patient {
        let id = sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO patients \
             (tenant_id, uhid, first_name, last_name, date_of_birth, gender, phone, address, \
              blood_group, no_known_allergies, registration_type, registration_source, \
              registered_by, preferred_language, last_visit_date, total_visits, address_line1, \
              attributes) \
             VALUES ($1, $2, $3, $4, $5, $6::gender, $7, $8, \
              $9::blood_group, $10, 'camp', 'camp', \
              $11, $12, $13::date, $14, $15, $16) \
             ON CONFLICT (tenant_id, uhid) DO UPDATE SET \
              phone = EXCLUDED.phone, address = EXCLUDED.address, updated_at = now() \
             RETURNING id",
        )
        .bind(tenant_id)
        .bind(&uhid)
        .bind(first)
        .bind(last)
        .bind(dob)
        .bind(gender)
        .bind(&phone)
        .bind(json!({
            "line1": format!("House {}, {}", person_index + 11, site.village),
            "village": site.village,
            "block": site.block,
            "district": site.district,
            "state": site.state,
            "pincode": site.pincode
        }))
        .bind(blood_group(person_index))
        .bind(person_index % 11 != 0)
        .bind(user_id)
        .bind(if matches!(site.state, "Kerala") {
            "Malayalam"
        } else if matches!(site.state, "Karnataka") {
            "Kannada"
        } else if matches!(site.state, "Andhra Pradesh") {
            "Telugu"
        } else {
            "Tamil"
        })
        .bind(site.scheduled_date)
        .bind(i32::try_from(1 + (person_index % 5)).unwrap_or(1))
        .bind(format!(
            "{}, {}, {}",
            site.village, site.district, site.pincode
        ))
        .bind(json!({
            "seed_source": "rural_camp_fixture",
            "camp_code": site.code,
            "priority": priority_category(age, person_index)
        }))
        .fetch_one(&mut **tx)
        .await?;

        if person_index % 17 == 0 {
            seed_allergy(tx, tenant_id, id, person_index).await?;
        }

        seed_recent_vitals(tx, tenant_id, id, department_id, user_id, person_index).await?;
        Some(id)
    } else {
        None
    };

    let seq = person_index + 1;
    let registration_number = format!("CR-{}-{seq:04}", site.code);
    let referred = is_referral(person_index);
    let screened = person_index % 10 != 0;
    let lab_sampled = screened && (person_index % 3 == 0 || high_sugar(person_index));
    let status = if referred {
        "referred"
    } else if screened {
        "screened"
    } else {
        "registered"
    };

    let registration_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO camp_registrations \
         (tenant_id, camp_id, registration_number, person_name, age, gender, phone, address, \
          id_proof_type, id_proof_number, patient_id, status, chief_complaint, is_walk_in, \
          registered_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, \
          $9, $10, $11, $12::camp_registration_status, $13, $14, $15) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(camp_id)
    .bind(registration_number)
    .bind(&name)
    .bind(age)
    .bind(gender)
    .bind(&phone)
    .bind(format!(
        "House {}, {}, {}, {}, {}",
        person_index + 11,
        site.village,
        site.district,
        site.state,
        site.pincode
    ))
    .bind(if linked_patient {
        Some("UHID")
    } else {
        Some("Local ID")
    })
    .bind(if linked_patient {
        Some(uhid.clone())
    } else {
        Some(format!("LOCAL-{}-{seq:04}", site.code))
    })
    .bind(patient_id)
    .bind(status)
    .bind(complaint)
    .bind(!linked_patient)
    .bind(user_id)
    .fetch_one(&mut **tx)
    .await?;

    if screened {
        seed_screening(
            tx,
            tenant_id,
            registration_id,
            user_id,
            person_index,
            referred,
        )
        .await?;
    }
    if lab_sampled {
        seed_lab_sample(tx, tenant_id, registration_id, user_id, site, person_index).await?;
    }
    if referred {
        seed_referral(
            tx,
            tenant_id,
            camp_id,
            registration_id,
            user_id,
            site,
            person_index,
        )
        .await?;
    }
    if person_index == 12 && site_index % 2 == 0 {
        seed_incident(tx, tenant_id, camp_id, registration_id, user_id).await?;
    }

    Ok(SeededRegistration {
        screened,
        lab_sampled,
    })
}

async fn seed_recent_vitals(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    department_id: Uuid,
    user_id: Uuid,
    person_index: usize,
) -> Result<(), sqlx::Error> {
    let encounter_id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO encounters \
         (tenant_id, patient_id, encounter_type, status, department_id, doctor_id, \
          encounter_date, notes, created_by, visit_type, attributes) \
         VALUES ($1, $2, 'opd', 'open', $3, $4, CURRENT_DATE - (($5::int % 45) || ' days')::interval, \
          'Recent baseline visit used for rural camp packet', $4, 'walk_in', $6) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(department_id)
    .bind(user_id)
    .bind(i32::try_from(person_index).unwrap_or(0))
    .bind(json!({ "source": "rural_camp_fixture" }))
    .fetch_one(&mut **tx)
    .await?;

    let systolic = 108 + i32::try_from((person_index * 7) % 62).unwrap_or(0);
    let diastolic = 68 + i32::try_from((person_index * 5) % 28).unwrap_or(0);
    let pulse = 66 + i32::try_from((person_index * 3) % 34).unwrap_or(0);
    let spo2 = 92 + i32::try_from(person_index % 8).unwrap_or(0);
    let weight = 45 + i32::try_from((person_index * 2) % 42).unwrap_or(0);
    let height = 148 + i32::try_from((person_index * 3) % 34).unwrap_or(0);

    sqlx::query(
        "INSERT INTO vitals \
         (tenant_id, encounter_id, recorded_by, temperature, pulse, systolic_bp, diastolic_bp, \
          respiratory_rate, spo2, weight_kg, height_cm, bmi, notes, recorded_at) \
         VALUES ($1, $2, $3, $4::numeric, $5, $6, $7, \
          $8, $9, $10::numeric, $11::numeric, $12::numeric, $13, now() - (($14::int % 14) || ' days')::interval)",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(user_id)
    .bind(format!("{:.1}", 36.2 + f64::from((person_index % 9) as i32) / 10.0))
    .bind(pulse)
    .bind(systolic)
    .bind(diastolic)
    .bind(16 + i32::try_from(person_index % 8).unwrap_or(0))
    .bind(spo2)
    .bind(weight.to_string())
    .bind(height.to_string())
    .bind(format!("{:.1}", bmi(f64::from(weight), f64::from(height))))
    .bind("Baseline vitals for camp packet")
    .bind(i32::try_from(person_index).unwrap_or(0))
    .execute(&mut **tx)
    .await?;

    seed_patient_history_for_encounter(
        tx,
        tenant_id,
        patient_id,
        encounter_id,
        user_id,
        person_index,
    )
    .await?;

    Ok(())
}

async fn backfill_existing_rural_patient_history(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    user_id: Uuid,
) -> Result<usize, sqlx::Error> {
    let rows = sqlx::query_as::<_, RuralEncounterBackfill>(
        "SELECT \
            e.id AS encounter_id, \
            e.patient_id, \
            row_number() OVER (ORDER BY e.created_at, e.id)::bigint AS seed_index \
         FROM encounters e \
         WHERE e.tenant_id = $1 \
           AND e.attributes->>'source' = 'rural_camp_fixture' \
           AND ( \
             NOT EXISTS ( \
               SELECT 1 FROM diagnoses dx \
               WHERE dx.tenant_id = e.tenant_id AND dx.encounter_id = e.id \
             ) \
             OR NOT EXISTS ( \
               SELECT 1 FROM prescriptions pr \
               WHERE pr.tenant_id = e.tenant_id AND pr.encounter_id = e.id \
             ) \
           ) \
         ORDER BY e.created_at, e.id \
         LIMIT 1000",
    )
    .bind(tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    let count = rows.len();
    for row in rows {
        seed_patient_history_for_encounter(
            tx,
            tenant_id,
            row.patient_id,
            row.encounter_id,
            user_id,
            usize::try_from(row.seed_index).unwrap_or(0),
        )
        .await?;
    }

    Ok(count)
}

async fn seed_patient_history_for_encounter(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    encounter_id: Uuid,
    user_id: Uuid,
    person_index: usize,
) -> Result<(), sqlx::Error> {
    let diagnosis_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS( \
            SELECT 1 FROM diagnoses WHERE tenant_id = $1 AND encounter_id = $2 \
         )",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .fetch_one(&mut **tx)
    .await?;

    if !diagnosis_exists {
        let diagnosis = diagnosis_history_seed(person_index);
        sqlx::query(
            "INSERT INTO diagnoses \
             (tenant_id, encounter_id, icd_code, description, is_primary, notes, severity, \
              certainty, onset_date, snomed_display) \
             VALUES ($1, $2, $3, $4, true, $5, $6, 'confirmed', \
              CURRENT_DATE - (($7::int % 365) || ' days')::interval, $8)",
        )
        .bind(tenant_id)
        .bind(encounter_id)
        .bind(diagnosis.icd_code)
        .bind(diagnosis.description)
        .bind("Seeded prior condition for camp packet patient chart")
        .bind(diagnosis.severity)
        .bind(i32::try_from(person_index).unwrap_or(0))
        .bind(diagnosis.snomed_display)
        .execute(&mut **tx)
        .await?;
    }

    let prescription_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS( \
            SELECT 1 FROM prescriptions WHERE tenant_id = $1 AND encounter_id = $2 \
         )",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .fetch_one(&mut **tx)
    .await?;

    if !prescription_exists {
        let prescription_id = sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO prescriptions \
             (tenant_id, encounter_id, doctor_id, patient_id, notes) \
             VALUES ($1, $2, $3, $4, 'Prior prescription included in rural camp safety packet') \
             RETURNING id",
        )
        .bind(tenant_id)
        .bind(encounter_id)
        .bind(user_id)
        .bind(patient_id)
        .fetch_one(&mut **tx)
        .await?;

        for item in medication_history_seed(person_index) {
            sqlx::query(
                "INSERT INTO prescription_items \
                 (tenant_id, prescription_id, drug_name, dosage, frequency, duration, route, \
                  instructions, item_status) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')",
            )
            .bind(tenant_id)
            .bind(prescription_id)
            .bind(item.drug_name)
            .bind(item.dosage)
            .bind(item.frequency)
            .bind(item.duration)
            .bind(item.route)
            .bind(item.instructions)
            .execute(&mut **tx)
            .await?;
        }
    }

    Ok(())
}

async fn seed_allergy(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    patient_id: Uuid,
    person_index: usize,
) -> Result<(), sqlx::Error> {
    let (allergen, reaction, severity) = if person_index % 34 == 0 {
        ("Penicillin", "Rash and wheeze", "severe")
    } else {
        ("Dust", "Sneezing", "mild")
    };
    sqlx::query(
        "INSERT INTO patient_allergies \
         (tenant_id, patient_id, allergy_type, allergen_name, reaction, severity, reported_by) \
         VALUES ($1, $2, $3::allergy_type, $4, $5, $6::allergy_severity, 'Camp pre-load')",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(if allergen == "Dust" {
        "environmental"
    } else {
        "drug"
    })
    .bind(allergen)
    .bind(reaction)
    .bind(severity)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

async fn seed_screening(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    registration_id: Uuid,
    user_id: Uuid,
    person_index: usize,
    referred: bool,
) -> Result<(), sqlx::Error> {
    let systolic = 110 + i32::try_from((person_index * 9) % 64).unwrap_or(0);
    let diastolic = 70 + i32::try_from((person_index * 4) % 28).unwrap_or(0);
    let pulse = 68 + i32::try_from((person_index * 5) % 38).unwrap_or(0);
    let spo2 = 93 + i32::try_from(person_index % 7).unwrap_or(0);
    let sugar = 84 + i32::try_from((person_index * 13) % 230).unwrap_or(0);
    let weight = 44 + i32::try_from((person_index * 3) % 44).unwrap_or(0);
    let height = 147 + i32::try_from((person_index * 5) % 35).unwrap_or(0);

    sqlx::query(
        "INSERT INTO camp_screenings \
         (tenant_id, registration_id, bp_systolic, bp_diastolic, pulse_rate, spo2, \
          temperature, blood_sugar_random, bmi, height_cm, weight_kg, visual_acuity_left, \
          visual_acuity_right, findings, diagnosis, advice, referred_to_hospital, \
          referral_department, referral_urgency, screened_by) \
         VALUES ($1, $2, $3, $4, $5, $6, \
          $7::numeric, $8::numeric, $9::numeric, $10::numeric, $11::numeric, $12, \
          $13, $14, $15, $16, $17, \
          $18, $19, $20)",
    )
    .bind(tenant_id)
    .bind(registration_id)
    .bind(systolic)
    .bind(diastolic)
    .bind(pulse)
    .bind(spo2)
    .bind(format!(
        "{:.1}",
        36.1 + f64::from((person_index % 11) as i32) / 10.0
    ))
    .bind(sugar.to_string())
    .bind(format!("{:.1}", bmi(f64::from(weight), f64::from(height))))
    .bind(height.to_string())
    .bind(weight.to_string())
    .bind(if person_index % 7 == 0 {
        Some("6/12")
    } else {
        Some("6/9")
    })
    .bind(if person_index % 9 == 0 {
        Some("6/18")
    } else {
        Some("6/9")
    })
    .bind(screening_finding(systolic, sugar, person_index))
    .bind(screening_diagnosis(systolic, sugar, person_index))
    .bind(if referred {
        "Referral slip generated; counselled patient and attendant."
    } else {
        "Lifestyle advice, hydration, medication adherence and follow-up guidance given."
    })
    .bind(referred)
    .bind(if referred {
        Some(referral_department(person_index))
    } else {
        None
    })
    .bind(if person_index % 19 == 0 {
        Some("urgent")
    } else if referred {
        Some("routine")
    } else {
        None
    })
    .bind(user_id)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

async fn seed_lab_sample(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    registration_id: Uuid,
    user_id: Uuid,
    site: &RuralCampSite,
    person_index: usize,
) -> Result<(), sqlx::Error> {
    let barcode = format!("{}-LAB-{:04}", site.code, person_index + 1);
    sqlx::query(
        "INSERT INTO camp_lab_samples \
         (tenant_id, registration_id, sample_type, test_requested, barcode, collected_by, sent_to_lab) \
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(tenant_id)
    .bind(registration_id)
    .bind(if high_sugar(person_index) {
        "capillary_blood"
    } else {
        "venous_blood"
    })
    .bind(if high_sugar(person_index) {
        Some("Random blood sugar / HbA1c advice")
    } else {
        Some("CBC and malaria rapid screen")
    })
    .bind(barcode)
    .bind(user_id)
    .bind(person_index % 6 != 0)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

async fn seed_referral(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    camp_id: Uuid,
    registration_id: Uuid,
    user_id: Uuid,
    site: &RuralCampSite,
    person_index: usize,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO camp_referrals \
         (tenant_id, camp_id, registration_id, referred_to_facility, referral_department, \
          urgency, reason, transport_mode, ambulance_required, attendant_name, attendant_phone, \
          status, referred_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'created', $12)",
    )
    .bind(tenant_id)
    .bind(camp_id)
    .bind(registration_id)
    .bind(site.referral_facility)
    .bind(referral_department(person_index))
    .bind(if person_index % 19 == 0 {
        "urgent"
    } else {
        "routine"
    })
    .bind("Camp screening threshold met for higher-centre review")
    .bind(if person_index % 19 == 0 {
        Some("ambulance")
    } else {
        Some("own_transport")
    })
    .bind(person_index % 19 == 0)
    .bind("Family attendant")
    .bind("9003100300")
    .bind(user_id)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

async fn seed_incident(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    camp_id: Uuid,
    registration_id: Uuid,
    user_id: Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO camp_incidents \
         (tenant_id, camp_id, registration_id, incident_type, severity, description, \
          immediate_action, status, reported_by) \
         VALUES ($1, $2, $3, 'crowd_control', 'moderate', \
          'Queue congestion at vitals station during peak arrival.', \
          'Opened second triage desk and moved elderly patients to priority line.', \
          'contained', $4)",
    )
    .bind(tenant_id)
    .bind(camp_id)
    .bind(registration_id)
    .bind(user_id)
    .execute(&mut **tx)
    .await?;

    Ok(())
}

async fn user_id_by_username(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    username: &str,
) -> Result<Option<Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM users WHERE tenant_id = $1 AND username = $2")
        .bind(tenant_id)
        .bind(username)
        .fetch_optional(&mut **tx)
        .await
}

async fn user_by_username(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: Uuid,
    username: &str,
) -> Result<Option<UserLite>, sqlx::Error> {
    sqlx::query_as::<_, UserLite>(
        "SELECT id, full_name, email FROM users WHERE tenant_id = $1 AND username = $2",
    )
    .bind(tenant_id)
    .bind(username)
    .fetch_optional(&mut **tx)
    .await
}

fn split_name(full_name: &str) -> (&str, Option<&str>) {
    let trimmed = full_name.trim();
    if let Some((first, rest)) = trimmed.split_once(' ') {
        (first, Some(rest))
    } else {
        (trimmed, None)
    }
}

fn dob_from_age(age: i32, person_index: usize) -> NaiveDate {
    let year = 2026 - age;
    let month = u32::try_from((person_index % 12) + 1).unwrap_or(1);
    let day = u32::try_from((person_index % 27) + 1).unwrap_or(1);
    if let Some(date) = NaiveDate::from_ymd_opt(year, month, day) {
        date
    } else {
        NaiveDate::from_ymd_opt(1980, 1, 1).unwrap_or(NaiveDate::MIN)
    }
}

fn blood_group(person_index: usize) -> &'static str {
    match person_index % 8 {
        0 => "a_positive",
        1 => "b_positive",
        2 => "o_positive",
        3 => "ab_positive",
        4 => "a_negative",
        5 => "b_negative",
        6 => "o_negative",
        _ => "unknown",
    }
}

fn priority_category(age: i32, person_index: usize) -> &'static str {
    if age >= 70 {
        "elderly"
    } else if person_index % 23 == 0 {
        "disabled"
    } else if person_index % 29 == 0 {
        "pregnant"
    } else {
        "normal"
    }
}

fn high_sugar(person_index: usize) -> bool {
    person_index % 11 == 0 || person_index % 37 == 0
}

fn is_referral(person_index: usize) -> bool {
    person_index % 13 == 0 || person_index % 19 == 0 || high_sugar(person_index)
}

fn referral_department(person_index: usize) -> &'static str {
    if high_sugar(person_index) {
        "General Medicine"
    } else if person_index % 19 == 0 {
        "Cardiology"
    } else if person_index % 7 == 0 {
        "Ophthalmology"
    } else {
        "General Medicine"
    }
}

fn screening_finding(systolic: i32, sugar: i32, person_index: usize) -> &'static str {
    if systolic >= 150 {
        "Raised blood pressure on camp screening"
    } else if sugar >= 220 {
        "High random blood sugar"
    } else if person_index % 7 == 0 {
        "Reduced visual acuity"
    } else {
        "No immediate danger signs"
    }
}

fn screening_diagnosis(systolic: i32, sugar: i32, person_index: usize) -> &'static str {
    if systolic >= 150 {
        "Hypertension suspected"
    } else if sugar >= 220 {
        "Diabetes control review required"
    } else if person_index % 7 == 0 {
        "Refractive error suspected"
    } else {
        "General health screening"
    }
}

fn diagnosis_history_seed(person_index: usize) -> DiagnosisSeed {
    match person_index % 8 {
        0 => DiagnosisSeed {
            icd_code: "I10",
            description: "Essential hypertension",
            severity: "moderate",
            snomed_display: "Hypertensive disorder, systemic arterial",
        },
        1 => DiagnosisSeed {
            icd_code: "E11.9",
            description: "Type 2 diabetes mellitus without complications",
            severity: "moderate",
            snomed_display: "Type 2 diabetes mellitus",
        },
        2 => DiagnosisSeed {
            icd_code: "J45.9",
            description: "Asthma, unspecified",
            severity: "mild",
            snomed_display: "Asthma",
        },
        3 => DiagnosisSeed {
            icd_code: "D50.9",
            description: "Iron deficiency anaemia, unspecified",
            severity: "mild",
            snomed_display: "Iron deficiency anemia",
        },
        4 => DiagnosisSeed {
            icd_code: "M54.5",
            description: "Low back pain",
            severity: "mild",
            snomed_display: "Low back pain",
        },
        5 => DiagnosisSeed {
            icd_code: "H52.7",
            description: "Disorder of refraction, unspecified",
            severity: "mild",
            snomed_display: "Refractive error",
        },
        6 => DiagnosisSeed {
            icd_code: "K29.7",
            description: "Gastritis, unspecified",
            severity: "mild",
            snomed_display: "Gastritis",
        },
        _ => DiagnosisSeed {
            icd_code: "Z13.9",
            description: "Screening examination, unspecified",
            severity: "mild",
            snomed_display: "Screening for disorder",
        },
    }
}

fn medication_history_seed(person_index: usize) -> [MedicationSeed; 2] {
    match person_index % 6 {
        0 => [
            MedicationSeed {
                drug_name: "Amlodipine",
                dosage: "5 mg",
                frequency: "Once daily",
                duration: "30 days",
                route: "oral",
                instructions: "Take after breakfast; monitor pedal edema",
            },
            MedicationSeed {
                drug_name: "Paracetamol",
                dosage: "500 mg",
                frequency: "As needed",
                duration: "3 days",
                route: "oral",
                instructions: "Maximum 3 tablets per day",
            },
        ],
        1 => [
            MedicationSeed {
                drug_name: "Metformin",
                dosage: "500 mg",
                frequency: "Twice daily",
                duration: "30 days",
                route: "oral",
                instructions: "Take with meals; avoid if vomiting/dehydrated",
            },
            MedicationSeed {
                drug_name: "Vitamin B-complex",
                dosage: "1 tablet",
                frequency: "Once daily",
                duration: "15 days",
                route: "oral",
                instructions: "Nutritional supplementation",
            },
        ],
        2 => [
            MedicationSeed {
                drug_name: "Salbutamol inhaler",
                dosage: "100 mcg",
                frequency: "2 puffs as needed",
                duration: "30 days",
                route: "inhalation",
                instructions: "Use with spacer if available",
            },
            MedicationSeed {
                drug_name: "Cetirizine",
                dosage: "10 mg",
                frequency: "At night",
                duration: "5 days",
                route: "oral",
                instructions: "May cause drowsiness",
            },
        ],
        3 => [
            MedicationSeed {
                drug_name: "Ferrous ascorbate",
                dosage: "100 mg",
                frequency: "Once daily",
                duration: "60 days",
                route: "oral",
                instructions: "Take after food; dark stools expected",
            },
            MedicationSeed {
                drug_name: "Folic acid",
                dosage: "5 mg",
                frequency: "Once daily",
                duration: "60 days",
                route: "oral",
                instructions: "Continue with iron therapy",
            },
        ],
        4 => [
            MedicationSeed {
                drug_name: "Pantoprazole",
                dosage: "40 mg",
                frequency: "Once daily",
                duration: "14 days",
                route: "oral",
                instructions: "Take before breakfast",
            },
            MedicationSeed {
                drug_name: "ORS",
                dosage: "1 sachet",
                frequency: "As required",
                duration: "2 days",
                route: "oral",
                instructions: "Mix with 1 litre clean water",
            },
        ],
        _ => [
            MedicationSeed {
                drug_name: "Calcium carbonate + Vitamin D3",
                dosage: "500 mg",
                frequency: "Once daily",
                duration: "30 days",
                route: "oral",
                instructions: "Take after food",
            },
            MedicationSeed {
                drug_name: "Carboxymethylcellulose eye drops",
                dosage: "0.5%",
                frequency: "Four times daily",
                duration: "7 days",
                route: "ophthalmic",
                instructions: "Avoid touching dropper tip",
            },
        ],
    }
}

fn bmi(weight_kg: f64, height_cm: f64) -> f64 {
    let height_meters = height_cm / 100.0;
    if height_meters <= 0.0 {
        0.0
    } else {
        weight_kg / (height_meters * height_meters)
    }
}
