import re, json

with open("signtutor/src/lib/vocabulary_200.ts", "r", encoding="utf-8") as f:
    content = f.read()

with open("signtutor/public/models/word_labels.json") as f:
    wl = json.load(f)
model_labels = wl["labels"]

entries = re.findall(r'id:\s*"([^"]+)"', content)
glosses = re.findall(r'gloss:\s*"([^"]+)"', content)
print("IDs:", entries)
print()
print("Glosses:", glosses)
print()
print("Model words missing from vocabulary_200 glosses:")
model_set = set(model_labels)
for ml in model_labels:
    if ml not in glosses:
        print(f"  MISSING: {ml}")
print(f"Model: {len(model_labels)} words. UI has {len([g for g in glosses if g in model_set])} matching model words.")
