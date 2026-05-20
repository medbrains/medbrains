// Command handlers exposed to the SPA via tauri::invoke. Each
// submodule registers a small, narrow set — desktop is a thin
// shell, all real business logic stays in medbrains-server.

pub(crate) mod printer;
pub(crate) mod system;
