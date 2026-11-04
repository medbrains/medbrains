//! Who is on the other end of the socket. The directory and the socket's mode let in the screen's
//! group, but WebKit's network process runs in that group too, so permissions alone would let a
//! compromised web process's helper power the machine off. So the kernel's word for who connected
//! decides: root (for operators and tests), or the shell's own program.
//!
//! This raises the bar and does not end the matter: a process running as the screen's user could
//! start the shell's program under its own control. Separate users would be the full answer, and
//! WebKit starts its helpers as the same user.

use std::os::unix::net::UnixStream;
use std::path::Path;

/// The only program, besides root's, allowed to talk to this service.
const SCREEN_PROGRAM: &str = "/usr/bin/medbrains-shell";

/// Decides from what the kernel reports. A program replaced since it started reads `… (deleted)`,
/// and is refused until it restarts.
fn is_allowed(is_root: bool, program: Option<&Path>) -> bool {
    is_root || program == Some(Path::new(SCREEN_PROGRAM))
}

/// True if this connection comes from root or the screen. Anything unreadable is a refusal.
#[cfg(target_os = "linux")]
pub(crate) fn is_screen(stream: &UnixStream) -> bool {
    let Ok(peer) = rustix::net::sockopt::socket_peercred(stream) else {
        return false;
    };
    let program = std::fs::read_link(format!("/proc/{}/exe", peer.pid.as_raw_nonzero())).ok();
    is_allowed(peer.uid.is_root(), program.as_deref())
}

/// Elsewhere there is no such check, so nobody is let in. The service only runs on Linux.
#[cfg(not(target_os = "linux"))]
pub(crate) const fn is_screen(_stream: &UnixStream) -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::{Path, SCREEN_PROGRAM, is_allowed};

    /// The finding: WebKit's network process is in the screen's group, and must still be refused.
    #[test]
    fn only_root_or_the_shell_itself_gets_through() {
        assert!(is_allowed(true, None));
        assert!(is_allowed(false, Some(Path::new(SCREEN_PROGRAM))));
        let webkit = Path::new("/usr/lib/aarch64-linux-gnu/webkitgtk-6.0/WebKitNetworkProcess");
        assert!(!is_allowed(false, Some(webkit)));
        assert!(!is_allowed(
            false,
            Some(Path::new("/usr/bin/medbrains-shell (deleted)"))
        ));
        assert!(!is_allowed(false, None));
    }
}
