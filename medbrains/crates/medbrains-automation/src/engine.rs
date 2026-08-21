//! Assembling the engine for a hospital.
//!
//! r8r on its own will run any workflow it is given. Here it is wrapped in the
//! two rules that make that safe inside `MedBrains`: a workflow may only use
//! nodes its authority covers, and only as many may run at once as the guard
//! admits.
//!
//! Both checks happen before the engine is entered, so a workflow that should
//! not run never starts rather than failing partway through with some of its
//! side effects already done.

use crate::{Deployment, Guard, RunAs};
use r8r_core::{
    BinaryStore, CredentialProvider, CredentialRegistry, NodeRegistry, StateStore, Variables,
    WorkflowExecute,
};
use r8r_workflow::interfaces::{ExecutionMode, ExecutionStatus, Items, RunResult};
use r8r_workflow::{CredentialTypeDescription, NodeTypeDescription, Workflow};
use std::sync::Arc;

/// Which permission a node type demands before a workflow may use it.
///
/// Only nodes that reach clinical data appear here. A node that posts to Slack
/// or reshapes JSON needs nothing, because it can only touch what an earlier
/// node already fetched — and that node was checked.
#[must_use]
pub fn required_permission(node_type: &str) -> Option<&'static str> {
    match node_type {
        // Reading a patient through the in-process node is reading a patient.
        "medbrains" | "medbrainsPatient" => Some("patients.view"),
        "medbrainsEncounter" => Some("encounters.view"),
        // Starting another workflow is starting a workflow. The nodes inside
        // it are checked separately, when it runs — see `Automation::check`.
        "executeWorkflow" => Some(medbrains_core::permissions::automation::RUN),
        _ => None,
    }
}

/// Where one tenant's automation data lives.
///
/// Every method takes the tenant rather than the implementation holding one,
/// so a single instance serves every hospital and none of them can be handed
/// another's watermarks, settings or files.
#[async_trait::async_trait]
pub trait TenantStores: Send + Sync + std::fmt::Debug {
    /// What this tenant's workflows remember between runs.
    fn state(&self, tenant_id: uuid::Uuid) -> Arc<dyn StateStore>;

    /// What this tenant's deployment is configured with.
    ///
    /// Async, and read once here rather than by the engine mid-run. r8r asks
    /// for variables from a synchronous context; reading Postgres from inside
    /// one means blocking a worker thread on a database round trip, which in a
    /// tokio runtime is a deadlock waiting for load. Reading them up front is
    /// also the behaviour a run wants: a workflow must not see a value change
    /// halfway through and take two different branches on what is meant to be
    /// the same setting.
    async fn variables(&self, tenant_id: uuid::Uuid) -> Arc<dyn Variables>;

    /// Where this tenant's downloaded files are kept.
    fn binaries(&self, tenant_id: uuid::Uuid) -> Arc<dyn BinaryStore>;
}

/// Why a workflow was refused before it ran.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum RefusedError {
    #[error("`{node}` needs the `{permission}` permission, which this workflow was not granted")]
    Permission { node: String, permission: &'static str },
}

/// The automation engine, wired for this deployment.
pub struct Automation {
    engine: WorkflowExecute,
    stores: Option<Arc<dyn TenantStores>>,
    nodes: Arc<NodeRegistry>,
    credential_types: Arc<CredentialRegistry>,
    guard: Guard,
    deployment: Deployment,
}

impl std::fmt::Debug for Automation {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Automation")
            .field("deployment", &self.deployment.as_str())
            .field("concurrency", &self.guard.limit())
            .field("node_types", &self.nodes.len())
            .finish()
    }
}

impl Automation {
    /// Build the engine.
    ///
    /// `credentials` is supplied rather than constructed so this crate stays
    /// free of storage: the server passes one backed by Postgres, and a test
    /// passes one backed by a map.
    pub fn new(
        deployment: Deployment,
        guard: Guard,
        credentials: Arc<dyn CredentialProvider>,
    ) -> Result<Self, r8r_core::CoreError> {
        let catalog = r8r_nodes_base::catalog();
        let nodes = Arc::new(catalog.nodes);

        let engine = WorkflowExecute::new(Arc::clone(&nodes))?.with_credentials(credentials);

        Ok(Automation {
            engine,
            stores: None,
            nodes,
            credential_types: Arc::new(catalog.credentials),
            guard,
            deployment,
        })
    }

    /// Supply the per-tenant stores a run needs.
    ///
    /// One factory rather than three separate capabilities, because all three
    /// are catastrophic to share and easy to share by accident. A watermark
    /// held in common would have two hospitals each skipping the other's
    /// records; a variable held in common would point one hospital's sync at
    /// another's server; a file held in common is a scanned discharge summary
    /// readable by the wrong hospital. Taking the tenant as an argument makes
    /// that a thing the type system asks about rather than a thing somebody
    /// remembers.
    #[must_use]
    pub fn with_stores(mut self, stores: Arc<dyn TenantStores>) -> Self {
        self.stores = Some(stores);
        self
    }

    /// The engine as it should run for one tenant.
    async fn engine_for(&self, run_as: &RunAs, execution_id: &str) -> WorkflowExecute {
        let engine = self.engine.for_execution(execution_id);

        let Some(stores) = self.stores.as_ref() else {
            // No stores configured: workflows remember nothing, read no
            // variables, and refuse files too large to carry. That is r8r's own
            // default, and right for an embedding that does not want MedBrains
            // writing on its behalf.
            return engine;
        };

        engine
            .with_state(stores.state(run_as.tenant_id))
            .with_variables(stores.variables(run_as.tenant_id).await)
            .with_binaries(stores.binaries(run_as.tenant_id))
    }

    /// Check a workflow against an authority without running it.
    ///
    /// Called when a workflow is activated, so the refusal arrives while
    /// somebody is looking at the screen rather than at 03:00.
    pub fn check(&self, workflow: &Workflow, run_as: &RunAs) -> Result<(), RefusedError> {
        for node in &workflow.nodes {
            if node.disabled {
                continue;
            }
            if let Some(permission) = required_permission(&node.kind) {
                if !run_as.allows(permission) {
                    return Err(RefusedError::Permission {
                        node: node.label().to_owned(),
                        permission,
                    });
                }
            }
        }
        Ok(())
    }

    /// Run a workflow under the authority it was granted.
    ///
    /// Returns a failed `RunResult` rather than an error when the authority is
    /// insufficient: to everything downstream this is a workflow that did not
    /// work, and it belongs in the execution history like any other failure.
    pub async fn run(
        &self,
        workflow: &Workflow,
        run_as: &RunAs,
        mode: ExecutionMode,
        input: Items,
    ) -> RunResult {
        if let Err(refused) = self.check(workflow, run_as) {
            tracing::warn!(
                workflow = %workflow.name,
                tenant = %run_as.tenant_id,
                reason = %refused,
                "refused to run a workflow beyond its authority"
            );
            return refused_result(&refused.to_string());
        }

        // Wait for a slot. Automation queues; the hospital does not.
        let _admission = self.guard.admit().await;

        // A run with no execution of its own still runs; its files simply have
        // nothing to be cleaned up with, which is why the server should use
        // `run_as_execution`.
        self.engine_for(run_as, "")
            .await
            .run(workflow, None, input, mode)
            .await
    }

    /// Run a workflow, naming the execution it belongs to.
    ///
    /// The identity is what ties a stored file to the run that produced it, so
    /// that pruning a run's history takes its attachments. A run without one
    /// still works; its files just have nothing to be cleaned up with, which
    /// is a disk filling slowly with scans nobody can reach.
    pub async fn run_as_execution(
        &self,
        execution_id: &str,
        workflow: &Workflow,
        run_as: &RunAs,
        mode: ExecutionMode,
        input: Items,
    ) -> RunResult {
        if let Err(refused) = self.check(workflow, run_as) {
            tracing::warn!(
                workflow = %workflow.name,
                tenant = %run_as.tenant_id,
                reason = %refused,
                "refused to run a workflow beyond its authority"
            );
            return refused_result(&refused.to_string());
        }

        let _admission = self.guard.admit().await;

        self.engine_for(run_as, execution_id)
            .await
            .run(workflow, None, input, mode)
            .await
    }

    /// Run only if a slot is free.
    ///
    /// The scheduler uses this: dropping this minute's run is better than
    /// queueing every future minute behind a slow one.
    pub async fn try_run(
        &self,
        workflow: &Workflow,
        run_as: &RunAs,
        mode: ExecutionMode,
        input: Items,
    ) -> Option<RunResult> {
        let admission = self.guard.try_admit()?;
        let result = self.run(workflow, run_as, mode, input).await;
        drop(admission);
        Some(result)
    }

    #[must_use]
    pub fn node_types(&self) -> Vec<NodeTypeDescription> {
        self.nodes.descriptions()
    }

    #[must_use]
    pub fn credential_types(&self) -> Vec<CredentialTypeDescription> {
        self.credential_types.descriptions()
    }

    #[must_use]
    pub fn deployment(&self) -> Deployment {
        self.deployment
    }

    #[must_use]
    pub fn guard(&self) -> &Guard {
        &self.guard
    }
}

fn refused_result(message: &str) -> RunResult {
    RunResult {
        status: ExecutionStatus::Error,
        error: Some(message.to_owned()),
        runs: Vec::new(),
        last: Items::new(),
        // A workflow refused before it started remembered nothing and is not
        // waiting for anything. Saying so explicitly rather than by default,
        // because a refusal that looked suspended would sit in the waiting
        // list for ever.
        remembered: None,
        suspended: None,
    }
}

#[cfg(test)]
mod tests {
    // Tests may state what must hold and stop if it does not; that is what a
    // test is. The denials exist for code the hospital runs.
    #![allow(clippy::expect_used, clippy::unwrap_used, clippy::panic, clippy::indexing_slicing)]

    use super::*;
    use r8r_core::NoCredentials;
    use serde_json::json;
    use uuid::Uuid;

    fn automation() -> Automation {
        Automation::new(Deployment::Embedded, Guard::new(2), Arc::new(NoCredentials))
            .expect("the engine builds")
    }

    fn workflow_with(node_type: &str) -> Workflow {
        serde_json::from_value(json!({
            "name": "test",
            "nodes": [
                { "id": "t", "type": "manual", "name": "Start", "parameters": {} },
                { "id": "n", "type": node_type, "name": "Clinical", "parameters": {} }
            ],
            "connections": [{ "from": "t", "to": "n", "port": "main" }]
        }))
        .expect("valid workflow")
    }

    fn authority_for(tenant: u128, permissions: &[&str]) -> RunAs {
        RunAs::restore(
            Uuid::from_u128(tenant),
            Some(Uuid::from_u128(2)),
            permissions.iter().map(|p| (*p).to_owned()).collect(),
        )
    }

    fn authority(permissions: &[&str]) -> RunAs {
        RunAs::restore(
            Uuid::from_u128(1),
            Some(Uuid::from_u128(2)),
            permissions.iter().map(|p| (*p).to_owned()).collect(),
        )
    }

    /// Remembers a value, so a test can see whether state reached the engine.
    fn remembering_workflow() -> Workflow {
        serde_json::from_value(json!({
            "name": "incremental",
            "nodes": [
                { "id": "t", "type": "manual", "name": "Start", "parameters": {} },
                { "id": "read", "type": "set", "name": "Read",
                  "parameters": { "mode": "fields", "keepOnlySet": true,
                                  "fields": { "since": "{{ state.lastSync }}",
                                              "where": "{{ vars.FHIR_BASE_URL }}" } } }
            ],
            "connections": [{ "from": "t", "to": "read", "port": "main" }]
        }))
        .expect("valid workflow")
    }

    // ======================================================== capabilities

    #[tokio::test]
    async fn a_workflow_reads_what_the_last_run_remembered() {
        // What an incremental sync is: "everything changed since last time".
        // Without stores wired, every run asks for everything.
        let engine = automation().with_stores(Arc::new(Stores));

        let result = engine
            .run(
                &remembering_workflow(),
                &authority(&[]),
                ExecutionMode::Manual,
                vec![json!({})],
            )
            .await;

        assert_eq!(result.status, ExecutionStatus::Success);
        assert_eq!(result.last[0]["since"], json!("tenant-1-watermark"));
    }

    #[tokio::test]
    async fn a_workflow_reads_the_values_this_deployment_was_given() {
        // The same workflow points at a test hospital or a live one depending
        // on this, rather than on somebody editing every node.
        let engine = automation().with_stores(Arc::new(Stores));

        let result = engine
            .run(
                &remembering_workflow(),
                &authority(&[]),
                ExecutionMode::Manual,
                vec![json!({})],
            )
            .await;

        assert_eq!(result.last[0]["where"], json!("https://tenant-1.example.org"));
    }

    #[tokio::test]
    async fn two_tenants_do_not_read_each_other_s_settings() {
        // The failure that makes this a factory rather than three capabilities:
        // one hospital's nightly sync pointed at another hospital's server.
        let engine = automation().with_stores(Arc::new(Stores));

        let first = engine
            .run(
                &remembering_workflow(),
                &authority_for(1, &[]),
                ExecutionMode::Manual,
                vec![json!({})],
            )
            .await;
        let second = engine
            .run(
                &remembering_workflow(),
                &authority_for(2, &[]),
                ExecutionMode::Manual,
                vec![json!({})],
            )
            .await;

        assert_eq!(first.last[0]["where"], json!("https://tenant-1.example.org"));
        assert_eq!(second.last[0]["where"], json!("https://tenant-2.example.org"));
    }

    #[tokio::test]
    async fn two_tenants_do_not_read_each_other_s_watermarks() {
        // Sharing one would have each hospital skipping the other's records —
        // silently, and only noticed when somebody asks why a patient never
        // synced.
        let engine = automation().with_stores(Arc::new(Stores));

        let first = engine
            .run(
                &remembering_workflow(),
                &authority_for(1, &[]),
                ExecutionMode::Manual,
                vec![json!({})],
            )
            .await;
        let second = engine
            .run(
                &remembering_workflow(),
                &authority_for(2, &[]),
                ExecutionMode::Manual,
                vec![json!({})],
            )
            .await;

        assert_eq!(first.last[0]["since"], json!("tenant-1-watermark"));
        assert_eq!(second.last[0]["since"], json!("tenant-2-watermark"));
    }

    #[tokio::test]
    async fn a_deployment_with_no_variables_configured_still_runs() {
        // The common case, and it must not be a different code path.
        let result = automation()
            .run(
                &remembering_workflow(),
                &authority(&[]),
                ExecutionMode::Manual,
                vec![json!({})],
            )
            .await;

        assert_eq!(result.status, ExecutionStatus::Success);
        assert_eq!(result.last[0]["where"], serde_json::Value::Null);
    }

    // ========================================================== authority

    #[test]
    fn starting_another_workflow_needs_the_permission_to_run_workflows() {
        // The nodes inside the other workflow are checked when it runs, not
        // here — this crate cannot see them. Whatever provider supplies
        // sub-workflows must route them through `Automation::run` with the
        // same authority, or a workflow granted nothing could call one that
        // reads patients. That is why no `with_sub_workflows` exists here: the
        // hole cannot be opened by accident.
        let calling = workflow_with("executeWorkflow");

        assert!(automation().check(&calling, &authority(&[])).is_err());
        assert!(
            automation()
                .check(&calling, &authority(&["automation.run"]))
                .is_ok()
        );
    }

    #[test]
    fn a_disabled_clinical_node_is_not_a_reason_to_refuse() {
        // It will not run, so it cannot read anything.
        let mut workflow = workflow_with("medbrainsPatient");
        workflow.nodes[1].disabled = true;

        assert!(automation().check(&workflow, &authority(&[])).is_ok());
    }

    // ============================================================ results

    #[test]
    fn a_refusal_is_not_a_run_that_is_waiting_for_something() {
        // A refusal that looked suspended would sit in the waiting list for
        // ever, and somebody would eventually approve it.
        let refused = refused_result("no");

        assert!(refused.suspended.is_none());
        assert!(refused.remembered.is_none());
        assert_eq!(refused.status, ExecutionStatus::Error);
    }

    /// Stores that answer with the tenant they were asked about, so a test can
    /// see whether the tenant reached them at all.
    #[derive(Debug)]
    struct Stores;

    #[async_trait::async_trait]
    impl TenantStores for Stores {
        fn state(&self, tenant_id: Uuid) -> Arc<dyn StateStore> {
            Arc::new(FixedState(format!("tenant-{}-watermark", tenant_id.as_u128())))
        }
        async fn variables(&self, tenant_id: Uuid) -> Arc<dyn Variables> {
            Arc::new(r8r_core::StaticVariables::new(
                [(
                    "FHIR_BASE_URL".to_owned(),
                    json!(format!(
                        "https://tenant-{}.example.org",
                        tenant_id.as_u128()
                    )),
                )]
                .into_iter()
                .collect(),
            ))
        }
        fn binaries(&self, _: Uuid) -> Arc<dyn BinaryStore> {
            Arc::new(r8r_core::NoBinaryStore)
        }
    }

    #[derive(Debug)]
    struct FixedState(String);

    #[async_trait::async_trait]
    impl StateStore for FixedState {
        async fn load(
            &self,
            _: &str,
        ) -> r8r_core::Result<serde_json::Map<String, serde_json::Value>> {
            Ok([("lastSync".to_owned(), json!(self.0))].into_iter().collect())
        }
        async fn commit(
            &self,
            _: &str,
            _: serde_json::Map<String, serde_json::Value>,
        ) -> r8r_core::Result<()> {
            Ok(())
        }
    }

    #[test]
    fn a_workflow_touching_nothing_clinical_needs_no_permission() {
        let plain = workflow_with("set");
        assert!(automation().check(&plain, &authority(&[])).is_ok());
    }

    #[test]
    fn a_workflow_reading_patients_needs_the_permission_to_read_patients() {
        let clinical = workflow_with("medbrains");

        let refused = automation()
            .check(&clinical, &authority(&["billing.view"]))
            .expect_err("should refuse");

        assert_eq!(
            refused,
            RefusedError::Permission { node: "Clinical".into(), permission: "patients.view" }
        );
    }

    #[test]
    fn the_same_workflow_is_allowed_once_the_authority_covers_it() {
        let clinical = workflow_with("medbrains");
        assert!(automation().check(&clinical, &authority(&["patients.view"])).is_ok());
    }

    #[test]
    fn a_disabled_node_does_not_require_its_permission() {
        // A node that cannot run cannot read anything.
        let mut clinical = workflow_with("medbrains");
        if let Some(node) = clinical.nodes.get_mut(1) {
            node.disabled = true;
        }
        assert!(automation().check(&clinical, &authority(&[])).is_ok());
    }

    #[tokio::test]
    async fn a_refusal_is_recorded_as_a_failed_run_not_a_crash() {
        let clinical = workflow_with("medbrains");

        let result =
            automation().run(&clinical, &authority(&[]), ExecutionMode::Schedule, vec![json!({})]).await;

        assert_eq!(result.status, ExecutionStatus::Error);
        assert!(result.error.unwrap().contains("patients.view"));
        assert!(result.runs.is_empty(), "nothing should have started");
    }

    #[tokio::test]
    async fn a_permitted_workflow_actually_runs() {
        let plain = workflow_with("set");

        let result =
            automation().run(&plain, &authority(&[]), ExecutionMode::Manual, vec![json!({})]).await;

        assert_eq!(result.status, ExecutionStatus::Success);
        assert_eq!(result.runs.len(), 2);
    }

    #[tokio::test]
    async fn the_guard_bounds_what_automation_can_consume() {
        let automation = automation();
        assert_eq!(automation.guard().limit(), 2);

        let first = automation.guard().try_admit().expect("a slot");
        let _second = automation.guard().try_admit().expect("a slot");

        assert!(
            automation.guard().try_admit().is_none(),
            "automation must not exceed its ceiling"
        );
        drop(first);
    }

    #[test]
    fn the_catalog_is_available_for_the_editor_to_render() {
        let automation = automation();
        assert!(automation.node_types().len() >= 15);
        assert!(!automation.credential_types().is_empty());
    }
}
