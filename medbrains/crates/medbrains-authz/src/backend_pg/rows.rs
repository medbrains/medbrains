//! Row <-> type conversions for `relation_tuples`.

use uuid::Uuid;

use crate::{Subject, TupleSource, TupleStatus};

/// A subject as its (`subject_type`, `subject_id`) columns.
pub(super) fn serialize_subject(s: &Subject) -> (&'static str, String) {
    match s {
        Subject::User(u) => ("user", u.to_string()),
        Subject::Role(r) => ("role", r.clone()),
        Subject::Department(d) => ("department", d.to_string()),
        Subject::Group(g) => ("group", g.to_string()),
        Subject::TupleSet(t) => ("tuple_set", t.clone()),
    }
}

/// The subject named by a row; `None` for a kind this build does not know.
pub(super) fn parse_subject(kind: &str, id: &str) -> Option<Subject> {
    Some(match kind {
        "user" => Subject::User(Uuid::parse_str(id).ok()?),
        "role" => Subject::Role(id.to_string()),
        "department" => Subject::Department(Uuid::parse_str(id).ok()?),
        "group" => Subject::Group(Uuid::parse_str(id).ok()?),
        "tuple_set" => Subject::TupleSet(id.to_string()),
        _ => return None,
    })
}

/// A row's status; anything unknown reads as active, as before.
pub(super) fn parse_status(s: &str) -> TupleStatus {
    match s {
        "revoked" => TupleStatus::Revoked,
        "superseded" => TupleStatus::Superseded,
        _ => TupleStatus::Active,
    }
}

/// A row's source; anything but `derived` is explicit.
pub(super) fn parse_source(s: &str) -> TupleSource {
    match s {
        "derived" => TupleSource::Derived,
        _ => TupleSource::Explicit,
    }
}
