"""Run every seed step in order, then read the result back through the API.

Each step is idempotent: ids it creates go into state.json (MB_DEMO_STATE), so a re-run
skips finished work and resumes where an interrupted run stopped.
"""
import importlib
import sys
import time

STEPS = ["s01_patients", "s02_staff", "s03_drugs", "s04_lab_masters", "s05_opd", "s06_lab",
         "s07_ipd", "s08_pharmacy", "s09_billing", "s10_er_radiology", "s11_extra_modules", "s99_verify"]

if __name__ == "__main__":
    only = set(sys.argv[1:])
    for name in STEPS:
        if only and name not in only:
            continue
        try:
            mod = importlib.import_module(name)
        except ModuleNotFoundError:
            print(f"-- {name}: not present, skipped")
            continue
        t0 = time.time()
        print(f"== {name}")
        mod.run()
        print(f"   {name} took {time.time() - t0:.0f}s")
