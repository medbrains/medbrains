//! Can an administrator restrict which hardware key models are accepted? Asked of a running Kanidm
//! through its own API, with software authenticators that sign real attestation statements.
//!
//!   IDM_ADMIN_PASSWORD=... kanidm-softkey <base url> <webauthn origin>
//!
//! What this cannot prove: that a physical key produces the attestation these do, or that a real
//! maker's list behaves as these one-CA lists do. The verification path on the server is the same.

use kanidm_client::{KanidmClient, KanidmClientBuilder};
use kanidm_proto::internal::{CUCredState, CURegState, CUSessionToken, CUStatus};
use std::time::Instant;
use url::Url;
use uuid::Uuid;
use webauthn_authenticator_rs::WebauthnAuthenticator;
use webauthn_authenticator_rs::softpasskey::SoftPasskey;
use webauthn_authenticator_rs::softtoken::{self, SoftToken};
use webauthn_rs::prelude::AttestationCaListBuilder;

type Failures = Vec<String>;

/// Records and prints one result.
fn check(failed: &mut Failures, name: &str, ok: bool, detail: &str) {
    println!("{}  {name}  {detail}", if ok { "PASS" } else { "FAIL" });
    if !ok {
        failed.push(name.to_owned());
    }
}

/// Builds a client for the machine. Its certificate is self-signed, and what is being tested here
/// is the WebAuthn origin, which is passed separately.
fn client(base: &str) -> Result<KanidmClient, String> {
    KanidmClientBuilder::new()
        .address(base.to_owned())
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .map_err(|e| format!("client: {e:?}"))
}

/// Creates a person in a new group, so each case has a policy of its own.
async fn person_in_group(admin: &KanidmClient, person: &str, group: &str) -> Result<(), String> {
    admin
        .idm_person_account_create(person, person)
        .await
        .map_err(|e| format!("person {person}: {e:?}"))?;
    admin
        .idm_group_create(group, None)
        .await
        .map_err(|e| format!("group {group}: {e:?}"))?;
    admin
        .idm_group_add_members(group, &[person])
        .await
        .map_err(|e| format!("member {group}: {e:?}"))
}

/// Applies an allow-list and the attested-passkey minimum to a group: the commands an administrator
/// runs, `kanidm group account-policy webauthn-attestation-ca-list` and `credential-type-minimum`.
async fn restrict_group(admin: &KanidmClient, group: &str, list: &str) -> Result<(), String> {
    admin
        .group_account_policy_enable(group)
        .await
        .map_err(|e| format!("enable: {e:?}"))?;
    admin
        .group_account_policy_credential_type_minimum_set(group, "attested_passkey")
        .await
        .map_err(|e| format!("minimum: {e:?}"))?;
    admin
        .group_account_policy_webauthn_attestation_set(group, list)
        .await
        .map_err(|e| format!("list: {e:?}"))
}

/// Opens a credential session the way the person's enrolment link does.
async fn enrol(
    admin: &KanidmClient,
    base: &str,
    person: &str,
) -> Result<(KanidmClient, CUSessionToken, CUStatus), String> {
    let intent = admin
        .idm_person_account_credential_update_intent(person, Some(900))
        .await
        .map_err(|e| format!("intent: {e:?}"))?;
    let anonymous = client(base)?;
    let (session, status) = anonymous
        .idm_account_credential_update_exchange(intent.token)
        .await
        .map_err(|e| format!("exchange: {e:?}"))?;
    Ok((anonymous, session, status))
}

/// Registers one authenticator in a session. Err holds the server's refusal.
async fn register<T: WebauthnAuthenticator>(
    who: &KanidmClient,
    session: &CUSessionToken,
    key: &mut T,
    origin: &Url,
) -> Result<(), String> {
    let status = who
        .idm_account_credential_update_attested_passkey_init(session)
        .await
        .map_err(|e| format!("init: {e:?}"))?;
    let CURegState::AttestedPasskey(challenge) = status.mfaregstate else {
        return Err(format!("no challenge: {:?}", status.mfaregstate));
    };
    let response = key
        .do_registration(origin.clone(), challenge)
        .map_err(|e| format!("authenticator: {e:?}"))?;
    who.idm_account_credential_update_attested_passkey_finish(session, "key".to_owned(), response)
        .await
        .map(|_| ())
        .map_err(|e| format!("{e:?}"))
}

/// Signs in with a key and nothing else. Err holds what went wrong.
async fn sign_in<T: WebauthnAuthenticator>(
    base: &str,
    person: &str,
    key: &mut T,
    origin: &Url,
) -> Result<(), String> {
    let fresh = client(base)?;
    let challenge = fresh
        .auth_passkey_begin(person)
        .await
        .map_err(|e| format!("begin: {e:?}"))?;
    let assertion = key
        .do_authentication(origin.clone(), challenge)
        .map_err(|e| format!("authenticator: {e:?}"))?;
    fresh
        .auth_passkey_complete(Box::new(assertion))
        .await
        .map_err(|e| format!("{e:?}"))
}

/// A stranger's attempt: a well-formed sign-in for the person with a signature nobody could verify,
/// which reaches the server. A real key is used only to shape it. Returns the server's answer.
async fn forged_sign_in<T: WebauthnAuthenticator>(
    base: &str,
    person: &str,
    key: &mut T,
    origin: &Url,
) -> Result<(), String> {
    let fresh = client(base)?;
    let challenge = fresh
        .auth_passkey_begin(person)
        .await
        .map_err(|e| format!("begin: {e:?}"))?;
    let mut assertion = key
        .do_authentication(origin.clone(), challenge)
        .map_err(|e| format!("authenticator: {e:?}"))?;
    assertion.response.signature = vec![0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01].into();
    fresh
        .auth_passkey_complete(Box::new(assertion))
        .await
        .map_err(|e| format!("{e:?}"))
}

/// A soft token, then two allow-lists in the JSON `fido-mds-tool` emits, both trusting the CA that
/// signed its attestation: one naming its model, one naming a different model.
fn new_token() -> Result<(SoftToken, String, String), String> {
    let (token, ca) = SoftToken::new(true).map_err(|e| format!("token: {e:?}"))?;
    let list_of = |aaguid, name: &str| {
        let mut builder = AttestationCaListBuilder::new();
        builder
            .insert_device_x509(ca.clone(), aaguid, name.to_owned(), Default::default())
            .map_err(|e| format!("builder: {e:?}"))?;
        serde_json::to_string(&builder.build()).map_err(|e| e.to_string())
    };
    let its_model = list_of(softtoken::AAGUID, "Approved key model")?;
    let other_model = list_of(Uuid::new_v4(), "Some other model")?;
    Ok((token, its_model, other_model))
}

/// What a hospital gets by turning keys on for a group: a key and no password, so guessing has nothing to
/// count against them.
async fn key_only_cannot_be_locked_out(
    base: &str,
    origin: &Url,
    admin: &KanidmClient,
    failed: &mut Failures,
) -> Result<(), String> {
    person_in_group(admin, "staff.member", "key_only_staff").await?;
    admin.group_account_policy_enable("key_only_staff").await.map_err(|e| format!("enable: {e:?}"))?;
    admin
        .group_account_policy_credential_type_minimum_set("key_only_staff", "passkey")
        .await
        .map_err(|e| format!("minimum: {e:?}"))?;
    let (who, session, status) = enrol(admin, base, "staff.member").await?;
    check(failed, "in a key-only group a person can have no password", status.primary_state == CUCredState::PolicyDeny, &format!("{:?}", status.primary_state));
    let refused = who.idm_account_credential_update_set_password(&session, "Correct-Horse-Battery-Staple-99").await;
    check(failed, "and the server refuses one", refused.is_err(), "");
    let status = who
        .idm_account_credential_update_passkey_init(&session)
        .await
        .map_err(|e| format!("init: {e:?}"))?;
    let CURegState::Passkey(challenge) = status.mfaregstate else {
        return Err("no passkey challenge".to_owned());
    };
    let mut key = SoftPasskey::new(true);
    let response = key.do_registration(origin.clone(), challenge).map_err(|e| format!("authenticator: {e:?}"))?;
    who.idm_account_credential_update_passkey_finish(&session, "key".to_owned(), response)
        .await
        .map_err(|e| format!("finish: {e:?}"))?;
    who.idm_account_credential_update_commit(&session).await.map_err(|e| format!("commit: {e:?}"))?;
    let started = Instant::now();
    let mut refused = 0;
    for _ in 0..150 {
        if client(base)?.auth_simple_password("staff.member", "Wrong-Password-1").await.is_err() {
            refused += 1;
        }
    }
    println!("INFO  150 password guesses took {:?}; refused {refused}", started.elapsed());
    check(failed, "every password guess is refused", refused == 150, "");
    let result = sign_in(base, "staff.member", &mut key, origin).await;
    check(failed, "and the person signs in at once with their key", result.is_ok(), &format!("{result:?}"));
    Ok(())
}

/// Runs the whole deciding test. Every refusal is one the server gave over the network.
async fn run(
    base: &str,
    origin: &Url,
    password: &str,
    failed: &mut Failures,
) -> Result<(), String> {
    let admin = client(base)?;
    admin
        .auth_simple_password("idm_admin", password)
        .await
        .map_err(|e| format!("idm_admin: {e:?}"))?;
    let (mut approved, approved_json, _) = new_token()?;
    let (mut other_vendor, other_json, _) = new_token()?;
    println!(
        "INFO  allow-list is {} bytes of JSON, one CA, AAGUID {}",
        approved_json.len(),
        softtoken::AAGUID
    );

    person_in_group(&admin, "key.nurse", "approved_keys").await?;
    restrict_group(&admin, "approved_keys", &approved_json).await?;

    let (who, session, status) = enrol(&admin, base, "key.nurse").await?;
    check(
        failed,
        "the person sees which models are allowed",
        status
            .attested_passkeys_allowed_devices
            .contains(&"Approved key model".to_owned()),
        &format!("{:?}", status.attested_passkeys_allowed_devices),
    );
    check(
        failed,
        "passwords are off under this policy",
        status.primary_state == CUCredState::PolicyDeny,
        &format!("{:?}", status.primary_state),
    );
    check(
        failed,
        "keys without attestation cannot start",
        status.passkeys_state == CUCredState::PolicyDeny,
        &format!("{:?}", status.passkeys_state),
    );
    let refused = who
        .idm_account_credential_update_passkey_init(&session)
        .await;
    check(
        failed,
        "server refuses the plain passkey path",
        refused.is_err(),
        &format!("{refused:?}").chars().take(90).collect::<String>(),
    );
    let refused = who
        .idm_account_credential_update_set_password(&session, "Correct-Horse-Battery-Staple-99")
        .await;
    check(
        failed,
        "server refuses a password",
        refused.is_err(),
        &format!("{refused:?}").chars().take(90).collect::<String>(),
    );

    let mut no_attestation = SoftPasskey::new(true);
    let result = register(&who, &session, &mut no_attestation, origin).await;
    check(
        failed,
        "a key with no attestation is refused",
        result.as_ref().is_err_and(|e| e.contains("CU0001")),
        &format!("{result:?}"),
    );
    let result = register(&who, &session, &mut other_vendor, origin).await;
    check(
        failed,
        "a key from another maker's CA is refused, with the same AAGUID",
        result.as_ref().is_err_and(|e| e.contains("CU0001")),
        &format!("{result:?}"),
    );
    let result = register(&who, &session, &mut approved, origin).await;
    check(
        failed,
        "the approved key is accepted",
        result.is_ok(),
        &format!("{result:?}"),
    );
    who.idm_account_credential_update_commit(&session)
        .await
        .map_err(|e| format!("commit: {e:?}"))?;

    let result = sign_in(base, "key.nurse", &mut approved, origin).await;
    check(
        failed,
        "and signs in, with no password",
        result.is_ok(),
        &format!("{result:?}"),
    );
    let result = forged_sign_in(base, "key.nurse", &mut approved, origin).await;
    check(
        failed,
        "a forged signature cannot sign in as that person",
        result
            .as_ref()
            .is_err_and(|e| e.contains("AuthenticationFailed")),
        &format!("{result:?}"),
    );

    // The model control: the same maker's CA, but a list that names another AAGUID.
    let (mut same_maker, _, other_model) = new_token()?;
    person_in_group(&admin, "key.porter", "other_model").await?;
    restrict_group(&admin, "other_model", &other_model).await?;
    let (who, session, _) = enrol(&admin, base, "key.porter").await?;
    let result = register(&who, &session, &mut same_maker, origin).await;
    // CU0002 here is AttestationUntrustedAaguid in the server's log, not a general failure.
    check(
        failed,
        "a trusted maker's key of an unlisted model is refused",
        result.as_ref().is_err_and(|e| e.contains("CU0002")),
        &format!("{result:?}"),
    );

    // A model recalled later: the check repeats at every sign-in, not only at enrolment.
    restrict_group(&admin, "approved_keys", &other_json).await?;
    let result = sign_in(base, "key.nurse", &mut approved, origin).await;
    check(
        failed,
        "removing a model stops keys already enrolled",
        result.is_err(),
        &format!("{result:?}"),
    );
    restrict_group(&admin, "approved_keys", &approved_json).await?;
    let result = sign_in(base, "key.nurse", &mut approved, origin).await;
    check(
        failed,
        "putting it back restores them",
        result.is_ok(),
        &format!("{result:?}"),
    );

    key_only_cannot_be_locked_out(base, origin, &admin, failed).await?;

    // A stranger who knows the username, against a key-only account.
    let fresh = client(base)?;
    let password_path = fresh
        .auth_simple_password("key.nurse", "Wrong-Password-1")
        .await;
    println!("INFO  a password against a key-only account: {password_path:?}");
    let started = Instant::now();
    let mut refused = 0;
    for _ in 0..50 {
        if forged_sign_in(base, "key.nurse", &mut approved, origin)
            .await
            .is_err()
        {
            refused += 1;
        }
    }
    println!(
        "INFO  50 forged sign-ins took {:?}; refused {refused}",
        started.elapsed()
    );
    let result = sign_in(base, "key.nurse", &mut approved, origin).await;
    check(
        failed,
        "and right after them, a stranger has not locked the real person out",
        result.is_ok(),
        &format!("{result:?}"),
    );

    Ok(())
}

/// Reads the arguments, runs the test, and exits non-zero if any check failed.
#[tokio::main]
async fn main() -> Result<(), String> {
    let mut args = std::env::args().skip(1);
    let base = args
        .next()
        .ok_or("usage: kanidm-softkey <base url> <origin>")?;
    let origin = Url::parse(&args.next().ok_or("no origin")?).map_err(|e| e.to_string())?;
    let password =
        std::env::var("IDM_ADMIN_PASSWORD").map_err(|_| "IDM_ADMIN_PASSWORD is not set")?;
    let mut failed = Vec::new();
    run(&base, &origin, &password, &mut failed).await?;
    println!(
        "{}",
        if failed.is_empty() {
            "ALL PASSED".to_owned()
        } else {
            format!("FAILED: {}", failed.join(", "))
        }
    );
    if failed.is_empty() {
        Ok(())
    } else {
        Err("the test failed".to_owned())
    }
}
