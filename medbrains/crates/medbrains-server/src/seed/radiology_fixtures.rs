use serde_json::json;
use sqlx::PgPool;

struct DicomFixture {
    uhid: &'static str,
    study_instance_uid: &'static str,
    accession_number: &'static str,
    modality: &'static str,
    study_date: &'static str,
    study_description: &'static str,
    referring_physician: &'static str,
    instance_count: i32,
    series_count: i32,
    orthanc_id: &'static str,
    pacs_url: &'static str,
    viewer_url: &'static str,
    file_size_bytes: i64,
    sample_file: &'static str,
}

const DICOM_FIXTURES: &[DicomFixture] = &[
    DicomFixture {
        uhid: "DEMO-00001",
        study_instance_uid: "1.2.826.0.1.3680043.10.543.2026051101",
        accession_number: "RAD-DEMO-CT-0001",
        modality: "CT",
        study_date: "2026-05-01",
        study_description: "CT Brain Plain - Synthetic Demo",
        referring_physician: "Dr. Ravi Menon",
        instance_count: 35,
        series_count: 2,
        orthanc_id: "demo-ct-brain-plain",
        pacs_url: "/demo/dicom/ct-brain-plain-demo.dcm",
        viewer_url: "/demo/dicom/ct-brain-plain-demo.html",
        file_size_bytes: 9088,
        sample_file: "ct-brain-plain-demo.dcm",
    },
    DicomFixture {
        uhid: "DEMO-00002",
        study_instance_uid: "1.2.826.0.1.3680043.10.543.2026051102",
        accession_number: "RAD-DEMO-US-0002",
        modality: "US",
        study_date: "2026-05-02",
        study_description: "US Abdomen - Synthetic Demo",
        referring_physician: "Dr. Priya Nair",
        instance_count: 18,
        series_count: 1,
        orthanc_id: "demo-us-abdomen",
        pacs_url: "/demo/dicom/us-abdomen-demo.dcm",
        viewer_url: "/demo/dicom/us-abdomen-demo.html",
        file_size_bytes: 9086,
        sample_file: "us-abdomen-demo.dcm",
    },
    DicomFixture {
        uhid: "DEMO-00003",
        study_instance_uid: "1.2.826.0.1.3680043.10.543.2026051103",
        accession_number: "RAD-DEMO-CR-0003",
        modality: "CR",
        study_date: "2026-05-03",
        study_description: "Chest X-Ray PA - Synthetic Demo",
        referring_physician: "Dr. Arjun Rao",
        instance_count: 1,
        series_count: 1,
        orthanc_id: "demo-cr-chest-pa",
        pacs_url: "/demo/dicom/chest-xray-pa-demo.dcm",
        viewer_url: "/demo/dicom/chest-xray-pa-demo.html",
        file_size_bytes: 9086,
        sample_file: "chest-xray-pa-demo.dcm",
    },
    DicomFixture {
        uhid: "DEMO-00004",
        study_instance_uid: "1.2.826.0.1.3680043.10.543.2026051104",
        accession_number: "RAD-DEMO-MR-0004",
        modality: "MR",
        study_date: "2026-05-04",
        study_description: "MRI Right Knee - Synthetic Demo",
        referring_physician: "Dr. Ravi Menon",
        instance_count: 64,
        series_count: 5,
        orthanc_id: "demo-mr-right-knee",
        pacs_url: "/demo/dicom/mri-right-knee-demo.dcm",
        viewer_url: "/demo/dicom/mri-right-knee-demo.html",
        file_size_bytes: 9088,
        sample_file: "mri-right-knee-demo.dcm",
    },
    DicomFixture {
        uhid: "DEMO-00005",
        study_instance_uid: "1.2.826.0.1.3680043.10.543.2026051105",
        accession_number: "RAD-DEMO-DX-0005",
        modality: "DX",
        study_date: "2026-05-05",
        study_description: "Left Hand X-Ray - Synthetic Demo",
        referring_physician: "Dr. Priya Nair",
        instance_count: 2,
        series_count: 1,
        orthanc_id: "demo-dx-left-hand",
        pacs_url: "/demo/dicom/left-hand-xray-demo.dcm",
        viewer_url: "/demo/dicom/left-hand-xray-demo.html",
        file_size_bytes: 9094,
        sample_file: "left-hand-xray-demo.dcm",
    },
];

pub(super) async fn seed_radiology_fixtures(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    let pacs_config = json!({
        "fixture_mode": true,
        "orthanc_url": "https://medbrains.localhost/demo/dicom",
        "local_ae_title": "MEDBRAINS_DEMO",
        "remote_ae_title": "ORTHANC_DEMO",
        "dicomweb_base_url": "https://medbrains.localhost/demo/dicom",
        "auto_sync": true,
        "note": "Synthetic de-identified DICOM fixtures for local development only."
    });

    sqlx::query(
        "INSERT INTO tenant_settings (tenant_id, category, key, value) \
         VALUES ($1, 'radiology', 'pacs_config', $2) \
         ON CONFLICT (tenant_id, category, key) DO UPDATE \
         SET value = EXCLUDED.value, updated_at = now()",
    )
    .bind(tenant_id)
    .bind(pacs_config)
    .execute(&mut *tx)
    .await?;

    let mut seeded = 0_i32;

    for fixture in DICOM_FIXTURES {
        let patient_id: Option<uuid::Uuid> =
            sqlx::query_scalar("SELECT id FROM patients WHERE tenant_id = $1 AND uhid = $2")
                .bind(tenant_id)
                .bind(fixture.uhid)
                .fetch_optional(&mut *tx)
                .await?;

        let Some(patient_id) = patient_id else {
            tracing::warn!(
                uhid = fixture.uhid,
                "Skipping radiology DICOM fixture because demo patient is missing"
            );
            continue;
        };

        let metadata = json!({
            "fixture": true,
            "deidentified": true,
            "sample_file": fixture.sample_file,
            "dicom_standard": "DICOM PS3.10 Part 10 file, Explicit VR Little Endian",
            "dicom_tags": {
                "00080050": fixture.accession_number,
                "00080060": fixture.modality,
                "00081030": fixture.study_description,
                "00100020": fixture.uhid,
                "0020000D": fixture.study_instance_uid
            },
            "compliance_note": "Synthetic local development data; do not use for diagnosis."
        });

        sqlx::query(
            "INSERT INTO radiology_dicom_studies \
             (tenant_id, patient_id, study_instance_uid, accession_number, modality, study_date, \
              study_description, referring_physician, instance_count, series_count, orthanc_id, \
              pacs_url, viewer_url, file_size_bytes, dicom_metadata) \
             VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12, $13, $14, $15) \
             ON CONFLICT (tenant_id, study_instance_uid) DO UPDATE SET \
              patient_id = EXCLUDED.patient_id, accession_number = EXCLUDED.accession_number, \
              modality = EXCLUDED.modality, study_date = EXCLUDED.study_date, \
              study_description = EXCLUDED.study_description, \
              referring_physician = EXCLUDED.referring_physician, \
              instance_count = EXCLUDED.instance_count, series_count = EXCLUDED.series_count, \
              orthanc_id = EXCLUDED.orthanc_id, pacs_url = EXCLUDED.pacs_url, \
              viewer_url = EXCLUDED.viewer_url, file_size_bytes = EXCLUDED.file_size_bytes, \
              dicom_metadata = EXCLUDED.dicom_metadata, is_active = true, updated_at = now()",
        )
        .bind(tenant_id)
        .bind(patient_id)
        .bind(fixture.study_instance_uid)
        .bind(fixture.accession_number)
        .bind(fixture.modality)
        .bind(fixture.study_date)
        .bind(fixture.study_description)
        .bind(fixture.referring_physician)
        .bind(fixture.instance_count)
        .bind(fixture.series_count)
        .bind(fixture.orthanc_id)
        .bind(fixture.pacs_url)
        .bind(fixture.viewer_url)
        .bind(fixture.file_size_bytes)
        .bind(metadata)
        .execute(&mut *tx)
        .await?;

        seeded += 1;
    }

    tx.commit().await?;
    tracing::info!(seeded, "Seeded synthetic radiology DICOM fixtures");
    Ok(())
}
