//! Static clinical fixtures for the simulator. Shapes match NMC UG
//! curriculum case-mix and NABH common-presentation expectations.

use rand::rngs::StdRng;
use rand::seq::IndexedRandom;

/// ICD-10 shortlist covering frequently seen OPD diagnoses across the
/// NMC UG curriculum case mix (medicine / paeds / ortho / ENT /
/// ophthalmology / derma / psych).
pub const ICD10_OPD: &[(&str, &str)] = &[
    ("J00", "Acute nasopharyngitis [common cold]"),
    ("J06.9", "Acute upper respiratory infection, unspecified"),
    ("R50.9", "Fever, unspecified"),
    ("K30", "Functional dyspepsia"),
    ("M54.5", "Low back pain"),
    ("R51", "Headache"),
    ("I10", "Essential (primary) hypertension"),
    ("E11.9", "Type 2 diabetes mellitus without complications"),
    ("K59.0", "Constipation"),
    ("L29.9", "Pruritus, unspecified"),
    ("H10.9", "Conjunctivitis, unspecified"),
    ("H66.9", "Otitis media, unspecified"),
    ("J20.9", "Acute bronchitis, unspecified"),
    ("N39.0", "Urinary tract infection, site not specified"),
    ("F41.9", "Anxiety disorder, unspecified"),
];

pub const CHIEF_COMPLAINTS: &[&str] = &[
    "Fever for 2 days",
    "Cough and cold",
    "Headache since morning",
    "Body ache and weakness",
    "Stomach pain",
    "Sore throat",
    "Back pain",
    "Loose motions",
    "Burning urination",
    "General check-up",
    "Joint pain",
    "Skin rash",
    "Ear pain",
    "Red eye / itching",
    "Anxiety / sleep difficulty",
];

pub const ER_COMPLAINTS: &[&str] = &[
    "Chest pain",
    "Road traffic accident",
    "Fall from height",
    "Acute abdominal pain",
    "Breathlessness",
    "Burn injury",
    "Snake bite",
    "Seizure",
    "High fever with chills",
    "Loss of consciousness (brief)",
    "Suspected poisoning",
    "Assault injury",
];

/// (drug_name, dosage, frequency, duration). INN names where common.
pub const RX_DRUGS: &[(&str, &str, &str, &str)] = &[
    ("Paracetamol 500mg", "1 tab", "TDS", "3 days"),
    ("Amoxicillin 500mg", "1 cap", "TDS", "5 days"),
    ("Pantoprazole 40mg", "1 tab", "OD", "7 days"),
    ("Ibuprofen 400mg", "1 tab", "BD", "3 days"),
    ("Cetirizine 10mg", "1 tab", "HS", "5 days"),
    ("Amlodipine 5mg", "1 tab", "OD", "30 days"),
    ("Metformin 500mg", "1 tab", "BD", "30 days"),
    ("Ondansetron 4mg", "1 tab", "SOS", "2 days"),
];

pub fn random_diagnosis(rng: &mut StdRng) -> (&'static str, &'static str) {
    *ICD10_OPD.choose(rng).expect("non-empty pool")
}

/// Weighted diagnosis pick — favours ICDs that match the current season,
/// active holiday boost, and the tenant's natural live-data distribution.
/// Weight per code = 1.0 (base) + 0.8 season + festival_weight_boost
/// holiday + natural_blend × (natural_count / max_natural_count).
pub fn random_diagnosis_weighted(
    rng: &mut StdRng,
    season_boost: &[&str],
    holiday_boost: &[&str],
    festival_weight_boost: f32,
    natural_icds: &[(String, i64)],
    natural_blend: f32,
) -> (&'static str, &'static str) {
    use rand::Rng;
    let max_natural = natural_icds
        .iter()
        .map(|(_, n)| *n)
        .max()
        .unwrap_or(1)
        .max(1);
    let weights: Vec<f32> = ICD10_OPD
        .iter()
        .map(|(code, _)| {
            let mut w = 1.0_f32;
            if season_boost.iter().any(|c| c == code) {
                w += 0.8;
            }
            if holiday_boost.iter().any(|c| c == code) {
                w += festival_weight_boost;
            }
            if natural_blend > 0.0 {
                if let Some((_, n)) = natural_icds.iter().find(|(c, _)| c == code) {
                    w += natural_blend * (*n as f32 / max_natural as f32);
                }
            }
            w
        })
        .collect();
    let total: f32 = weights.iter().sum();
    if total <= 0.0 {
        return random_diagnosis(rng);
    }
    let mut roll = rng.random::<f32>() * total;
    for (idx, w) in weights.iter().enumerate() {
        if roll < *w {
            return ICD10_OPD[idx];
        }
        roll -= w;
    }
    random_diagnosis(rng)
}
