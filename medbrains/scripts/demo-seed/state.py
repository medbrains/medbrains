"""Persisted id map so re-runs skip what already exists."""
import json, os
P = os.environ.get("MB_DEMO_STATE", os.path.join(os.path.dirname(os.path.abspath(__file__)), "state.json"))
S = json.load(open(P)) if os.path.exists(P) else {}
def save(): json.dump(S, open(P, "w"), indent=1, default=str)
def bucket(name): return S.setdefault(name, {})
