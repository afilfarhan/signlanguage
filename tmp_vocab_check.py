import re, json
with open("signtutor/src/lib/vocabulary_200.ts", "r", encoding="utf-8") as f:
    content = f.read()

glosses = re.findall(r'gloss:\s*"([^"]+)"', content)
sids   = re.findall(r'id:\s*"([^"]+)"', content)

model_labels = ['HELLO','GOODBYE','YES','NO','PLEASE','THANKS','SORRY','HELP','WANT','NEED',
    'LIKE','LOVE','KNOW','THINK','FEEL','SEE','HEAR','SAY','TELL','ASK',
    'GIVE','TAKE','COME','GO','EAT','DRINK','SLEEP','WORK','PLAY','LEARN',
    'TEACH','READ','WRITE','BUY','PAY','OPEN','CLOSE','STOP','START','WAIT',
    'FRIEND','FAMILY','MOTHER','FATHER','BABY','HOME','SCHOOL','FOOD','WATER',
    'GOOD','BAD','HAPPY','SAD','ANGRY','SCARED','BIG','SMALL','NEW','OLD','FAST',
    'SLOW','HOT','COLD','MAN','WOMAN','BOY','GIRL','PERSON','NAME','WHAT','WHERE',
    'WHEN','WHO','HOW','WHY','HOW-MUCH','HOW-MANY','MORE','LESS','ALL','NONE',
    'EVERY','SAME','DIFFERENT','MAYBE','ALWAYS','NEVER','TODAY','TOMORROW','YESTERDAY',
    'NOW','BEFORE','AFTER','WITH','WITHOUT','CAN','CANNOT','MUST','SHOULD','TRY']

# Check which model labels are present in UI as glosses
ui_gloss_set = set(glosses)
missing = [l for l in model_labels if l not in ui_gloss_set]
print("Missing glosses in vocabulary_200.ts:", missing)

# Check problematic slugs
check_ids = ["say", "hear", "feel", "thanks", "thank_you", "tell"]
for sid in check_ids:
    m = re.search(r'\{[^}]*id:\s*"' + re.escape(sid) + r'"', content, re.DOTALL)
    block = m.group(0) if m else ""
    g = re.search(r'gloss:\s*"([^"]+)"', block)
    print(f"  id={sid} gloss={g.group(1) if g else '?'}")
