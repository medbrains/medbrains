//! The cap a prescription, or a discharge summary, puts on what a gated drug
//! may release: matched per catalogue name class, counted per item, across
//! every order on the same paper. Pure, so the rule is tested without a
//! database; `schedule_gate` reads the rows.

use std::collections::{BTreeMap, HashMap, HashSet};

use uuid::Uuid;

/// One gated drug on the order, its lines summed.
#[derive(Debug, sqlx::FromRow)]
pub(super) struct ScheduledLine {
    pub(super) catalog_id: Uuid,
    pub(super) name: String,
    /// `H`, `H1`, `X`, `NDPS`, or `controlled` for a controlled drug of none.
    pub(super) schedule: String,
    pub(super) is_controlled: bool,
    pub(super) quantity: i64,
}

impl ScheduledLine {
    /// X, NDPS and controlled: no verbal order, no repeat, a stated quantity.
    pub(super) fn is_strict(&self) -> bool {
        self.is_controlled || matches!(self.schedule.as_str(), "X" | "NDPS")
    }

    /// "Schedule H", or "Controlled" for a controlled drug with no schedule.
    pub(super) fn kind(&self) -> String {
        if self.schedule == "controlled" {
            "Controlled".to_owned()
        } else {
            format!("Schedule {}", self.schedule)
        }
    }
}

/// What one prescription item, or one listed discharge medicine, allows.
#[derive(Debug)]
pub(super) struct Allowance {
    pub(super) catalog_item_id: Option<Uuid>,
    pub(super) name: String,
    /// The quantity the doctor wrote.
    pub(super) stated: Option<i64>,
    /// Dose x frequency x duration, when the frequency can be counted.
    pub(super) counted: Option<i64>,
}

/// What earlier orders on the same prescription or summary released of one
/// catalogue item.
#[derive(Debug, sqlx::FromRow)]
pub(super) struct Released {
    pub(super) catalog_id: Uuid,
    pub(super) name: String,
    pub(super) quantity: i64,
}

/// The paper behind a cap, for the refusal's wording.
#[derive(Debug, Clone, Copy)]
pub(super) struct Source {
    pub(super) noun: &'static str,
    /// Fills per item: `1 + repeats`, or 1 for a strict drug.
    pub(super) repeats: i64,
}

/// How a catalogue name is compared: trimmed, ignoring case.
fn name_key(name: &str) -> String {
    name.trim().to_ascii_lowercase()
}

/// Each gated line checked against the allowances, per name class. Pure: the
/// rule lives here.
///
/// Catalogue items with one full name form a class. An allowance with a
/// catalogue id serves only that item; one without (an older line) serves the
/// whole class it names. The class is refused when what its items took, here
/// and before, cannot be covered: each item's excess over its own id
/// allowances must fit in the class's name allowances.
pub(super) fn cap_problems<'l>(
    lines: impl IntoIterator<Item = &'l ScheduledLine>,
    allowances: &[Allowance],
    released: &[Released],
    source: Source,
) -> Vec<String> {
    let mut classes: BTreeMap<String, Vec<&ScheduledLine>> = BTreeMap::new();
    for line in lines {
        classes.entry(name_key(&line.name)).or_default().push(line);
    }
    classes
        .iter()
        .filter_map(|(class, members)| class_problem(class, members, allowances, released, source))
        .collect()
}

/// The refusal for one name class, if it has one.
fn class_problem(
    class: &str,
    members: &[&ScheduledLine],
    allowances: &[Allowance],
    released: &[Released],
    source: Source,
) -> Option<String> {
    let first = members.first()?;
    let (label, kind, noun) = (&first.name, first.kind(), source.noun);
    let strict = members.iter().any(|m| m.is_strict());
    let earlier: Vec<&Released> = released
        .iter()
        .filter(|r| name_key(&r.name) == class)
        .collect();
    let ids: HashSet<Uuid> = members
        .iter()
        .map(|m| m.catalog_id)
        .chain(earlier.iter().map(|r| r.catalog_id))
        .collect();
    let by_id: Vec<&Allowance> = allowances
        .iter()
        .filter(|a| a.catalog_item_id.is_some_and(|id| ids.contains(&id)))
        .collect();
    let by_name: Vec<&Allowance> = allowances
        .iter()
        .filter(|a| a.catalog_item_id.is_none() && !class.is_empty() && name_key(&a.name) == class)
        .collect();
    if by_id.is_empty() && by_name.is_empty() {
        return Some(format!("{label}: {kind} drug that is not on {noun}"));
    }
    let quantity = |a: &Allowance| {
        if strict {
            a.stated
        } else {
            a.stated.or(a.counted)
        }
    };
    if by_id.iter().chain(&by_name).any(|a| quantity(a).is_none()) {
        return Some(if strict {
            format!(
                "{label}: {kind} drug with no quantity stated on {noun}; X and NDPS drugs go out \
                 only on a quantity the doctor wrote"
            )
        } else {
            format!(
                "{label}: {kind} drug whose prescribed quantity cannot be read (no quantity, and \
                 a frequency that cannot be counted); ask the doctor to state it"
            )
        });
    }
    let fills = if strict { 1 } else { 1 + source.repeats };
    let mut id_cap: HashMap<Uuid, i64> = HashMap::new();
    for a in &by_id {
        if let (Some(id), Some(q)) = (a.catalog_item_id, quantity(a)) {
            *id_cap.entry(id).or_default() += q.saturating_mul(fills);
        }
    }
    let name_cap: i64 = by_name
        .iter()
        .filter_map(|a| quantity(a))
        .map(|q| q.saturating_mul(fills))
        .sum();
    let mut used: HashMap<Uuid, i64> = HashMap::new();
    for r in &earlier {
        *used.entry(r.catalog_id).or_default() += r.quantity;
    }
    for m in members {
        *used.entry(m.catalog_id).or_default() += m.quantity;
    }
    let overflow: i64 = used
        .iter()
        .map(|(id, u)| (u - id_cap.get(id).copied().unwrap_or(0)).max(0))
        .sum();
    if overflow <= name_cap {
        return None;
    }
    let asked: i64 = members.iter().map(|m| m.quantity).sum();
    let before: i64 = earlier.iter().map(|r| r.quantity).sum();
    let allowed = id_cap.values().sum::<i64>() + name_cap;
    Some(format!(
        "{label}: {asked} asked, but {noun} allows {allowed} and {before} already went out on it \
         ({} left)",
        (allowed - before).max(0)
    ))
}

#[cfg(test)]
mod tests {
    use super::{Allowance, Released, ScheduledLine, Source, cap_problems};
    use uuid::Uuid;

    const RX: Source = Source {
        noun: "the prescription",
        repeats: 0,
    };

    fn line(id: u128, name: &str, schedule: &str, quantity: i64) -> ScheduledLine {
        ScheduledLine {
            catalog_id: Uuid::from_u128(id),
            name: name.to_owned(),
            schedule: schedule.to_owned(),
            is_controlled: matches!(schedule, "X" | "NDPS"),
            quantity,
        }
    }

    fn item(id: Option<u128>, name: &str, stated: Option<i64>, counted: Option<i64>) -> Allowance {
        Allowance {
            catalog_item_id: id.map(Uuid::from_u128),
            name: name.to_owned(),
            stated,
            counted,
        }
    }

    fn released(id: u128, name: &str, quantity: i64) -> Released {
        Released {
            catalog_id: Uuid::from_u128(id),
            name: name.to_owned(),
            quantity,
        }
    }

    fn passes(lines: &[ScheduledLine], items: &[Allowance], before: &[Released]) -> bool {
        cap_problems(lines, items, before, RX).is_empty()
    }

    #[test]
    fn a_lower_strength_prescription_does_not_release_a_higher_one() {
        let two_mg = [line(2, "Alprax 2 mg", "H", 10)];
        // By the 0.25 mg item's id, by its full name, and by the generic name.
        assert!(!passes(
            &two_mg,
            &[item(Some(1), "Alprax 2 mg", Some(10), None)],
            &[]
        ));
        assert!(!passes(
            &two_mg,
            &[item(None, "Alprax 0.25 mg", Some(10), None)],
            &[]
        ));
        assert!(!passes(
            &two_mg,
            &[item(None, "alprazolam", Some(10), None)],
            &[]
        ));
        assert!(passes(
            &two_mg,
            &[item(None, " ALPRAX 2 MG ", Some(10), None)],
            &[]
        ));
        assert!(passes(
            &two_mg,
            &[item(Some(2), "anything", Some(10), None)],
            &[]
        ));
    }

    #[test]
    fn one_item_is_shared_by_every_catalogue_item_it_matches() {
        // Two catalogue rows with one full name, one item by name for ten.
        let both = [
            line(7, "Alprax 0.25", "H", 10),
            line(9, "Alprax 0.25", "H", 10),
        ];
        let ten = [item(None, "Alprax 0.25", Some(10), None)];
        assert!(!passes(&both, &ten, &[]));
        let halves = [
            line(7, "Alprax 0.25", "H", 5),
            line(9, "Alprax 0.25", "H", 5),
        ];
        assert!(passes(&halves, &ten, &[]));
        // Earlier releases of the other row count against the same item.
        assert!(!passes(
            &[line(9, "Alprax 0.25", "H", 6)],
            &ten,
            &[released(7, "Alprax 0.25", 5)]
        ));
        // An id item serves only its own row; the name item covers the rest.
        let mixed = [
            item(Some(7), "x", Some(4), None),
            item(None, "Alprax 0.25", Some(6), None),
        ];
        assert!(passes(&[line(7, "Alprax 0.25", "H", 10)], &mixed, &[]));
        assert!(!passes(&[line(9, "Alprax 0.25", "H", 7)], &mixed, &[]));
    }

    #[test]
    fn repeats_add_fills_except_for_strict_drugs_which_need_a_stated_quantity() {
        let with_repeat = Source { repeats: 1, ..RX };
        let h = [line(1, "Codeine syrup", "H", 20)];
        let counted = [item(Some(1), "x", None, Some(10))];
        assert!(cap_problems(&h, &counted, &[], with_repeat).is_empty());
        assert!(!cap_problems(&h, &counted, &[], RX).is_empty());
        let x = [line(1, "Morphine 10 mg", "NDPS", 10)];
        let refused = cap_problems(&x, &counted, &[], with_repeat);
        assert!(refused[0].contains("no quantity stated"), "{refused:?}");
        let stated = [item(Some(1), "x", Some(10), None)];
        assert!(cap_problems(&x, &stated, &[], with_repeat).is_empty());
        let twenty = [line(1, "Morphine 10 mg", "NDPS", 20)];
        assert!(!cap_problems(&twenty, &stated, &[], with_repeat).is_empty());
        assert!(!passes(&h, &[], &[]));
        assert!(!passes(&h, &[item(Some(1), "x", None, None)], &[]));
    }
}
