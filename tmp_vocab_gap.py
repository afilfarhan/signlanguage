import json, re

with open("ml/models/vocab_v1.json") as f:
    v = json.load(f)
all_words = v["words"]

with open("signtutor/public/models/word_labels.json") as f:
    wl = json.load(f)
model_labels = wl["labels"]

with open("signtutor/src/lib/vocabulary_200.ts", "r", encoding="utf-8") as f:
    content = f.read()
ui_glosses = set(re.findall(r'gloss:\s*"([^"]+)"', content))

print("=== Labels NOT in UI vocabulary_200.ts ===")
missing = [l for l in model_labels if l not in ui_glosses]
for w in missing:
    print(f"  {w}")
print(f"Total missing: {len(missing)}")

print()
print("=== Labels in UI but NOT in model ===")
in_ui_not_model = [g for g in ui_glosses if g not in model_labels and g.isupper()]
print(f"Count: {len(in_ui_not_model)}")

# Check thank_you entry
m = re.search(r'\{id:\s*"thank_you".*?gloss:\s*"([^"]+)"', content, re.DOTALL)
if m:
    print(f"\nthank_you gloss: {m.group(1)}")
