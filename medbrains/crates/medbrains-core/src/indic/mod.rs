//! Names between English spelling and Indian scripts, on-box and rule-based.
//!
//! A front desk types "Ramesh Kumar" and is offered "रमेश कुमार" or
//! "ரமேஷ் குமார்"; types "முருகன்" and is offered "Murugan". No model, no
//! dataset, no network: Latin is parsed into Devanagari syllables by a small
//! phonetic table, Devanagari is carried to the other Brahmic scripts by
//! their shared Unicode layout (Tamil by its own table), and any script is
//! read back to Latin the way Indian names are usually spelled. Spelling a
//! name is a guess — "Sunita" may be सुनिता or सुनीता — so the Latin side
//! offers a few candidates and the desk picks or edits one.

mod tamil;

/// The scripts a name can be offered in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Script {
    /// Hindi, Marathi, Nepali, Sanskrit.
    Devanagari,
    Bengali,
    Gurmukhi,
    Gujarati,
    Odia,
    Tamil,
    Telugu,
    Kannada,
    Malayalam,
}

impl Script {
    /// The start of the script's Unicode block.
    const fn base(self) -> u32 {
        match self {
            Self::Devanagari => 0x0900,
            Self::Bengali => 0x0980,
            Self::Gurmukhi => 0x0A00,
            Self::Gujarati => 0x0A80,
            Self::Odia => 0x0B00,
            Self::Tamil => 0x0B80,
            Self::Telugu => 0x0C00,
            Self::Kannada => 0x0C80,
            Self::Malayalam => 0x0D00,
        }
    }

    /// Scripts that write a final consonant with an explicit virama.
    const fn marks_final_virama(self) -> bool {
        matches!(
            self,
            Self::Tamil | Self::Telugu | Self::Kannada | Self::Malayalam
        )
    }

    const ALL: [Self; 9] = [
        Self::Devanagari,
        Self::Bengali,
        Self::Gurmukhi,
        Self::Gujarati,
        Self::Odia,
        Self::Tamil,
        Self::Telugu,
        Self::Kannada,
        Self::Malayalam,
    ];
}

/// The Indian script `text` is mostly written in, if any.
#[must_use]
pub fn script_of(text: &str) -> Option<Script> {
    let mut counts = [0usize; 9];
    for c in text.chars() {
        let cp = u32::from(c);
        if let Some(i) = Script::ALL
            .iter()
            .position(|s| (s.base()..s.base() + 0x80).contains(&cp))
        {
            counts[i] += 1;
        }
    }
    let (i, n) = counts.iter().enumerate().max_by_key(|(_, n)| **n)?;
    (*n > 0).then(|| Script::ALL[i])
}

const VIRAMA: char = '\u{094D}';
const ANUSVARA: char = '\u{0902}';

/// Consonants, longest spelling first.
const CONSONANTS: &[(&str, char)] = &[
    ("ksh", 'क'),
    ("chh", 'छ'),
    ("kh", 'ख'),
    ("gh", 'घ'),
    ("ch", 'च'),
    ("jh", 'झ'),
    ("th", 'थ'),
    ("dh", 'ध'),
    ("ph", 'फ'),
    ("bh", 'भ'),
    ("sh", 'श'),
    ("gy", 'ज'),
    ("k", 'क'),
    ("g", 'ग'),
    ("c", 'क'),
    ("j", 'ज'),
    ("t", 'त'),
    ("d", 'द'),
    ("n", 'न'),
    ("p", 'प'),
    ("f", 'फ'),
    ("b", 'ब'),
    ("m", 'म'),
    ("y", 'य'),
    ("r", 'र'),
    ("l", 'ल'),
    ("v", 'व'),
    ("w", 'व'),
    ("s", 'स'),
    ("h", 'ह'),
    ("z", 'ज'),
    ("q", 'क'),
    ("x", 'क'),
];

/// Clusters a single Latin spelling stands for.
fn cluster(spelling: &str) -> &'static [char] {
    match spelling {
        "ksh" => &['क', VIRAMA, 'ष'],
        "gy" => &['ज', VIRAMA, 'ञ'],
        "x" => &['क', VIRAMA, 'स'],
        _ => &[],
    }
}

/// Vowels, longest first: (spelling, independent, sign after a consonant).
/// `None` as the sign is the inherent a.
const VOWELS: &[(&str, char, Option<char>)] = &[
    ("aa", 'आ', Some('ा')),
    ("ee", 'ई', Some('ी')),
    ("ii", 'ई', Some('ी')),
    ("oo", 'ऊ', Some('ू')),
    ("uu", 'ऊ', Some('ू')),
    ("ai", 'ऐ', Some('ै')),
    ("au", 'औ', Some('ौ')),
    ("ou", 'औ', Some('ौ')),
    ("a", 'अ', None),
    ("i", 'इ', Some('ि')),
    ("u", 'उ', Some('ु')),
    ("e", 'ए', Some('े')),
    ("o", 'ओ', Some('ो')),
];

fn longest<'a, T: Copy>(rest: &str, table: &'a [(&'a str, T)]) -> Option<(&'a str, T)> {
    table.iter().find(|(s, _)| rest.starts_with(s)).copied()
}

/// How the Latin side is read where English spelling is ambiguous.
#[derive(Clone, Copy)]
struct Reading {
    /// A word-final "a" after a consonant is long ("Priya" → प्रिया).
    final_a_long: bool,
    /// A short "i" is read long (Sunita → सुनीता, Lakshmi → लक्ष्मी).
    long_i: bool,
    /// An "a" before the word's last consonant is long (Kumar → कुमार).
    closing_a_long: bool,
}

/// One Latin word in Devanagari.
fn word_to_devanagari(word: &str, how: Reading) -> String {
    let lower = word.to_lowercase();
    let mut out = String::new();
    let mut rest = lower.as_str();
    let mut pending: Vec<char> = Vec::new(); // a consonant cluster awaiting its vowel
    let mut after_vowel = false;
    while !rest.is_empty() {
        if let Some((spelling, c)) = longest(rest, CONSONANTS) {
            let next = &rest[spelling.len()..];
            let nasal = (spelling == "n" || spelling == "m")
                && after_vowel
                && pending.is_empty()
                && longest(next, CONSONANTS).is_some_and(|(s, _)| {
                    !matches!(s, "y" | "r" | "l" | "v" | "w" | "h" | "n" | "m")
                });
            if nasal {
                out.push(ANUSVARA);
            } else {
                if !pending.is_empty() {
                    pending.push(VIRAMA);
                }
                match cluster(spelling) {
                    [] => pending.push(c),
                    many => pending.extend_from_slice(many),
                }
            }
            after_vowel = false;
            rest = next;
        } else if let Some((spelling, (independent, sign))) = VOWELS
            .iter()
            .find(|(s, _, _)| rest.starts_with(s))
            .map(|(s, i, m)| (*s, (*i, *m)))
        {
            let next = &rest[spelling.len()..];
            let at_end = next.is_empty();
            let closing = longest(next, CONSONANTS).is_some_and(|(c, _)| next.len() == c.len());
            let sign = match (spelling, sign) {
                ("a", None) if at_end && how.final_a_long && !pending.is_empty() => Some('ा'),
                ("a", None) if closing && how.closing_a_long && !pending.is_empty() => Some('ा'),
                ("i", Some(_)) if how.long_i => Some('ी'),
                _ => sign,
            };
            if pending.is_empty() {
                let independent = match spelling {
                    "i" if how.long_i => 'ई',
                    _ => independent,
                };
                out.push(independent);
            } else {
                out.extend(pending.drain(..));
                if let Some(sign) = sign {
                    out.push(sign);
                }
            }
            after_vowel = true;
            rest = next;
        } else {
            let c = rest.chars().next().unwrap_or(' ');
            out.extend(pending.drain(..));
            out.push(c);
            after_vowel = false;
            rest = &rest[c.len_utf8()..];
        }
    }
    out.extend(pending.drain(..));
    out
}

/// Devanagari text in `script`, carrying the shared Brahmic layout across;
/// Tamil by its own table.
fn from_devanagari(text: &str, script: Script) -> String {
    let mut out = String::new();
    for word in text.split(' ') {
        if !out.is_empty() {
            out.push(' ');
        }
        let mut w: String = if script == Script::Tamil {
            tamil::from_devanagari(word)
        } else {
            word.chars()
                .map(|c| {
                    let cp = u32::from(c);
                    if (0x0900..0x0980).contains(&cp) {
                        char::from_u32(cp - 0x0900 + script.base()).unwrap_or(c)
                    } else {
                        c
                    }
                })
                .collect()
        };
        if script.marks_final_virama() && w.chars().last().is_some_and(|c| is_consonant(c, script))
        {
            w.push(char::from_u32(script.base() + 0x4D).unwrap_or(VIRAMA));
        }
        out.push_str(&w);
    }
    out
}

/// A consonant of `script` (ka through ha in the shared layout).
fn is_consonant(c: char, script: Script) -> bool {
    let offset = u32::from(c).wrapping_sub(script.base());
    (0x15..=0x39).contains(&offset)
}

/// A Latin name in `script`: a few spellings, most likely first, no repeats.
#[must_use]
pub fn from_latin(text: &str, script: Script) -> Vec<String> {
    let reading = |final_a_long, long_i, closing_a_long| Reading {
        final_a_long,
        long_i,
        closing_a_long,
    };
    let readings = [
        reading(true, false, false),
        reading(false, false, false),
        reading(true, true, false),
        reading(true, false, true),
    ];
    let mut out: Vec<String> = Vec::new();
    for how in readings {
        let deva: Vec<String> = text
            .split_whitespace()
            .map(|w| word_to_devanagari(w, how))
            .collect();
        let candidate = from_devanagari(&deva.join(" "), script);
        if !candidate.trim().is_empty() && !out.contains(&candidate) {
            out.push(candidate);
        }
    }
    out
}

/// Latin romanization of one Devanagari consonant.
fn latin_consonant(c: char) -> Option<&'static str> {
    Some(match c {
        'क' => "k",
        'ख' => "kh",
        'ग' => "g",
        'घ' => "gh",
        'ङ' => "n",
        'च' => "ch",
        'छ' => "chh",
        'ज' => "j",
        'झ' => "jh",
        'ञ' => "n",
        'ट' => "t",
        'ठ' => "th",
        'ड' => "d",
        'ढ' => "dh",
        'ण' => "n",
        'त' => "t",
        'थ' => "th",
        'द' => "d",
        'ध' => "dh",
        'न' => "n",
        'प' => "p",
        'फ' => "ph",
        'ब' => "b",
        'भ' => "bh",
        'म' => "m",
        'य' => "y",
        'र' => "r",
        'ल' => "l",
        'ळ' => "l",
        'व' => "v",
        'श' | 'ष' => "sh",
        'स' => "s",
        'ह' => "h",
        _ => return None,
    })
}

fn latin_vowel(c: char) -> Option<&'static str> {
    Some(match c {
        'अ' => "a",
        'आ' | 'ा' => "a",
        'इ' | 'ि' | 'ई' | 'ी' => "i",
        'उ' | 'ु' | 'ऊ' | 'ू' => "u",
        'ऋ' | 'ृ' => "ri",
        'ए' | 'े' => "e",
        'ऐ' | 'ै' => "ai",
        'ओ' | 'ो' => "o",
        'औ' | 'ौ' => "au",
        _ => return None,
    })
}

/// One Devanagari word in Latin, the inherent a dropped at the word's end.
fn word_to_latin(word: &str) -> String {
    let chars: Vec<char> = word.chars().collect();
    let mut out = String::new();
    for (i, &c) in chars.iter().enumerate() {
        if let Some(cons) = latin_consonant(c) {
            out.push_str(cons);
            let next = chars.get(i + 1).copied();
            let silent = next == Some(VIRAMA)
                || next.is_some_and(|n| latin_vowel(n).is_some() && !matches!(n, 'अ'..='औ'));
            let last = i + 1 == chars.len();
            if !silent && !last {
                out.push('a');
            }
        } else if let Some(v) = latin_vowel(c) {
            out.push_str(v);
        } else if c == ANUSVARA {
            let before_labial = chars
                .get(i + 1)
                .is_some_and(|n| matches!(n, 'प' | 'फ' | 'ब' | 'भ' | 'म'));
            out.push(if before_labial { 'm' } else { 'n' });
        } else if c != VIRAMA && c != '\u{093C}' {
            out.push(c);
        }
    }
    let mut cs = out.chars();
    cs.next()
        .map_or_else(String::new, |f| f.to_uppercase().chain(cs).collect())
}

/// A name in any Indian script, spelled the way Indian names usually are in
/// English. Text in no Indian script is returned as it is.
#[must_use]
pub fn to_latin(text: &str) -> String {
    let Some(script) = script_of(text) else {
        return text.to_owned();
    };
    if script == Script::Tamil {
        return tamil::to_latin(text);
    }
    let deva: String = text
        .chars()
        .map(|c| {
            let cp = u32::from(c);
            if (script.base()..script.base() + 0x80).contains(&cp) {
                char::from_u32(cp - script.base() + 0x0900).unwrap_or(c)
            } else {
                c
            }
        })
        .collect();
    deva.split(' ')
        .map(word_to_latin)
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests;
