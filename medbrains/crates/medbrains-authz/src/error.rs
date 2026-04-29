use thiserror::Error;

/// Errors emitted by the authz engine. Routes typically map these to AppError.
#[derive(Debug, Error)]
pub enum AuthzError {
    /// The subject does not hold the requested relation on the object.
    #[error("forbidden: subject lacks {relation} on {object_type}:{object_id}")]
    Forbidden {
        relation: String,
        object_type: String,
        object_id: uuid::Uuid,
    },

    /// Object type is not registered in EntityShareSpec.
    #[error("unknown object_type '{0}' — register in medbrains-core/src/sharing/registry.rs")]
    UnknownObjectType(String),

    /// Relation is not allowed for this object_type per the registry.
    #[error("relation '{relation}' not permitted on object_type '{object_type}'")]
    InvalidRelation {
        relation: String,
        object_type: String,
    },

    /// Caveat predicate evaluator rejected the grant at check time.
    #[error("caveat failed: {0}")]
    CaveatFailed(String),

    /// Tuple lookup graph hit the depth limit on tuple_set rewrites.
    #[error("expansion depth limit exceeded ({0})")]
    ExpansionDepthExceeded(u8),

    /// Backend-level failure (DB, cache, etc.).
    #[error("backend error: {0}")]
    Backend(#[from] sqlx::Error),

    /// Catch-all.
    #[error("authz: {0}")]
    Other(String),
}
