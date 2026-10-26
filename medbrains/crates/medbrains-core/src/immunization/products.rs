//! Vaccine products and the antigens each one protects against, so a dose
//! recorded by name (often read off a card) counts towards every series it
//! covers -- a hexavalent dose is DTP, Hib, hepatitis B and IPV at once.

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Antigen {
    Bcg,
    HepB,
    Opv,
    Ipv,
    Dtp,
    Hib,
    Rota,
    Pcv,
    Measles,
    Mumps,
    Rubella,
    Je,
    Td,
    Varicella,
    HepA,
    Typhoid,
    Hpv,
    Influenza,
}

/// A vaccine product as it is given.
#[derive(Debug, Clone, Copy)]
pub struct Product {
    pub key: &'static str,
    pub name: &'static str,
    pub antigens: &'static [Antigen],
    /// Lower-case words or phrases that name it on a card or in a record.
    aliases: &'static [&'static str],
}

use Antigen::{
    Bcg, Dtp, HepA, HepB, Hib, Hpv, Influenza, Ipv, Je, Measles, Mumps, Opv, Pcv, Rota, Rubella,
    Td, Typhoid, Varicella,
};

/// Most specific first: "hexavalent" before "DTaP", "MMR" before "MR",
/// "Tdap" before "Td".
pub const PRODUCTS: &[Product] = &[
    Product {
        key: "hexa",
        name: "Hexavalent (DTaP-IPV-HepB-Hib)",
        antigens: &[Dtp, HepB, Hib, Ipv],
        aliases: &["hexa", "hexavalent", "hexaxim", "infanrix hexa"],
    },
    Product {
        key: "penta",
        name: "Pentavalent (DTwP-HepB-Hib)",
        antigens: &[Dtp, HepB, Hib],
        aliases: &["penta", "pentavalent"],
    },
    Product {
        key: "mmr",
        name: "MMR",
        antigens: &[Measles, Mumps, Rubella],
        aliases: &["mmr"],
    },
    Product {
        key: "mr",
        name: "MR (measles-rubella)",
        antigens: &[Measles, Rubella],
        aliases: &["mr", "measles rubella"],
    },
    Product {
        key: "tdap",
        name: "Tdap",
        antigens: &[Td],
        aliases: &["tdap"],
    },
    Product {
        key: "td",
        name: "Td",
        antigens: &[Td],
        aliases: &["td", "tetanus diphtheria"],
    },
    Product {
        key: "dtp",
        name: "DTwP/DTaP",
        antigens: &[Dtp],
        aliases: &["dtp", "dpt", "dtwp", "dtap"],
    },
    Product {
        key: "bcg",
        name: "BCG",
        antigens: &[Bcg],
        aliases: &["bcg"],
    },
    Product {
        key: "opv",
        name: "OPV (oral polio)",
        antigens: &[Opv],
        aliases: &["opv", "bopv", "oral polio"],
    },
    Product {
        key: "ipv",
        name: "IPV / fIPV",
        antigens: &[Ipv],
        aliases: &["ipv", "fipv", "inactivated polio"],
    },
    Product {
        key: "hepb",
        name: "Hepatitis B",
        antigens: &[HepB],
        aliases: &["hepatitis b", "hep b", "hepb", "hbv"],
    },
    Product {
        key: "hib",
        name: "Hib",
        antigens: &[Hib],
        aliases: &["hib", "haemophilus"],
    },
    Product {
        key: "rota",
        name: "Rotavirus",
        antigens: &[Rota],
        aliases: &["rota", "rotavirus", "rotavac", "rotasiil"],
    },
    Product {
        key: "pcv",
        name: "PCV (pneumococcal conjugate)",
        antigens: &[Pcv],
        aliases: &["pcv", "pneumococcal"],
    },
    Product {
        key: "measles",
        name: "Measles",
        antigens: &[Measles],
        aliases: &["measles"],
    },
    Product {
        key: "je",
        name: "JE (Japanese encephalitis)",
        antigens: &[Je],
        aliases: &["je", "japanese encephalitis"],
    },
    Product {
        key: "varicella",
        name: "Varicella",
        antigens: &[Varicella],
        aliases: &["varicella", "chickenpox", "chicken pox"],
    },
    Product {
        key: "hepa",
        name: "Hepatitis A",
        antigens: &[HepA],
        aliases: &["hepatitis a", "hep a", "hepa"],
    },
    Product {
        key: "tcv",
        name: "Typhoid conjugate (TCV)",
        antigens: &[Typhoid],
        aliases: &["tcv", "typhoid"],
    },
    Product {
        key: "hpv",
        name: "HPV",
        antigens: &[Hpv],
        aliases: &["hpv", "papilloma"],
    },
    Product {
        key: "flu",
        name: "Influenza",
        antigens: &[Influenza],
        aliases: &["influenza", "flu"],
    },
];

pub fn by_key(key: &str) -> Option<&'static Product> {
    PRODUCTS.iter().find(|p| p.key == key)
}

/// The product a recorded dose names: its key when it was recorded from
/// the schedule, else the first product whose alias appears as whole words
/// in the vaccine name. `None` when nothing matches -- such a dose is shown
/// as unmatched rather than guessed.
pub fn identify(key: Option<&str>, name: &str) -> Option<&'static Product> {
    if let Some(p) = key.and_then(by_key) {
        return Some(p);
    }
    let words: Vec<String> = name
        .to_lowercase()
        .split(|c: char| !c.is_ascii_alphanumeric())
        .filter(|w| !w.is_empty())
        .map(str::to_owned)
        .collect();
    let text = format!(" {} ", words.join(" "));
    PRODUCTS
        .iter()
        .find(|p| p.aliases.iter().any(|a| text.contains(&format!(" {a} "))))
}
