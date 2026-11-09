//! What the front must do on a running machine: its limits, its keys, and how it fails.

use std::time::Duration;

use serde_json::Value;

use crate::vm::Vm;
use crate::{ensure, number};

const FRONT_STATE: &str = "/var/lib/medbrains-front";
const NAMES_FILE: &str = "/var/lib/medbrains/config/front-names";
const CERTS: &str = "/usr/lib/medbrains/front-certs";
/// Writes a certificate for `$1` signed by this machine's authority to /run, and verifies it.
const SIGN_AND_VERIFY: &str = r#"t() { openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -keyout /run/t.key -out /run/t.csr -subj /CN=t 2>/dev/null; openssl x509 -req -in /run/t.csr -CA /var/lib/medbrains-front/ca/ca.pem -CAkey /var/lib/medbrains-front/ca/ca.key -CAcreateserial -days 1 -out /run/t.pem -extfile <(echo "subjectAltName=$1") 2>/dev/null; openssl verify -partial_chain -CAfile /var/lib/medbrains-front/ca/ca.pem /run/t.pem >/dev/null 2>&1 && echo "$1 accepted" || echo "$1 refused"; rm -f /run/t.key /run/t.csr /run/t.pem; }"#;

/// The serial number of the certificate on the LAN port.
fn lan_serial(vm: &mut Vm) -> Result<String, String> {
    vm.run(&format!(
        "openssl x509 -in {FRONT_STATE}/lan/chain.pem -noout -serial"
    ))
}

/// How many times the front has restarted, and its main process.
fn front_identity(vm: &mut Vm) -> Result<String, String> {
    vm.run("systemctl show medbrains-front -p MainPID --value")
}

/// A stolen authority key cannot make a certificate a browser would accept for another site.
pub(crate) fn authority_is_constrained(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let out = vm.run(&format!(
        "{SIGN_AND_VERIFY}; for n in DNS:bank.example DNS:evil.com IP:8.8.8.8 IP:2001:db8::1 DNS:medbrains.local DNS:x.internal IP:10.1.2.3 IP:fd00::1; do t $n; done"
    ))?;
    for bad in [
        "DNS:bank.example",
        "DNS:evil.com",
        "IP:8.8.8.8",
        "IP:2001:db8::1",
    ] {
        ensure(
            out.contains(&format!("{bad} refused")),
            format!("{bad}: {out}"),
        )?;
    }
    for good in [
        "DNS:medbrains.local",
        "DNS:x.internal",
        "IP:10.1.2.3",
        "IP:fd00::1",
    ] {
        ensure(
            out.contains(&format!("{good} accepted")),
            format!("{good}: {out}"),
        )?;
    }
    Ok(())
}

/// A typing mistake in the names file is skipped; the front keeps running and names the rest.
pub(crate) fn bad_name_stops_nothing(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let out = vm.run(&format!(
        "printf 'a..b\\n1.2.3.999\\n:::\\nbad name\\n$(id)\\nhims.lan\\n' > {NAMES_FILE}; {CERTS} --restart 2>/dev/null; echo rc=$?; sleep 3; systemctl is-active medbrains-front; cat {FRONT_STATE}/lan/names; openssl x509 -in {FRONT_STATE}/lan/chain.pem -noout -ext subjectAltName; rm -f {NAMES_FILE}; {CERTS} --restart 2>/dev/null; sleep 3"
    ))?;
    ensure(out.contains("rc=0") && out.contains("active"), out.clone())?;
    ensure(
        out.contains("DNS:hims.lan"),
        format!("good name lost: {out}"),
    )?;
    for bad in ["a..b", "1.2.3.999", "bad name", "uid="] {
        ensure(!out.contains(bad), format!("{bad} got in: {out}"))?;
    }
    Ok(())
}

/// If a new certificate cannot be made, the valid old one stays in service.
pub(crate) fn failed_issue_keeps_the_old_one(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let before = lan_serial(vm)?;
    let out = vm.run(&format!(
        "mv {FRONT_STATE}/ca/ca.key {FRONT_STATE}/ca/ca.key.away; echo garbage > {FRONT_STATE}/ca/ca.key; echo hims.lan > {NAMES_FILE}; {CERTS} 2>&1 | grep -c keeping; mv {FRONT_STATE}/ca/ca.key.away {FRONT_STATE}/ca/ca.key; rm -f {NAMES_FILE}"
    ))?;
    ensure(out.trim() == "1", format!("did not keep it: {out}"))?;
    ensure(lan_serial(vm)? == before, "the certificate changed")
}

/// A router advertisement gives this machine an address nobody chose. That must cost nothing.
pub(crate) fn learned_address_restarts_nothing(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let (before, pid) = (lan_serial(vm)?, front_identity(vm)?);
    vm.run(&format!(
        "I=$(ip -o -4 route show default | cut -d' ' -f5); ip -6 addr add 2001:db8:77::1/64 dev $I valid_lft 3600 preferred_lft 1800; {CERTS} --restart; sleep 2; ip -6 addr del 2001:db8:77::1/64 dev $I"
    ))?;
    ensure(lan_serial(vm)? == before, "reissued for a learned address")?;
    ensure(
        front_identity(vm)? == pid,
        "restarted for a learned address",
    )
}

/// A key that does not match its certificate would stop the front at its next start.
pub(crate) fn mismatched_key_is_replaced(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let out = vm.run_for(
        &format!(
            "openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:prime256v1 -out {FRONT_STATE}/lan/key.pem 2>/dev/null; systemctl restart medbrains-front; sleep 2; systemctl is-active medbrains-front"
        ),
        Duration::from_secs(30),
    )?;
    ensure(out.trim().ends_with("active"), out.clone())?;
    ensure(
        vm.status("web", "https", "/api/health")? == 200,
        "no answer with a replaced key",
    )
}

/// The agent owns its folder, so root must not write through a link it plants there. The screen's
/// trust file is the certificate and then the local authority, which the identity provider's port needs.
pub(crate) fn agent_link_is_refused(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let copy = "/var/lib/medbrains-agent/local-front.pem";
    let out = vm.run_for(
        &format!(
            "echo untouched > /run/link-target; rm -f {copy}; ln -s /run/link-target {copy}; {CERTS} 2>&1 | grep -c refusing; cat /run/link-target; rm -f {copy}; {CERTS}; stat -c '%U %G %a' {copy}; cmp {copy} {FRONT_STATE}/screen/cert.pem && echo same; stat -c '%U' /var/lib/medbrains-settings/local-front.pem; cat {FRONT_STATE}/screen/cert.pem {FRONT_STATE}/ca/ca.pem | cmp /var/lib/medbrains-settings/local-front.pem - && echo trust-same"
        ),
        Duration::from_secs(40),
    )?;
    ensure(out.contains("untouched"), format!("written through the link: {out}"))?;
    ensure(out.contains("medbrains-agent kiosk 644") && out.contains("same"), format!("no copy after: {out}"))?;
    ensure(out.contains("root") && out.contains("trust-same"), format!("trust store: {out}"))
}

/// A machine's tunnel arrives from its own 127.x.y.z. The server must see that address, and no other
/// local program may use one.
pub(crate) fn tunnel_address_is_kept(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let out = vm.run(
        "setpriv --reuid=medbrains-agent --regid=kiosk --clear-groups curl -sk -m 5 -o /dev/null -w 'agent %{http_code}\\n' --interface 127.1.2.3 https://127.0.0.1:8443/api/health; setpriv --reuid=kiosk --regid=kiosk --clear-groups curl -sk -m 3 -o /dev/null -w 'other %{http_code}\\n' --interface 127.1.2.4 https://127.0.0.1:8443/api/health; true",
    )?;
    ensure(out.contains("agent 200"), format!("the agent's address: {out}"))?;
    ensure(out.contains("other 000"), format!("another program's address: {out}"))
}

/// The front must offer HTTP/1.1 only: HTTP/2 stays unreachable until it earns its limits.
pub(crate) fn front_offers_http1_only(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let version = vm.run(
        "curl -sk --http2 -o /dev/null -w '%{http_version}' https://127.0.0.1:8443/api/health",
    )?;
    ensure(
        version.trim() == "1.1",
        format!("negotiated HTTP {}", version.trim()),
    )
}

/// Every screen and browser depends on the front, so a crash must not leave it down.
pub(crate) fn front_returns_after_a_crash(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let state = vm.run_for(
        "pkill -9 -x medbrains-front; sleep 6; systemctl is-active medbrains-front",
        Duration::from_secs(30),
    )?;
    ensure(
        state.trim() == "active",
        format!("the front is {}", state.trim()),
    )?;
    ensure(
        vm.status("web", "https", "/api/health")? == 200,
        "no answer after the crash",
    )
}

/// The front runs as its own user, under a memory limit, and always comes back.
pub(crate) fn front_is_confined(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let shown = vm.run(
        "systemctl show medbrains-front -p User -p Restart -p MemoryMax -p WatchdogUSec -p NoNewPrivileges -p CapabilityBoundingSet",
    )?;
    ensure(
        shown.contains("User=medbrains-front"),
        format!("no own user: {shown}"),
    )?;
    ensure(
        shown.contains("Restart=always"),
        format!("no restart: {shown}"),
    )?;
    ensure(
        !shown.contains("MemoryMax=infinity"),
        format!("no memory limit: {shown}"),
    )?;
    ensure(
        shown.contains("NoNewPrivileges=yes"),
        format!("can gain privileges: {shown}"),
    )?;
    let user = vm.run("ps -o user= -C medbrains-front | sort -u")?;
    ensure(
        user.trim() == "medbrains-front",
        format!("running as {user}"),
    )
}

/// Only root reads the authority's key, and the front cannot change what it serves.
pub(crate) fn front_keys_are_held_close(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let modes = vm.run(&format!(
        "stat -c '%a %U %G' {FRONT_STATE}/ca {FRONT_STATE}/ca/ca.key {FRONT_STATE}/lan/key.pem {FRONT_STATE}/screen/key.pem"
    ))?;
    let lines: Vec<&str> = modes.lines().map(str::trim).collect();
    ensure(
        lines.first() == Some(&"700 root root"),
        format!("authority: {modes}"),
    )?;
    ensure(
        lines.get(1) == Some(&"600 root root"),
        format!("authority key: {modes}"),
    )?;
    let leaf = "640 root medbrains-front";
    ensure(
        lines.get(2) == Some(&leaf) && lines.get(3) == Some(&leaf),
        format!("keys: {modes}"),
    )
}

/// A made-up name costs nothing: nothing is issued or stored, and the plain answer still comes.
pub(crate) fn made_up_name_stores_nothing(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let count = format!("find {FRONT_STATE} -type f | wc -l");
    let before = number(vm, &count)?;
    for index in 0..20 {
        vm.run(&format!(
            "curl -sk -m 5 -o /dev/null --resolve made-up-{index}.example:443:127.0.0.1 https://made-up-{index}.example/api/health"
        ))?;
    }
    let after = number(vm, &count)?;
    ensure(before == after, format!("{before} files became {after}"))
}

/// A certificate that went missing is made again, and a bad one never means plain HTTP.
pub(crate) fn front_recovers_a_missing_certificate(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let state = vm.run_for(
        &format!("rm -rf {FRONT_STATE}/lan; systemctl restart medbrains-front; sleep 2; systemctl is-active medbrains-front"),
        Duration::from_secs(30),
    )?;
    ensure(
        state.trim() == "active",
        format!("the front is {}", state.trim()),
    )?;
    ensure(
        vm.status("web", "https", "/api/health")? == 200,
        "no answer after recovery",
    )?;
    ensure(
        vm.status("web", "http", "/api/health")? != 200,
        "plain HTTP answered",
    )
}

/// The sentence a person reads when the server is down, not a blank page.
pub(crate) fn plain_words_when_the_server_stops(vm: &mut Vm, _: &Value) -> Result<(), String> {
    let page = vm.run_for(
        "systemctl stop medbrains-server; curl -sk -m 8 https://127.0.0.1:8443/; systemctl start medbrains-server",
        Duration::from_secs(60),
    )?;
    ensure(
        page.contains("MedBrains is not answering"),
        format!("answered: {page}"),
    )?;
    vm.wait_for_server()
}
