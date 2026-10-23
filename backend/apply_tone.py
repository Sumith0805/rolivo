import py_compile

PATH = "guard.py"
text = open(PATH, encoding="utf-8").read()

if "clean_up" not in text:
    text = text.replace(
        "from skills_guard import",
        "from tone_guard import clean_up\nfrom skills_guard import",
        1,
    )
    anchor = "    res[\"skills\"] = complete_skills(orig, res)\n"
    if anchor not in text:
        raise SystemExit("Could not find the place to patch. Tell Claude.")
    text = text.replace(anchor, anchor + "    res = clean_up(orig, res)\n", 1)
    open(PATH, "w", encoding="utf-8").write(text)

py_compile.compile(PATH, doraise=True)
print("patched and compiled")