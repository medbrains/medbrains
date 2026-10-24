//! The generated types must put exactly the same bytes on the wire as the
//! `spicedb-rs-proto` 1.49.2 types they replace. The hex below was produced by
//! encoding these same values with that crate; a field renumbered, renamed into
//! a different tag, or dropped would change it.
#![allow(clippy::unwrap_used)]

use medbrains_spicedb_proto::authzed::api::v1 as v1;
use medbrains_spicedb_proto::google::rpc::Status;
use prost::Message;

fn obj(t: &str, id: &str) -> v1::ObjectReference {
    v1::ObjectReference { object_type: t.into(), object_id: id.into() }
}

fn subj(t: &str, id: &str) -> v1::SubjectReference {
    v1::SubjectReference { object: Some(obj(t, id)), optional_relation: String::new() }
}

fn full() -> v1::Consistency {
    v1::Consistency { requirement: Some(v1::consistency::Requirement::FullyConsistent(true)) }
}

fn item(id: &str, permission: &str) -> v1::CheckBulkPermissionsRequestItem {
    v1::CheckBulkPermissionsRequestItem {
        resource: Some(obj("patient", id)),
        permission: permission.into(),
        subject: Some(subj("user", "u")),
        context: None,
    }
}

const CHECK_REQ: &str = "0a022001120e0a0770617469656e7412033435361a0476696577220d0a0b0a04757365721203313233";
const BULK_REQ: &str = "0a02200112210a0c0a0770617469656e741201311204766965771a0b0a090a047573657212017512210a0c0a0770617469656e741201321204656469741a0b0a090a0475736572120175";
const LOOKUP_REQ: &str = "0a022001120770617469656e741a0476696577220d0a0b0a0475736572120331323330f403";
const CHECK_RESP: &str = "0a0e0a0c4767594b42454e4b5154303d1002";
const BULK_RESP: &str = "12270a210a0c0a0770617469656e741201311204766965771a0b0a090a04757365721201751202080212320a210a0c0a0770617469656e741201321204656469741a0b0a090a04757365721201751a0d080512096e6f7420666f756e64";
const LOOKUP_RESP: &str = "120334353618012a060a046e657874";

#[test]
fn check_permission_request_encodes_identically() {
    let req = v1::CheckPermissionRequest {
        consistency: Some(full()),
        resource: Some(obj("patient", "456")),
        permission: "view".into(),
        subject: Some(subj("user", "123")),
        ..Default::default()
    };
    assert_eq!(hex::encode(req.encode_to_vec()), CHECK_REQ);
}

#[test]
fn bulk_check_request_encodes_identically() {
    let req = v1::CheckBulkPermissionsRequest {
        consistency: Some(full()),
        items: vec![item("1", "view"), item("2", "edit")],
        ..Default::default()
    };
    assert_eq!(hex::encode(req.encode_to_vec()), BULK_REQ);
}

#[test]
fn lookup_resources_request_encodes_identically() {
    let req = v1::LookupResourcesRequest {
        consistency: Some(full()),
        resource_object_type: "patient".into(),
        permission: "view".into(),
        subject: Some(subj("user", "123")),
        optional_limit: 500,
        ..Default::default()
    };
    assert_eq!(hex::encode(req.encode_to_vec()), LOOKUP_REQ);
}

#[test]
fn check_permission_response_decodes_to_the_same_verdict() {
    let resp = v1::CheckPermissionResponse::decode(hex::decode(CHECK_RESP).unwrap().as_slice()).unwrap();
    assert_eq!(
        resp.permissionship(),
        v1::check_permission_response::Permissionship::HasPermission
    );
    assert_eq!(resp.checked_at.unwrap().token, "GgYKBENKQT0=");
}

#[test]
fn bulk_check_response_keeps_each_pair_and_its_error() {
    let resp =
        v1::CheckBulkPermissionsResponse::decode(hex::decode(BULK_RESP).unwrap().as_slice()).unwrap();
    assert_eq!(resp.pairs.len(), 2);
    assert_eq!(resp.pairs[0].request, Some(item("1", "view")));
    match &resp.pairs[0].response {
        Some(v1::check_bulk_permissions_pair::Response::Item(i)) => assert_eq!(
            i.permissionship(),
            v1::check_permission_response::Permissionship::HasPermission
        ),
        other => panic!("expected an item, got {other:?}"),
    }
    // A per-item error stays an error — it must never read as "no permission".
    match &resp.pairs[1].response {
        Some(v1::check_bulk_permissions_pair::Response::Error(Status { code, message, .. })) => {
            assert_eq!((*code, message.as_str()), (5, "not found"));
        }
        other => panic!("expected an error, got {other:?}"),
    }
}

#[test]
fn lookup_resources_response_decodes_id_and_cursor() {
    let resp =
        v1::LookupResourcesResponse::decode(hex::decode(LOOKUP_RESP).unwrap().as_slice()).unwrap();
    assert_eq!(resp.resource_object_id, "456");
    assert_eq!(resp.permissionship(), v1::LookupPermissionship::HasPermission);
    assert_eq!(resp.after_result_cursor.unwrap().token, "next");
}
