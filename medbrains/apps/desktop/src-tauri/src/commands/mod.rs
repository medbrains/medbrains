// Command handlers exposed to the desktop's pages via tauri::invoke. The
// desktop is a thin shell: these only choose and remember the hospital server;
// all real business logic stays in medbrains-server.

mod binding;
pub(crate) mod server;
