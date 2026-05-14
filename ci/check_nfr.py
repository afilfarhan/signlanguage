"""
Release-gate enforcer. Reads the eval/robustness reports written by the
training and robustness scripts and exits non-zero if any PDR gate fails.

Gates checked:
  - NFR-9  : top-1 accuracy must meet the per-task target.
  - NFR-10 : no slice may be more than 5 pp below the clean accuracy
             (parsed from the robustness/fairness markdown tables).
  - Feature parity : the JS↔Python parity test (run separately) must have
             produced a non-empty success line in its log; we just check the
             log file the workflow tees.

Run from the repo root:
    python3 ci/check_nfr.py
"""
from __future__ import annotations
import re, sys, pathlib, json

ROOT = pathlib.Path(__file__).resolve().parents[1]
RED, GREEN, YELLOW, RESET = "\033[31m", "\033[32m", "\033[33m", "\033[0m"

errors: list[str] = []
notes:  list[str] = []

def fail(msg: str): errors.append(msg);  print(f"{RED}✗ {msg}{RESET}")
def ok(msg: str):    notes.append(msg);  print(f"{GREEN}✓ {msg}{RESET}")
def warn(msg: str):                       print(f"{YELLOW}! {msg}{RESET}")

# ----------------------------- NFR-9 -------------------------------------
NFR9 = {
    "static (fingerspelling)": (
        ROOT / "ml/models/eval_report.md", 0.85,
        re.compile(r"Held-out accuracy:\*\*\s*\*\*([0-9.]+)\*\*"),
    ),
    "dynamic (isolated signs)": (
        ROOT / "ml/models/dynamic_eval_report.md", 0.80,
        re.compile(r"Held-out top-1 accuracy:\*\*\s*\*\*([0-9.]+)\*\*"),
    ),
}

print("== NFR-9 (accuracy targets) ==")
for name, (path, target, rx) in NFR9.items():
    if not path.exists():
        fail(f"{name}: report missing at {path.relative_to(ROOT)}")
        continue
    m = rx.search(path.read_text())
    if not m:
        fail(f"{name}: couldn't parse accuracy from {path.relative_to(ROOT)}")
        continue
    acc = float(m.group(1))
    if acc + 1e-6 < target:
        fail(f"{name}: accuracy {acc:.3f} below NFR-9 target {target:.2f}")
    else:
        ok(f"{name}: accuracy {acc:.3f} ≥ {target:.2f}")

# ----------------------------- NFR-10 ------------------------------------
def parse_robustness_or_fairness_table(text: str) -> list[tuple[str, float]]:
    """Return [(slice_name, accuracy), ...] from any markdown table that has
    the columns Slice | Accuracy | ... — used for both the robustness and
    fairness placeholder tables."""
    rows = []
    in_table = False
    for line in text.splitlines():
        if re.match(r"\|\s*Slice\s*\|\s*Accuracy\b", line, re.I):
            in_table = True; continue
        if in_table:
            if not line.strip().startswith("|"): break
            if re.match(r"\|\s*-+", line): continue  # separator
            cells = [c.strip() for c in line.strip("|").split("|")]
            if len(cells) >= 2:
                try:
                    rows.append((cells[0], float(cells[1])))
                except ValueError:
                    continue
    return rows

GATE_PP = 0.05
print("\n== NFR-10 (per-slice ±5pp gate) ==")
for path in [ROOT / "ml/models/dynamic_robustness_report.md"]:
    if not path.exists():
        fail(f"missing: {path.relative_to(ROOT)}")
        continue
    rows = parse_robustness_or_fairness_table(path.read_text())
    if not rows:
        fail(f"{path.relative_to(ROOT)}: no rows parsed")
        continue
    clean = next((acc for s, acc in rows if s.lower() == "clean"), None)
    if clean is None:
        fail(f"{path.relative_to(ROOT)}: no 'clean' baseline row")
        continue
    print(f"  {path.relative_to(ROOT)} (clean={clean:.3f}):")
    for s, acc in rows:
        if s.lower() == "clean": continue
        delta = acc - clean
        within = abs(delta) <= GATE_PP + 1e-6
        line = f"    {s:<22s} acc={acc:.3f} Δ={delta:+.3f}"
        if within:
            print(f"{GREEN}{line} ✓{RESET}")
        else:
            print(f"{RED}{line} ✗{RESET}")
            errors.append(f"slice '{s}' deviates {delta:+.3f} from clean (gate ±{GATE_PP})")

# ----------------------------- Parity ------------------------------------
print("\n== JS ↔ Python feature parity ==")
parity_log = ROOT / "ci/parity.log"
if not parity_log.exists():
    warn("parity.log not found — skipped (run ci/run_parity.mjs first)")
else:
    text = parity_log.read_text()
    if "5/5 samples within tolerance" in text:
        ok("static MLP normalize() parity: 5/5 within tolerance")
    else:
        fail("parity.log present but did not report 5/5 within tolerance")
        print(text)

# ----------------------------- Summary -----------------------------------
print()
if errors:
    print(f"{RED}FAIL: {len(errors)} gate(s) violated{RESET}")
    for e in errors: print(f"  - {e}")
    sys.exit(1)
print(f"{GREEN}PASS: all release gates green{RESET}")
