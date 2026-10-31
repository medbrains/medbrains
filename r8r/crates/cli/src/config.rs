//! Runtime configuration, all of it from the environment.
//! Mirrors `packages/cli/src/config`.

#[derive(Debug, Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub database_path: String,
    /// Where the built editor lives. Overriding this makes `npm run dev`
    /// changes visible without recompiling the binary.
    pub ui_dir: Option<String>,
    /// How many executions to keep per workflow. Older rows are pruned.
    pub execution_history_limit: usize,
    /// What to call this worker. See [`crate::worker::Worker::identify`];
    /// `None` means take the hostname.
    pub worker_id: Option<String>,
}

impl Config {
    pub fn from_env() -> Self {
        Config {
            host: env_or("R8R_HOST", "127.0.0.1"),
            port: env_or("R8R_PORT", "5678").parse().unwrap_or(5678),
            database_path: env_or("R8R_DATABASE", "r8r.sqlite"),
            ui_dir: std::env::var("R8R_UI_DIR").ok(),
            execution_history_limit: env_or("R8R_EXECUTION_HISTORY", "200")
                .parse()
                .unwrap_or(200),
            worker_id: std::env::var(crate::worker::WORKER_ID_ENV).ok(),
        }
    }

    pub fn bind_address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}
