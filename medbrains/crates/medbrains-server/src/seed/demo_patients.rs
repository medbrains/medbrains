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
