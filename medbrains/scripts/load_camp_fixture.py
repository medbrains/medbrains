#!/usr/bin/env python3
"""Load the real camp extract into MedBrains through its own API.

    python3 scripts/load_camp_fixture.py --dry-run
    MEDBRAINS_PASSWORD=... python3 scripts/load_camp_fixture.py --limit 25

The implementation lives in `scripts/camp_fixture/`, split by concern —
`source` reads the extract, `clinical` validates readings and composes the
SOAP note, `journey` builds the event series, `api` talks to the server.

This file stays as the entry point because `python3 -m scripts.camp_fixture`
does not work: there is an installed package called `scripts` on the default
interpreter, and it shadows this directory.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from camp_fixture.cli import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
