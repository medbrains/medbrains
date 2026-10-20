use super::*;

fn started(session: Uuid) -> DisplayState {
    apply(
        &DisplayState::default(),
        DisplayEvent::SessionStart {
            session,
            patient_name: Some("Ravi Kumar Sharma".into()),
        },
    )
    .expect("valid")
    .expect("applies")
}

#[test]
fn a_name_is_cut_to_first_name_and_initial() {
    assert_eq!(short_name("Ravi Kumar Sharma").as_deref(), Some("Ravi S."));
    assert_eq!(short_name("  anita  ").as_deref(), Some("anita"));
    assert_eq!(short_name("   "), None);
    let long = "A".repeat(80);
    assert_eq!(short_name(&long).map(|n| n.len()), Some(MAX_FIRST_NAME));
}

#[test]
fn the_snapshot_never_holds_the_full_name() {
    let state = started(Uuid::new_v4());
    let json = serde_json::to_string(&state).expect("json");
    assert!(
        !json.contains("Kumar") && !json.contains("Sharma"),
        "{json}"
    );
    assert_eq!(state.patient.as_deref(), Some("Ravi S."));
}

#[test]
fn an_event_for_another_session_changes_nothing() {
    let state = started(Uuid::new_v4());
    let late = DisplayEvent::Paid {
        session: Uuid::new_v4(),
        amount_paise: 100,
        change_paise: None,
    };
    assert_eq!(apply(&state, late), Ok(None));
}

#[test]
fn a_new_session_wipes_the_last_patient() {
    let first = Uuid::new_v4();
    let state = apply(
        &started(first),
        DisplayEvent::Items {
            session: first,
            lines: vec![DisplayLine {
                label: "Pharmacy".into(),
                amount_paise: 50_000,
            }],
            total_due_paise: 50_000,
        },
    )
    .expect("valid")
    .expect("applies");
    let next = apply(
        &state,
        DisplayEvent::SessionStart {
            session: Uuid::new_v4(),
            patient_name: None,
        },
    )
    .expect("valid")
    .expect("applies");
    assert!(next.lines.is_empty() && next.patient.is_none() && next.total_due_paise == 0);
    assert_eq!(next.seq, state.seq + 1);
}

#[test]
fn only_a_upi_link_or_https_image_becomes_a_qr() {
    let s = Uuid::new_v4();
    let qr = |upi: Option<&str>, img: Option<&str>| {
        apply(
            &started(s),
            DisplayEvent::QrShown {
                session: s,
                amount_paise: 100,
                upi_uri: upi.map(Into::into),
                image_url: img.map(Into::into),
                close_by: None,
            },
        )
    };
    assert!(qr(Some("upi://pay?pa=x@y&am=1"), None).is_ok());
    assert!(qr(None, Some("https://rzp.io/qr.png")).is_ok());
    assert_eq!(qr(Some("javascript:alert(1)"), None), Err(Rejected::Qr));
    assert_eq!(qr(None, Some("http://x/qr.png")), Err(Rejected::Qr));
    assert_eq!(qr(None, None), Err(Rejected::Qr));
}

#[test]
fn bad_values_are_refused() {
    let s = Uuid::new_v4();
    let tender = DisplayEvent::TenderSelected {
        session: s,
        tender: "barter".into(),
        amount_paise: 1,
    };
    assert_eq!(apply(&started(s), tender), Err(Rejected::Tender));
    let card = DisplayEvent::CardStatus {
        session: s,
        status: "maybe".into(),
        amount_paise: 1,
    };
    assert_eq!(apply(&started(s), card), Err(Rejected::CardStatus));
    let paid = DisplayEvent::Paid {
        session: s,
        amount_paise: -5,
        change_paise: None,
    };
    assert_eq!(apply(&started(s), paid), Err(Rejected::Amount));
}

#[test]
fn lines_are_bounded() {
    let s = Uuid::new_v4();
    let lines = (0..50)
        .map(|i| DisplayLine {
            label: format!("{i} {}", "x".repeat(200)),
            amount_paise: 1,
        })
        .collect();
    let state = apply(
        &started(s),
        DisplayEvent::Items {
            session: s,
            lines,
            total_due_paise: 50,
        },
    )
    .expect("valid")
    .expect("applies");
    assert_eq!(state.lines.len(), MAX_LINES);
    assert!(
        state
            .lines
            .iter()
            .all(|l| l.label.chars().count() <= MAX_LABEL)
    );
}

#[test]
fn an_old_paid_reads_as_idle() {
    let s = Uuid::new_v4();
    let paid = apply(
        &started(s),
        DisplayEvent::Paid {
            session: s,
            amount_paise: 60_000,
            change_paise: Some(4_000),
        },
    )
    .expect("valid")
    .expect("applies");
    assert_eq!(visible(&paid, Duration::from_secs(1)).phase, Phase::Paid);
    let late = visible(&paid, PAID_VISIBLE + Duration::from_secs(1));
    assert_eq!(late.phase, Phase::Idle);
    assert_eq!(late.seq, paid.seq, "same change, no new announcement");
    assert_eq!(
        visible(&started(s), SESSION_STALE + Duration::from_secs(1)).phase,
        Phase::Idle
    );
}

#[test]
fn counters_do_not_share_snapshots() {
    let tenant = Uuid::new_v4();
    let (a, b) = (Uuid::new_v4(), Uuid::new_v4());
    let s = Uuid::new_v4();
    publish(
        tenant,
        a,
        DisplayEvent::SessionStart {
            session: s,
            patient_name: Some("Ravi".into()),
        },
    )
    .expect("publish");
    assert_eq!(poll(tenant, a).patient.as_deref(), Some("Ravi"));
    assert_eq!(poll(tenant, b), DisplayState::default());
    assert_eq!(poll(Uuid::new_v4(), a), DisplayState::default());
    assert!(is_connected(tenant, a), "a poll counts as connected");
}

#[test]
fn a_repeated_start_renames_without_wiping() {
    let s = Uuid::new_v4();
    let qr = apply(
        &started(s),
        DisplayEvent::QrShown {
            session: s,
            amount_paise: 100,
            upi_uri: Some("upi://pay?pa=x@y".into()),
            image_url: None,
            close_by: None,
        },
    )
    .expect("valid")
    .expect("applies");
    let renamed = apply(
        &qr,
        DisplayEvent::SessionStart {
            session: s,
            patient_name: Some("Anita Rao".into()),
        },
    )
    .expect("valid")
    .expect("applies");
    assert_eq!(renamed.phase, Phase::Qr);
    assert!(renamed.qr.is_some());
    assert_eq!(renamed.patient.as_deref(), Some("Anita R."));
}
