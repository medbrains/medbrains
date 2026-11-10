//! Substitutes the pharmacy proposed on online orders, in the prescribing
//! doctor's sign-off queue (storefront part 2, #4864). A decision, not a
//! signature: listed only for a doctor who may make it. One agreed by phone
//! carries its 24-hour confirmation deadline as a telephone order does, so
//! it sorts to the top with the other countersigns.

use medbrains_core::permissions;
use medbrains_server_core::{
    error::AppError, middleware::auth::Claims, middleware::authorization::is_bypass_role,
};
use sqlx::{Postgres, Transaction};

use crate::doctor_dashboard::PendingSignoffEntry;

fn may_decide(claims: &Claims) -> bool {
    is_bypass_role(claims)
        || claims
            .permissions
            .iter()
            .any(|p| p == permissions::doctor::store_substitutions::DECIDE)
}

/// How many wait for this doctor.
pub(crate) async fn count(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
) -> Result<i64, AppError> {
    if !may_decide(claims) {
        return Ok(0);
    }
    Ok(sqlx::query_scalar(
        "SELECT COUNT(*)::bigint FROM pharmacy_substitution_requests \
         WHERE tenant_id = $1 AND doctor_id = $2 \
           AND status IN ('with_doctor', 'phone_pending') AND deleted_at IS NULL",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_one(&mut **tx)
    .await?)
}

/// The requests waiting for this doctor, as sign-off entries.
pub(crate) async fn pending(
    tx: &mut Transaction<'_, Postgres>,
    claims: &Claims,
) -> Result<Vec<PendingSignoffEntry>, AppError> {
    if !may_decide(claims) {
        return Ok(Vec::new());
    }
    Ok(sqlx::query_as::<_, PendingSignoffEntry>(
        "SELECT 'store_substitution' AS record_type, r.id AS record_id, \
                r.created_at, 'clinical' AS legal_class, o.patient_id, \
                CONCAT_WS(' ', NULLIF(pat.prefix, ''), pat.first_name, \
                          NULLIF(pat.middle_name, ''), pat.last_name) AS patient_name, \
                pat.uhid, CONCAT(sub.name, ' instead of ', orig.name) AS summary, \
                CONCAT('Online order · ', r.reason) AS context, \
                CASE WHEN r.status = 'phone_pending' THEN 'Agreed by phone: confirm' END \
                  AS risk_label, \
                CASE WHEN r.status = 'phone_pending' THEN 'telephone' END AS order_mode, \
                r.confirm_due_at AS countersign_due_at, NULL::boolean AS transcribed \
           FROM pharmacy_substitution_requests r \
           JOIN pharmacy_store_orders o ON o.id = r.store_order_id AND o.tenant_id = r.tenant_id \
           JOIN patients pat ON pat.id = o.patient_id AND pat.tenant_id = r.tenant_id \
           JOIN pharmacy_catalog orig ON orig.id = r.original_item_id AND orig.tenant_id = r.tenant_id \
           JOIN pharmacy_catalog sub ON sub.id = r.substitute_item_id AND sub.tenant_id = r.tenant_id \
          WHERE r.tenant_id = $1 AND r.doctor_id = $2 \
            AND r.status IN ('with_doctor', 'phone_pending') AND r.deleted_at IS NULL \
          ORDER BY r.created_at LIMIT 200",
    )
    .bind(claims.tenant_id)
    .bind(claims.sub)
    .fetch_all(&mut **tx)
    .await?)
}
