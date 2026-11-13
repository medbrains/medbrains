//! Background jobs that run for the life of the server: escalations, billing passes, purges.

use std::future::Future;

/// Spawns a detached background job meant to run for the life of the server. The job's future
/// must have output `!`, so a job body that could `return` (and silently stop escalating,
/// billing or purging while the server looks healthy) does not compile. The only way left for it
/// to end is a panic or a runtime shutdown, and that is logged with `name` (pass `module_path!()`)
/// rather than swallowed.
pub fn spawn_forever<F>(name: &'static str, job: F)
where
    F: Future<Output = !> + Send + 'static,
{
    // ponytail: a watcher task per job via tokio's JoinHandle, no `futures` dependency needed.
    // The job is not restarted; restart-on-panic would go here if a job ever needs it.
    let handle = tokio::spawn(job);
    tokio::spawn(async move {
        let Err(error) = handle.await;
        if error.is_panic() {
            tracing::error!(job = name, %error, "background job panicked and has stopped");
        } else {
            tracing::warn!(job = name, %error, "background job was cancelled");
        }
    });
}

