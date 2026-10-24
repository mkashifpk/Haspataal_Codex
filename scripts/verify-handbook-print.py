"""Check the real Electron-produced queue handbook PDF, including a scrolled-dialog regression.

Requires pypdf in the verification Python environment. Does not exercise a physical printer.
"""
import argparse
import hashlib
import json
from pathlib import Path
from pypdf import PdfReader

parser = argparse.ArgumentParser()
parser.add_argument("pdf", type=Path)
parser.add_argument("--report", type=Path)
args = parser.parse_args()
raw = args.pdf.read_bytes()
assert raw.startswith(b"%PDF-"), "Not a PDF"
pdf = PdfReader(args.pdf)
text = " ".join(" ".join(page.extract_text() for page in pdf.pages).split())
for marker in ["My live queue", "During OPD", "Steps and controls", "What must a reviewer check?", "Human and language review pending"]:
    assert marker in text, f"Handbook content clipped or missing: {marker}"
assert "TEST: user cancelled" not in text, "Transient print diagnostics leaked onto paper"
assert "PRINT_FAILED" not in text, "Transient print error leaked onto paper"
images = sum(len(page.images) for page in pdf.pages)
assert images >= 1, "Bundled example missing from handbook output"
result = {"passed": True, "file": args.pdf.as_posix(), "pages": len(pdf.pages), "images": images,
          "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(),
          "checks": ["title, beginning, steps, last FAQ and review status retained after scrolling",
                     "bundled example embedded", "transient print diagnostics excluded"],
          "limits": "English PDF structure/content check; physical printing and native Urdu review remain human pending."}
if args.report:
    args.report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, indent=2))
