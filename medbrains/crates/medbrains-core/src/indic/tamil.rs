//! Tamil, which does not share the other scripts' layout: one letter for
//! k/kh/g/gh, n written ந at a word's start and ன inside it, and Sanskrit
//! sounds in Grantha letters (ஜ ஷ ஸ ஹ).

const PULLI: char = '\u{0BCD}';

/// One Devanagari word in Tamil letters.
pub(super) fn from_devanagari(word: &str) -> String {
    let chars: Vec<char> = word.chars().collect();
    let mut out = String::new();
    for (i, &c) in chars.iter().enumerate() {
        let next = chars.get(i + 1).copied();
        let mapped: &str = match c {
            'अ' => "அ",
            'आ' => "ஆ",
            'इ' => "இ",
            'ई' => "ஈ",
            'उ' => "உ",
            'ऊ' => "ஊ",
            'ए' => "ஏ",
            'ऐ' => "ஐ",
            'ओ' => "ஓ",
            'औ' => "ஔ",
            'ा' => "ா",
            'ि' => "ி",
            'ी' => "ீ",
            'ु' => "ு",
            'ू' => "ூ",
            'े' => "ே",
            'ै' => "ை",
            'ो' => "ோ",
            'ौ' => "ௌ",
            '्' => "்",
            'क' | 'ख' | 'ग' | 'घ' => "க",
            'ङ' => "ங",
            'च' | 'छ' => "ச",
            'ज' | 'झ' => "ஜ",
            'ञ' => "ஞ",
            'ट' | 'ठ' | 'ड' | 'ढ' => "ட",
            'ण' => "ண",
            'त' | 'थ' | 'द' | 'ध' => "த",
            'न' => {
                if i == 0 {
                    "ந"
                } else {
                    "ன"
                }
            }
            'प' | 'फ' | 'ब' | 'भ' => "ப",
            'म' => "ம",
            'य' => "ய",
            'र' => "ர",
            'ल' => "ல",
            'ळ' => "ள",
            'व' => "வ",
            'श' | 'ष' => "ஷ",
            'स' => "ஸ",
            'ह' => "ஹ",
            'ं' => match next {
                Some('क' | 'ख' | 'ग' | 'घ') => "ங்",
                Some('त' | 'थ' | 'द' | 'ध') => "ந்",
                Some('ट' | 'ठ' | 'ड' | 'ढ') => "ண்",
                Some('प' | 'फ' | 'ब' | 'भ' | 'म') => "ம்",
                _ => "ன்",
            },
            other => {
                out.push(other);
                continue;
            }
        };
        out.push_str(mapped);
    }
    out
}

fn is_consonant(c: char) -> bool {
    ('\u{0B95}'..='\u{0BB9}').contains(&c)
}

const fn vowel_sign(c: char) -> Option<&'static str> {
    Some(match c {
        'ா' => "a",
        'ி' | 'ீ' => "i",
        'ு' | 'ூ' => "u",
        'ெ' | 'ே' => "e",
        'ை' => "ai",
        'ொ' | 'ோ' => "o",
        'ௌ' => "au",
        _ => return None,
    })
}

/// A Tamil consonant in Latin; `between_vowels` voices k/ch/t/p, as Tamil
/// names are spelled ("Murugan", not "Murukan").
#[expect(
    clippy::match_same_arms,
    reason = "one arm per letter: the table it is"
)]
const fn consonant(c: char, between_vowels: bool) -> &'static str {
    match (c, between_vowels) {
        ('க', false) => "k",
        ('க', true) => "g",
        ('ச', false) => "ch",
        ('ச', true) => "s",
        ('ட', false) => "t",
        ('ட', true) => "d",
        ('ப', false) => "p",
        ('ப', true) => "b",
        ('த', _) => "th",
        ('ங', _) => "ng",
        ('ஞ', _) => "nj",
        ('ண' | 'ந' | 'ன', _) => "n",
        ('ம', _) => "m",
        ('ய', _) => "y",
        ('ர' | 'ற', _) => "r",
        ('ல' | 'ள', _) => "l",
        ('வ', _) => "v",
        ('ழ', _) => "zh",
        ('ஜ', _) => "j",
        ('ஷ' | 'ஶ', _) => "sh",
        ('ஸ', _) => "s",
        ('ஹ', _) => "h",
        _ => "",
    }
}

const fn independent(c: char) -> Option<&'static str> {
    Some(match c {
        'அ' | 'ஆ' => "a",
        'இ' | 'ஈ' => "i",
        'உ' | 'ஊ' => "u",
        'எ' | 'ஏ' => "e",
        'ஐ' => "ai",
        'ஒ' | 'ஓ' => "o",
        'ஔ' => "au",
        _ => return None,
    })
}

/// A Tamil name in Latin, the way Tamil names are spelled in English.
pub(super) fn to_latin(text: &str) -> String {
    text.split(' ')
        .map(|word| {
            let chars: Vec<char> = word.chars().collect();
            let mut out = String::new();
            let mut last_vowel = false;
            for (i, &c) in chars.iter().enumerate() {
                if is_consonant(c) {
                    let next = chars.get(i + 1).copied();
                    let voiced = last_vowel && next != Some(PULLI);
                    let doubled =
                        i > 0 && chars.get(i - 1) == Some(&PULLI) && chars.get(i - 2) == Some(&c);
                    out.push_str(consonant(c, voiced && !doubled));
                    if next == Some(PULLI) {
                        last_vowel = false;
                    } else if let Some(sign) = next.and_then(vowel_sign) {
                        out.push_str(sign);
                        last_vowel = true;
                    } else {
                        out.push('a');
                        last_vowel = true;
                    }
                } else if let Some(v) = independent(c) {
                    out.push_str(v);
                    last_vowel = true;
                } else if vowel_sign(c).is_none() && c != PULLI {
                    out.push(c);
                    last_vowel = false;
                }
            }
            let mut cs = out.chars();
            cs.next()
                .map_or_else(String::new, |f| f.to_uppercase().chain(cs).collect())
        })
        .collect::<Vec<_>>()
        .join(" ")
}
