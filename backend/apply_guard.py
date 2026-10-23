import py_compile
import re

PATH = "rewrite.py"
text = open(PATH, encoding="utf-8").read()

if "from guard import finalize" not in text:
    text = text.replace(
        "from llm import ask_json\n",
        "from llm import ask_json\nfrom guard import finalize\n",
        1,
    )

text = re.sub(
    r"^[ \t]+bullets = (?:keep_numbers|limit_bullets)\(.*\)[ \t]*$",
    lambda m: m.group(0)[: len(m.group(0)) - len(m.group(0).lstrip())] + "pass",
    text,
    flags=re.M,
)

if "finalize(resume, result, facts)" not in text:
    anchor = "    changes = diff_notes(resume, result, removed)\n"
    if anchor not in text:
        raise SystemExit("Could not find the place to patch. Tell Claude.")
    block = (
        "    result, flags, reverted = finalize(resume, result, facts)\n"
        "    if reverted:\n"
        "        msg = \" unsupported items to your original wording.\"\n"
        "        notes.append(\"Reverted \" + str(reverted) + msg)\n"
    )
    text = text.replace(anchor, block + anchor, 1)

open(PATH, "w", encoding="utf-8").write(text)
py_compile.compile(PATH, doraise=True)
print("patched and compiled")