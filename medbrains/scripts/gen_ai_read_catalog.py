#!/usr/bin/env python3
"""Generate the AI read-API catalog (GET endpoints under allowlisted domains) from
routes/mod.rs. Multi-line aware. Regenerate after route changes.
Output: crates/medbrains-server/src/routes/ai_read_catalog.txt (include_str!)."""
import re, pathlib
ALLOW = {"patients","opd","lab","pharmacy","ipd","radiology","blood-bank","emergency","nurse","ot",
"chronic-care","cds","order-sets","infection-control","bedside","diet","mrd","documents","specialty",
"billing","insurance","payments","indent","procurement","hr","scheduling","quality","front-office",
"facilities","housekeeping","camp","communications","command-center","regulatory","lms"}
src = pathlib.Path("crates/medbrains-server/src/routes/mod.rs").read_text()
paths = set()
# Each .route("PATH", <method-chain>) — capture PATH, then scan the chain (which may
# span lines) up to the balancing of the route's args for a get( method.
for m in re.finditer(r'\.route\(\s*"(/api/[a-z0-9{}_/-]+)"\s*,', src):
    path = m.group(1)
    seg = path.split("/")[2] if path.count("/") >= 2 else ""
    if seg not in ALLOW: continue
    chain = src[m.end(): m.end()+160]          # method chain window (multi-line safe)
    chain = chain.split(".route(")[0]           # stop at the next route
    if re.search(r'\bget\(', chain): paths.add(path)
by = {}
for p in sorted(paths): by.setdefault(p.split("/")[2], []).append(p)
lines = []
for dom in sorted(by):
    lines.append(f"# {dom}")
    lines.extend(by[dom]); lines.append("")
pathlib.Path("crates/medbrains-server/src/routes/ai_read_catalog.txt").write_text("\n".join(lines))
print(f"catalog: {len(paths)} GET endpoints across {len(by)} domains")
print("domains:", ", ".join(sorted(by)))
