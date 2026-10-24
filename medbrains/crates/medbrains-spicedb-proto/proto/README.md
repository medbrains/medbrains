# Vendored protos

Copied unmodified from the upstream repositories at these commits. Bump them
together, then run `../regenerate.sh` and commit `src/gen`.

| path | source | ref |
|---|---|---|
| `authzed/` | github.com/authzed/api | `v1.53.0` (d5fc38fe34) — Apache-2.0, see `authzed/LICENSE` |
| `google/api/annotations.proto`, `google/api/http.proto`, `google/rpc/status.proto` | github.com/googleapis/googleapis | `4792db7b61d0d1430f5bc33463bbe90254f3d5f6` — Apache-2.0 |
| `validate/validate.proto` | github.com/envoyproxy/protoc-gen-validate | `414042a5ff2e98dc47f8161937316a25b1da5bba` — Apache-2.0 |
| `buf/validate/validate.proto` | github.com/bufbuild/protovalidate (`proto/protovalidate/…`) | `c550962b283761cd5e7d333c7fe32183e6d282eb` — Apache-2.0 |
| `protoc-gen-openapiv2/options/*.proto` | github.com/grpc-ecosystem/grpc-gateway | `06cfd4481b628d428ac36ed3dcec81a285880362` — BSD-3-Clause |

Only `authzed/api/v1/{permission,schema,watch}_service.proto` and
`google/rpc/status.proto` are compiled; the rest are their imports. The API
version is kept at or below the SpiceDB server (`docker-compose.yml`, v1.56.0):
newer request fields are optional on the wire, but the server must know them.
