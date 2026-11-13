//! Background jobs that run for the life of the server: escalations, billing passes, purges.

use std::future::Future;

/// Spawns a detached background job meant to run for the life of the server. The job's future
/// must have output `!`, so a job body that could `return` (and silently stop escalating,
/// billing or purging while the server looks healthy) does not compile.
pub fn spawn_forever<F>(job: F)
where
    F: Future<Output = !> + Send + 'static,
{
    tokio::spawn(job);
}
