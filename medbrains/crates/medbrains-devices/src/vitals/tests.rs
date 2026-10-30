//! Golden monitor messages, parsed by the bridge's own HL7 parser.

use chrono::{TimeZone, Utc};
use medbrains_adapter_sdk::hl7;

use super::{Obs, Sample, observed_at, sample};

/// What the bridge forwards: every OBX of the message.
fn obs(raw: &str) -> Vec<Obs> {
    let msg = hl7::parse(raw).unwrap();
    let group = hl7::oru::observation_groups(&msg)
        .into_iter()
        .next()
        .unwrap();
    serde_json::from_value(serde_json::to_value(group.results).unwrap()).unwrap()
}

/// Philips IntelliVue via the Information Center: MDC codes, OBX-11 `R`.
const PHILIPS: &str = "MSH|^~\\&|PIIC|PHILIPS|MEDBRAINS|HMS|20261026120000||ORU^R01^ORU_R01|P0001|P|2.6|||AL|NE\r\
PID|||UHID-7||Rao^Lakshmi\r\
PV1||I|ICU^^BED-07\r\
OBR|1|||69837^MDC_DEV_METER_PHYSIO_MULTI_PARAM_MDS^MDC|||20261026120000\r\
OBX|1|NM|150456^MDC_PULS_OXIM_SAT_O2^MDC|1.1.1.1|97|262688^MDC_DIM_PERCENT^MDC|||||R|||20261026120000\r\
OBX|2|NM|147842^MDC_ECG_HEART_RATE^MDC|1.1.1.2|82|264864^MDC_DIM_BEAT_PER_MIN^MDC|||||R|||20261026120000\r\
OBX|3|NM|149530^MDC_PULS_OXIM_PULS_RATE^MDC|1.1.1.3|84|264864^MDC_DIM_BEAT_PER_MIN^MDC|||||R|||20261026120000\r\
OBX|4|NM|150021^MDC_PRESS_BLD_NONINV_SYS^MDC|1.1.2.1|128|266016^MDC_DIM_MMHG^MDC|||||R|||20261026115800\r\
OBX|5|NM|150022^MDC_PRESS_BLD_NONINV_DIA^MDC|1.1.2.2|76|266016^MDC_DIM_MMHG^MDC|||||R|||20261026115800\r\
OBX|6|NM|150023^MDC_PRESS_BLD_NONINV_MEAN^MDC|1.1.2.3|93|266016^MDC_DIM_MMHG^MDC|||||R\r\
OBX|7|NM|151562^MDC_RESP_RATE^MDC|1.1.3.1|16|264928^MDC_DIM_RESP_PER_MIN^MDC|||||R\r\
OBX|8|NM|150344^MDC_TEMP^MDC|1.1.4.1|37.1|268192^MDC_DIM_DEGC^MDC|||||R\r";

/// GE CARESCAPE gateway: LOINC codes, temperature in Fahrenheit, an offset.
const GE: &str = "MSH|^~\\&|CARESCAPE|GE|MEDBRAINS|HMS|20261026063000+0000||ORU^R01|G77|P|2.5\r\
PID|||UHID-9\r\
OBR|1||||||20261026063000+0000\r\
OBX|1|NM|8867-4^Heart rate^LN||134|/min^^UCUM|||||F|||20261026063000+0000\r\
OBX|2|NM|59408-5^SpO2^LN||89|%^^UCUM|||||F|||20261026063000+0000\r\
OBX|3|NM|9279-1^Resp rate^LN||28|/min^^UCUM|||||F\r\
OBX|4|NM|8310-5^Body temperature^LN||101.3|[degF]^^UCUM|||||F\r\
OBX|5|ST|ALARM^Alarm text^L||HR HIGH||||||F\r";

#[test]
fn a_philips_set_becomes_one_sample_in_charting_units() {
    let o = obs(PHILIPS);
    assert_eq!(
        sample(&o),
        Sample {
            temperature: Some(37.1),
            pulse: Some(82),
            systolic_bp: Some(128),
            diastolic_bp: Some(76),
            respiratory_rate: Some(16),
            spo2: Some(97)
        },
        "ECG heart rate wins over the pleth rate; the mean pressure is ignored",
    );
    assert!(!sample(&o).is_abnormal());
    // The earliest observation time (the NIBP at 11:58), read as IST.
    assert_eq!(
        observed_at(&o),
        Some(Utc.with_ymd_and_hms(2026, 10, 26, 6, 28, 0).unwrap())
    );
}

#[test]
fn a_ge_set_uses_loinc_converts_fahrenheit_and_is_abnormal() {
    let o = obs(GE);
    let s = sample(&o);
    assert_eq!(
        (s.pulse, s.spo2, s.respiratory_rate),
        (Some(134), Some(89), Some(28))
    );
    assert_eq!(s.temperature, Some(38.5), "101.3 °F");
    assert_eq!(
        (s.systolic_bp, s.diastolic_bp),
        (None, None),
        "no blood pressure in this message"
    );
    assert!(s.is_abnormal());
    assert_eq!(
        observed_at(&o),
        Some(Utc.with_ymd_and_hms(2026, 10, 26, 6, 30, 0).unwrap()),
        "offset honoured"
    );
}

#[test]
fn a_message_with_no_vital_sign_is_empty() {
    let raw = "MSH|^~\\&|X\rOBR|1\rOBX|1|ST|ALARM^Alarm||LEAD OFF\rOBX|2|NM|150456^MDC_PULS_OXIM_SAT_O2^MDC||---";
    assert!(
        sample(&obs(raw)).is_empty(),
        "text alarms and unparseable values are not readings"
    );
}

#[test]
fn each_abnormal_threshold_on_its_own() {
    let base = Sample {
        temperature: Some(37.0),
        pulse: Some(80),
        systolic_bp: Some(120),
        diastolic_bp: Some(70),
        respiratory_rate: Some(16),
        spo2: Some(97),
    };
    assert!(!base.is_abnormal());
    for s in [
        Sample {
            spo2: Some(91),
            ..base
        },
        Sample {
            pulse: Some(40),
            ..base
        },
        Sample {
            pulse: Some(131),
            ..base
        },
        Sample {
            respiratory_rate: Some(8),
            ..base
        },
        Sample {
            respiratory_rate: Some(25),
            ..base
        },
        Sample {
            systolic_bp: Some(90),
            ..base
        },
        Sample {
            systolic_bp: Some(220),
            ..base
        },
        Sample {
            temperature: Some(35.0),
            ..base
        },
        Sample {
            temperature: Some(39.1),
            ..base
        },
    ] {
        assert!(s.is_abnormal(), "{s:?}");
    }
}
