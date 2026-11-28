//! Writes the web's copy of the adult NEWS2 bands from [`news2_table`], so the
//! vitals screens grade a reading by the same table the server scores with.
//!
//! The web shows each reading as normal (scores 0), amber (1–2) or red (3).
//! Every NEWS2 parameter rises monotonically away from its 0 band, so two
//! inclusive ranges describe it exactly: `normal` (score 0) and `borderline`
//! (score 0–2); outside `borderline` it scores 3. The bands are read off the
//! scoring functions by probing every value, never typed out a second time.
//!
//! `news2_bands_ts_is_current` fails when the committed file differs; rewrite
//! it with `NEWS2_BANDS_WRITE=1 cargo test -p medbrains-clinical-scores news2_bands`.

use super::news2_table;

/// Where the generated file lives, from this crate's directory.
const TS_PATH: &str = "../../packages/schemas/src/news2-bands.generated.ts";

/// One parameter: its name on the web, the values probed, how a value prints.
struct Param {
    name: &'static str,
    probe: std::ops::RangeInclusive<i32>,
    score: fn(i32) -> i32,
    tenths: bool,
}

/// Adult NEWS2 parameters the vitals screens grade. `SpO₂` is Scale 1: Scale 2
/// needs a clinician's prescription and the air-or-oxygen flag, neither of
/// which the vitals form carries.
const PARAMS: [Param; 5] = [
    Param {
        name: "respiratory_rate",
        probe: 0..=100,
        score: news2_table::respiration,
        tenths: false,
    },
    Param {
        name: "spo2",
        probe: 0..=100,
        score: news2_table::spo2_scale1,
        tenths: false,
    },
    Param {
        name: "systolic_bp",
        probe: 0..=400,
        score: news2_table::systolic,
        tenths: false,
    },
    Param {
        name: "pulse",
        probe: 0..=400,
        score: news2_table::pulse,
        tenths: false,
    },
    Param {
        name: "temperature",
        probe: 200..=500,
        score: news2_table::temperature,
        tenths: true,
    },
];

/// The one contiguous run of probed values whose score passes `keep`; panics
/// if there are two, because two ranges could not describe the parameter.
fn run(p: &Param, keep: impl Fn(i32) -> bool) -> (i32, i32) {
    let hits: Vec<i32> = p.probe.clone().filter(|&v| keep((p.score)(v))).collect();
    let (lo, hi) = (hits[0], hits[hits.len() - 1]);
    assert_eq!(
        hits.len(),
        usize::try_from(hi - lo + 1).unwrap(),
        "{} is not one run",
        p.name
    );
    (lo, hi)
}

/// A bound as TypeScript: open-ended at the probe's edge, else the value.
fn bound(p: &Param, v: i32) -> String {
    if v == *p.probe.start() {
        "Number.NEGATIVE_INFINITY".into()
    } else if v == *p.probe.end() {
        "Number.POSITIVE_INFINITY".into()
    } else if p.tenths {
        format!("{}.{}", v / 10, v % 10)
    } else {
        v.to_string()
    }
}

/// One parameter's entry in the generated object.
fn entry(p: &Param) -> String {
    let pair = |(lo, hi)| format!("[{}, {}]", bound(p, lo), bound(p, hi));
    format!(
        "  {}: {{\n    normal: {},\n    borderline: {},\n  }},\n",
        p.name,
        pair(run(p, |s| s == 0)),
        pair(run(p, |s| s <= 2))
    )
}

/// The whole generated file.
fn render() -> String {
    let head = concat!(
        "// GENERATED from crates/medbrains-clinical-scores/src/ews/news2_table.rs by\n",
        "// news2_bands_ts.rs. Do not edit by hand: change the Rust, then run\n",
        "// `NEWS2_BANDS_WRITE=1 cargo test -p medbrains-clinical-scores news2_bands`.\n",
        "//\n",
        "// Adult NEWS2 (Royal College of Physicians, 2017, Chart 1), SpO2 Scale 1.\n",
        "// Inclusive ranges: `normal` scores 0, `borderline` scores 0-2, outside it\n",
        "// scores 3. Temperature in degrees Celsius, to one decimal.\n\n",
        "export const NEWS2_BANDS = {\n",
    );
    let body: Vec<String> = PARAMS.iter().map(entry).collect();
    format!("{head}{}}} as const;\n", body.concat())
}

#[test]
fn news2_bands_ts_is_current() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(TS_PATH);
    let want = render();
    if std::env::var_os("NEWS2_BANDS_WRITE").is_some() {
        std::fs::write(&path, &want).unwrap();
    }
    let have = std::fs::read_to_string(&path).unwrap_or_default();
    assert!(have == want, "{TS_PATH} is stale; regenerate it:\n{want}");
}
