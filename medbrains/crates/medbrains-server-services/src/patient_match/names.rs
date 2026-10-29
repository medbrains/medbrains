//! Comparing two names the way a registration desk in India meets them:
//! the same person written "Lakshmi" and "Laxmi", "Mohammed" and
//! "Muhammad", "Vijay Kumar" and "Kumar Vijay", "K. Ravindran" and "Kumar
//! Ravindran", "Murugan" and "Murugan S".
//!
//! Names arrive romanised by whoever typed them, so one Indic name has many
//! Latin spellings. Two keys absorb that: a transliteration key that folds
//! the spelling choices romanisation leaves open (aspirates, long vowels,
//! `ksh`/`x`, `v`/`w`/`b`, `y`/`i`, doubled letters, a final `a` or `h`),
//! and a consonant skeleton that also lets the vowels differ. Honorifics
//! ("Mr", "Smt", "Dr", "B/O") are dropped first; token order never counts.

use strsim::jaro_winkler;

/// How well two names agree, strongest first.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NameAgreement {
    /// The same words, in any order.
    Exact,
    /// The same name spelt another way (same transliteration keys).
    Variant,
    /// Close: the same consonants, a typo, initials for a word, or one name
    /// missing a word the other has.
    Partial,
    Different,
}

/// Words that are titles or relationships, not names.
const HONORIFICS: &[&str] = &[
    "mr", "mrs", "ms", "miss", "dr", "smt", "shri", "sri", "shree", "sree", "kumari", "km",
    "master", "mast", "baby", "late", "prof", "md", "sk",
];

/// Lower-case words of letters only, honorifics and "B/O" (baby of) dropped.
pub fn words(name: &str) -> Vec<String> {
    name.to_lowercase()
        .replace("b/o", " ")
        .split(|c: char| !c.is_ascii_alphabetic())
        .filter(|w| !w.is_empty() && !HONORIFICS.contains(w))
        .map(str::to_owned)
        .collect()
}

/// The spelling choices romanisation leaves open, folded to one form.
const FOLDS: &[(&str, &str)] = &[
    ("ksh", "ks"),
    ("x", "ks"),
    ("aa", "a"),
    ("ee", "i"),
    ("ii", "i"),
    ("oo", "u"),
    ("ou", "u"),
    ("uu", "u"),
    ("ph", "f"),
    ("bh", "b"),
    ("dh", "d"),
    ("th", "t"),
    ("kh", "k"),
    ("gh", "g"),
    ("jh", "j"),
    ("ch", "c"),
    ("sh", "s"),
    ("ck", "k"),
    ("q", "k"),
    ("z", "j"),
    ("w", "v"),
    ("v", "b"),
    ("y", "i"),
];

/// A word's transliteration key: "Lakshmi" and "Laxmi" both give `laksmi`,
/// "Vijay" and "Vijai" both `bijai`.
pub fn translit_key(word: &str) -> String {
    let mut k = word.to_lowercase();
    for (from, to) in FOLDS {
        k = k.replace(from, to);
    }
    let mut out = String::with_capacity(k.len());
    for c in k.chars() {
        if !out.ends_with(c) {
            out.push(c);
        }
    }
    while out.len() > 2 && (out.ends_with('a') || out.ends_with('h')) {
        out.pop();
    }
    out
}

/// The transliteration key with every vowel after the first letter dropped:
/// "Mohammed" and "Muhammad" both give `mhmd`.
pub fn skeleton(word: &str) -> String {
    let key = translit_key(word);
    let mut chars = key.chars();
    let first = chars.next().map(String::from).unwrap_or_default();
    first + &chars.filter(|c| !"aeiou".contains(*c)).collect::<String>()
}

fn sorted(mut v: Vec<String>) -> Vec<String> {
    v.sort();
    v
}

/// Whether every word of `short` is a word of `long` (by `key`), or the
/// initial of one — "K Ravindran" in "Kumar Ravindran", "Murugan" in
/// "Murugan S". At least one full word must match, so "K" alone never does.
fn covered(short: &[String], long: &[String], key: fn(&str) -> String) -> bool {
    let mut left: Vec<String> = long.iter().map(|w| key(w)).collect();
    let mut full = 0;
    for w in short {
        let k = key(w);
        if let Some(i) = left.iter().position(|l| *l == k) {
            left.swap_remove(i);
            full += 1;
        } else if w.len() == 1 {
            let Some(i) = long
                .iter()
                .position(|l| l.starts_with(w.as_str()) && left.contains(&key(l)))
            else {
                return false;
            };
            let k = key(&long[i]);
            if let Some(j) = left.iter().position(|l| *l == k) {
                left.swap_remove(j);
            }
        } else {
            return false;
        }
    }
    full > 0
}

/// How the name typed at the desk agrees with a registered one.
#[must_use]
pub fn compare(typed: &str, registered: &str) -> NameAgreement {
    let (a, b) = (words(typed), words(registered));
    if a.is_empty() || b.is_empty() {
        return NameAgreement::Different;
    }
    if sorted(a.clone()) == sorted(b.clone()) {
        return NameAgreement::Exact;
    }
    let keys = |ws: &[String]| sorted(ws.iter().map(|w| translit_key(w)).collect());
    if keys(&a) == keys(&b) {
        return NameAgreement::Variant;
    }
    let skeletons = |ws: &[String]| sorted(ws.iter().map(|w| skeleton(w)).collect());
    let (short, long) = if a.len() <= b.len() {
        (&a, &b)
    } else {
        (&b, &a)
    };
    if skeletons(&a) == skeletons(&b)
        || typo_aligned(&keys(&a), &keys(&b))
        || covered(short, long, translit_key)
    {
        return NameAgreement::Partial;
    }
    NameAgreement::Different
}

/// Jaro-Winkler similarity of two folded words at or above which they
/// differ by a typo, not a person.
const TYPO_SIMILARITY: f64 = 0.92;

/// The same number of words, each word either the same key or a typo of
/// the word it pairs with. Per word, so a shared surname never carries two
/// different first names ("Ram Prasad" / "Shyam Prasad") over the line.
fn typo_aligned(a: &[String], b: &[String]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut left: Vec<&String> = b.iter().collect();
    for w in a {
        let best = left
            .iter()
            .enumerate()
            .map(|(i, l)| (i, jaro_winkler(w, l)))
            .max_by(|x, y| x.1.total_cmp(&y.1));
        match best {
            Some((i, sim)) if sim >= TYPO_SIMILARITY => {
                left.swap_remove(i);
            }
            _ => return false,
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::{NameAgreement::*, compare, skeleton, translit_key};

    #[test]
    fn indian_spelling_variants_are_the_same_name() {
        for (a, b) in [
            ("Lakshmi", "Laxmi"),
            ("Vijay Kumar", "Vijai Kumar"),
            ("Sreedevi", "Shridevi"),
            ("Bhaskar Rao", "Baskar Rao"),
            ("Vishwanathan", "Viswanathan"),
            ("Ramesh", "Rameshh"),
            ("Krishna", "Krishn"),
            ("Pooja", "Puja"),
            ("Ghanshyam", "Ganshyam"),
            ("Biswas", "Viswas"),
        ] {
            assert_eq!(compare(a, b), Variant, "{a} / {b}");
        }
    }

    #[test]
    fn vowel_differences_and_typos_are_close_not_the_same() {
        assert_eq!(skeleton("Mohammed"), skeleton("Muhammad"));
        assert_eq!(compare("Mohammed Rafi", "Muhammad Rafi"), Partial);
        assert_eq!(compare("Saravanan", "Saravanen"), Partial);
    }

    #[test]
    fn order_titles_initials_and_a_missing_word_are_handled() {
        assert_eq!(compare("Kumar Vijay", "Vijay Kumar"), Exact);
        assert_eq!(compare("Smt. Lakshmi Devi", "Lakshmi Devi"), Exact);
        assert_eq!(compare("B/O Priya", "Priya"), Exact);
        assert_eq!(compare("K. Ravindran", "Kumar Ravindran"), Partial);
        assert_eq!(compare("Murugan", "Murugan S"), Partial);
    }

    #[test]
    fn different_people_stay_different() {
        assert_eq!(compare("Ravi Kumar", "Ravindra Singh"), Different);
        assert_eq!(compare("Anil Sharma", "Sunil Sharma"), Different);
        assert_eq!(compare("Priya", "Riya"), Different);
        assert_eq!(compare("Ram Prasad", "Shyam Prasad"), Different, "twins");
        assert_eq!(
            compare("K", "Kumar"),
            Different,
            "an initial alone is no match"
        );
        assert_eq!(compare("", "Kumar"), Different);
    }

    #[test]
    fn the_keys_fold_what_romanisation_leaves_open() {
        assert_eq!(translit_key("Lakshmi"), translit_key("Laxmi"));
        assert_eq!(translit_key("Sanjay"), translit_key("Sanjai"));
        assert_ne!(translit_key("Anil"), translit_key("Sunil"));
    }
}
