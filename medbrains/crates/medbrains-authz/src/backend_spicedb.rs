//! SpiceDB backend — gRPC client implementation of `AuthzBackend`.
//!
//! Talks to the `authzed/spicedb` sidecar over gRPC. Schema lives in
//! `infra/spicedb/schema.zed`; tuples are stored in SpiceDB's own
//! Postgres database (NOT our application Postgres). The on-disk
//! `relation_tuples` table from migration 129 stays around as a
//! write-ahead audit copy + fallback, but isn't the source of truth
//! for resolution.
//!
//! Concurrency: the `Client` is cheaply clonable (it holds a tonic
//! channel), so we wrap it in `Arc<Self>` rather than mutexing.

use std::sync::Arc;

use async_trait::async_trait;
use spicedb_rs_proto::authzed::api::v1::{
    self as v1,
    permissions_service_client::PermissionsServiceClient,
    relationship_update::Operation as TupleOp,
};
use tonic::{
    Request,
    metadata::MetadataValue,
    service::{Interceptor, interceptor::InterceptedService},
    transport::{Channel, Endpoint},
};
use uuid::Uuid;

use crate::{
    AuthzBackend, AuthzContext, AuthzError, RelationTuple, Subject, TupleSource, TupleStatus,
    relations::Relation,
};

const DEFAULT_LIMIT: u32 = 1000;

#[derive(Clone)]
pub struct SpiceDbBackend {
    client: Arc<PermissionsServiceClient<InterceptedService<Channel, BearerAuth>>>,
}

#[derive(Clone)]
pub struct BearerAuth {
    token: MetadataValue<tonic::metadata::Ascii>,
}

impl Interceptor for BearerAuth {
    fn call(
        &mut self,
        mut req: tonic::Request<()>,
    ) -> Result<tonic::Request<()>, tonic::Status> {
        req.metadata_mut()
            .insert("authorization", self.token.clone());
        Ok(req)
    }
}

impl SpiceDbBackend {
    /// Connect to a SpiceDB endpoint with a preshared key.
    /// `endpoint` should be `http://host:port` (or `https://...` in prod).
    pub async fn connect(endpoint: &str, preshared_key: &str) -> Result<Self, AuthzError> {
        let channel = Endpoint::from_shared(endpoint.to_owned())
            .map_err(|e| AuthzError::Other(format!("bad endpoint: {e}")))?
            .connect()
            .await
            .map_err(|e| AuthzError::Other(format!("spicedb connect: {e}")))?;

        let token: MetadataValue<_> = format!("Bearer {preshared_key}")
            .parse()
            .map_err(|e| AuthzError::Other(format!("bad bearer token: {e}")))?;

        let auth = BearerAuth { token };
        let client = PermissionsServiceClient::with_interceptor(channel, auth);

        Ok(Self {
            client: Arc::new(client),
        })
    }

    /// Build the SubjectReference from an `AuthzContext`. The user is the
    /// "primary" subject; group / dept / role membership is handled
    /// inside SpiceDB via the schema's `relation` definitions, so we
    /// only ever pass `user:<uuid>` here.
    fn subject_for(ctx: &AuthzContext) -> v1::SubjectReference {
        v1::SubjectReference {
            object: Some(v1::ObjectReference {
                object_type: "user".to_owned(),
                object_id: ctx.user_id.to_string(),
            }),
            optional_relation: String::new(),
        }
    }

    /// Translate a `Subject` enum into the SpiceDB `SubjectReference`
    /// shape used in `WriteRelationshipsRequest`.
    fn subject_to_ref(subject: &Subject) -> v1::SubjectReference {
        match subject {
            Subject::User(id) => v1::SubjectReference {
                object: Some(v1::ObjectReference {
                    object_type: "user".to_owned(),
                    object_id: id.to_string(),
                }),
                optional_relation: String::new(),
            },
            Subject::Role(code) => v1::SubjectReference {
                object: Some(v1::ObjectReference {
                    object_type: "role".to_owned(),
                    object_id: code.clone(),
                }),
                optional_relation: String::new(),
            },
            Subject::Department(id) => v1::SubjectReference {
                object: Some(v1::ObjectReference {
                    object_type: "department".to_owned(),
                    object_id: id.to_string(),
                }),
                optional_relation: "member".to_owned(),
            },
            Subject::Group(id) => v1::SubjectReference {
                object: Some(v1::ObjectReference {
                    object_type: "access_group".to_owned(),
                    object_id: id.to_string(),
                }),
                optional_relation: "member".to_owned(),
            },
            Subject::TupleSet(spec) => {
                // "<object_type>:<object_id>#<relation>" → split it out
                let (left, rel) = spec.split_once('#').unwrap_or((spec.as_str(), ""));
                let (otype, oid) = left.split_once(':').unwrap_or((left, ""));
                v1::SubjectReference {
                    object: Some(v1::ObjectReference {
                        object_type: otype.to_owned(),
                        object_id: oid.to_owned(),
                    }),
                    optional_relation: rel.to_owned(),
                }
            }
        }
    }

    /// Default consistency hint: minimize_latency. Mutations use
    /// fully_consistent below.
    fn read_consistency() -> v1::Consistency {
        v1::Consistency {
            requirement: Some(v1::consistency::Requirement::MinimizeLatency(true)),
        }
    }
}

/// Map our `Relation` enum to a SpiceDB **permission** name (used by
/// `check_permission` / `lookup_resources`). The schema in
/// `infra/spicedb/schema.zed` defines `permission view = owner + ...`,
/// `permission edit = ...`, etc., so a request for `Relation::Viewer`
/// translates to permission `"view"` and gets the implied-by-owner
/// resolution for free.
fn relation_to_permission(rel: Relation) -> &'static str {
    match rel {
        Relation::Owner => "delete",
        Relation::Editor => "edit",
        Relation::Viewer => "view",
        Relation::AttendingPhysician => "edit",
        Relation::Consultant => "view",
        Relation::Phlebotomist => "view",
        Relation::Nurse => "view",
        Relation::ReferredTo => "view",
        Relation::FollowupAssignee => "view",
        Relation::Approver => "edit",
        Relation::Auditor => "view",
        Relation::BillingViewer => "view",
        Relation::BillingEditor => "edit",
    }
}

/// Map our `Relation` enum to a SpiceDB **relation** name (used by
/// `write_relationships` / `delete_relationships`). These match the
/// `relation X: user` declarations in `schema.zed`. Note the divergence
/// from `relation_to_permission` above — `Relation::Viewer` writes a
/// `viewer` relation tuple, but checks resolve via the `view`
/// permission expansion.
fn relation_to_relname(rel: Relation) -> &'static str {
    match rel {
        Relation::Owner => "owner",
        Relation::Editor => "editor",
        Relation::Viewer => "viewer",
        Relation::AttendingPhysician => "attending",
        Relation::Consultant => "viewer",
        Relation::Phlebotomist => "viewer",
        Relation::Nurse => "viewer",
        Relation::ReferredTo => "viewer",
        Relation::FollowupAssignee => "viewer",
        Relation::Approver => "editor",
        Relation::Auditor => "viewer",
        Relation::BillingViewer => "viewer",
        Relation::BillingEditor => "editor",
    }
}

#[async_trait]
impl AuthzBackend for SpiceDbBackend {
    async fn check(
        &self,
        ctx: &AuthzContext,
        relation: Relation,
        object_type: &str,
        object_id: Uuid,
    ) -> Result<bool, AuthzError> {
        // Bypass roles never hit SpiceDB. The middleware sets
        // `is_bypass=true` for super_admin / hospital_admin.
        if ctx.is_bypass {
            return Ok(true);
        }

        let permission = relation_to_permission(relation).to_owned();
        let req = v1::CheckPermissionRequest {
            consistency: Some(v1::Consistency {
                requirement: Some(v1::consistency::Requirement::FullyConsistent(true)),
            }),
            resource: Some(v1::ObjectReference {
                object_type: object_type.to_owned(),
                object_id: object_id.to_string(),
            }),
            permission: permission.clone(),
            subject: Some(Self::subject_for(ctx)),
            context: None,
            with_tracing: false,
        };

        let mut client = (*self.client).clone();
        let resp = client
            .check_permission(Request::new(req))
            .await
            .map_err(|e| AuthzError::Other(format!("check_permission: {e}")))?
            .into_inner();

        use v1::check_permission_response::Permissionship;
        let _ = permission;
        Ok(matches!(
            Permissionship::try_from(resp.permissionship),
            Ok(Permissionship::HasPermission | Permissionship::ConditionalPermission)
        ))
    }

    async fn expand(
        &self,
        _ctx: &AuthzContext,
        object_type: &str,
        object_id: Uuid,
    ) -> Result<Vec<RelationTuple>, AuthzError> {
        // Read all relationships on this object via ReadRelationships.
        let req = v1::ReadRelationshipsRequest {
            consistency: Some(Self::read_consistency()),
            relationship_filter: Some(v1::RelationshipFilter {
                resource_type: object_type.to_owned(),
                optional_resource_id: object_id.to_string(),
                optional_relation: String::new(),
                optional_resource_id_prefix: String::new(),
                optional_subject_filter: None,
            }),
            optional_limit: DEFAULT_LIMIT,
            optional_cursor: None,
        };

        let mut client = (*self.client).clone();
        let mut stream = client
            .read_relationships(Request::new(req))
            .await
            .map_err(|e| AuthzError::Other(format!("read_relationships: {e}")))?
            .into_inner();

        let mut out = Vec::new();
        while let Some(msg) = stream
            .message()
            .await
            .map_err(|e| AuthzError::Other(format!("read_relationships stream: {e}")))?
        {
            if let Some(rel) = msg.relationship {
                if let Some(tuple) = relationship_to_tuple(rel) {
                    out.push(tuple);
                }
            }
        }
        Ok(out)
    }

    async fn list_accessible(
        &self,
        ctx: &AuthzContext,
        object_type: &str,
        relation: Relation,
    ) -> Result<Vec<Uuid>, AuthzError> {
        // Bypass: caller wants every object. We return Vec::new() and
        // let the handler interpret that as "no filter" by checking
        // ctx.is_bypass directly. (Returning all UUIDs is wasteful.)
        if ctx.is_bypass {
            return Ok(Vec::new());
        }

        let req = v1::LookupResourcesRequest {
            consistency: Some(v1::Consistency {
                requirement: Some(v1::consistency::Requirement::FullyConsistent(true)),
            }),
            resource_object_type: object_type.to_owned(),
            permission: relation_to_permission(relation).to_owned(),
            subject: Some(Self::subject_for(ctx)),
            context: None,
            optional_limit: 0,
            optional_cursor: None,
        };

        let mut client = (*self.client).clone();
        let mut stream = client
            .lookup_resources(Request::new(req))
            .await
            .map_err(|e| AuthzError::Other(format!("lookup_resources: {e}")))?
            .into_inner();

        let mut out = Vec::new();
        while let Some(msg) = stream
            .message()
            .await
            .map_err(|e| AuthzError::Other(format!("lookup_resources stream: {e}")))?
        {
            if let Ok(uuid) = Uuid::parse_str(&msg.resource_object_id) {
                out.push(uuid);
            }
        }
        Ok(out)
    }

    async fn write_tuple(
        &self,
        _ctx: &AuthzContext,
        object_type: &str,
        object_id: Uuid,
        relation: Relation,
        subject: Subject,
        expires_at: Option<chrono::DateTime<chrono::Utc>>,
        _reason: Option<String>,
    ) -> Result<Uuid, AuthzError> {
        let optional_expires_at = expires_at.map(|t| prost_types::Timestamp {
            seconds: t.timestamp(),
            nanos: t.timestamp_subsec_nanos() as i32,
        });

        let relationship = v1::Relationship {
            resource: Some(v1::ObjectReference {
                object_type: object_type.to_owned(),
                object_id: object_id.to_string(),
            }),
            relation: relation_to_relname(relation).to_owned(),
            subject: Some(Self::subject_to_ref(&subject)),
            optional_caveat: None,
            optional_expires_at,
        };

        let req = v1::WriteRelationshipsRequest {
            updates: vec![v1::RelationshipUpdate {
                operation: TupleOp::Touch as i32, // upsert — idempotent
                relationship: Some(relationship),
            }],
            optional_preconditions: vec![],
            optional_transaction_metadata: None,
        };

        let mut client = (*self.client).clone();
        client
            .write_relationships(Request::new(req))
            .await
            .map_err(|e| AuthzError::Other(format!("write_relationships: {e}")))?;

        // SpiceDB tuples don't have a sortable id; the caller usually
        // doesn't need one back, but the trait demands a Uuid so we
        // return a deterministic hash of the (object,relation,subject).
        Ok(synthetic_tuple_id(object_type, object_id, &relation, &subject))
    }

    async fn revoke_tuple(
        &self,
        _ctx: &AuthzContext,
        _tuple_id: Uuid,
    ) -> Result<(), AuthzError> {
        // SpiceDB doesn't have tuple-id-based deletes — the client
        // identifies tuples by (resource, relation, subject). Callers
        // who need to revoke must use `revoke_specific` below; the
        // trait method is left as Other(...) so misuse is loud.
        Err(AuthzError::Other(
            "use SpiceDbBackend::revoke_specific(object,relation,subject) — \
             the trait revoke_tuple isn't supported on SpiceDB backend"
                .to_owned(),
        ))
    }
}

impl SpiceDbBackend {
    /// SpiceDB-native revoke: matches by (resource, relation, subject)
    /// rather than by tuple id (which SpiceDB doesn't expose).
    pub async fn revoke_specific(
        &self,
        object_type: &str,
        object_id: Uuid,
        relation: Relation,
        subject: Subject,
    ) -> Result<(), AuthzError> {
        let relationship = v1::Relationship {
            resource: Some(v1::ObjectReference {
                object_type: object_type.to_owned(),
                object_id: object_id.to_string(),
            }),
            relation: relation_to_relname(relation).to_owned(),
            subject: Some(Self::subject_to_ref(&subject)),
            optional_caveat: None,
            optional_expires_at: None,
        };

        let req = v1::WriteRelationshipsRequest {
            updates: vec![v1::RelationshipUpdate {
                operation: TupleOp::Delete as i32,
                relationship: Some(relationship),
            }],
            optional_preconditions: vec![],
            optional_transaction_metadata: None,
        };

        let mut client = (*self.client).clone();
        client
            .write_relationships(Request::new(req))
            .await
            .map_err(|e| AuthzError::Other(format!("delete (write_relationships): {e}")))?;
        Ok(())
    }
}

/// Convert a SpiceDB `Relationship` into our internal `RelationTuple`.
/// Loses some metadata (granted_by, granted_reason) that SpiceDB
/// doesn't track natively — those live in our audit_log.
fn relationship_to_tuple(rel: v1::Relationship) -> Option<RelationTuple> {
    let resource = rel.resource?;
    let subject_ref = rel.subject?;
    let subject_obj = subject_ref.object?;

    let object_id = Uuid::parse_str(&resource.object_id).ok()?;
    let subject = subject_ref_to_subject(&subject_obj.object_type, &subject_obj.object_id);

    Some(RelationTuple {
        tuple_id: _synthetic_tuple_id_str(&resource.object_type, object_id, &rel.relation, &subject),
        // SpiceDB's tenancy lives in object_id prefix (we use bare uuids,
        // so tenant context is implicit in the AuthzContext).
        tenant_id: Uuid::nil(),
        object_type: resource.object_type,
        object_id,
        relation: rel.relation,
        subject,
        caveat: None,
        expires_at: rel.optional_expires_at.map(|ts| {
            chrono::DateTime::from_timestamp(ts.seconds, ts.nanos as u32)
                .unwrap_or_else(chrono::Utc::now)
        }),
        status: TupleStatus::Active,
        granted_by: Uuid::nil(),
        granted_at: chrono::Utc::now(),
        granted_reason: None,
        source: TupleSource::Explicit,
        derived_from: None,
    })
}

fn subject_ref_to_subject(object_type: &str, object_id: &str) -> Subject {
    match object_type {
        "user" => Uuid::parse_str(object_id).map_or_else(
            |_| Subject::Role(object_id.to_owned()),
            Subject::User,
        ),
        "role" => Subject::Role(object_id.to_owned()),
        "department" => Subject::Department(
            Uuid::parse_str(object_id).unwrap_or_else(|_| Uuid::nil()),
        ),
        "access_group" => {
            Subject::Group(Uuid::parse_str(object_id).unwrap_or_else(|_| Uuid::nil()))
        }
        _ => Subject::TupleSet(format!("{object_type}:{object_id}")),
    }
}

/// Stable synthetic UUID derived from the tuple coordinates. SpiceDB
/// doesn't assign tuple ids; we derive one client-side so the rest
/// of the codebase (audit log, share-revoke API) keeps working with
/// `Uuid` keys.
fn synthetic_tuple_id(
    object_type: &str,
    object_id: Uuid,
    relation: &Relation,
    subject: &Subject,
) -> Uuid {
    use sha2::{Digest, Sha256};
    let subject_str = match subject {
        Subject::User(id) => format!("user:{id}"),
        Subject::Role(code) => format!("role:{code}"),
        Subject::Department(id) => format!("dept:{id}"),
        Subject::Group(id) => format!("group:{id}"),
        Subject::TupleSet(s) => format!("set:{s}"),
    };
    let key = format!("{object_type}:{object_id}#{}@{subject_str}", relation.as_code());
    let digest = Sha256::digest(key.as_bytes());
    Uuid::from_slice(&digest[0..16]).unwrap_or_else(|_| Uuid::nil())
}

/// Same hash but takes the relation as a `&str` — convenient when
/// reading back tuples whose relation is a free-form string from
/// SpiceDB (some relations may not be in our `Relation` enum).
fn _synthetic_tuple_id_str(
    object_type: &str,
    object_id: Uuid,
    relation: &str,
    subject: &Subject,
) -> Uuid {
    use sha2::{Digest, Sha256};
    let subject_str = match subject {
        Subject::User(id) => format!("user:{id}"),
        Subject::Role(code) => format!("role:{code}"),
        Subject::Department(id) => format!("dept:{id}"),
        Subject::Group(id) => format!("group:{id}"),
        Subject::TupleSet(s) => format!("set:{s}"),
    };
    let key = format!("{object_type}:{object_id}#{relation}@{subject_str}");
    let digest = Sha256::digest(key.as_bytes());
    Uuid::from_slice(&digest[0..16]).unwrap_or_else(|_| Uuid::nil())
}

// Avoid the second helper — the relationship_to_tuple path uses the
// non-Relation variant by re-creating a string key. The compiler will
// drop _synthetic_tuple_id_str if unused; keeping it for clarity.
