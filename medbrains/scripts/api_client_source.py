"""The API client's source as one text, in the shape the checks were written for.

`packages/api/src/client.ts` holds the transport (request, session, errors) and each
API area's methods live in `packages/api/src/modules/<area>.ts` as
`export const <area>Api = { … }`, so a screen downloads only the areas it calls.
The contract, coverage and permission checks parse one `export const api = { … }`
object; this joins every area's methods back into that one object after client.ts.
Line numbers in the joined text are not the files' line numbers.
"""

from pathlib import Path

API_SRC = Path(__file__).resolve().parent.parent / "packages" / "api" / "src"


def api_client_source() -> str:
    """client.ts followed by every area's methods inside one `export const api = {`."""
    bodies = []
    for module in sorted((API_SRC / "modules").glob("*.ts")):
        text = module.read_text(encoding="utf-8")
        start = text.index("= {\n", text.index("export const ")) + len("= {\n")
        bodies.append(text[start : text.rindex("\n};")])
    client = (API_SRC / "client.ts").read_text(encoding="utf-8")
    return client + "\nexport const api = {\n" + "\n".join(bodies) + "\n};\n"


if __name__ == "__main__":
    joined = api_client_source()
    assert "export const api = {" in joined and "request<" in joined
    print(f"api client source: {joined.count(chr(10))} lines")
