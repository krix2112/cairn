import re

with open('app/static/analyze.html', 'r', encoding='utf-8') as f:
    content = f.read()

get_ids = set(m[1] for m in re.findall(r"document\.getElementById\((['\"])([\w\-]+)\1\)", content))
qs_ids = set(m[1] for m in re.findall(r"querySelector\((['\"])#([\w\-]+)\1\)", content))
all_js_ids = get_ids | qs_ids

html_ids = set(m[1] for m in re.findall(r"id=(['\"])([\w\-]+)\1", content))

missing = all_js_ids - html_ids
print("Total referenced JS IDs:", len(all_js_ids))
print("Missing IDs:", missing)
for m in sorted(missing):
    print("  MISSING ID:", m)

