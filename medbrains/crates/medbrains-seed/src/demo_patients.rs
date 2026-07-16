use argon2::{
    Argon2,
    password_hash::{PasswordHasher, SaltString, rand_core::OsRng},
};
use sqlx::{PgPool, Postgres, Transaction};

type SeedTx<'a> = Transaction<'a, Postgres>;

#[derive(Clone, Copy)]
struct DemoDoctor {
    username: &'static str,
    full_name: &'static str,
    email: &'static str,
    dept_code: &'static str,
}

/// Demo doctors: Internal Medicine, Pediatrics, Surgery.
/// Password: doctor123 for all.
const DEMO_DOCTORS: &[DemoDoctor] = &[
    DemoDoctor {
        username: "dr_ravi",
        full_name: "Dr. Ravi Menon",
        email: "dr_ravi@medbrains.localhost",
        dept_code: "GEN-MEDICINE",
    },
    DemoDoctor {
        username: "dr_priya",
        full_name: "Dr. Priya Nair",
        email: "dr_priya@medbrains.localhost",
        dept_code: "PEDIATRICS",
    },
    DemoDoctor {
        username: "dr_arjun",
        full_name: "Dr. Arjun Rao",
        email: "dr_arjun@medbrains.localhost",
        dept_code: "GEN-SURGERY",
    },
    DemoDoctor {
        username: "dr_fatima",
        full_name: "Dr. Fatima Khan",
        email: "dr_fatima@medbrains.localhost",
        dept_code: "OBGYN",
    },
    DemoDoctor {
        username: "dr_sandeep",
        full_name: "Dr. Sandeep Iyer",
        email: "dr_sandeep@medbrains.localhost",
        dept_code: "ORTHOPEDICS",
    },
    DemoDoctor {
        username: "dr_meera",
        full_name: "Dr. Meera Iqbal",
        email: "dr_meera@medbrains.localhost",
        dept_code: "EMERGENCY",
    },
    DemoDoctor {
        username: "dr_asha",
        full_name: "Dr. Asha Thomas",
        email: "dr_asha@medbrains.localhost",
        dept_code: "ICU",
    },
];

struct DemoRoleUser {
    username: &'static str,
    full_name: &'static str,
    email: &'static str,
    role: &'static str,
    dept_code: Option<&'static str>,
}

/// One demo user per major non-doctor role for RBAC tests.
/// Password: test123 for all.
const DEMO_ROLE_USERS: &[DemoRoleUser] = &[
    DemoRoleUser {
        username: "nurse_anita",
        full_name: "Nurse Anita Joseph",
        email: "nurse_anita@medbrains.localhost",
        role: "nurse",
        dept_code: Some("GEN-MEDICINE"),
    },
    DemoRoleUser {
        username: "nurse_beena",
        full_name: "Nurse Beena Mathew",
        email: "nurse_beena@medbrains.localhost",
        role: "nurse",
        dept_code: Some("GEN-MEDICINE"),
    },
    DemoRoleUser {
        username: "nurse_chitra",
        full_name: "Nurse Chitra Rao",
        email: "nurse_chitra@medbrains.localhost",
        role: "nurse",
        dept_code: Some("GEN-SURGERY"),
    },
    DemoRoleUser {
        username: "nurse_david",
        full_name: "Nurse David Paul",
        email: "nurse_david@medbrains.localhost",
        role: "nurse",
        dept_code: Some("PEDIATRICS"),
    },
    DemoRoleUser {
        username: "nurse_farida",
        full_name: "Nurse Farida Begum",
        email: "nurse_farida@medbrains.localhost",
        role: "nurse",
        dept_code: Some("OBGYN"),
    },
    DemoRoleUser {
        username: "charge_nurse_latha",
        full_name: "Charge Nurse Latha Menon",
        email: "charge_latha@medbrains.localhost",
        role: "nurse",
        dept_code: Some("ICU"),
    },
    DemoRoleUser {
        username: "nurse_rahul",
        full_name: "Nurse Rahul Nair",
        email: "nurse_rahul@medbrains.localhost",
        role: "nurse",
        dept_code: Some("EMERGENCY"),
    },
    DemoRoleUser {
        username: "nurse_mina",
        full_name: "Nurse Mina Das",
        email: "nurse_mina@medbrains.localhost",
        role: "nurse",
        dept_code: Some("PEDIATRICS"),
    },
    DemoRoleUser {
        username: "lab_suresh",
        full_name: "Suresh Lab-Tech",
        email: "lab_suresh@medbrains.localhost",
        role: "lab_technician",
        dept_code: Some("PATHOLOGY"),
    },
    DemoRoleUser {
        username: "pharm_kavita",
        full_name: "Kavita Pharmacist",
        email: "pharm_kavita@medbrains.localhost",
        role: "pharmacist",
        dept_code: Some("PHARMACY"),
    },
    DemoRoleUser {
        username: "billing_raj",
        full_name: "Raj Billing-Clerk",
        email: "billing_raj@medbrains.localhost",
        role: "billing_clerk",
        dept_code: Some("BILLING-DEPT"),
    },
    DemoRoleUser {
        username: "recept_meera",
        full_name: "Meera Receptionist",
        email: "recept_meera@medbrains.localhost",
        role: "receptionist",
        dept_code: Some("GEN-MEDICINE"),
    },
    DemoRoleUser {
        username: "radio_vikram",
        full_name: "Dr. Vikram Radiologist",
        email: "radio_vikram@medbrains.localhost",
        role: "doctor",
        dept_code: Some("RADIOLOGY"),
    },
    DemoRoleUser {
        username: "audit_neha",
        full_name: "Neha Audit-Officer",
        email: "audit_neha@medbrains.localhost",
        role: "audit_officer",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "hosp_admin_demo",
        full_name: "Demo Hospital Admin",
        email: "hosp_admin@medbrains.localhost",
        role: "hospital_admin",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "mrd_sanjay",
        full_name: "Sanjay MRD-Officer",
        email: "mrd_sanjay@medbrains.localhost",
        role: "mrd_officer",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "canteen_lata",
        full_name: "Lata Canteen-Staff",
        email: "canteen_lata@medbrains.localhost",
        role: "canteen_staff",
        dept_code: None,
    },
    DemoRoleUser {
        username: "dietitian_anu",
        full_name: "Anu Dietitian",
        email: "dietitian_anu@medbrains.localhost",
        role: "dietitian",
        dept_code: None,
    },
    DemoRoleUser {
        username: "security_pradeep",
        full_name: "Pradeep Security-Guard",
        email: "security_pradeep@medbrains.localhost",
        role: "security_guard",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "biomed_arvind",
        full_name: "Arvind Biomed-Engineer",
        email: "biomed_arvind@medbrains.localhost",
        role: "biomed_engineer",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "amb_gopal",
        full_name: "Gopal Ambulance-Driver",
        email: "amb_gopal@medbrains.localhost",
        role: "ambulance_driver",
        dept_code: Some("EMERGENCY"),
    },
    DemoRoleUser {
        username: "radio_tech_sita",
        full_name: "Sita Radiology-Tech",
        email: "radio_tech_sita@medbrains.localhost",
        role: "radiology_tech",
        dept_code: Some("RADIOLOGY"),
    },
    DemoRoleUser {
        username: "cssd_ramesh",
        full_name: "Ramesh CSSD-Tech",
        email: "cssd_ramesh@medbrains.localhost",
        role: "cssd_technician",
        dept_code: None,
    },
    DemoRoleUser {
        username: "bb_tech_divya",
        full_name: "Divya Blood-Bank-Tech",
        email: "bb_divya@medbrains.localhost",
        role: "blood_bank_tech",
        dept_code: Some("PATHOLOGY"),
    },
    DemoRoleUser {
        username: "fo_priti",
        full_name: "Priti Front-Office",
        email: "fo_priti@medbrains.localhost",
        role: "front_office_staff",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "ic_dr_kavya",
        full_name: "Dr. Kavya Infection-Control",
        email: "ic_kavya@medbrains.localhost",
        role: "infection_control_officer",
        dept_code: None,
    },
    DemoRoleUser {
        username: "proc_amit",
        full_name: "Amit Procurement",
        email: "proc_amit@medbrains.localhost",
        role: "procurement_officer",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "store_naveen",
        full_name: "Naveen Store-Keeper",
        email: "store_naveen@medbrains.localhost",
        role: "store_keeper",
        dept_code: None,
    },
    DemoRoleUser {
        username: "hr_deepika",
        full_name: "Deepika HR-Officer",
        email: "hr_deepika@medbrains.localhost",
        role: "hr_officer",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "camp_rohit",
        full_name: "Rohit Camp-Coordinator",
        email: "camp_rohit@medbrains.localhost",
        role: "camp_coordinator",
        dept_code: None,
    },
    DemoRoleUser {
        username: "ins_nidhi",
        full_name: "Nidhi Insurance-Officer",
        email: "ins_nidhi@medbrains.localhost",
        role: "insurance_officer",
        dept_code: Some("BILLING-DEPT"),
    },
    DemoRoleUser {
        username: "ot_staff_jaya",
        full_name: "Jaya OT-Staff",
        email: "ot_jaya@medbrains.localhost",
        role: "ot_staff",
        dept_code: Some("ANESTHESIOLOGY"),
    },
    DemoRoleUser {
        username: "quality_dr_ashish",
        full_name: "Dr. Ashish Quality-Officer",
        email: "quality_ashish@medbrains.localhost",
        role: "quality_officer",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "case_mgr_seema",
        full_name: "Seema Case-Manager",
        email: "case_seema@medbrains.localhost",
        role: "case_manager",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "ur_dr_prakash",
        full_name: "Dr. Prakash UR-Reviewer",
        email: "ur_prakash@medbrains.localhost",
        role: "utilization_reviewer",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "facilities_mohan",
        full_name: "Mohan Facilities-Manager",
        email: "facilities_mohan@medbrains.localhost",
        role: "facilities_manager",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "occ_dr_gita",
        full_name: "Dr. Gita Occ-Health",
        email: "occ_gita@medbrains.localhost",
        role: "occ_health_officer",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "sched_admin_bina",
        full_name: "Bina Scheduling-Admin",
        email: "sched_bina@medbrains.localhost",
        role: "scheduling_admin",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "housekeep_lila",
        full_name: "Lila Housekeeping",
        email: "hk_lila@medbrains.localhost",
        role: "housekeeping_staff",
        dept_code: None,
    },
];

struct DemoPatient {
    uhid: &'static str,
    first: &'static str,
    last: &'static str,
    gender: &'static str,
    phone: &'static str,
    dob: &'static str,
}

const DEMO_PATIENTS: &[DemoPatient] = &[
    DemoPatient {
        uhid: "DEMO-00001",
        first: "Rajesh",
        last: "Kumar",
        gender: "male",
        phone: "9876543210",
        dob: "1985-03-15",
    },
    DemoPatient {
        uhid: "DEMO-00002",
        first: "Priya",
        last: "Sharma",
        gender: "female",
        phone: "9876543211",
        dob: "1990-07-22",
    },
    DemoPatient {
        uhid: "DEMO-00003",
        first: "Arun",
        last: "Patel",
        gender: "male",
        phone: "9876543212",
        dob: "1978-11-08",
    },
    DemoPatient {
        uhid: "DEMO-00004",
        first: "Lakshmi",
        last: "Devi",
        gender: "female",
        phone: "9876543213",
        dob: "1965-01-30",
    },
    DemoPatient {
        uhid: "DEMO-00005",
        first: "Mohammed",
        last: "Irfan",
        gender: "male",
        phone: "9876543214",
        dob: "2000-09-12",
    },
];

const QUEUE_STATUSES: &[&str] = &["waiting", "waiting", "called", "in_consultation", "waiting"];

const DEMO_NURSE_STAFF: &[(&str, &str, &str, &str)] = &[
    ("nurse_anita", "DEMO-NUR-001", "GEN-MEDICINE", "BSc Nursing"),
    ("nurse_beena", "DEMO-NUR-002", "GEN-MEDICINE", "GNM"),
    ("nurse_chitra", "DEMO-NUR-003", "GEN-SURGERY", "BSc Nursing"),
    (
        "nurse_david",
        "DEMO-NUR-004",
        "PEDIATRICS",
        "Pediatric Nursing",
    ),
    ("nurse_farida", "DEMO-NUR-005", "OBGYN", "GNM"),
    (
        "charge_nurse_latha",
        "DEMO-NUR-006",
        "ICU",
        "Critical Care Nursing",
    ),
    (
        "nurse_rahul",
        "DEMO-NUR-007",
        "EMERGENCY",
        "Emergency Nursing",
    ),
    ("nurse_mina", "DEMO-NUR-008", "PEDIATRICS", "BSc Nursing"),
];

const DEMO_VILLAGES: &[(&str, &str, &str, &str)] = &[
    ("Thiruvallam", "695027", "Thiruvananthapuram", "Kerala"),
    ("Vellayani", "695522", "Thiruvananthapuram", "Kerala"),
    ("Kalliyoor", "695042", "Thiruvananthapuram", "Kerala"),
    ("Nedumangad", "695541", "Thiruvananthapuram", "Kerala"),
    ("Kazhakoottam", "695582", "Thiruvananthapuram", "Kerala"),
    ("Mangalapuram", "695317", "Thiruvananthapuram", "Kerala"),
    ("Parassala", "695502", "Thiruvananthapuram", "Kerala"),
    ("Varkala", "695141", "Thiruvananthapuram", "Kerala"),
];

const DEMO_FIRST_NAMES: &[&str] = &[
    "Aarav", "Anaya", "Dev", "Diya", "Gopal", "Isha", "Kiran", "Leela", "Manoj", "Nisha",
    "Prakash", "Rekha", "Sahil", "Tara", "Vijay", "Yamini",
];

const DEMO_LAST_NAMES: &[&str] = &[
    "Nair", "Menon", "Kumar", "Devi", "Thomas", "Pillai", "Rao", "Khan",
];

const DEMO_DIAGNOSES: &[&str] = &[
    "Community acquired pneumonia",
    "Acute gastroenteritis with dehydration",
    "Type 2 diabetes mellitus with fever",
    "Post-operative wound care",
    "Bronchial asthma exacerbation",
    "Hypertensive urgency observation",
    "Urinary tract infection",
    "Dengue fever monitoring",
];

/// Seed demo patients + OPD encounters + queue entries for testing.
/// Idempotent — skips if patients with these UHIDs already exist.
#[allow(clippy::too_many_lines)]
pub(super) async fn seed_demo_patients(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    // ── Seed demo doctors (idempotent) ─────────────────────
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let doctor_hash = argon2
        .hash_password(b"doctor123", &salt)
        .map_err(|e| format!("password hash error: {e}"))?
        .to_string();

    for doc in DEMO_DOCTORS {
        let dept_id: Option<uuid::Uuid> =
            sqlx::query_scalar("SELECT id FROM departments WHERE tenant_id = $1 AND code = $2")
                .bind(tenant_id)
                .bind(doc.dept_code)
                .fetch_optional(&mut *tx)
                .await?;
        let dept_array: Vec<uuid::Uuid> = dept_id.map(|d| vec![d]).unwrap_or_default();

        sqlx::query(
            "INSERT INTO users \
             (tenant_id, username, email, password_hash, full_name, role, department_ids) \
             VALUES ($1, $2, $3, $4, $5, 'doctor', $6) \
             ON CONFLICT (tenant_id, username) DO UPDATE \
             SET department_ids = EXCLUDED.department_ids, \
                 full_name = EXCLUDED.full_name",
        )
        .bind(tenant_id)
        .bind(doc.username)
        .bind(doc.email)
        .bind(&doctor_hash)
        .bind(doc.full_name)
        .bind(&dept_array)
        .execute(&mut *tx)
        .await?;
    }

    tracing::info!("Seeded {} demo doctors", DEMO_DOCTORS.len());

    // ── Seed demo role users (idempotent) ──────────────────
    let role_user_salt = SaltString::generate(&mut OsRng);
    let role_user_hash = argon2
        .hash_password(b"test123", &role_user_salt)
        .map_err(|e| format!("password hash error: {e}"))?
        .to_string();

    for user in DEMO_ROLE_USERS {
        let dept_id: Option<uuid::Uuid> = if let Some(code) = user.dept_code {
            sqlx::query_scalar("SELECT id FROM departments WHERE tenant_id = $1 AND code = $2")
                .bind(tenant_id)
                .bind(code)
                .fetch_optional(&mut *tx)
                .await?
        } else {
            None
        };

        let dept_array: Vec<uuid::Uuid> = dept_id.map(|d| vec![d]).unwrap_or_default();

        sqlx::query(
            "INSERT INTO users \
             (tenant_id, username, email, password_hash, full_name, role, department_ids) \
             VALUES ($1, $2, $3, $4, $5, $6::user_role, $7) \
             ON CONFLICT (tenant_id, username) DO UPDATE \
             SET full_name = EXCLUDED.full_name, \
                 department_ids = EXCLUDED.department_ids",
        )
        .bind(tenant_id)
        .bind(user.username)
        .bind(user.email)
        .bind(&role_user_hash)
        .bind(user.full_name)
        .bind(user.role)
        .bind(&dept_array)
        .execute(&mut *tx)
        .await?;
    }

    tracing::info!("Seeded {} demo role users", DEMO_ROLE_USERS.len());

    seed_staff_employees_and_rosters(&mut tx, tenant_id).await?;
    seed_doctor_schedules(&mut tx, tenant_id).await?;

    // Check if demo patients already exist
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM patients WHERE tenant_id = $1 AND uhid LIKE 'DEMO-%'",
    )
    .bind(tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    let demo_patients_already_seeded = count > 0;

    // Get the General Medicine department ID
    let Some(dept_id) = sqlx::query_scalar::<_, uuid::Uuid>(
        "SELECT id FROM departments WHERE tenant_id = $1 AND code = 'GEN-MEDICINE'",
    )
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    else {
        tracing::warn!("GEN-MEDICINE department not found, skipping demo patients");
        tx.commit().await?;
        return Ok(());
    };

    // Get the admin user ID (doctor for encounters)
    let Some(doctor_id) = sqlx::query_scalar::<_, uuid::Uuid>(
        "SELECT id FROM users WHERE tenant_id = $1 AND username = 'admin'",
    )
    .bind(tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    else {
        tracing::warn!("Admin user not found, skipping demo patients");
        tx.commit().await?;
        return Ok(());
    };

    // ── Insert demo patients ─────────────────────────────────

    let mut patient_ids: Vec<uuid::Uuid> = Vec::new();

    if demo_patients_already_seeded {
        tracing::debug!("Base demo patients already seeded, keeping OPD queue stable");
    } else {
        for p in DEMO_PATIENTS {
            let pid: uuid::Uuid = sqlx::query_scalar(
                "INSERT INTO patients \
                 (tenant_id, uhid, first_name, last_name, gender, phone, date_of_birth) \
                 VALUES ($1, $2, $3, $4, $5::gender, $6, $7::date) \
                 RETURNING id",
            )
            .bind(tenant_id)
            .bind(p.uhid)
            .bind(p.first)
            .bind(p.last)
            .bind(p.gender)
            .bind(p.phone)
            .bind(p.dob)
            .fetch_one(&mut *tx)
            .await?;

            patient_ids.push(pid);
        }

        tracing::info!("Seeded {} demo patients", DEMO_PATIENTS.len());

        // ── OPD encounters + queue entries ───────────────────────

        for (i, patient_id) in patient_ids.iter().enumerate() {
            let token = i32::try_from(i + 1).unwrap_or(1);
            let status = QUEUE_STATUSES[i];

            let encounter_id: uuid::Uuid = sqlx::query_scalar(
                "INSERT INTO encounters \
                 (tenant_id, patient_id, encounter_type, status, department_id, doctor_id, notes) \
                 VALUES ($1, $2, 'opd'::encounter_type, 'open'::encounter_status, $3, $4, $5) \
                 RETURNING id",
            )
            .bind(tenant_id)
            .bind(patient_id)
            .bind(dept_id)
            .bind(doctor_id)
            .bind(format!("Demo OPD visit for {}", DEMO_PATIENTS[i].first))
            .fetch_one(&mut *tx)
            .await?;

            sqlx::query(
                "INSERT INTO opd_queues \
                 (tenant_id, encounter_id, department_id, doctor_id, token_number, status, \
                  queue_date) \
                 VALUES ($1, $2, $3, $4, $5, $6::queue_status, CURRENT_DATE)",
            )
            .bind(tenant_id)
            .bind(encounter_id)
            .bind(dept_id)
            .bind(doctor_id)
            .bind(token)
            .bind(status)
            .execute(&mut *tx)
            .await?;
        }

        tracing::info!(
            "Seeded {} OPD encounters with queue entries",
            patient_ids.len()
        );
    }

    seed_opd_appointments(&mut tx, tenant_id).await?;
    seed_nursing_ipd_workload(&mut tx, tenant_id).await?;

    tx.commit().await?;
    Ok(())
}

async fn seed_staff_employees_and_rosters(
    tx: &mut SeedTx<'_>,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let Some(created_by) = lookup_user_id(tx, tenant_id, "admin").await? else {
        tracing::warn!("Admin user not found, skipping demo nurse employee roster seed");
        return Ok(());
    };

    let shift_defs = [
        (
            "DEMO-DAY",
            "Demo Day Shift",
            "morning",
            "07:00",
            "15:00",
            false,
        ),
        (
            "DEMO-EVE",
            "Demo Evening Shift",
            "evening",
            "15:00",
            "23:00",
            false,
        ),
        (
            "DEMO-NGT",
            "Demo Night Shift",
            "night",
            "23:00",
            "07:00",
            true,
        ),
    ];

    let mut shift_ids = Vec::with_capacity(shift_defs.len());
    for (code, name, shift_type, start, end, is_night) in shift_defs {
        let shift_id: uuid::Uuid = sqlx::query_scalar(
            "INSERT INTO shift_definitions \
             (tenant_id, code, name, shift_type, start_time, end_time, break_minutes, is_night) \
             VALUES ($1, $2, $3, $4::shift_type, $5::time, $6::time, 30, $7) \
             ON CONFLICT (tenant_id, code) DO UPDATE \
             SET name = EXCLUDED.name, \
                 shift_type = EXCLUDED.shift_type, \
                 start_time = EXCLUDED.start_time, \
                 end_time = EXCLUDED.end_time, \
                 is_night = EXCLUDED.is_night \
             RETURNING id",
        )
        .bind(tenant_id)
        .bind(code)
        .bind(name)
        .bind(shift_type)
        .bind(start)
        .bind(end)
        .bind(is_night)
        .fetch_one(&mut **tx)
        .await?;
        shift_ids.push(shift_id);
    }

    for (idx, (username, employee_code, dept_code, qualification)) in
        DEMO_NURSE_STAFF.iter().enumerate()
    {
        let Some(user_id) = lookup_user_id(tx, tenant_id, username).await? else {
            continue;
        };
        let Some(dept_id) = lookup_department_id(tx, tenant_id, dept_code).await? else {
            continue;
        };

        let full_name: String =
            sqlx::query_scalar("SELECT full_name FROM users WHERE tenant_id = $1 AND id = $2")
                .bind(tenant_id)
                .bind(user_id)
                .fetch_one(&mut **tx)
                .await?;
        let display_name = full_name
            .strip_prefix("Charge Nurse ")
            .or_else(|| full_name.strip_prefix("Nurse "))
            .unwrap_or(&full_name);
        let (first_name, last_name) = display_name
            .split_once(' ')
            .map_or((display_name, ""), |(first, last)| (first, last));

        let employee_id: uuid::Uuid = sqlx::query_scalar(
            "INSERT INTO employees \
             (tenant_id, user_id, employee_code, first_name, last_name, gender, phone, email, \
              department_id, employment_type, status, date_of_joining, qualifications, notes) \
             SELECT $1, $2, $3, $4, $5, 'unknown', $6, u.email, $7, \
                    'permanent'::employment_type, 'active'::employee_status, \
                    CURRENT_DATE - INTERVAL '2 years', $8, $9 \
             FROM users u \
             WHERE u.tenant_id = $1 AND u.id = $2 \
             ON CONFLICT (tenant_id, employee_code) DO UPDATE \
             SET user_id = EXCLUDED.user_id, \
                 department_id = EXCLUDED.department_id, \
                 qualifications = EXCLUDED.qualifications, \
                 status = 'active'::employee_status \
             RETURNING id",
        )
        .bind(tenant_id)
        .bind(user_id)
        .bind(employee_code)
        .bind(first_name)
        .bind(last_name)
        .bind(format!("98980{:04}", idx + 1))
        .bind(dept_id)
        .bind(serde_json::json!([
            qualification,
            "BLS certified",
            "NABH IPSG orientation"
        ]))
        .bind("Demo clinical employee for nurse/mobile/IPD workflow testing")
        .fetch_one(&mut **tx)
        .await?;

        for day_offset in 0..7_i32 {
            let shift_id =
                shift_ids[(idx + usize::try_from(day_offset).unwrap_or(0)) % shift_ids.len()];
            sqlx::query(
                "INSERT INTO duty_rosters \
                 (tenant_id, employee_id, department_id, shift_id, roster_date, notes, created_by) \
                 VALUES ($1, $2, $3, $4, CURRENT_DATE + $5, $6, $7) \
                 ON CONFLICT (tenant_id, employee_id, roster_date) DO UPDATE \
                 SET department_id = EXCLUDED.department_id, \
                     shift_id = EXCLUDED.shift_id, \
                     notes = EXCLUDED.notes",
            )
            .bind(tenant_id)
            .bind(employee_id)
            .bind(dept_id)
            .bind(shift_id)
            .bind(day_offset)
            .bind("Demo 7-day nursing roster")
            .bind(created_by)
            .execute(&mut **tx)
            .await?;
        }
    }

    tracing::info!(
        "Seeded {} demo nurse employees and 7-day duty rosters",
        DEMO_NURSE_STAFF.len()
    );
    Ok(())
}

async fn seed_doctor_schedules(
    tx: &mut SeedTx<'_>,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    for doc in DEMO_DOCTORS {
        let Some(doctor_id) = lookup_user_id(tx, tenant_id, doc.username).await? else {
            continue;
        };
        let Some(dept_id) = lookup_department_id(tx, tenant_id, doc.dept_code).await? else {
            continue;
        };

        for day in 1..=6_i32 {
            sqlx::query(
                "INSERT INTO doctor_schedules \
                 (tenant_id, doctor_id, department_id, day_of_week, start_time, end_time, \
                  slot_duration_mins, max_patients) \
                 SELECT $1, $2, $3, $4, $5::time, $6::time, 15, $7 \
                 WHERE NOT EXISTS ( \
                   SELECT 1 FROM doctor_schedules \
                   WHERE tenant_id = $1 AND doctor_id = $2 AND department_id = $3 \
                     AND day_of_week = $4 AND start_time = $5::time \
                 )",
            )
            .bind(tenant_id)
            .bind(doctor_id)
            .bind(dept_id)
            .bind(day)
            .bind(if doc.dept_code == "EMERGENCY" {
                "08:00"
            } else {
                "09:00"
            })
            .bind(if doc.dept_code == "EMERGENCY" {
                "20:00"
            } else {
                "13:00"
            })
            .bind(if doc.dept_code == "EMERGENCY" { 48 } else { 24 })
            .execute(&mut **tx)
            .await?;

            sqlx::query(
                "INSERT INTO doctor_schedules \
                 (tenant_id, doctor_id, department_id, day_of_week, start_time, end_time, \
                  slot_duration_mins, max_patients) \
                 SELECT $1, $2, $3, $4, $5::time, $6::time, 15, 20 \
                 WHERE $7::boolean = false \
                   AND NOT EXISTS ( \
                     SELECT 1 FROM doctor_schedules \
                     WHERE tenant_id = $1 AND doctor_id = $2 AND department_id = $3 \
                       AND day_of_week = $4 AND start_time = $5::time \
                   )",
            )
            .bind(tenant_id)
            .bind(doctor_id)
            .bind(dept_id)
            .bind(day)
            .bind("15:00")
            .bind("18:00")
            .bind(doc.dept_code == "EMERGENCY")
            .execute(&mut **tx)
            .await?;
        }
    }

    tracing::info!("Seeded demo doctor schedules");
    Ok(())
}

#[allow(clippy::too_many_lines)]
async fn seed_opd_appointments(
    tx: &mut SeedTx<'_>,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let Some(created_by) = lookup_user_id(tx, tenant_id, "recept_meera")
        .await?
        .or(lookup_user_id(tx, tenant_id, "admin").await?)
    else {
        tracing::warn!("No receptionist/admin user found, skipping demo appointments");
        return Ok(());
    };

    let count = demo_seed_count("MEDBRAINS_DEMO_OPD_APPOINTMENTS", 72, 1_000);
    let statuses = [
        "scheduled",
        "confirmed",
        "checked_in",
        "in_consultation",
        "completed",
        "scheduled",
    ];

    for i in 0..count {
        let doc = DEMO_DOCTORS[i % DEMO_DOCTORS.len()];
        let Some(doctor_id) = lookup_user_id(tx, tenant_id, doc.username).await? else {
            continue;
        };
        let Some(dept_id) = lookup_department_id(tx, tenant_id, doc.dept_code).await? else {
            continue;
        };

        let uhid = format!("DEMO-OPD-{:04}", i + 1);
        let first = DEMO_FIRST_NAMES[i % DEMO_FIRST_NAMES.len()];
        let last = DEMO_LAST_NAMES[(i / DEMO_FIRST_NAMES.len()) % DEMO_LAST_NAMES.len()];
        let patient_id = upsert_generated_patient(
            tx,
            tenant_id,
            &uhid,
            first,
            last,
            if i % 2 == 0 { "male" } else { "female" },
            &format!("90010{:05}", i + 1),
            18 + i32::try_from(i % 62).unwrap_or(0),
            i,
            created_by,
        )
        .await?;

        let date_offset = i32::try_from(i % 7).unwrap_or(0);
        let slot_start = slot_time(9 * 60 + i32::try_from((i % 16) * 15).unwrap_or(0));
        let slot_end = slot_time(9 * 60 + i32::try_from((i % 16) * 15 + 15).unwrap_or(15));
        let status = statuses[i % statuses.len()];

        let appointment_id: Option<uuid::Uuid> = sqlx::query_scalar(
            "INSERT INTO appointments \
             (tenant_id, patient_id, doctor_id, department_id, appointment_date, slot_start, \
              slot_end, appointment_type, status, reason, notes, checked_in_at, completed_at, \
              created_by, booking_source) \
             SELECT $1, $2, $3, $4, CURRENT_DATE + $5, $6::time, $7::time, \
                    $8::appointment_type, $9::appointment_status, $10, $11, \
                    CASE WHEN $9 IN ('checked_in', 'in_consultation', 'completed') \
                         THEN now() - INTERVAL '30 minutes' END, \
                    CASE WHEN $9 = 'completed' THEN now() - INTERVAL '5 minutes' END, \
                    $12, 'demo_seed' \
             WHERE NOT EXISTS ( \
                 SELECT 1 FROM appointments \
                 WHERE tenant_id = $1 AND patient_id = $2 \
                   AND appointment_date = CURRENT_DATE + $5 AND slot_start = $6::time \
             ) \
             RETURNING id",
        )
        .bind(tenant_id)
        .bind(patient_id)
        .bind(doctor_id)
        .bind(dept_id)
        .bind(date_offset)
        .bind(&slot_start)
        .bind(&slot_end)
        .bind(if i % 5 == 0 { "follow_up" } else { "new_visit" })
        .bind(status)
        .bind(DEMO_DIAGNOSES[i % DEMO_DIAGNOSES.len()])
        .bind("Demo appointment seeded for doctor schedule and OPD testing")
        .bind(created_by)
        .fetch_optional(&mut **tx)
        .await?;

        if date_offset == 0 && matches!(status, "checked_in" | "in_consultation") {
            let encounter_id = ensure_opd_encounter(
                tx,
                tenant_id,
                patient_id,
                dept_id,
                doctor_id,
                "Demo checked-in appointment encounter",
            )
            .await?;
            if let Some(id) = appointment_id {
                sqlx::query(
                    "UPDATE appointments SET encounter_id = $3 WHERE tenant_id = $1 AND id = $2",
                )
                .bind(tenant_id)
                .bind(id)
                .bind(encounter_id)
                .execute(&mut **tx)
                .await?;
            }
            seed_opd_queue_entry(
                tx,
                tenant_id,
                encounter_id,
                dept_id,
                doctor_id,
                100 + i32::try_from(i).unwrap_or(0),
                if status == "in_consultation" {
                    "in_consultation"
                } else {
                    "waiting"
                },
                created_by,
            )
            .await?;
        }
    }

    tracing::info!("Seeded {count} demo OPD appointments");
    Ok(())
}

#[allow(clippy::too_many_lines)]
async fn seed_nursing_ipd_workload(
    tx: &mut SeedTx<'_>,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let Some(created_by) = lookup_user_id(tx, tenant_id, "admin").await? else {
        tracing::warn!("Admin user not found, skipping demo IPD nursing workload");
        return Ok(());
    };

    let count = demo_seed_count("MEDBRAINS_DEMO_IPD_PATIENTS", 36, 500);

    for i in 0..count {
        let doc = DEMO_DOCTORS[i % DEMO_DOCTORS.len()];
        let Some(doctor_id) = lookup_user_id(tx, tenant_id, doc.username).await? else {
            continue;
        };
        let Some(dept_id) = lookup_department_id(tx, tenant_id, doc.dept_code).await? else {
            continue;
        };
        let (nurse_username, _, _, _) = pick_nurse_for_department(doc.dept_code, i);
        let Some(nurse_id) = lookup_user_id(tx, tenant_id, nurse_username).await? else {
            continue;
        };

        let ward_id = ensure_demo_ward(tx, tenant_id, doc.dept_code, dept_id).await?;
        let uhid = format!("DEMO-IPD-{:04}", i + 1);
        let first = DEMO_FIRST_NAMES[(i + 3) % DEMO_FIRST_NAMES.len()];
        let last = DEMO_LAST_NAMES[(i + 2) % DEMO_LAST_NAMES.len()];
        let patient_id = upsert_generated_patient(
            tx,
            tenant_id,
            &uhid,
            first,
            last,
            if i % 3 == 0 { "female" } else { "male" },
            &format!("90020{:05}", i + 1),
            22 + i32::try_from(i % 58).unwrap_or(0),
            i + 100,
            created_by,
        )
        .await?;

        let diagnosis = DEMO_DIAGNOSES[i % DEMO_DIAGNOSES.len()];
        let encounter_id = ensure_ipd_encounter(
            tx,
            tenant_id,
            patient_id,
            dept_id,
            doctor_id,
            &format!("Demo IPD encounter: {diagnosis}"),
        )
        .await?;
        let admission_id = ensure_admission(
            tx,
            tenant_id,
            encounter_id,
            patient_id,
            doctor_id,
            ward_id,
            nurse_id,
            diagnosis,
            created_by,
            i,
        )
        .await?;

        grant_relation_if_missing(
            tx,
            tenant_id,
            "admission",
            admission_id,
            "viewer",
            "user",
            &nurse_id.to_string(),
            created_by,
            "Demo primary nurse admission access",
        )
        .await?;
        grant_relation_if_missing(
            tx,
            tenant_id,
            "admission",
            admission_id,
            "viewer",
            "user",
            &doctor_id.to_string(),
            created_by,
            "Demo attending doctor admission access",
        )
        .await?;
        grant_relation_if_missing(
            tx,
            tenant_id,
            "patient",
            patient_id,
            "viewer",
            "user",
            &nurse_id.to_string(),
            created_by,
            "Demo nurse patient chart access",
        )
        .await?;
        grant_relation_if_missing(
            tx,
            tenant_id,
            "encounter",
            encounter_id,
            "viewer",
            "user",
            &nurse_id.to_string(),
            created_by,
            "Demo nurse encounter access",
        )
        .await?;

        seed_mar_rows(tx, tenant_id, admission_id, nurse_id, i).await?;
        seed_bedside_observations(tx, tenant_id, encounter_id, admission_id, nurse_id, i).await?;
    }

    tracing::info!("Seeded {count} demo IPD admissions with nursing workload");
    Ok(())
}

async fn lookup_user_id(
    tx: &mut SeedTx<'_>,
    tenant_id: uuid::Uuid,
    username: &str,
) -> Result<Option<uuid::Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM users WHERE tenant_id = $1 AND username = $2")
        .bind(tenant_id)
        .bind(username)
        .fetch_optional(&mut **tx)
        .await
}

async fn lookup_department_id(
    tx: &mut SeedTx<'_>,
    tenant_id: uuid::Uuid,
    code: &str,
) -> Result<Option<uuid::Uuid>, sqlx::Error> {
    sqlx::query_scalar("SELECT id FROM departments WHERE tenant_id = $1 AND code = $2")
        .bind(tenant_id)
        .bind(code)
        .fetch_optional(&mut **tx)
        .await
}

#[allow(clippy::too_many_arguments)]
async fn upsert_generated_patient(
    tx: &mut SeedTx<'_>,
    tenant_id: uuid::Uuid,
    uhid: &str,
    first_name: &str,
    last_name: &str,
    gender: &str,
    phone: &str,
    age_years: i32,
    village_index: usize,
    registered_by: uuid::Uuid,
) -> Result<uuid::Uuid, sqlx::Error> {
    let (village, pincode, district, state) = DEMO_VILLAGES[village_index % DEMO_VILLAGES.len()];
    sqlx::query_scalar(
        "INSERT INTO patients \
         (tenant_id, uhid, first_name, last_name, gender, phone, date_of_birth, address, \
          address_line1, attributes, registered_by, preferred_language, financial_class) \
         VALUES ($1, $2, $3, $4, $5::gender, $6, \
                 (CURRENT_DATE - ($7::int * INTERVAL '1 year') \
                  - (($11::int % 365) * INTERVAL '1 day'))::date, \
                 $8, $9, $10, $12, 'Malayalam', 'self_pay'::financial_class) \
         ON CONFLICT (tenant_id, uhid) DO UPDATE \
         SET first_name = EXCLUDED.first_name, \
             last_name = EXCLUDED.last_name, \
             phone = EXCLUDED.phone, \
             address = EXCLUDED.address, \
             attributes = EXCLUDED.attributes \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(uhid)
    .bind(first_name)
    .bind(last_name)
    .bind(gender)
    .bind(phone)
    .bind(age_years)
    .bind(serde_json::json!({
        "village": village,
        "pincode": pincode,
        "district": district,
        "state": state,
        "country": "India"
    }))
    .bind(format!("{village} village, {district}, {state} {pincode}"))
    .bind(serde_json::json!({
        "demo_seed": true,
        "village": village,
        "pincode": pincode,
        "district": district,
        "state": state
    }))
    .bind(i32::try_from(village_index).unwrap_or(0))
    .bind(registered_by)
    .fetch_one(&mut **tx)
    .await
}

async fn ensure_opd_encounter(
    tx: &mut SeedTx<'_>,
    tenant_id: uuid::Uuid,
    patient_id: uuid::Uuid,
    dept_id: uuid::Uuid,
    doctor_id: uuid::Uuid,
    notes: &str,
) -> Result<uuid::Uuid, sqlx::Error> {
    if let Some(id) = sqlx::query_scalar(
        "SELECT id FROM encounters \
         WHERE tenant_id = $1 AND patient_id = $2 AND encounter_type = 'opd'::encounter_type \
           AND notes = $3 \
         LIMIT 1",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(notes)
    .fetch_optional(&mut **tx)
    .await?
    {
        return Ok(id);
    }

    sqlx::query_scalar(
        "INSERT INTO encounters \
         (tenant_id, patient_id, encounter_type, status, department_id, doctor_id, \
          encounter_date, notes, attributes) \
         VALUES ($1, $2, 'opd'::encounter_type, 'open'::encounter_status, $3, $4, \
                 CURRENT_DATE, $5, '{\"demo_seed\":true}'::jsonb) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(dept_id)
    .bind(doctor_id)
    .bind(notes)
    .fetch_one(&mut **tx)
    .await
}

#[allow(clippy::too_many_arguments)]
async fn seed_opd_queue_entry(
    tx: &mut SeedTx<'_>,
    tenant_id: uuid::Uuid,
    encounter_id: uuid::Uuid,
    dept_id: uuid::Uuid,
    doctor_id: uuid::Uuid,
    token_number: i32,
    status: &str,
    created_by: uuid::Uuid,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO opd_queues \
         (tenant_id, encounter_id, department_id, doctor_id, token_number, status, queue_date, \
          created_by) \
         SELECT $1, $2, $3, $4, $5, $6::queue_status, CURRENT_DATE, $7 \
         WHERE NOT EXISTS ( \
             SELECT 1 FROM opd_queues WHERE tenant_id = $1 AND encounter_id = $2 \
         )",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(dept_id)
    .bind(doctor_id)
    .bind(token_number)
    .bind(status)
    .bind(created_by)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn ensure_ipd_encounter(
    tx: &mut SeedTx<'_>,
    tenant_id: uuid::Uuid,
    patient_id: uuid::Uuid,
    dept_id: uuid::Uuid,
    doctor_id: uuid::Uuid,
    notes: &str,
) -> Result<uuid::Uuid, sqlx::Error> {
    if let Some(id) = sqlx::query_scalar(
        "SELECT id FROM encounters \
         WHERE tenant_id = $1 AND patient_id = $2 AND encounter_type = 'ipd'::encounter_type \
           AND notes = $3 \
         LIMIT 1",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(notes)
    .fetch_optional(&mut **tx)
    .await?
    {
        return Ok(id);
    }

    sqlx::query_scalar(
        "INSERT INTO encounters \
         (tenant_id, patient_id, encounter_type, status, department_id, doctor_id, \
          encounter_date, notes, attributes) \
         VALUES ($1, $2, 'ipd'::encounter_type, 'open'::encounter_status, $3, $4, \
                 CURRENT_DATE, $5, '{\"demo_seed\":true}'::jsonb) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(patient_id)
    .bind(dept_id)
    .bind(doctor_id)
    .bind(notes)
    .fetch_one(&mut **tx)
    .await
}

async fn ensure_demo_ward(
    tx: &mut SeedTx<'_>,
    tenant_id: uuid::Uuid,
    dept_code: &str,
    dept_id: uuid::Uuid,
) -> Result<uuid::Uuid, sqlx::Error> {
    let code = format!("DEMO-{dept_code}-WARD");
    let name = format!("Demo {} Ward", dept_code.replace('-', " "));
    sqlx::query_scalar(
        "INSERT INTO wards (tenant_id, code, name, department_id, ward_type, total_beds) \
         VALUES ($1, $2, $3, $4, $5, 30) \
         ON CONFLICT (tenant_id, code) DO UPDATE \
         SET name = EXCLUDED.name, department_id = EXCLUDED.department_id \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(code)
    .bind(name)
    .bind(dept_id)
    .bind(if dept_code == "ICU" { "icu" } else { "general" })
    .fetch_one(&mut **tx)
    .await
}

#[allow(clippy::too_many_arguments)]
async fn ensure_admission(
    tx: &mut SeedTx<'_>,
    tenant_id: uuid::Uuid,
    encounter_id: uuid::Uuid,
    patient_id: uuid::Uuid,
    doctor_id: uuid::Uuid,
    ward_id: uuid::Uuid,
    nurse_id: uuid::Uuid,
    diagnosis: &str,
    created_by: uuid::Uuid,
    index: usize,
) -> Result<uuid::Uuid, sqlx::Error> {
    if let Some(id) = sqlx::query_scalar(
        "SELECT id FROM admissions \
         WHERE tenant_id = $1 AND encounter_id = $2 AND patient_id = $3 \
         LIMIT 1",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(patient_id)
    .fetch_optional(&mut **tx)
    .await?
    {
        sqlx::query(
            "UPDATE admissions SET ward_id = $4, primary_nurse_id = $5 \
             WHERE tenant_id = $1 AND id = $2 AND patient_id = $3",
        )
        .bind(tenant_id)
        .bind(id)
        .bind(patient_id)
        .bind(ward_id)
        .bind(nurse_id)
        .execute(&mut **tx)
        .await?;
        return Ok(id);
    }

    sqlx::query_scalar(
        "INSERT INTO admissions \
         (tenant_id, encounter_id, patient_id, admitting_doctor, status, ward_id, \
          primary_nurse_id, provisional_diagnosis, comorbidities, estimated_los_days, \
          priority, admission_source, admission_weight_kg, admission_height_cm, created_by, \
          admitted_at) \
         VALUES ($1, $2, $3, $4, 'admitted'::admission_status, $5, $6, $7, $8, $9, \
                 $10, 'direct'::admission_source, $11::numeric, $12::numeric, $13, \
                 now() - ($14::int * INTERVAL '2 hours')) \
         RETURNING id",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(patient_id)
    .bind(doctor_id)
    .bind(ward_id)
    .bind(nurse_id)
    .bind(diagnosis)
    .bind(serde_json::json!(["Hypertension", "Diabetes mellitus"]))
    .bind(2 + i32::try_from(index % 5).unwrap_or(0))
    .bind(if index % 6 == 0 { "urgent" } else { "routine" })
    .bind(format!("{}", 52 + i32::try_from(index % 38).unwrap_or(0)))
    .bind(format!("{}", 150 + i32::try_from(index % 35).unwrap_or(0)))
    .bind(created_by)
    .bind(i32::try_from(index).unwrap_or(0))
    .fetch_one(&mut **tx)
    .await
}

async fn seed_mar_rows(
    tx: &mut SeedTx<'_>,
    tenant_id: uuid::Uuid,
    admission_id: uuid::Uuid,
    nurse_id: uuid::Uuid,
    index: usize,
) -> Result<(), sqlx::Error> {
    let existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ipd_medication_administration \
         WHERE tenant_id = $1 AND admission_id = $2",
    )
    .bind(tenant_id)
    .bind(admission_id)
    .fetch_one(&mut **tx)
    .await?;
    if existing > 0 {
        return Ok(());
    }

    let meds = [
        ("Paracetamol", "650 mg", "oral", "TID", false),
        ("Pantoprazole", "40 mg", "iv", "OD", false),
        ("Insulin Regular", "6 units", "subcutaneous", "AC", true),
    ];
    for (offset, (drug, dose, route, frequency, high_alert)) in meds.iter().enumerate() {
        sqlx::query(
            "INSERT INTO ipd_medication_administration \
             (tenant_id, admission_id, drug_name, dose, route, frequency, scheduled_at, status, \
              administered_by, administered_at, barcode_verified, is_high_alert, notes) \
             VALUES ($1, $2, $3, $4, $5, $6, \
                     now() + ($7::int * INTERVAL '4 hours'), \
                     $8::mar_status, $9, \
                     CASE WHEN $8 = 'given' THEN now() - INTERVAL '1 hour' END, \
                     $10, $11, $12)",
        )
        .bind(tenant_id)
        .bind(admission_id)
        .bind(drug)
        .bind(dose)
        .bind(route)
        .bind(frequency)
        .bind(i32::try_from(offset).unwrap_or(0))
        .bind(if index % 5 == offset {
            "given"
        } else {
            "scheduled"
        })
        .bind(nurse_id)
        .bind(index % 4 == 0)
        .bind(*high_alert)
        .bind("Demo MAR row for bedside medication workflow")
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

async fn seed_bedside_observations(
    tx: &mut SeedTx<'_>,
    tenant_id: uuid::Uuid,
    encounter_id: uuid::Uuid,
    admission_id: uuid::Uuid,
    nurse_id: uuid::Uuid,
    index: usize,
) -> Result<(), sqlx::Error> {
    let existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM vitals WHERE tenant_id = $1 AND encounter_id = $2",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .fetch_one(&mut **tx)
    .await?;
    if existing == 0 {
        for reading in 0..2_i32 {
            sqlx::query(
                "INSERT INTO vitals \
                 (tenant_id, encounter_id, recorded_by, temperature, pulse, systolic_bp, \
                  diastolic_bp, respiratory_rate, spo2, weight_kg, height_cm, notes, recorded_at) \
                 VALUES ($1, $2, $3, $4::numeric, $5, $6, $7, $8, $9, \
                         $10::numeric, $11::numeric, $12, \
                         now() - ($13::int * INTERVAL '6 hours'))",
            )
            .bind(tenant_id)
            .bind(encounter_id)
            .bind(nurse_id)
            .bind(format!(
                "{:.1}",
                36.5 + f64::from(i32::try_from(index % 8).unwrap_or(0)) / 10.0
            ))
            .bind(76 + i32::try_from(index % 22).unwrap_or(0))
            .bind(112 + i32::try_from(index % 28).unwrap_or(0))
            .bind(70 + i32::try_from(index % 14).unwrap_or(0))
            .bind(16 + i32::try_from(index % 8).unwrap_or(0))
            .bind(94 + i32::try_from(index % 6).unwrap_or(0))
            .bind(format!("{}", 52 + i32::try_from(index % 38).unwrap_or(0)))
            .bind(format!("{}", 150 + i32::try_from(index % 35).unwrap_or(0)))
            .bind("Demo nurse-recorded vital signs")
            .bind(reading)
            .execute(&mut **tx)
            .await?;
        }
    }

    sqlx::query(
        "INSERT INTO vitals_capture_schedules \
         (tenant_id, encounter_id, frequency_minutes, next_due_at, created_by, last_captured_at) \
         SELECT $1, $2, 240, now() + INTERVAL '4 hours', $3, now() - INTERVAL '2 hours' \
         WHERE NOT EXISTS ( \
             SELECT 1 FROM vitals_capture_schedules \
             WHERE tenant_id = $1 AND encounter_id = $2 AND ended_at IS NULL \
         )",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(nurse_id)
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        "INSERT INTO intake_output_entries \
         (tenant_id, encounter_id, recorded_by, category, direction, volume_ml, notes) \
         SELECT $1, $2, $3, 'oral', 'intake', $4, 'Demo oral intake' \
         WHERE NOT EXISTS ( \
             SELECT 1 FROM intake_output_entries WHERE tenant_id = $1 AND encounter_id = $2 \
         )",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(nurse_id)
    .bind(300 + i32::try_from(index % 5).unwrap_or(0) * 50)
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        "INSERT INTO pain_score_entries \
         (tenant_id, encounter_id, recorded_by, scale, score, location, intervention_taken, notes) \
         SELECT $1, $2, $3, 'numeric', $4, $5, $6, 'Demo pain score' \
         WHERE NOT EXISTS ( \
             SELECT 1 FROM pain_score_entries WHERE tenant_id = $1 AND encounter_id = $2 \
         )",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(nurse_id)
    .bind(i32::try_from(index % 8).unwrap_or(0))
    .bind(if index % 2 == 0 { "abdomen" } else { "chest" })
    .bind("Positioning and medication as ordered")
    .execute(&mut **tx)
    .await?;

    sqlx::query(
        "INSERT INTO fall_risk_assessments \
         (tenant_id, encounter_id, admission_id, recorded_by, scale, score, risk_level, \
          interventions) \
         SELECT $1, $2, $3, $4, 'morse', $5, $6, $7 \
         WHERE NOT EXISTS ( \
             SELECT 1 FROM fall_risk_assessments WHERE tenant_id = $1 AND admission_id = $3 \
         )",
    )
    .bind(tenant_id)
    .bind(encounter_id)
    .bind(admission_id)
    .bind(nurse_id)
    .bind(25 + i32::try_from(index % 55).unwrap_or(0))
    .bind(if index % 4 == 0 {
        "high"
    } else if index % 3 == 0 {
        "medium"
    } else {
        "low"
    })
    .bind(serde_json::json!([
        "bed in low position",
        "call bell within reach",
        "fall risk band applied"
    ]))
    .execute(&mut **tx)
    .await?;

    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn grant_relation_if_missing(
    tx: &mut SeedTx<'_>,
    tenant_id: uuid::Uuid,
    object_type: &str,
    object_id: uuid::Uuid,
    relation: &str,
    subject_type: &str,
    subject_id: &str,
    granted_by: uuid::Uuid,
    reason: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO relation_tuples \
         (tenant_id, object_type, object_id, relation, subject_type, subject_id, granted_by, \
          granted_reason, source) \
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, 'derived' \
         WHERE NOT EXISTS ( \
             SELECT 1 FROM relation_tuples \
             WHERE tenant_id = $1 AND object_type = $2 AND object_id = $3 \
               AND relation = $4 AND subject_type = $5 AND subject_id = $6 \
               AND status = 'active' \
         )",
    )
    .bind(tenant_id)
    .bind(object_type)
    .bind(object_id)
    .bind(relation)
    .bind(subject_type)
    .bind(subject_id)
    .bind(granted_by)
    .bind(reason)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

fn pick_nurse_for_department(
    dept_code: &str,
    fallback_index: usize,
) -> (&'static str, &'static str, &'static str, &'static str) {
    DEMO_NURSE_STAFF
        .iter()
        .find(|(_, _, nurse_dept, _)| *nurse_dept == dept_code)
        .copied()
        .unwrap_or(DEMO_NURSE_STAFF[fallback_index % DEMO_NURSE_STAFF.len()])
}

fn demo_seed_count(env_name: &str, default: usize, max: usize) -> usize {
    std::env::var(env_name)
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .map_or(default, |v| v.clamp(1, max))
}

fn slot_time(minutes_from_midnight: i32) -> String {
    let hour = (minutes_from_midnight / 60).rem_euclid(24);
    let minute = minutes_from_midnight.rem_euclid(60);
    format!("{hour:02}:{minute:02}")
}
