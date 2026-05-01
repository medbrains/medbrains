use argon2::{
    Argon2,
    password_hash::{PasswordHasher, SaltString, rand_core::OsRng},
};
use sqlx::PgPool;

struct DemoDoctor {
    username: &'static str,
    full_name: &'static str,
    email: &'static str,
}

/// Demo doctors: Internal Medicine, Pediatrics, Surgery.
/// Password: doctor123 for all.
const DEMO_DOCTORS: &[DemoDoctor] = &[
    DemoDoctor {
        username: "dr_ravi",
        full_name: "Dr. Ravi Menon",
        email: "dr_ravi@medbrains.local",
    },
    DemoDoctor {
        username: "dr_priya",
        full_name: "Dr. Priya Nair",
        email: "dr_priya@medbrains.local",
    },
    DemoDoctor {
        username: "dr_arjun",
        full_name: "Dr. Arjun Rao",
        email: "dr_arjun@medbrains.local",
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
        email: "nurse_anita@medbrains.local",
        role: "nurse",
        dept_code: Some("GEN-MEDICINE"),
    },
    DemoRoleUser {
        username: "lab_suresh",
        full_name: "Suresh Lab-Tech",
        email: "lab_suresh@medbrains.local",
        role: "lab_technician",
        dept_code: Some("PATHOLOGY"),
    },
    DemoRoleUser {
        username: "pharm_kavita",
        full_name: "Kavita Pharmacist",
        email: "pharm_kavita@medbrains.local",
        role: "pharmacist",
        dept_code: Some("PHARMACY"),
    },
    DemoRoleUser {
        username: "billing_raj",
        full_name: "Raj Billing-Clerk",
        email: "billing_raj@medbrains.local",
        role: "billing_clerk",
        dept_code: Some("BILLING-DEPT"),
    },
    DemoRoleUser {
        username: "recept_meera",
        full_name: "Meera Receptionist",
        email: "recept_meera@medbrains.local",
        role: "receptionist",
        dept_code: Some("GEN-MEDICINE"),
    },
    DemoRoleUser {
        username: "radio_vikram",
        full_name: "Dr. Vikram Radiologist",
        email: "radio_vikram@medbrains.local",
        role: "doctor",
        dept_code: Some("RADIOLOGY"),
    },
    DemoRoleUser {
        username: "audit_neha",
        full_name: "Neha Audit-Officer",
        email: "audit_neha@medbrains.local",
        role: "audit_officer",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "hosp_admin_demo",
        full_name: "Demo Hospital Admin",
        email: "hosp_admin@medbrains.local",
        role: "hospital_admin",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "mrd_sanjay",
        full_name: "Sanjay MRD-Officer",
        email: "mrd_sanjay@medbrains.local",
        role: "mrd_officer",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "canteen_lata",
        full_name: "Lata Canteen-Staff",
        email: "canteen_lata@medbrains.local",
        role: "canteen_staff",
        dept_code: None,
    },
    DemoRoleUser {
        username: "dietitian_anu",
        full_name: "Anu Dietitian",
        email: "dietitian_anu@medbrains.local",
        role: "dietitian",
        dept_code: None,
    },
    DemoRoleUser {
        username: "security_pradeep",
        full_name: "Pradeep Security-Guard",
        email: "security_pradeep@medbrains.local",
        role: "security_guard",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "biomed_arvind",
        full_name: "Arvind Biomed-Engineer",
        email: "biomed_arvind@medbrains.local",
        role: "biomed_engineer",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "amb_gopal",
        full_name: "Gopal Ambulance-Driver",
        email: "amb_gopal@medbrains.local",
        role: "ambulance_driver",
        dept_code: Some("EMERGENCY"),
    },
    DemoRoleUser {
        username: "radio_tech_sita",
        full_name: "Sita Radiology-Tech",
        email: "radio_tech_sita@medbrains.local",
        role: "radiology_tech",
        dept_code: Some("RADIOLOGY"),
    },
    DemoRoleUser {
        username: "cssd_ramesh",
        full_name: "Ramesh CSSD-Tech",
        email: "cssd_ramesh@medbrains.local",
        role: "cssd_technician",
        dept_code: None,
    },
    DemoRoleUser {
        username: "bb_tech_divya",
        full_name: "Divya Blood-Bank-Tech",
        email: "bb_divya@medbrains.local",
        role: "blood_bank_tech",
        dept_code: Some("PATHOLOGY"),
    },
    DemoRoleUser {
        username: "fo_priti",
        full_name: "Priti Front-Office",
        email: "fo_priti@medbrains.local",
        role: "front_office_staff",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "ic_dr_kavya",
        full_name: "Dr. Kavya Infection-Control",
        email: "ic_kavya@medbrains.local",
        role: "infection_control_officer",
        dept_code: None,
    },
    DemoRoleUser {
        username: "proc_amit",
        full_name: "Amit Procurement",
        email: "proc_amit@medbrains.local",
        role: "procurement_officer",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "store_naveen",
        full_name: "Naveen Store-Keeper",
        email: "store_naveen@medbrains.local",
        role: "store_keeper",
        dept_code: None,
    },
    DemoRoleUser {
        username: "hr_deepika",
        full_name: "Deepika HR-Officer",
        email: "hr_deepika@medbrains.local",
        role: "hr_officer",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "camp_rohit",
        full_name: "Rohit Camp-Coordinator",
        email: "camp_rohit@medbrains.local",
        role: "camp_coordinator",
        dept_code: None,
    },
    DemoRoleUser {
        username: "ins_nidhi",
        full_name: "Nidhi Insurance-Officer",
        email: "ins_nidhi@medbrains.local",
        role: "insurance_officer",
        dept_code: Some("BILLING-DEPT"),
    },
    DemoRoleUser {
        username: "ot_staff_jaya",
        full_name: "Jaya OT-Staff",
        email: "ot_jaya@medbrains.local",
        role: "ot_staff",
        dept_code: Some("ANESTHESIOLOGY"),
    },
    DemoRoleUser {
        username: "quality_dr_ashish",
        full_name: "Dr. Ashish Quality-Officer",
        email: "quality_ashish@medbrains.local",
        role: "quality_officer",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "case_mgr_seema",
        full_name: "Seema Case-Manager",
        email: "case_seema@medbrains.local",
        role: "case_manager",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "ur_dr_prakash",
        full_name: "Dr. Prakash UR-Reviewer",
        email: "ur_prakash@medbrains.local",
        role: "utilization_reviewer",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "facilities_mohan",
        full_name: "Mohan Facilities-Manager",
        email: "facilities_mohan@medbrains.local",
        role: "facilities_manager",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "occ_dr_gita",
        full_name: "Dr. Gita Occ-Health",
        email: "occ_gita@medbrains.local",
        role: "occ_health_officer",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "sched_admin_bina",
        full_name: "Bina Scheduling-Admin",
        email: "sched_bina@medbrains.local",
        role: "scheduling_admin",
        dept_code: Some("HOSP-ADMIN"),
    },
    DemoRoleUser {
        username: "housekeep_lila",
        full_name: "Lila Housekeeping",
        email: "hk_lila@medbrains.local",
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
        sqlx::query(
            "INSERT INTO users \
             (tenant_id, username, email, password_hash, full_name, role) \
             VALUES ($1, $2, $3, $4, $5, 'doctor') \
             ON CONFLICT (tenant_id, username) DO NOTHING",
        )
        .bind(tenant_id)
        .bind(doc.username)
        .bind(doc.email)
        .bind(&doctor_hash)
        .bind(doc.full_name)
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
            sqlx::query_scalar(
                "SELECT id FROM departments WHERE tenant_id = $1 AND code = $2",
            )
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
             ON CONFLICT (tenant_id, username) DO NOTHING",
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

    // Check if demo patients already exist
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM patients WHERE tenant_id = $1 AND uhid LIKE 'DEMO-%'",
    )
    .bind(tenant_id)
    .fetch_one(&mut *tx)
    .await?;

    if count > 0 {
        tracing::debug!("Demo patients already seeded, skipping");
        tx.commit().await?;
        return Ok(());
    }

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
        let token: i32 = i32::try_from(i + 1).unwrap_or(1);
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
             (tenant_id, encounter_id, department_id, doctor_id, token_number, status, queue_date) \
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

    tx.commit().await?;
    Ok(())
}
