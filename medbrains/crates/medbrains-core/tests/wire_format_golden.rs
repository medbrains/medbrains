//! Wire-format golden for the `chrono` → `time` migration (owner, 2026-11-19).
//!
//! Every way a date or time leaves the server — JSON (serde), `Display`,
//! RFC 3339, the `format(...)` patterns the print and HL7 code uses, the
//! parse patterns the API accepts, and the binary Postgres encoding sqlx
//! sends — is rendered here for fixed instants and compared with
//! `golden/wire_format.txt`.
//!
//! The expected file was written from the `chrono` code. A migration PR
//! rewrites the producers in this file with `time` and must leave the golden
//! file byte-for-byte unchanged; a changed line is a changed wire format, and
//! is a decision to record in DECISIONS.md, not a file to regenerate.

use chrono::{
    DateTime, Duration, FixedOffset, NaiveDate, NaiveDateTime, NaiveTime, SecondsFormat, Utc,
};
use medbrains_core::nhcx_wire::{ist_timestamp, receipt_timestamp};
use sqlx::Encode;
use sqlx::postgres::{PgArgumentBuffer, Postgres};

/// India Standard Time, the zone every printed document in a first-country
/// deployment carries.
const IST_SECONDS: i32 = 5 * 3600 + 30 * 60;

/// Format patterns found in the workspace's `.format(...)` calls.
const FORMATS: &[&str] = &[
    "%d-%b-%Y",
    "%H:%M",
    "%d-%m-%Y",
    "%d-%b-%Y %H:%M",
    "%Y%m%d%H%M%S",
    "%Y%m%d",
    "%Y-%m-%d",
    "%d-%m-%Y %H:%M",
    "%d %b %Y",
    "%Y%m%d%H%M",
    "%d %b",
    "%d %b %Y %H:%M UTC",
    "%Y-%m-%d %H:%M UTC",
    "%d/%m/%Y",
    "%Y%m%d%H%M%S+0000",
    "%Y-%m",
    "%H",
    "%Y%m%d%H%M%S%z",
    "%Y",
    "%Y-%m-01",
    "%Y-%m-%d %H:%M",
    "%w",
    "%H%M%S",
    "%d/%m/%Y %H:%M:%S:%3f",
    "%d %b %H:%M",
    "%b %Y",
    "%-d %b %Y",
];

/// The instants every rendering is taken for: a whole second, a value with
/// nanoseconds, the evening that is already next year in IST, a leap day,
/// and a pre-2000 instant (negative Postgres microseconds).
fn instants() -> Vec<(&'static str, Option<DateTime<Utc>>)> {
    vec![
        ("whole", DateTime::from_timestamp(1_795_152_600, 0)),
        (
            "nanos",
            DateTime::from_timestamp(1_795_152_600, 123_456_789),
        ),
        ("ist_new_year", DateTime::from_timestamp(1_798_747_200, 0)),
        ("leap_day", DateTime::from_timestamp(1_835_395_200, 0)),
        (
            "pre_2000",
            DateTime::from_timestamp(915_148_799, 999_999_999),
        ),
    ]
}

/// The instant in IST as a fixed offset, as the print and NHCX code does.
fn in_ist(at: DateTime<Utc>) -> Option<DateTime<FixedOffset>> {
    FixedOffset::east_opt(IST_SECONDS).map(|ist| at.with_timezone(&ist))
}

/// A JSON rendering, or `ERR` when serialisation fails.
fn json<T: serde::Serialize>(value: &T) -> String {
    serde_json::to_string(value).unwrap_or_else(|e| format!("ERR {e}"))
}

/// The bytes sqlx sends Postgres for a value, as hex, or `ERR`.
fn pg<T: for<'q> Encode<'q, Postgres>>(value: &T) -> String {
    let mut buf = PgArgumentBuffer::default();
    match value.encode_by_ref(&mut buf) {
        Ok(_) => hex::encode(&buf[..]),
        Err(e) => format!("ERR {e}"),
    }
}

/// What a JSON string deserialises to (re-serialised), or `ERR`.
fn accepts<T: serde::de::DeserializeOwned + serde::Serialize>(input: &str) -> String {
    serde_json::from_str::<T>(&json(&input)).map_or_else(|_| "ERR".to_owned(), |v| json(&v))
}

/// Every rendering of one instant, one `label = value` line each.
fn render_instant(name: &str, at: DateTime<Utc>, out: &mut Vec<String>) {
    let date = at.date_naive();
    let naive = at.naive_utc();
    let time = naive.time();
    out.push(format!("{name}.utc.json = {}", json(&at)));
    out.push(format!("{name}.utc.display = {at}"));
    out.push(format!("{name}.utc.rfc3339 = {}", at.to_rfc3339()));
    out.push(format!(
        "{name}.utc.rfc3339_millis_z = {}",
        at.to_rfc3339_opts(SecondsFormat::Millis, true)
    ));
    out.push(format!(
        "{name}.utc.rfc3339_secs = {}",
        at.to_rfc3339_opts(SecondsFormat::Secs, false)
    ));
    out.push(format!("{name}.utc.timestamp = {}", at.timestamp()));
    out.push(format!(
        "{name}.utc.timestamp_millis = {}",
        at.timestamp_millis()
    ));
    out.push(format!("{name}.utc.pg = {}", pg(&at)));
    out.push(format!("{name}.date.json = {}", json(&date)));
    out.push(format!("{name}.date.display = {date}"));
    out.push(format!("{name}.date.pg = {}", pg(&date)));
    out.push(format!("{name}.naive.json = {}", json(&naive)));
    out.push(format!("{name}.naive.display = {naive}"));
    out.push(format!("{name}.naive.pg = {}", pg(&naive)));
    out.push(format!("{name}.time.json = {}", json(&time)));
    out.push(format!("{name}.time.display = {time}"));
    out.push(format!("{name}.time.pg = {}", pg(&time)));
    out.push(format!("{name}.nhcx.ist_timestamp = {}", ist_timestamp(at)));
    out.push(format!(
        "{name}.nhcx.receipt_timestamp = {}",
        receipt_timestamp(at)
    ));
    if let Some(ist) = in_ist(at) {
        out.push(format!("{name}.ist.json = {}", json(&ist)));
        out.push(format!("{name}.ist.rfc3339 = {}", ist.to_rfc3339()));
        out.push(format!("{name}.ist.date = {}", ist.date_naive()));
        out.push(format!("{name}.ist.pg = {}", pg(&ist)));
        for pattern in FORMATS {
            out.push(format!(
                "{name}.ist.format[{pattern}] = {}",
                ist.format(pattern)
            ));
        }
    }
    for pattern in FORMATS {
        out.push(format!(
            "{name}.utc.format[{pattern}] = {}",
            at.format(pattern)
        ));
    }
}

/// The inputs the API's deserialisers and `parse_from_str` calls accept,
/// including the near-misses a stricter parser would refuse.
fn render_parsing(out: &mut Vec<String>) {
    let instants = [
        "2026-11-20T05:30:00Z",
        "2026-11-20T05:30:00.123Z",
        "2026-11-20T05:30:00.123456789Z",
        "2026-11-20T11:00:00+05:30",
        "2026-11-20T05:30:00+00:00",
        "2026-11-20 05:30:00Z",
        "2026-11-20t05:30:00z",
        "2026-11-20T05:30Z",
        "2026-11-20T05:30:00",
        "2026-11-20",
    ];
    for input in instants {
        out.push(format!(
            "parse.utc.json[{input}] = {}",
            accepts::<DateTime<Utc>>(input)
        ));
        out.push(format!(
            "parse.rfc3339[{input}] = {}",
            DateTime::parse_from_rfc3339(input)
                .map_or_else(|_| "ERR".to_owned(), |v| v.to_rfc3339())
        ));
    }
    for input in [
        "2026-11-20",
        "2026-1-5",
        "2026-02-30",
        "20261120",
        "2026-11-20T00:00:00Z",
    ] {
        out.push(format!(
            "parse.date.json[{input}] = {}",
            accepts::<NaiveDate>(input)
        ));
    }
    for input in ["09:30", "09:30:00", "09:30:00.5", "9:30"] {
        out.push(format!(
            "parse.time.json[{input}] = {}",
            accepts::<NaiveTime>(input)
        ));
    }
    for input in [
        "2026-11-20T09:30:00",
        "2026-11-20T09:30:00.25",
        "2026-11-20 09:30:00",
    ] {
        out.push(format!(
            "parse.naive.json[{input}] = {}",
            accepts::<NaiveDateTime>(input)
        ));
    }
    let date_patterns = [
        ("%Y-%m-%d", "2026-11-20"),
        ("%Y-%m-%d", "2026-1-5"),
        ("%Y%m%d", "20261120"),
    ];
    for (pattern, input) in date_patterns {
        out.push(format!(
            "parse.date.str[{pattern}|{input}] = {}",
            NaiveDate::parse_from_str(input, pattern)
                .map_or_else(|_| "ERR".to_owned(), |d| d.to_string())
        ));
    }
    let naive_patterns = [
        ("%Y-%m-%dT%H:%M:%S%.f", "2026-11-20T09:30:00"),
        ("%Y-%m-%dT%H:%M:%S%.f", "2026-11-20T09:30:00.125"),
        ("%Y-%m-%d %H:%M:%S%.f", "2026-11-20 09:30:00.5"),
        ("%Y%m%d%H%M%S", "20261120093000"),
    ];
    for (pattern, input) in naive_patterns {
        out.push(format!(
            "parse.naive.str[{pattern}|{input}] = {}",
            NaiveDateTime::parse_from_str(input, pattern)
                .map_or_else(|_| "ERR".to_owned(), |d| d.to_string())
        ));
    }
    for (pattern, input) in [
        ("%H:%M", "09:30"),
        ("%H:%M", "9:30"),
        ("%H:%M:%S", "09:30:15"),
    ] {
        out.push(format!(
            "parse.time.str[{pattern}|{input}] = {}",
            NaiveTime::parse_from_str(input, pattern)
                .map_or_else(|_| "ERR".to_owned(), |t| t.to_string())
        ));
    }
}

/// Durations: the serde form and the whole-unit reads the code relies on.
fn render_durations(out: &mut Vec<String>) {
    let spans = [
        ("90m", Duration::minutes(90)),
        ("7d", Duration::days(7)),
        ("neg_1500ms", Duration::milliseconds(-1500)),
    ];
    for (name, span) in spans {
        out.push(format!("duration.{name}.json = {}", json(&span)));
        out.push(format!("duration.{name}.seconds = {}", span.num_seconds()));
        out.push(format!("duration.{name}.minutes = {}", span.num_minutes()));
        out.push(format!(
            "duration.{name}.millis = {}",
            span.num_milliseconds()
        ));
    }
}

/// Every rendering, in a fixed order, one line each.
fn render() -> String {
    let mut out = Vec::new();
    for (name, at) in instants() {
        match at {
            Some(at) => render_instant(name, at, &mut out),
            None => out.push(format!("{name} = OUT OF RANGE")),
        }
    }
    out.push(format!("none.json = {}", json(&None::<DateTime<Utc>>)));
    render_parsing(&mut out);
    render_durations(&mut out);
    out.join("\n") + "\n"
}

#[test]
fn wire_formats_match_the_golden_file() {
    assert_eq!(render(), include_str!("golden/wire_format.txt"));
}
