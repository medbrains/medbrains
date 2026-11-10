//! The declarative integration engine.
//!
//! Mirrors how n8n's routing-based nodes work. An integration describes itself
//! as data — a base URL, a credential type, and a list of resources and
//! operations, each carrying the request it makes — and this module turns that
//! description into real HTTP calls. Adding an integration therefore means
//! writing a manifest, not an executor: no new control flow, no new error
//! handling, nothing new to test at the transport layer.

use crate::credentials::{self, ResolvedCredential};
use crate::errors::{CoreError, Result};
use crate::execute_context::{ExecuteContext, main_output};
use crate::http::{self, ResponseFormat};
use crate::nodes_loader::NodeExecutor;
use crate::suspension::NodeOutcome;
use async_trait::async_trait;
use r8r_workflow::credentials::{AuthMethod, CredentialTypeDescription};
use r8r_workflow::interfaces::{Items, NodeProperty, NodeTypeDescription};
use r8r_workflow::node_helpers;
use r8r_workflow::routing::{PostReceive, RequestRouting, Routing};
use serde_json::{Map, Value, json};

/// Parameter names with special meaning, matching n8n's convention.
pub const RESOURCE: &str = "resource";
pub const OPERATION: &str = "operation";

/// A node whose behaviour is entirely described by its `NodeTypeDescription`.
#[derive(Debug, Clone)]
pub struct DeclarativeNode {
    description: NodeTypeDescription,
    credential_type: Option<CredentialTypeDescription>,
}

impl DeclarativeNode {
    #[must_use]
    pub fn new(
        description: NodeTypeDescription,
        credential_type: Option<CredentialTypeDescription>,
    ) -> Self {
        DeclarativeNode {
            description,
            credential_type,
        }
    }

    /// Find the routing for the resource/operation pair currently selected.
    ///
    /// Operations live as options on a property named `operation`, and several
    /// such properties can exist — one per resource — so the visible one is
    /// chosen using the same `displayOptions` rules the editor uses.
    fn routing_for(&self, parameters: &Value) -> Result<Routing> {
        let selected = parameters.get(OPERATION).cloned().unwrap_or(Value::Null);

        let candidates = self
            .description
            .properties
            .iter()
            .filter(|property| property.name == OPERATION)
            .filter(|property| property.is_visible(parameters));

        for property in candidates {
            if let Some(routing) = find_routing(property, &selected) {
                return Ok(routing);
            }
        }

        Err(CoreError::Node(format!(
            "`{}` has no operation `{}` for resource `{}`",
            self.description.name,
            r8r_workflow::stringify(&selected),
            r8r_workflow::stringify(&parameters.get(RESOURCE).cloned().unwrap_or(Value::Null)),
        )))
    }

    /// Load the credential this node is bound to, if any.
    async fn credential(&self, ctx: &ExecuteContext<'_>) -> Result<Option<ResolvedCredential>> {
        let Some(requirement) = self.description.credentials.first() else {
            return Ok(None);
        };

        match ctx.node.credentials.get(&requirement.name) {
            Some(id) => ctx.credentials.get(id).await.map(Some),
            None if requirement.required => Err(CoreError::Node(format!(
                "select a `{}` credential for this node",
                requirement.name
            ))),
            None => Ok(None),
        }
    }

    fn base_url(&self, credential: Option<&ResolvedCredential>) -> String {
        // A credential may point at a self-hosted instance, so it wins over
        // the node's compiled-in default.
        credential
            .and_then(|c| c.field("baseUrl"))
            .and_then(Value::as_str)
            .filter(|url| !url.is_empty())
            .map(str::to_owned)
            .or_else(|| {
                self.credential_type
                    .as_ref()
                    .and_then(|t| t.base_url.clone())
            })
            .or_else(|| self.description.base_url.clone())
            .unwrap_or_default()
    }
}

#[async_trait]
impl NodeExecutor for DeclarativeNode {
    fn description(&self) -> NodeTypeDescription {
        self.description.clone()
    }

    async fn execute(&self, ctx: &ExecuteContext<'_>) -> Result<NodeOutcome> {
        let credential = self.credential(ctx).await?;
        let base_url = self.base_url(credential.as_ref());

        let mut out = Items::new();
        for idx in 0..ctx.input.len() {
            let parameters = ctx.params(idx)?;
            let routing = self.routing_for(&parameters)?;

            let request = resolve_request(
                &routing.request,
                &parameters,
                credential.as_ref(),
                &self.auth_method(),
                ctx,
                idx,
            )?;

            let url = http::join_url(&base_url, &request.url);
            let response = send(ctx, &request, &url).await?;
            out.extend(shape(&response.body, &routing.output.post_receive));
        }

        Ok(main_output(out).into())
    }
}

impl DeclarativeNode {
    fn auth_method(&self) -> AuthMethod {
        self.credential_type
            .as_ref()
            .map_or(AuthMethod::None, |t| t.authenticate.clone())
    }
}

/// A request with every template resolved and the credential folded in.
#[derive(Debug, Clone)]
pub struct PreparedRequest {
    pub routing: RequestRouting,
    pub url: String,
}

/// Resolve the templates in a routing request against parameters, the current
/// item and the credential, then merge in whatever the credential contributes.
pub fn resolve_request(
    routing: &RequestRouting,
    parameters: &Value,
    credential: Option<&ResolvedCredential>,
    auth: &AuthMethod,
    ctx: &ExecuteContext<'_>,
    idx: usize,
) -> Result<PreparedRequest> {
    // A private expression context: `parameter` and `credentials` are visible
    // to routing templates only, never to a user's Code node.
    let mut expression = ctx.expression.clone();
    expression.set_variable("parameter", parameters.clone());
    if let Some(credential) = credential {
        expression.set_variable("credentials", credential.data.clone());
    }

    let item = ctx.item(idx);
    let resolve = |value: &Value| expression.resolve(value, &item, idx, ctx.input);

    let mut prepared = RequestRouting {
        method: routing.method,
        url: String::new(),
        headers: as_object(resolve(&Value::String(String::new()))?),
        query: Map::new(),
        body_type: routing.body_type,
        body: None,
    };

    prepared.url = r8r_workflow::stringify(&resolve(&Value::String(routing.url.clone()))?);
    prepared.headers = as_object(resolve(&Value::Object(routing.headers.clone()))?);
    prepared.query = as_object(resolve(&Value::Object(routing.query.clone()))?);
    prepared.body = match &routing.body {
        Some(body) => Some(resolve(body)?),
        None => None,
    };

    if let Some(credential) = credential {
        let contribution = credentials::contribution(auth, credential);
        merge(
            &mut prepared.headers,
            &resolve(&Value::Object(contribution.headers))?,
        );
        merge(
            &mut prepared.query,
            &resolve(&Value::Object(contribution.query))?,
        );
        if !contribution.body.is_empty() {
            let extra = resolve(&Value::Object(contribution.body))?;
            let mut body = as_object(prepared.body.clone().unwrap_or_else(|| json!({})));
            merge(&mut body, &extra);
            prepared.body = Some(Value::Object(body));
        }
    }

    let url = prepared.url.clone();
    Ok(PreparedRequest {
        routing: prepared,
        url,
    })
}

async fn send(
    ctx: &ExecuteContext<'_>,
    request: &PreparedRequest,
    url: &str,
) -> Result<http::HttpResponse> {
    let mut builder = ctx
        .http
        .request(http::method_of(request.routing.method), url)
        .timeout(http::timeout_from(http::DEFAULT_TIMEOUT_MS));

    for (name, value) in &request.routing.headers {
        builder = builder.header(name, http::stringify(value));
    }
    if !request.routing.query.is_empty() {
        let pairs: Vec<(String, String)> = request
            .routing
            .query
            .iter()
            .filter(|(_, value)| !value.is_null())
            .map(|(name, value)| (name.clone(), http::stringify(value)))
            .collect();
        builder = builder.query(&pairs);
    }
    builder = http::with_body(
        builder,
        request.routing.body_type,
        request.routing.body.as_ref(),
    )?;

    http::send(builder, url, ResponseFormat::Auto, false).await
}

/// Apply the output rules in order, turning a response body into items.
///
/// Every rule maps over the current list of values, which is what lets them
/// compose: plucking `entry`, splitting it, then plucking `resource` from each
/// entry unwraps a FHIR Bundle into the resources it carries. Values stay raw
/// until the end so that a rule can act on an array without it first being
/// boxed into an item.
#[must_use]
pub fn shape(body: &Value, steps: &[PostReceive]) -> Items {
    let mut values = vec![body.clone()];

    for step in steps {
        values = apply(step, values);
    }

    values.into_iter().map(node_helpers::as_item).collect()
}

fn apply(step: &PostReceive, values: Vec<Value>) -> Vec<Value> {
    match step {
        PostReceive::RootProperty { property } => {
            values.iter().map(|value| dig(value, property)).collect()
        }

        // Flatten: an array becomes its elements, an absent value becomes
        // nothing, and anything else stands alone.
        PostReceive::Split => values
            .into_iter()
            .flat_map(|value| match value {
                Value::Array(entries) => entries,
                Value::Null => Vec::new(),
                other => vec![other],
            })
            .collect(),

        PostReceive::Limit { count } => values.into_iter().take(*count).collect(),

        PostReceive::Set { fields } => values
            .into_iter()
            .map(|value| {
                let mut item = node_helpers::as_item(value);
                if let Some(object) = item.as_object_mut() {
                    for (key, extra) in fields {
                        object.insert(key.clone(), extra.clone());
                    }
                }
                item
            })
            .collect(),

        PostReceive::Acknowledge => vec![json!({ "success": true })],
    }
}

fn find_routing(property: &NodeProperty, selected: &Value) -> Option<Routing> {
    property
        .options
        .iter()
        .find(|option| &option.value == selected)
        .and_then(|option| option.routing.clone())
}

/// Follow a dotted path, yielding null when any hop is missing.
fn dig(value: &Value, path: &str) -> Value {
    let mut current = value;
    for hop in path.split('.') {
        match current.get(hop) {
            Some(next) => current = next,
            None => return Value::Null,
        }
    }
    current.clone()
}

fn as_object(value: Value) -> Map<String, Value> {
    match value {
        Value::Object(map) => map,
        _ => Map::new(),
    }
}

fn merge(target: &mut Map<String, Value>, extra: &Value) {
    if let Value::Object(map) = extra {
        for (key, value) in map {
            target.insert(key.clone(), value.clone());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn root_property_then_split_produces_one_item_per_entry() {
        let body = json!({ "data": { "channels": [{ "id": "C1" }, { "id": "C2" }] } });
        let items = shape(
            &body,
            &[
                PostReceive::RootProperty {
                    property: "data.channels".into(),
                },
                PostReceive::Split,
            ],
        );

        assert_eq!(items.len(), 2);
        assert_eq!(items[1]["id"], json!("C2"));
    }

    #[test]
    fn a_missing_root_property_yields_no_items_rather_than_failing() {
        let items = shape(
            &json!({ "data": {} }),
            &[
                PostReceive::RootProperty {
                    property: "data.nope".into(),
                },
                PostReceive::Split,
            ],
        );
        assert!(items.is_empty());
    }

    #[test]
    fn limit_trims_the_result_set() {
        let body = json!({ "rows": [1, 2, 3, 4, 5] });
        let items = shape(
            &body,
            &[
                PostReceive::RootProperty {
                    property: "rows".into(),
                },
                PostReceive::Split,
                PostReceive::Limit { count: 2 },
            ],
        );
        assert_eq!(items.len(), 2);
    }

    #[test]
    fn set_stamps_fields_onto_every_item() {
        let mut fields = Map::new();
        fields.insert("resource".into(), json!("message"));

        let items = shape(
            &json!({ "rows": [{ "id": 1 }, { "id": 2 }] }),
            &[
                PostReceive::RootProperty {
                    property: "rows".into(),
                },
                PostReceive::Split,
                PostReceive::Set { fields },
            ],
        );

        assert!(
            items
                .iter()
                .all(|item| item["resource"] == json!("message"))
        );
    }

    #[test]
    fn acknowledge_replaces_an_empty_response_with_a_success_item() {
        let items = shape(&json!(null), &[PostReceive::Acknowledge]);
        assert_eq!(items, vec![json!({ "success": true })]);
    }

    #[test]
    fn no_rules_passes_the_body_through_as_one_item() {
        let items = shape(&json!({ "ok": true }), &[]);
        assert_eq!(items, vec![json!({ "ok": true })]);
    }

    #[test]
    fn a_scalar_body_is_boxed_so_every_item_stays_an_object() {
        let items = shape(&json!("plain"), &[]);
        assert_eq!(items, vec![json!({ "value": "plain" })]);
    }

    #[test]
    fn splitting_a_single_object_keeps_it_as_one_item() {
        let items = shape(
            &json!({ "row": { "id": 1 } }),
            &[
                PostReceive::RootProperty {
                    property: "row".into(),
                },
                PostReceive::Split,
            ],
        );
        assert_eq!(items.len(), 1);
    }
}
