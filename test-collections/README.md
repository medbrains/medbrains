# API test collections

Importable **OpenAPI 3** + **Postman v2.1** collections for the MedBrains API,
generated from the real contract — the TypeScript client's endpoint index plus
the Rust/TS request-type shapes extracted by `scripts/fetch_api_shape.py`. One
source of truth, so the collections never drift from the code.

## Generate

```sh
cd medbrains && make collections
# → test-collections/openapi.json  (OpenAPI 3.0)
# → test-collections/postman_collection.json  (Postman v2.1)
```

The generated JSON is **gitignored** (multi-MB, derived, regenerable) — the same
convention the repo uses for auto-generated smoke specs. Run `make collections`
to (re)produce them locally.

## What's inside

- **~1800 endpoints** (every method+path the TS client exposes).
- Each write endpoint carries a **positive** example request — its body sampled
  from the real request struct (correct field names + types) — plus
  representative **negative** cases:
  - `no-auth` → expect **401/403** (the API must refuse an unauthenticated call).
  - `empty-body` → expect **400/422** (the API must validate a bad body).

## Import + run

1. Import `postman_collection.json` into Postman (or `openapi.json` into
   Insomnia / Swagger UI).
2. Set the collection variables:
   - `base_url` — e.g. `http://127.0.0.1:3000`
   - `token` — a bearer token (log in via `POST /api/auth/login` with the
     `x-medbrains-client: desktop-agent` header to get a native token).
3. Run a folder or the whole collection. Positive requests should return 2xx;
   the negative cases assert the API correctly refuses/validates.
