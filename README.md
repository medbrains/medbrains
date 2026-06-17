# MedBrains

Multi-tenant Hospital Management System. The application lives in [`medbrains/`](./medbrains)
(Rust/Axum backend + React/Mantine frontend) — see [`CLAUDE.md`](./CLAUDE.md) for the
architecture, tech stack, and module workflow.

## Semantic code search (cocoindex-code)

This repo is indexed for **local semantic code search** with
[`cocoindex-code`](https://cocoindex.io/cocoindex-code/) — fully local (LMDB + SQLite +
on-device `sentence-transformers`), no API key or database required. An MCP server
(`.mcp.json`) exposes the search to AI assistants.

### One-time install

```bash
uv tool install --upgrade 'cocoindex-code[full]'   # or: pipx install 'cocoindex-code[full]'
```

### Build / refresh the index

```bash
ccc index                       # build or update (incremental)
ccc status                      # chunk/file/language stats
ccc doctor                      # health check
```

The shared indexing config (which files to include/exclude) is committed at
[`.cocoindex_code/settings.yml`](./.cocoindex_code/settings.yml); the index databases
themselves are gitignored.

### Search

```bash
ccc search "set tenant context for row level security"
ccc search --lang rust --path 'medbrains/crates/*' "argon2 password hashing"
ccc search --lang tsx "DataTable column sorting"
```

### MCP server

`.mcp.json` registers a project-scoped `cocoindex-code` MCP server (`ccc mcp`). On the
next session Claude Code prompts to approve it; after that the assistant can run semantic
code search directly. Requires `ccc` on `PATH` (`~/.local/bin`).

> Note: `pyproject.toml` also declares the `cocoindex` **library** (the engine
> `cocoindex-code` is built on). The search tool above is installed separately as a CLI;
> the library dep is only needed if you build custom CocoIndex flows.
