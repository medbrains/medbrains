//! In-memory `AuthzBackend` for unit tests. No SQL, no transactions.

use async_trait::async_trait;
use std::sync::Mutex;
use uuid::Uuid;

use crate::{
    AuthzBackend, AuthzContext, AuthzError, RelationTuple, Subject, TupleSource, TupleStatus,
    registry, relations::Relation,
};

#[derive(Debug, Default)]
pub struct InMemoryBackend {
    tuples: Mutex<Vec<RelationTuple>>,
}

impl InMemoryBackend {
    pub fn new() -> Self {
        Self::default()
    }

    fn matches(t: &RelationTuple, ctx: &AuthzContext, target_relations: &[Relation]) -> bool {
        if t.tenant_id != ctx.tenant_id {
            return false;
        }
        if t.status != TupleStatus::Active {
            return false;
        }
        if let Some(exp) = t.expires_at {
            if exp <= chrono::Utc::now() {
                return false;
            }
        }
        let rel_codes: Vec<&str> = target_relations.iter().map(|r| r.as_code()).collect();
        if !rel_codes.contains(&t.relation.as_str()) {
            return false;
        }
        match &t.subject {
            Subject::User(u) => *u == ctx.user_id,
            Subject::Role(r) => r == &ctx.role,
            Subject::Department(d) => ctx.department_ids.contains(d),
            Subject::Group(_) => false, // TODO: model groups in tests when needed
            Subject::TupleSet(_) => false, // depth-limited rewrite in Phase 3.3
        }
    }
}

#[async_trait]
impl AuthzBackend for InMemoryBackend {
    async fn check(
        &self,
        ctx: &AuthzContext,
        relation: Relation,
        object_type: &str,
        object_id: Uuid,
    ) -> Result<bool, AuthzError> {
        if ctx.is_bypass {
            return Ok(true);
        }
        let spec = registry::lookup(object_type)
            .ok_or_else(|| AuthzError::UnknownObjectType(object_type.to_string()))?;
        if !spec.allowed_relations.contains(&relation) {
            return Err(AuthzError::InvalidRelation {
                relation: relation.as_code().to_string(),
                object_type: object_type.to_string(),
            });
        }
        let candidates: Vec<Relation> = relation.implied_by();
        let tuples = self.tuples.lock().expect("authz test backend lock poisoned");
        Ok(tuples.iter().any(|t| {
            t.object_type == object_type
                && t.object_id == object_id
                && Self::matches(t, ctx, &candidates)
        }))
    }

    async fn expand(
        &self,
        ctx: &AuthzContext,
        object_type: &str,
        object_id: Uuid,
    ) -> Result<Vec<RelationTuple>, AuthzError> {
        let tuples = self.tuples.lock().expect("authz test backend lock poisoned");
        Ok(tuples
            .iter()
            .filter(|t| {
                t.tenant_id == ctx.tenant_id
                    && t.object_type == object_type
                    && t.object_id == object_id
            })
            .cloned()
            .collect())
    }

    async fn list_accessible(
        &self,
        ctx: &AuthzContext,
        object_type: &str,
        relation: Relation,
    ) -> Result<Vec<Uuid>, AuthzError> {
        if ctx.is_bypass {
            return Ok(Vec::new());
        }
        let candidates: Vec<Relation> = relation.implied_by();
        let tuples = self.tuples.lock().expect("authz test backend lock poisoned");
        let mut ids: Vec<Uuid> = tuples
            .iter()
            .filter(|t| t.object_type == object_type && Self::matches(t, ctx, &candidates))
            .map(|t| t.object_id)
            .collect();
        ids.sort();
        ids.dedup();
        Ok(ids)
    }

    async fn write_tuple(
        &self,
        ctx: &AuthzContext,
        object_type: &str,
        object_id: Uuid,
        relation: Relation,
        subject: Subject,
        expires_at: Option<chrono::DateTime<chrono::Utc>>,
        reason: Option<String>,
    ) -> Result<Uuid, AuthzError> {
        let spec = registry::lookup(object_type)
            .ok_or_else(|| AuthzError::UnknownObjectType(object_type.to_string()))?;
        if spec.bypass_only {
            return Err(AuthzError::Other(format!(
                "{object_type} is bypass_only"
            )));
        }
        if !spec.allowed_relations.contains(&relation) {
            return Err(AuthzError::InvalidRelation {
                relation: relation.as_code().to_string(),
                object_type: object_type.to_string(),
            });
        }
        let tuple_id = Uuid::new_v4();
        let tuple = RelationTuple {
            tuple_id,
            tenant_id: ctx.tenant_id,
            object_type: object_type.to_string(),
            object_id,
            relation: relation.as_code().to_string(),
            subject,
            caveat: None,
            expires_at,
            status: TupleStatus::Active,
            granted_by: ctx.user_id,
            granted_at: chrono::Utc::now(),
            granted_reason: reason,
            source: TupleSource::Explicit,
            derived_from: None,
        };
        self.tuples
            .lock()
            .expect("authz test backend lock poisoned")
            .push(tuple);
        Ok(tuple_id)
    }

    async fn revoke_tuple(&self, ctx: &AuthzContext, tuple_id: Uuid) -> Result<(), AuthzError> {
        let mut tuples = self.tuples.lock().expect("authz test backend lock poisoned");
        if let Some(t) = tuples.iter_mut().find(|t| {
            t.tuple_id == tuple_id && t.tenant_id == ctx.tenant_id && t.status == TupleStatus::Active
        }) {
            t.status = TupleStatus::Revoked;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ctx(tenant: Uuid, user: Uuid, role: &str) -> AuthzContext {
        AuthzContext {
            tenant_id: tenant,
            user_id: user,
            role: role.to_string(),
            department_ids: vec![],
            is_bypass: false,
        }
    }

    #[tokio::test]
    async fn user_grant_then_check() {
        let backend = InMemoryBackend::new();
        let tenant = Uuid::new_v4();
        let alice = Uuid::new_v4();
        let bob = Uuid::new_v4();
        let patient = Uuid::new_v4();

        let actx = ctx(tenant, alice, "doctor");
        let bctx = ctx(tenant, bob, "doctor");

        // Alice grants Bob viewer on patient
        backend
            .write_tuple(
                &actx,
                "patient",
                patient,
                Relation::Viewer,
                Subject::User(bob),
                None,
                None,
            )
            .await
            .unwrap();

        // Bob can now view
        assert!(
            backend
                .check(&bctx, Relation::Viewer, "patient", patient)
                .await
                .unwrap()
        );
    }

    #[tokio::test]
    async fn editor_implies_viewer() {
        let backend = InMemoryBackend::new();
        let tenant = Uuid::new_v4();
        let alice = Uuid::new_v4();
        let bob = Uuid::new_v4();
        let patient = Uuid::new_v4();

        backend
            .write_tuple(
                &ctx(tenant, alice, "doctor"),
                "patient",
                patient,
                Relation::Editor,
                Subject::User(bob),
                None,
                None,
            )
            .await
            .unwrap();

        // Bob has Editor → also has Viewer
        let bctx = ctx(tenant, bob, "doctor");
        assert!(
            backend
                .check(&bctx, Relation::Viewer, "patient", patient)
                .await
                .unwrap()
        );
    }

    #[tokio::test]
    async fn bypass_role_always_passes() {
        let backend = InMemoryBackend::new();
        let mut admin = ctx(Uuid::new_v4(), Uuid::new_v4(), "super_admin");
        admin.is_bypass = true;
        // No tuples written — bypass still passes.
        assert!(
            backend
                .check(&admin, Relation::Viewer, "patient", Uuid::new_v4())
                .await
                .unwrap()
        );
    }

    #[tokio::test]
    async fn unknown_object_type_rejected() {
        let backend = InMemoryBackend::new();
        let c = ctx(Uuid::new_v4(), Uuid::new_v4(), "doctor");
        let r = backend
            .check(&c, Relation::Viewer, "not_a_thing", Uuid::new_v4())
            .await;
        assert!(matches!(r, Err(AuthzError::UnknownObjectType(_))));
    }

    #[tokio::test]
    async fn revoke_blocks_check() {
        let backend = InMemoryBackend::new();
        let tenant = Uuid::new_v4();
        let alice = Uuid::new_v4();
        let bob = Uuid::new_v4();
        let patient = Uuid::new_v4();

        let actx = ctx(tenant, alice, "doctor");
        let bctx = ctx(tenant, bob, "doctor");

        let tuple_id = backend
            .write_tuple(
                &actx,
                "patient",
                patient,
                Relation::Viewer,
                Subject::User(bob),
                None,
                None,
            )
            .await
            .unwrap();

        assert!(
            backend
                .check(&bctx, Relation::Viewer, "patient", patient)
                .await
                .unwrap()
        );

        backend.revoke_tuple(&actx, tuple_id).await.unwrap();

        assert!(
            !backend
                .check(&bctx, Relation::Viewer, "patient", patient)
                .await
                .unwrap()
        );
    }
}
