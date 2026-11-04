"""Turn dist-demo/ (npm run build:demo) into an Artifact page + files map.

Writes dist-demo/artifact.html (head contents + body, no html/head/body wrappers,
since the Artifact host adds its own skeleton) and prints the `files` JSON map.
"""
import json
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent / "dist-demo"
html = (root / "index.html").read_text(encoding="utf-8")

head = re.search(r"<head>(.*?)</head>", html, re.S).group(1)
body = re.search(r"<body[^>]*>(.*?)</body>", html, re.S).group(1)
# The host adds charset + viewport; drop ours and the SEO/social tags that don't apply to a demo.
head = re.sub(r'\s*<meta (charset|name="viewport"|property="og:|name="twitter:|name="robots")[^>]*>', "", head)
head = re.sub(r"\s*<!--.*?-->", "", head, flags=re.S)
head = re.sub(r"\s*<title>.*?</title>", "", head, flags=re.S)
page = '<title>Doing מחברת שטח</title>\n<meta name="robots" content="noindex">\n' + head.strip() + "\n" + body.strip() + "\n"
(root / "artifact.html").write_text(page, encoding="utf-8")

# Libraries (micromark) carry a literal U+FFFD inside string literals; the Artifact host
# rejects that character, so write it as the equivalent JS escape sequence.
REPLACEMENT_CHAR = chr(0xFFFD)
JS_ESCAPE = "\\" + "uFFFD"
for js in root.glob("assets/*.js"):
    text = js.read_text(encoding="utf-8")
    if REPLACEMENT_CHAR in text:
        js.write_text(text.replace(REPLACEMENT_CHAR, JS_ESCAPE), encoding="utf-8")

# Kid photos from the live app's public folder are not needed by the demo (its kids have
# no photos) and must not travel with a shareable page.
SKIP = {"index.html", "artifact.html", "lenny-small.png", "liam-small.jpg", "noga-small.jpg",
        "omer-small.png", "tamar.jpg", "og-image.png", "og-image.svg", "vite.svg"}
files = {}
for f in sorted(root.rglob("*")):
    if f.is_file() and f.name not in SKIP:
        rel = f.relative_to(root).as_posix()
        files[rel] = rel
print(json.dumps(files, ensure_ascii=False))
