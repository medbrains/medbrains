use sqlx::PgPool;

/// `(code, name, provider_type, contact_phone, website)`
const PROVIDERS: &[(&str, &str, &str, &str, &str)] = &[
    // ── Government Schemes ────────────────────────────────────
    (
        "GOV-CGHS",
        "CGHS (Central Government Health Scheme)",
        "government",
        "1800-11-0223",
        "cghs.gov.in",
    ),
    (
        "GOV-ECHS",
        "ECHS (Ex-Servicemen Contributory Health Scheme)",
        "government",
        "011-26193388",
        "echs.gov.in",
    ),
    (
        "GOV-PMJAY",
        "PMJAY (Ayushman Bharat PM-JAY)",
        "government",
        "14555",
        "pmjay.gov.in",
    ),
    (
        "GOV-ESIS",
        "ESIC (Employees' State Insurance)",
        "government",
        "1800-11-2526",
        "esic.nic.in",
    ),
    (
        "GOV-CMCHIS",
        "CMCHIS (CM's Comprehensive Health Insurance)",
        "government",
        "104",
        "cmchistn.com",
    ),
    // ── Public Sector Insurers ────────────────────────────────
    (
        "PUB-NIACL",
        "New India Assurance Co. Ltd.",
        "public_sector",
        "1800-209-0056",
        "newindia.co.in",
    ),
    (
        "PUB-UIICL",
        "United India Insurance Co. Ltd.",
        "public_sector",
        "1800-4253-3333",
        "uiic.co.in",
    ),
    (
        "PUB-OICL",
        "Oriental Insurance Co. Ltd.",
        "public_sector",
        "1800-11-8485",
        "orientalinsurance.org.in",
    ),
    (
        "PUB-NICL",
        "National Insurance Co. Ltd.",
        "public_sector",
        "1800-345-0330",
        "nationalinsurance.nic.co.in",
    ),
    // ── Private Insurers ──────────────────────────────────────
    (
        "PVT-STAR",
        "Star Health & Allied Insurance",
        "private",
        "1800-425-2255",
        "starhealth.in",
    ),
    (
        "PVT-HDFC",
        "HDFC ERGO Health Insurance",
        "private",
        "1800-266-0700",
        "hdfcergo.com",
    ),
    (
        "PVT-ICICI",
        "ICICI Lombard Health Insurance",
        "private",
        "1800-266-9725",
        "icicilombard.com",
    ),
    (
        "PVT-BAJAJ",
        "Bajaj Allianz Health Insurance",
        "private",
        "1800-209-5858",
        "bajajallianz.com",
    ),
    (
        "PVT-MAX",
        "Niva Bupa (Max Bupa) Health Insurance",
        "private",
        "1800-200-5577",
        "nivabupa.com",
    ),
    (
        "PVT-CARE",
        "Care Health Insurance (Religare)",
        "private",
        "1800-102-4488",
        "careinsurance.com",
    ),
    (
        "PVT-TATA",
        "Tata AIG Health Insurance",
        "private",
        "1800-266-7780",
        "tataaig.com",
    ),
    (
        "PVT-SBI",
        "SBI General Health Insurance",
        "private",
        "1800-102-1111",
        "sbigeneral.in",
    ),
    (
        "PVT-ROYAL",
        "Royal Sundaram Health Insurance",
        "private",
        "1800-568-9999",
        "royalsundaram.in",
    ),
    (
        "PVT-CHOLA",
        "Cholamandalam MS Health Insurance",
        "private",
        "1800-200-5544",
        "cholainsurance.com",
    ),
    (
        "PVT-MANI",
        "Manipal Cigna Health Insurance",
        "private",
        "1800-266-0101",
        "manipalcigna.com",
    ),
    // ── Third-Party Administrators (TPAs) ─────────────────────
    (
        "TPA-MDI",
        "MD India Healthcare (TPA)",
        "tpa",
        "1800-209-7800",
        "maboreindia.com",
    ),
    (
        "TPA-MEDI",
        "Medi Assist Insurance TPA",
        "tpa",
        "1800-425-0101",
        "mediassistindia.com",
    ),
    (
        "TPA-PARK",
        "Paramount Health Services (TPA)",
        "tpa",
        "022-4035-9100",
        "paramounttpa.com",
    ),
    (
        "TPA-VIDAL",
        "Vidal Health TPA",
        "tpa",
        "1800-425-3056",
        "vidalhealth.com",
    ),
    (
        "TPA-GOOD",
        "Good Health TPA Services",
        "tpa",
        "1800-599-2020",
        "goodhealthplan.com",
    ),
];

/// Seed insurance providers for the DEFAULT tenant.
/// Idempotent — skips providers that already exist.
pub(super) async fn seed_insurance_providers(
    pool: &PgPool,
    tenant_id: uuid::Uuid,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut tx = pool.begin().await?;

    sqlx::query("SELECT set_config('app.tenant_id', $1::text, true)")
        .bind(tenant_id.to_string())
        .execute(&mut *tx)
        .await?;

    for &(code, name, provider_type, contact_phone, website) in PROVIDERS {
        sqlx::query(
            "INSERT INTO master_insurance_providers \
             (tenant_id, code, name, provider_type, contact_phone, website) \
             VALUES ($1, $2, $3, $4, $5, $6) \
             ON CONFLICT (tenant_id, code) DO NOTHING",
        )
        .bind(tenant_id)
        .bind(code)
        .bind(name)
        .bind(provider_type)
        .bind(contact_phone)
        .bind(website)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    tracing::info!("Seeded {} insurance providers", PROVIDERS.len());
    Ok(())
}
