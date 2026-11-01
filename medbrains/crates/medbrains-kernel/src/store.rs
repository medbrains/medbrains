//! Storage: the object store with tenant-scoped keys.
//!
//! Wraps `medbrains_core::object_store::ObjectStore` (S3 in the cloud, local
//! disk on premises). Every key is prefixed with the unit of work's tenant —
//! the `{tenant_id}/…` convention uploads already follow — so one hospital
//! cannot name another's objects.

use medbrains_core::object_store::ObjectStore;
use uuid::Uuid;

use crate::{AppError, Tx};

/// The stored key for `key` under `tenant_id`. Refuses keys that could climb
/// out of the prefix.
fn tenant_key(tenant_id: Uuid, key: &str) -> Result<String, AppError> {
    let climbs = key
        .split('/')
        .any(|part| part.is_empty() || part == "." || part == "..");
    if climbs || key.contains('\\') {
        return Err(AppError::BadRequest(format!("invalid object key '{key}'")));
    }
    Ok(format!("{tenant_id}/{key}"))
}

/// Store `bytes` at `key` for this hospital.
#[inline]
pub async fn put<S: ObjectStore + ?Sized>(
    store: &S,
    tx: &Tx,
    key: &str,
    bytes: Vec<u8>,
) -> Result<(), AppError> {
    let full = tenant_key(tx.actor().tenant_id, key)?;
    store
        .put(&full, bytes, None)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))
}

/// Read the object at `key` for this hospital.
#[inline]
pub async fn get<S: ObjectStore + ?Sized>(
    store: &S,
    tx: &Tx,
    key: &str,
) -> Result<Vec<u8>, AppError> {
    let full = tenant_key(tx.actor().tenant_id, key)?;
    store.get(&full).await.map_err(|e| match e {
        medbrains_core::object_store::ObjectStoreError::NotFound(_) => AppError::NotFound,
        other => AppError::Internal(other.to_string()),
    })
}

#[cfg(test)]
mod tests {
    use super::tenant_key;
    use uuid::Uuid;

    #[test]
    fn keys_live_under_the_tenant_and_cannot_climb_out() {
        let tenant = Uuid::nil();
        assert_eq!(
            tenant_key(tenant, "grn/scan.pdf").ok().as_deref(),
            Some("00000000-0000-0000-0000-000000000000/grn/scan.pdf")
        );
        for bad in ["../other/x", "a/../../b", "/abs", "a//b", "a\\b", ""] {
            assert!(
                tenant_key(tenant, bad).is_err(),
                "{bad:?} should be refused"
            );
        }
    }
}
