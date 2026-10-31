# r8r

A workflow automation engine in Rust. Same idea as n8n — a visual graph of
nodes that moves data between systems — with the engine written to be fast
enough that you stop thinking about it.

A four-node workflow runs in **under a millisecond**, and a webhook round-trip
including the SQLite write lands in **~0.8ms**.

```
cargo build --release -p r8r-cli
./target/release/r8r          # editor on http://127.0.0.1:5678
```

The editor is compiled into the binary. Deployment is one file plus a
database.

## Layout

The workspace mirrors n8n's package split, so the boundaries are the ones the
problem actually has:

| Crate | Answers |
|---|---|
| `crates/workflow` | What a workflow *is*: nodes, connections, expressions, conditions, graph ordering. Pure — no I/O. |
| `crates/formats` | Turning the outside world into JSON: XML, SOAP, YAML, TOML, CSV, form-encoded, Excel. Pure. |
| `crates/core` | What it means to *run* one: the executor, the node trait, credentials, encryption, the declarative integration engine. |
| `crates/nodes-base` | The nodes themselves, plus one manifest per integration. |
| `crates/cli` | The server: REST API, webhooks, scheduler, persistence, logging. Library + thin binary. |
| `editor-ui` | React + React Flow + Mantine. Built to `dist/`, embedded at compile time. |

## Adding an integration

An integration is data, not code. It declares a credential type and a node
whose operations carry the request they make; `r8r-core::declarative` does the
rest — auth, templating, retries, error text, response shaping.

```rust
send_json(
    "Send", "send", HttpMethod::Post, "chat.postMessage",
    json!({ "channel": "{{ parameter.channel }}", "text": "{{ parameter.text }}" }),
    "Post a message to a channel",
)
```

`crates/nodes-base/src/integrations/slack.rs` is the whole Slack node. Nothing
in the engine knows Slack exists.

## Expressions

`{{ }}` anywhere in a parameter, evaluated with [Rhai] — pure Rust and
sandboxed: no filesystem, no network, no process, and hard caps on operations,
recursion and string size.

```
{{ item.first + " " + item.last }}
{{ item.price * item.qty * 1.2 }}
{{ if item.vip && item.overdue { "high" } else { "normal" } }}
```

A path that does not exist evaluates to `null` rather than failing, because
half-populated records are normal input.

## Credentials

Sealed with AES-256-GCM before they reach the database, so a copied
`r8r.sqlite` is not a copied set of API tokens. The key comes from
`R8R_ENCRYPTION_KEY`, or is generated once and written beside the database —
**back that file up**. The API returns a placeholder where a secret would be,
never the secret.

## When something breaks

* **The console**, in the editor: every run, node by node, with items and
  timings. Works for a run from last night as well as one from ten seconds ago.
* **The canvas**: item counts on the wires, milliseconds under each node,
  `not reached` on branches nothing took.
* **The log**: `R8R_LOG=debug` for per-node detail, `trace` for payloads,
  `R8R_LOG_FORMAT=json` to ship it somewhere.
* **An error workflow**: set `settings.errorWorkflowId` and a failed run starts
  that workflow with the failure as its input — which is how a failure becomes
  a Slack message, a page, or a ticket.

## Configuration

| Variable | Default | |
|---|---|---|
| `R8R_HOST` / `R8R_PORT` | `127.0.0.1` / `5678` | |
| `R8R_DATABASE` | `r8r.sqlite` | |
| `R8R_ENCRYPTION_KEY` | generated | Credential encryption |
| `R8R_EXECUTION_HISTORY` | `200` | Runs kept per workflow |
| `R8R_LOG` | `info` | `debug`, `trace`, or per-module filters |
| `R8R_LOG_FORMAT` | `pretty` | or `json` |
| `R8R_UI_DIR` | *(embedded)* | Serve the editor from disk instead |

## Development

```
cargo test --workspace                          # 319 tests
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all

npm --prefix editor-ui test                     # 135 tests
npm --prefix editor-ui run lint                 # biome
npm --prefix editor-ui run build
```

The lint policy follows NASA/JPL's Power of 10 where it maps onto Rust:
`unsafe` is forbidden, `unwrap`/`expect`/`panic`/indexing are denied outside
tests, functions stay under 60 lines, and CI builds with `-D warnings`. Two
loops are deliberate exceptions and say so: the server's accept loop and the
scheduler's tick.

[Rhai]: https://rhai.rs
