use sqlx::PgPool;

/// One service point: the desk or room a patient is called forward to.
///
/// `department` is the department that owns the point. It is `None` for the
/// general consultation rooms on purpose — OPD-03 is not Cardiology's room, it
/// is whichever clinic is sitting in it this morning, and that is what
/// `doctor_schedules.station_id` records. A station with no owning department
/// is offered to every department; one with an owner is offered only to it.
struct StationSeed {
    room_code: &'static str,
    code: &'static str,
    name: &'static str,
    station_type: &'static str,
    department: Option<&'static str>,
}

/// The outpatient path, in the order a patient walks it.
///
/// Only points that actually call a token appear here. The store room, the
/// records room and the wards have locations but no queue, and a station for
/// them would be a row nothing ever reads.
const STATIONS: &[StationSeed] = &[
    StationSeed {
        room_code: "BILLING-01",
        code: "REG-01",
        name: "Registration Counter 1",
        station_type: "reception",
        department: Some("BILLING-DEPT"),
    },
    StationSeed {
        room_code: "BILLING-02",
        code: "BILL-02",
        name: "Billing Counter 2",
        station_type: "billing_counter",
        department: Some("BILLING-DEPT"),
    },
    StationSeed {
        room_code: "LAB-COLLECT",
        code: "LAB-COLLECT",
        name: "Sample Collection",
        station_type: "lab_counter",
        department: Some("PATHOLOGY"),
    },
    StationSeed {
        room_code: "PHARM-DISP",
        code: "PHARM-DISP",
        name: "Pharmacy Dispensing",
        station_type: "pharmacy_counter",
        department: Some("PHARMACY"),
    },
];

/// Insert one station, resolving its room and department by code.
///
/// A missing room is skipped rather than failing the seed: a tenant may run a
/// trimmed location tree, and a hospital without a separate sample-collection
/// room should still get the rest of its counters.
async fn insert_station(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: uuid::Uuid,
    seed: &StationSeed,
) -> Result<bool, Box<dyn std::error::Error>> {
    let inserted = sqlx::query(
        "INSERT INTO stations (tenant_id, department_id, location_id, code, name, station_type) \
         SELECT $1, \
                (SELECT id FROM departments WHERE tenant_id = $1 AND code = $2), \
                l.id, $3, $4, $5 \
           FROM locations l \
          WHERE l.tenant_id = $1 AND l.code = $6 AND l.level = 'room' \
         ON CONFLICT (tenant_id, code) DO NOTHING",
    )
    .bind(tenant_id)
    .bind(seed.department)
    .bind(seed.code)
    .bind(seed.name)
    .bind(seed.station_type)
    .bind(seed.room_code)
    .execute(&mut **tx)
    .await?
    .rows_affected();

    Ok(inserted > 0)
}

/// Seed the consultation rooms as shared OPD counters.
///
/// Kept separate from `STATIONS` because the rooms are numbered rather than
/// named, and listing six near-identical entries by hand invites the copy that
/// forgets to change one field.
async fn insert_consultation_rooms(
    tx: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    tenant_id: uuid::Uuid,
) -> Result<u64, Box<dyn std::error::Error>> {
    let inserted = sqlx::query(
        "INSERT INTO stations (tenant_id, location_id, code, name, station_type) \
         SELECT $1, l.id, 'OPD-C' || right(l.code, 2), \
                'OPD Counter ' || right(l.code, 2), 'opd_counter' \
           FROM locations l \
          WHERE l.tenant_id = $1 AND l.level = 'room' AND l.code LIKE 'OPD-%' \
         ON CONFLICT (tenant_id, code) DO NOTHING",
    )
    .bind(tenant_id)
    .execute(&mut **tx)
    .await?
    .rows_affected();

    Ok(inserted)
}

/// Seed the service points that call tokens, bound to the rooms they sit in.
///
/// Runs after `seed_locations` — every station resolves its room by code, and
/// without the location tree there is nothing to bind to.
pub(super) async fn seed_stations(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM stations WHERE tenant_id = $1 AND deleted_at IS NULL",
    )
    .bind(tenant_id)
    .fetch_one(pool)
    .await?;

    if count > 0 {
        tracing::debug!("Stations already seeded ({count} rows), skipping");
        return Ok(());
    }

    let mut tx = pool.begin().await?;
    let mut seeded = insert_consultation_rooms(&mut tx, tenant_id).await?;
    for seed in STATIONS {
        if insert_station(&mut tx, tenant_id, seed).await? {
            seeded += 1;
        }
    }
    tx.commit().await?;

    tracing::info!("Seeded {seeded} stations");
    Ok(())
}
