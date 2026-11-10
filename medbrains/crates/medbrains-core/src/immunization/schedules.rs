//! The childhood schedules a hospital can follow.
//!
//! UIP: Ministry of Health and Family Welfare, National Immunization Schedule
//! for infants and children (Universal Immunization Programme), including the
//! third fractional IPV dose at 9 months (2023).
//!
//! IAP: Indian Academy of Pediatrics Advisory Committee on Vaccines and
//! Immunization Practices (ACVIP), recommended schedule 2023 (Indian Pediatr
//! 2024). The IAP schedule also lists optional and situational vaccines; the
//! ones here are its routine recommendations for every child.
//!
//! U-WIN (MoHFW's digital registry for UIP vaccination of children 0-16
//! years and pregnant women) records doses against this same UIP vaccine
//! list. MedBrains does not write to U-WIN -- it publishes no API for
//! hospital systems; doses reach the patient's ABHA as FHIR Immunization
//! records instead, and a vaccinator enters UIP doses in U-WIN as usual.
//!
//! Ages are in days: 6 weeks 42, 10 weeks 70, 14 weeks 98, 6 months 183,
//! 9 months 274, 12 months 365, 15 months 456, 16 months 487, 18 months 548,
//! 4 years 1461, 5 years 1826, 7 years 2557, 9 years 3287, 10 years 3652,
//! 16 years 5844.

use super::products::Antigen::{
    self, Bcg, Dtp, HepA, HepB, Hib, Hpv, Influenza, Ipv, Je, Measles, Mumps, Opv, Pcv, Rota,
    Rubella, Td, Typhoid, Varicella,
};

/// One dose of a series.
#[derive(Debug, Clone, Copy)]
pub struct DoseRule {
    pub label: &'static str,
    /// The youngest age at which the dose counts.
    pub min_age: i64,
    /// The age the schedule gives it at.
    pub due_age: i64,
    /// The oldest age at which it is still given; beyond it the dose is
    /// no longer offered.
    pub max_age: Option<i64>,
    /// Minimum days after the previous dose of the series.
    pub min_interval: i64,
    /// The product to record it as.
    pub product: &'static str,
}

/// A series of doses protecting against `needs`.
#[derive(Debug, Clone, Copy)]
pub struct Series {
    pub key: &'static str,
    pub name: &'static str,
    pub needs: &'static [Antigen],
    /// Only a product protecting against exactly `needs` counts (a birth
    /// dose of hepatitis B is the monovalent vaccine, never pentavalent).
    pub exact: bool,
    pub doses: &'static [DoseRule],
    /// Catch-up rules and contraindications, for the person giving it.
    pub note: &'static str,
    /// Given only where the hospital opts in (JE: endemic districts).
    pub optional: bool,
}

const fn d(
    label: &'static str,
    product: &'static str,
    min_age: i64,
    due_age: i64,
    max_age: Option<i64>,
    min_interval: i64,
) -> DoseRule {
    DoseRule {
        label,
        min_age,
        due_age,
        max_age,
        min_interval,
        product,
    }
}

const LIVE: &str = "Live vaccine: not in severe immunodeficiency or on high-dose steroids.";

pub const UIP: &[Series] = &[
    Series {
        key: "bcg",
        name: "BCG",
        needs: &[Bcg],
        exact: false,
        optional: false,
        doses: &[d("BCG", "bcg", 0, 0, Some(365), 0)],
        note: "At birth or as early as possible until 1 year. Not in symptomatic HIV or known immunodeficiency.",
    },
    Series {
        key: "hepb0",
        name: "Hepatitis B birth dose",
        needs: &[HepB],
        exact: true,
        optional: false,
        doses: &[d("Hep B-0", "hepb", 0, 0, Some(1), 0)],
        note: "Within 24 hours of birth only; later hepatitis B doses come with Pentavalent.",
    },
    Series {
        key: "opv0",
        name: "OPV birth dose",
        needs: &[Opv],
        exact: false,
        optional: false,
        doses: &[d("OPV-0", "opv", 0, 0, Some(15), 0)],
        note: "At birth or within the first 15 days.",
    },
    Series {
        key: "opv",
        name: "OPV",
        needs: &[Opv],
        exact: false,
        optional: false,
        doses: &[
            d("OPV-1", "opv", 42, 42, Some(1826), 0),
            d("OPV-2", "opv", 70, 70, Some(1826), 28),
            d("OPV-3", "opv", 98, 98, Some(1826), 28),
        ],
        note: "At 6, 10 and 14 weeks; can be given until 5 years, 4 weeks apart.",
    },
    Series {
        key: "penta",
        name: "Pentavalent",
        needs: &[Dtp, HepB, Hib],
        exact: false,
        optional: false,
        doses: &[
            d("Penta-1", "penta", 42, 42, Some(365), 0),
            d("Penta-2", "penta", 70, 70, Some(365), 28),
            d("Penta-3", "penta", 98, 98, Some(365), 28),
        ],
        note: "At 6, 10 and 14 weeks, 4 weeks apart, until 1 year. After 1 year, missed doses are given as DPT (until 7 years).",
    },
    Series {
        key: "rota",
        name: "Rotavirus",
        needs: &[Rota],
        exact: false,
        optional: false,
        doses: &[
            d("Rota-1", "rota", 42, 42, Some(365), 0),
            d("Rota-2", "rota", 70, 70, Some(365), 28),
            d("Rota-3", "rota", 98, 98, Some(365), 28),
        ],
        note: "At 6, 10 and 14 weeks, until 1 year. Not after intussusception or in severe combined immunodeficiency.",
    },
    Series {
        key: "fipv",
        name: "Fractional IPV",
        needs: &[Ipv],
        exact: false,
        optional: false,
        doses: &[
            d("fIPV-1", "ipv", 42, 42, Some(365), 0),
            d("fIPV-2", "ipv", 98, 98, Some(365), 28),
            d("fIPV-3", "ipv", 274, 274, Some(365), 28),
        ],
        note: "Intradermal at 6 weeks, 14 weeks and 9 months.",
    },
    Series {
        key: "pcv",
        name: "Pneumococcal conjugate",
        needs: &[Pcv],
        exact: false,
        optional: false,
        doses: &[
            d("PCV-1", "pcv", 42, 42, Some(365), 0),
            d("PCV-2", "pcv", 98, 98, Some(365), 28),
            d("PCV booster", "pcv", 274, 274, Some(365), 56),
        ],
        note: "At 6 weeks, 14 weeks and a booster at 9 months, until 1 year.",
    },
    Series {
        key: "mr",
        name: "Measles-rubella",
        needs: &[Measles, Rubella],
        exact: false,
        optional: false,
        doses: &[
            d("MR-1", "mr", 274, 274, Some(1826), 0),
            d("MR-2", "mr", 487, 487, Some(1826), 28),
        ],
        note: "At 9-12 months and 16-24 months; both can be given until 5 years, 4 weeks apart. Live vaccine: not in severe immunodeficiency.",
    },
    Series {
        key: "je",
        name: "Japanese encephalitis",
        needs: &[Je],
        exact: false,
        optional: true,
        doses: &[
            d("JE-1", "je", 274, 274, Some(5479), 0),
            d("JE-2", "je", 487, 487, Some(5479), 28),
        ],
        note: "Endemic districts only: 9-12 months and 16-24 months.",
    },
    Series {
        key: "dpt_b",
        name: "DPT boosters",
        needs: &[Dtp],
        exact: false,
        optional: false,
        doses: &[
            d("DPT booster-1", "dtp", 487, 487, Some(2557), 180),
            d("DPT booster-2", "dtp", 1826, 1826, Some(2557), 180),
        ],
        note: "At 16-24 months and 5-6 years; not after 7 years (give Td).",
    },
    Series {
        key: "opv_b",
        name: "OPV booster",
        needs: &[Opv],
        exact: false,
        optional: false,
        doses: &[d("OPV booster", "opv", 487, 487, Some(1826), 28)],
        note: "At 16-24 months.",
    },
    Series {
        key: "td",
        name: "Td",
        needs: &[Td],
        exact: false,
        optional: false,
        doses: &[
            d("Td (10 years)", "td", 3652, 3652, None, 0),
            d("Td (16 years)", "td", 5844, 5844, None, 365),
        ],
        note: "At 10 and 16 years.",
    },
];

pub const IAP: &[Series] = &[
    Series {
        key: "bcg",
        name: "BCG",
        needs: &[Bcg],
        exact: false,
        optional: false,
        doses: &[d("BCG", "bcg", 0, 0, Some(1826), 0)],
        note: "At birth. Not in symptomatic HIV or known immunodeficiency.",
    },
    Series {
        key: "opv0",
        name: "OPV birth dose",
        needs: &[Opv],
        exact: false,
        optional: false,
        doses: &[d("OPV-0", "opv", 0, 0, Some(15), 0)],
        note: "At birth; national pulse polio doses are additional.",
    },
    Series {
        key: "hepb",
        name: "Hepatitis B",
        needs: &[HepB],
        exact: false,
        optional: false,
        doses: &[
            d("Hep B-1", "hepb", 0, 0, None, 0),
            d("Hep B-2", "hexa", 42, 42, None, 28),
            d("Hep B-3", "hexa", 70, 70, None, 28),
            d("Hep B-4", "hexa", 98, 98, None, 28),
        ],
        note: "Birth dose within 24 hours, then with combination vaccines at 6, 10 and 14 weeks.",
    },
    Series {
        key: "dtp",
        name: "DTwP/DTaP",
        needs: &[Dtp],
        exact: false,
        optional: false,
        doses: &[
            d("DTP-1", "hexa", 42, 42, Some(2557), 0),
            d("DTP-2", "hexa", 70, 70, Some(2557), 28),
            d("DTP-3", "hexa", 98, 98, Some(2557), 28),
            d("DTP booster-1", "dtp", 487, 487, Some(2557), 180),
            d("DTP booster-2", "dtp", 1461, 1461, Some(2557), 180),
        ],
        note: "6, 10, 14 weeks; boosters at 16-18 months and 4-6 years. After 7 years use Tdap/Td.",
    },
    Series {
        key: "hib",
        name: "Hib",
        needs: &[Hib],
        exact: false,
        optional: false,
        doses: &[
            d("Hib-1", "hexa", 42, 42, Some(1826), 0),
            d("Hib-2", "hexa", 70, 70, Some(1826), 28),
            d("Hib-3", "hexa", 98, 98, Some(1826), 28),
            d("Hib booster", "hib", 487, 487, Some(1826), 180),
        ],
        note: "6, 10, 14 weeks and a booster at 16-18 months; not after 5 years in healthy children.",
    },
    Series {
        key: "ipv",
        name: "IPV",
        needs: &[Ipv],
        exact: false,
        optional: false,
        doses: &[
            d("IPV-1", "hexa", 42, 42, None, 0),
            d("IPV-2", "hexa", 70, 70, None, 28),
            d("IPV-3", "hexa", 98, 98, None, 28),
            d("IPV booster", "ipv", 487, 487, None, 180),
        ],
        note: "6, 10, 14 weeks and a booster at 16-18 months.",
    },
    Series {
        key: "rota",
        name: "Rotavirus",
        needs: &[Rota],
        exact: false,
        optional: false,
        doses: &[
            d("Rota-1", "rota", 42, 42, Some(105), 0),
            d("Rota-2", "rota", 70, 70, Some(240), 28),
            d("Rota-3", "rota", 98, 98, Some(240), 28),
        ],
        note: "First dose by 15 weeks, last by 8 months. Not after intussusception or in severe combined immunodeficiency.",
    },
    Series {
        key: "pcv",
        name: "Pneumococcal conjugate",
        needs: &[Pcv],
        exact: false,
        optional: false,
        doses: &[
            d("PCV-1", "pcv", 42, 42, Some(1826), 0),
            d("PCV-2", "pcv", 70, 70, Some(1826), 28),
            d("PCV-3", "pcv", 98, 98, Some(1826), 28),
            d("PCV booster", "pcv", 365, 365, Some(1826), 56),
        ],
        note: "6, 10, 14 weeks and a booster at 12-15 months.",
    },
    Series {
        key: "flu",
        name: "Influenza",
        needs: &[Influenza],
        exact: false,
        optional: false,
        doses: &[
            d("Influenza-1", "flu", 183, 183, None, 0),
            d("Influenza-2", "flu", 214, 214, None, 28),
        ],
        note: "Two doses a month apart from 6 months, then once every year before the flu season.",
    },
    Series {
        key: "tcv",
        name: "Typhoid conjugate",
        needs: &[Typhoid],
        exact: false,
        optional: false,
        doses: &[d("TCV", "tcv", 183, 274, None, 0)],
        note: "One dose from 6-9 months.",
    },
    Series {
        key: "mmr",
        name: "MMR",
        needs: &[Measles, Mumps, Rubella],
        exact: false,
        optional: false,
        doses: &[
            d("MMR-1", "mmr", 274, 274, None, 0),
            d("MMR-2", "mmr", 456, 456, None, 28),
            d("MMR-3", "mmr", 1461, 1461, None, 28),
        ],
        note: LIVE,
    },
    Series {
        key: "hepa",
        name: "Hepatitis A",
        needs: &[HepA],
        exact: false,
        optional: false,
        doses: &[
            d("Hep A-1", "hepa", 365, 365, None, 0),
            d("Hep A-2", "hepa", 548, 548, None, 180),
        ],
        note: "From 12 months; the second dose 6 months later for the inactivated vaccine (one dose suffices for the live vaccine).",
    },
    Series {
        key: "varicella",
        name: "Varicella",
        needs: &[Varicella],
        exact: false,
        optional: false,
        doses: &[
            d("Varicella-1", "varicella", 365, 456, None, 0),
            d("Varicella-2", "varicella", 456, 548, None, 90),
        ],
        note: LIVE,
    },
    Series {
        key: "je",
        name: "Japanese encephalitis",
        needs: &[Je],
        exact: false,
        optional: true,
        doses: &[
            d("JE-1", "je", 274, 274, None, 0),
            d("JE-2", "je", 365, 487, None, 28),
        ],
        note: "Endemic areas only.",
    },
    Series {
        key: "td",
        name: "Tdap/Td",
        needs: &[Td],
        exact: false,
        optional: false,
        doses: &[d("Tdap (10-12 years)", "tdap", 3652, 3652, None, 0)],
        note: "Tdap at 10-12 years; Td every 10 years after.",
    },
    Series {
        key: "hpv",
        name: "HPV",
        needs: &[Hpv],
        exact: false,
        optional: false,
        doses: &[
            d("HPV-1", "hpv", 3287, 3287, None, 0),
            d("HPV-2", "hpv", 3470, 3470, None, 180),
        ],
        note: "Two doses 6 months apart from 9-14 years (three doses if started at 15 or later).",
    },
];
