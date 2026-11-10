//! One adapter per knowledge shape (RFC §3.2). The engine is generic over
//! this trait; phase 1 has two implementations and later phases add more.

use serde::{Serialize, de::DeserializeOwned};
use uuid::Uuid;

use crate::model::{KnowledgeImpactEntry, Op};
use medbrains_server_core::error::AppError;

pub(crate) type Tx<'a> = sqlx::Transaction<'a, sqlx::Postgres>;

/// One item with its rows parsed into the adapter's shape.
#[derive(Debug, Clone)]
pub(crate) struct Planned<R> {
    pub op: Op,
    pub target: Option<Uuid>,
    pub before: Option<R>,
    pub after: Option<R>,
}

pub(crate) trait Adapter {
    /// `knowledge_change_items.target_kind`: the table the item edits.
    const KIND: &'static str;
    /// Holding any one of these lets a user propose items for the area.
    const MANAGE: &'static [&'static str];
    /// The editable fields of one row, `is_active` included.
    type Row: Serialize + DeserializeOwned + PartialEq + Clone + Send + Sync + Unpin;
    /// What `observe` reads, before and after the edits.
    type State: Send;

    fn validate(row: &Self::Row) -> Result<(), String>;

    /// The checks that need the database (a flow track's six checks), run
    /// when a set is created, previewed and applied. The inner `Err` is the
    /// refusal in words; the outer one a fault.
    async fn check(
        _tx: &mut Tx<'_>,
        _tenant: Uuid,
        _row: &Self::Row,
    ) -> Result<Result<(), String>, AppError> {
        Ok(Ok(()))
    }

    /// `row` as a delete leaves it.
    fn deactivated(row: &Self::Row) -> Self::Row;

    /// Active live rows, for the editor.
    async fn list(tx: &mut Tx<'_>, tenant: Uuid) -> Result<Vec<(Uuid, Self::Row)>, sqlx::Error>;

    /// The live row an item would change, locked: by id, or for a create the
    /// active row with the same natural key (which must not exist).
    async fn current(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        target: Option<Uuid>,
        after: Option<&Self::Row>,
    ) -> Result<Option<Self::Row>, sqlx::Error>;

    /// Make one edit; returns the row's id.
    async fn write(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        op: Op,
        target: Option<Uuid>,
        after: Option<&Self::Row>,
    ) -> Result<Uuid, sqlx::Error>;

    /// What the runtime readers would see, for the keys the items touch.
    async fn observe(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        items: &[Planned<Self::Row>],
    ) -> Result<Self::State, sqlx::Error>;

    /// Who is affected by moving from `before` to `after`.
    async fn impact(
        tx: &mut Tx<'_>,
        tenant: Uuid,
        items: &[Planned<Self::Row>],
        before: Self::State,
        after: Self::State,
    ) -> Result<Vec<KnowledgeImpactEntry>, sqlx::Error>;
}

/// "1 prescription", "14 prescriptions".
pub(crate) fn plural(n: i64, one: &str, many: &str) -> String {
    format!("{n} {}", if n == 1 { one } else { many })
}
