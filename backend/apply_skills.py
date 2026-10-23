import py_compile

PATH = "guard.py"
text = open(PATH, encoding="utf-8").read()

if "complete_skills" not in text:
    text = text.replace(
        "from scoring import",
        "from skills_guard import complete_skills\nfrom scoring import",
        1,
    )
    anchor = "    reverted = 0\n"
    if anchor not in text:
        raise SystemExit("Could not find the place to patch. Tell Claude.")
    line = "    res[\"skills\"] = complete_skills(orig, res)\n"
    text = text.replace(anchor, anchor + line, 1)
    open(PATH, "w", encoding="utf-8").write(text)

py_compile.compile(PATH, doraise=True)
print("patched and compiled")