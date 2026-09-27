//! The one evaluator of the registration rules. The server, both native apps
//! and the web (a TypeScript port held to the same fixtures) all ask it.

use std::collections::BTreeMap;

use super::RegistrationProblem;
use super::catalogue::{Check, Cond, Field, Options, Rule};

/// A draft: field id → the value as entered. Toggles are `"true"`/`"false"`;
/// absent and blank are the same.
pub type Draft = BTreeMap<String, String>;

fn value<'a>(draft: &'a Draft, field: &str) -> &'a str {
    draft.get(field).map_or("", |v| v.trim())
}

fn matches(draft: &Draft, c: &Cond) -> bool {
    let v = value(draft, c.field);
    c.is.iter().any(|want| {
        if *want == "*" {
            !v.is_empty()
        } else {
            v == *want
        }
    })
}

fn applies(draft: &Draft, r: &Rule) -> bool {
    (r.when.is_empty() || r.when.iter().any(|c| matches(draft, c)))
        && r.when_all.iter().all(|c| matches(draft, c))
        && !r.unless.iter().any(|c| matches(draft, c))
}

fn digit_count(v: &str) -> usize {
    v.chars().filter(char::is_ascii_digit).count()
}

fn phone_shaped(v: &str) -> bool {
    let body = v.strip_prefix('+').unwrap_or(v);
    body.chars()
        .all(|c| c.is_ascii_digit() || matches!(c, ' ' | '-' | '(' | ')'))
        && (10..=15).contains(&digit_count(v))
}

fn email_shaped(v: &str) -> bool {
    match v.split_once('@') {
        Some((user, domain)) => {
            !user.is_empty()
                && domain.contains('.')
                && !domain.starts_with('.')
                && !domain.ends_with('.')
                && !v.contains(' ')
        }
        None => false,
    }
}

/// Whether `v` passes `check` for `field`. Shape checks pass an empty value;
/// only `Required`, `Checked` and `AnyFilled` decide that one must be there.
fn passes(draft: &Draft, field: &Field, check: &Check, v: &str) -> bool {
    match check {
        Check::Required => !v.is_empty(),
        Check::Checked => v == "true",
        Check::AnyFilled { fields } => fields.iter().any(|f| !value(draft, f).is_empty()),
        _ if v.is_empty() => true,
        Check::OneOfOptions => match field.options {
            Options::Fixed(opts) => opts.iter().any(|o| o.value == v),
            _ => true,
        },
        Check::Digits { min, max } => {
            let n = u32::try_from(digit_count(v)).unwrap_or(u32::MAX);
            v.chars()
                .all(|c| c.is_ascii_digit() || matches!(c, ' ' | '-'))
                && (*min..=*max).contains(&n)
        }
        Check::PhoneShape => phone_shaped(v),
        Check::MaxLen { max } => u32::try_from(v.chars().count()).is_ok_and(|n| n <= *max),
        Check::IntRange { min, max } => v.parse::<i64>().is_ok_and(|n| (*min..=*max).contains(&n)),
        Check::Email => email_shaped(v),
    }
}

/// Every problem with `draft`, in the form's order, at most one per field —
/// the first rule a field fails is the one the desk needs to fix.
#[must_use]
pub fn problems(fields: &[Field], draft: &Draft) -> Vec<RegistrationProblem> {
    fields
        .iter()
        .filter_map(|field| {
            let v = value(draft, field.id);
            field
                .rules
                .iter()
                .find(|r| applies(draft, r) && !passes(draft, field, &r.check, v))
                .map(|r| RegistrationProblem {
                    field: field.id.to_owned(),
                    message: r.message.to_owned(),
                })
        })
        .collect()
}
