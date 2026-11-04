//! Runs helper programs with a deadline, so a stuck one can't hold the screen's start or its polls.
//! The same as `medbrains-os-setup/src/child.rs`: this crate sits outside the workspace, because GTK
//! won't build on the machines that build the rest, so the two can't share a crate.

use std::io::Read;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

/// How long most helpers may take.
pub(crate) const USUAL_LIMIT: Duration = Duration::from_secs(5);
/// How much of a helper's output is kept. Its reader stops here, so it can't fill the service.
const MAX_OUTPUT: u64 = 2 * 1024 * 1024;
const POLL: Duration = Duration::from_millis(20);
/// How long to wait for a pipe once the helper has ended: a grandchild may hold it open.
const DRAIN: Duration = Duration::from_millis(200);

/// What a helper left behind.
#[derive(Debug)]
pub(crate) struct Finished {
    pub(crate) success: bool,
    pub(crate) stdout: Vec<u8>,
    pub(crate) stderr: Vec<u8>,
}

/// Reads a pipe on its own thread, so a helper that writes a lot can't block on a full pipe.
fn collect(pipe: Option<impl Read + Send + 'static>) -> mpsc::Receiver<Vec<u8>> {
    let (sender, receiver) = mpsc::channel();
    thread::spawn(move || {
        let mut output = Vec::new();
        if let Some(pipe) = pipe {
            // Whatever arrived before a read error is still the answer.
            drop(pipe.take(MAX_OUTPUT).read_to_end(&mut output));
        }
        drop(sender.send(output));
    });
    receiver
}

/// Runs a helper to the end or to the limit, whichever comes first, killing it at the limit.
/// `None` means it couldn't start or was killed: not an answer of any kind.
pub(crate) fn run(program: &str, args: &[&str], limit: Duration) -> Option<Finished> {
    let mut child = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .ok()?;
    let (stdout, stderr) = (collect(child.stdout.take()), collect(child.stderr.take()));
    let deadline = Instant::now() + limit;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() < deadline => thread::sleep(POLL),
            _ => {
                // Already gone is the only way these fail, and reaping is all that is left to do.
                drop(child.kill());
                drop(child.wait());
                return None;
            }
        }
    };
    Some(Finished {
        success: status.success(),
        stdout: stdout.recv_timeout(DRAIN).unwrap_or_default(),
        stderr: stderr.recv_timeout(DRAIN).unwrap_or_default(),
    })
}

#[cfg(test)]
mod tests {
    use super::run;
    use std::time::{Duration, Instant};

    const SOON: Duration = Duration::from_millis(300);

    /// The finding this exists for: a helper that never ends must not hold the service.
    #[test]
    fn a_stuck_helper_is_killed_at_the_limit() {
        let started = Instant::now();
        assert!(run("sleep", &["30"], SOON).is_none());
        assert!(started.elapsed() < Duration::from_secs(5));
    }

    #[test]
    fn output_and_exit_are_reported() {
        let done = run(
            "sh",
            &["-c", "echo out; echo err >&2; exit 3"],
            Duration::from_secs(5),
        );
        let done = done.filter(|d| !d.success && d.stdout == b"out\n" && d.stderr == b"err\n");
        assert!(done.is_some());
    }

    #[test]
    fn a_helper_that_cannot_start_is_not_an_answer() {
        assert!(run("/nonexistent/helper", &[], SOON).is_none());
    }

    /// More than a pipe holds, so this proves the reader doesn't deadlock with the helper.
    #[test]
    fn a_lot_of_output_does_not_block_the_helper() {
        let done = run(
            "sh",
            &["-c", "head -c 300000 /dev/zero"],
            Duration::from_secs(5),
        );
        assert!(done.is_some_and(|d| d.success && d.stdout.len() == 300_000));
    }
}
