import json, re

with open("ml/models/vocab_v1.json") as f:
    vocab_v1 = json.load(f)["words"][:100]

with open("signtutor/public/models/word_labels.json") as f:
    wl = json.load(f)
model_labels = wl["labels"]

print("vocab_v1[:100] == word_labels.json:", vocab_v1 == model_labels)

with open("signtutor/src/lib/curriculum.ts", "r", encoding="utf-8") as f:
    curr = f.read()
glosses_curr = set(re.findall(r'"([A-Z][A-Z-]+)"', curr))

with open("signtutor/src/lib/vocabulary_200.ts", "r", encoding="utf-8") as f:
    v200 = f.read()
glosses_v200 = set(re.findall(r'gloss:\s*"([^"]+)"', v200))

print("\nIn model but NOT in curriculum.ts:")
missing_curr = [l for l in model_labels if l not in glosses_curr]
for w in missing_curr:
    print(f"  {w}")

print("\nIn model but NOT in vocabulary_200.ts glosses:")
missing_v200 = [l for l in model_labels if l not in glosses_v200]
for w in missing_v200:
    print(f"  {w}")
