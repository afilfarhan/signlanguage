import re, json

with open("signtutor/src/lib/vocabulary_200.ts", "r", encoding="utf-8") as f:
    content = f.read()

with open("signtutor/public/models/word_labels.json") as f:
    wl = json.load(f)
model_labels = wl["labels"]

block_re = re.compile(
    r'\{[^{}]*id:\s*"([^"]+)"[^{}]*gloss:\s*"([^"]+)"', re.DOTALL
)

seen = {}
for m in block_re.finditer(content):
    sid = m.group(1)
    gloss = m.group(2)
    seen[sid] = gloss

print("=== All IDs in vocabulary_200.ts ===")
for sid, gloss in seen.items():
    print(f"  id={sid!r}  gloss={gloss!r}")

print()
print("=== Checking model-word coverage ===")
model_set = set(model_labels)

def id_to_gloss(sid):
    return sid.upper().replace("_", "-")

for sid, gloss in seen.items():
    expected = id_to_gloss(sid)
    in_model = gloss in model_set
    matches = gloss == expected
    if not in_model or not matches:
        print(f"  id={sid!r}  gloss={gloss!r}  expected={expected!r}  in_model={in_model}")

print()
print("=== IDs not in vocabulary_200.ts (model words) ===")
for label in model_labels:
    # check if any id maps to this label
    found = any(v == label for v in seen.values())
    if not found:
        print(f"  {label}")
