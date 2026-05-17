// Copyright 2026 Cloudflare, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use log::{debug, error, warn};
use std::fs;
use std::path::Path;

use crate::server::configuration::ServerConf;

fn move_old_pid(path: &str) {
    if !Path::new(path).exists() {
        debug!("Old pid file does not exist");
        return;
    }

    let new_path = format!("{path}.old");
    match fs::rename(path, &new_path) {
        Ok(()) => debug!("Old pid file renamed"),
        Err(e) => error!(
            "failed to rename pid file from {} to {}: {}",
            path, new_path, e
        ),
    }
}

/// Daemon mode is intentionally disabled in the MedBrains vendored Pingora build.
///
/// MedBrains runs the proxy as a foreground process under `make dev`, systemd, or
/// container supervision. Keeping foreground-only behavior removes the unmaintained
/// `daemonize` dependency from the proxy attack surface.
#[cfg(unix)]
pub fn daemonize(conf: &ServerConf) {
    move_old_pid(&conf.pid_file);
    warn!(
        "Pingora daemon mode is disabled in the MedBrains build; continuing in the foreground"
    );
}
