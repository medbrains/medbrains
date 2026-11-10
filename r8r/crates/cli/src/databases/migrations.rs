//! Schema creation. Each migration is append-only and runs inside one
//! transaction; `user_version` records how far we have got.

use rusqlite::Connection;

const MIGRATIONS: &[&str] = &[
    // 1 — workflows and executions
    r"
    CREATE TABLE workflow_entity (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        active        INTEGER NOT NULL DEFAULT 0,
        nodes         TEXT NOT NULL DEFAULT '[]',
        connections   TEXT NOT NULL DEFAULT '[]',
        settings      TEXT NOT NULL DEFAULT '{}',
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
    );

    CREATE TABLE execution_entity (
        id            TEXT PRIMARY KEY,
        workflow_id   TEXT NOT NULL REFERENCES workflow_entity(id) ON DELETE CASCADE,
        workflow_name TEXT NOT NULL,
        status        TEXT NOT NULL,
        mode          TEXT NOT NULL,
        started_at    TEXT NOT NULL,
        finished_at   TEXT,
        ms            INTEGER NOT NULL DEFAULT 0,
        error         TEXT,
        data          TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX ix_execution_workflow
        ON execution_entity(workflow_id, started_at DESC);
    CREATE INDEX ix_workflow_active ON workflow_entity(active);
    ",
    // 2 — stored credentials. `data` holds the sealed JSON blob; nothing here
    // is readable without the instance encryption key.
    r"
    CREATE TABLE credential_entity (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        type       TEXT NOT NULL,
        data       TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE INDEX ix_credential_type ON credential_entity(type);
    ",
    // 3 — idempotency for inbound requests.
    //
    // Every webhook sender retries: a timeout, a dropped socket, or a 5xx and
    // the same event arrives again. Without a record of what has already been
    // handled, a retried "lab result ready" runs the workflow twice and books
    // the result twice — and the second one looks exactly as legitimate as the
    // first.
    //
    // The key is chosen by the workflow, because only it knows what identifies
    // an event: the sender's `Idempotency-Key` header, a message id in the
    // body, or a composite. The stored response is replayed verbatim, so a
    // retry is indistinguishable from the original as far as the caller can
    // tell — which is the property that makes retrying safe for them.
    r"
    CREATE TABLE idempotency_entity (
        workflow_id  TEXT NOT NULL REFERENCES workflow_entity(id) ON DELETE CASCADE,
        key          TEXT NOT NULL,
        status       INTEGER NOT NULL,
        response     TEXT NOT NULL,
        execution_id TEXT,
        created_at   TEXT NOT NULL,
        PRIMARY KEY (workflow_id, key)
    );

    CREATE INDEX ix_idempotency_age ON idempotency_entity(created_at);
    ",
    // 4 — retry lineage.
    //
    // When a vendor is down for twenty minutes, everything that fired in that
    // window fails together, and someone has to put it all through again once
    // the vendor is back. Replaying them one at a time is the kind of task
    // that gets abandoned halfway, which is how a batch of results quietly
    // goes missing.
    //
    // Recording what a run is a retry *of* makes the batch reviewable
    // afterwards, and `attempt` is what stops a permanently-failing run being
    // replayed forever by somebody's automation: a run that has already been
    // through several attempts is telling you something that another attempt
    // will not fix.
    r"
    ALTER TABLE execution_entity ADD COLUMN retry_of TEXT;
    ALTER TABLE execution_entity ADD COLUMN attempt INTEGER NOT NULL DEFAULT 1;

    CREATE INDEX ix_execution_status ON execution_entity(status, started_at DESC);
    ",
    // 5 — runs that are waiting.
    //
    // A prescription waiting on a pharmacist, a summary waiting on a
    // consultant, a follow-up three days out: none of those can be held in
    // memory, because the next deploy would lose the run and it would never
    // finish and never say so.
    //
    // What is stored is where the run stopped and what it was carrying, which
    // is enough to start the rest of the workflow later. `resume_at` is the
    // moment it may continue on its own; `needs_approval` runs never do, no
    // matter how much time passes — time is not consent.
    r"
    CREATE TABLE execution_wait (
        execution_id   TEXT PRIMARY KEY
                            REFERENCES execution_entity(id) ON DELETE CASCADE,
        workflow_id    TEXT NOT NULL
                            REFERENCES workflow_entity(id) ON DELETE CASCADE,
        node_id        TEXT NOT NULL,
        node_name      TEXT NOT NULL,
        reason         TEXT NOT NULL,
        resume_at      TEXT,
        needs_approval INTEGER NOT NULL DEFAULT 0,
        items          TEXT NOT NULL DEFAULT '[]',
        created_at     TEXT NOT NULL
    );

    CREATE INDEX ix_wait_due ON execution_wait(resume_at) WHERE resume_at IS NOT NULL;
    ",
    // 6 — what a workflow remembers between runs.
    //
    // Without this every run is a full load: a workflow that syncs
    // appointments fetches all of them every time, because it has no way to
    // know what it saw last. One value — the moment of the newest record it
    // processed — turns that into an incremental sync.
    //
    // Small on purpose. This is a handful of scalars per workflow, not a place
    // to accumulate records: anything holding clinical data belongs in the
    // execution history, which is pruned.
    r"
    CREATE TABLE workflow_state (
        workflow_id TEXT NOT NULL REFERENCES workflow_entity(id) ON DELETE CASCADE,
        key         TEXT NOT NULL,
        value       TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        PRIMARY KEY (workflow_id, key)
    );
    ",
    // 7 — workflow history.
    //
    // Until now a save overwrote the workflow and the previous shape was gone.
    // Somebody who breaks an active workflow at two in the morning has nothing
    // to go back to, and nothing to compare against to find out what they did.
    //
    // Versions are append-only: restoring an old one writes a *new* version
    // that copies it, rather than rewinding the table. That way the restore is
    // itself part of the history — which matters when the restore is the thing
    // that broke something — and the newest row is always the current one.
    r"
    CREATE TABLE workflow_version (
        id          TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL REFERENCES workflow_entity(id) ON DELETE CASCADE,
        version     INTEGER NOT NULL,
        name        TEXT NOT NULL,
        nodes       TEXT NOT NULL,
        connections TEXT NOT NULL,
        settings    TEXT NOT NULL,
        created_at  TEXT NOT NULL,
        -- What this version was: an edit, or a restore of an earlier one.
        note        TEXT,
        UNIQUE (workflow_id, version)
    );

    CREATE INDEX ix_workflow_version
        ON workflow_version(workflow_id, version DESC);
    ",
    // 8 — instance variables.
    //
    // The same workflow has to run in a test hospital and a live one. Anything
    // that differs between them — a base URL, a facility code, a batch size —
    // belongs here rather than typed into a node, so promoting a workflow is a
    // copy rather than an edit of every step that mentions a hostname.
    //
    // Values are stored in the clear and are readable by anyone who can edit a
    // workflow, because that is what an expression reading `vars` means. A
    // secret belongs in a credential, which is sealed; this table is for
    // configuration, which is not.
    r"
    CREATE TABLE variable_entity (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    ",
    // 9 — more than one r8r against one database.
    //
    // Two things went wrong the moment a second process started. Its scheduler
    // kept its own copy of when each cron was next due, so every scheduled
    // workflow fired twice. And startup recovery marked *every* running
    // execution as interrupted, including the ones the other process was in
    // the middle of — reporting a healthy run as dead while it carried on
    // writing to the hospital.
    //
    // A worker announces itself and keeps saying it is alive. Recovery then
    // only closes runs belonging to a worker that has stopped saying so, and
    // work that must happen once is held behind a lease that exactly one
    // worker owns at a time.
    r"
    CREATE TABLE worker_entity (
        id         TEXT PRIMARY KEY,
        hostname   TEXT NOT NULL,
        started_at TEXT NOT NULL,
        seen_at    TEXT NOT NULL
    );

    -- Work that must happen once across the whole deployment, no matter how
    -- many workers are running. `expires_at` rather than a held connection so
    -- that a worker which dies without tidying up still lets go.
    CREATE TABLE lease_entity (
        name       TEXT PRIMARY KEY,
        worker_id  TEXT NOT NULL,
        expires_at TEXT NOT NULL
    );

    -- Which worker is running this execution. Null for rows written before
    -- this migration, and for runs nobody claimed.
    ALTER TABLE execution_entity ADD COLUMN worker_id TEXT;
    ",
];

pub(super) fn run(conn: &Connection) -> rusqlite::Result<()> {
    let stored: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    let current = usize::try_from(stored).unwrap_or(0);

    for (i, sql) in MIGRATIONS.iter().enumerate().skip(current) {
        conn.execute_batch(&format!(
            "BEGIN; {sql} PRAGMA user_version = {}; COMMIT;",
            i + 1
        ))?;
    }
    Ok(())
}
