"""Mark non-essential slides as hidden in Alagappa_Pitch_v2.pptx.

Hidden slides stay in the file (and remain editable / unhidden later) but are
skipped during slideshow. The keep-list below holds the seven slides that tell
the core story end-to-end; everything else stays as backup for Q&A.
"""
from pathlib import Path

from pptx import Presentation

SRC = Path("/Users/apple/Projects/MedBrains/presentations/Alagappa_Pitch_v2.pptx")
OUT = Path("/Users/apple/Projects/MedBrains/presentations/Alagappa_Pitch_v2.pptx")

# 1-based slide numbers to keep visible.
KEEP = {
    1,   # Cover — Don't buy. Build.
    2,   # Four vendor quotes
    8,   # Why me · why now (80% built status)
    11,  # Real 3-year TCO
    12,  # Pre-launch budget
    16,  # Roadmap to go-live
    18,  # Where we stand
}


def main() -> None:
    prs = Presentation(str(SRC))
    slides = list(prs.slides)
    hidden, visible = [], []
    for idx, slide in enumerate(slides, 1):
        if idx in KEEP:
            slide.element.attrib.pop("show", None)
            visible.append(idx)
        else:
            slide.element.set("show", "0")
            hidden.append(idx)
    prs.save(str(OUT))
    print(f"Visible ({len(visible)}): {visible}")
    print(f"Hidden ({len(hidden)}): {hidden}")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
