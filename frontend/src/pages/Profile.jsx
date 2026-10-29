import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearToken } from "../api.js";
import { completeness, mergeAutofill, withDefaults } from "../profile.js";
import { useProfile } from "../profileContext.jsx";
import { autofill, deleteSaved, fileProblem, listSaved, saveResume, savedText } from "../vault.js";

// the draft keeps skills and achievements as plain text boxes, then turns them back into lists
function toDraft(p) {
  const d = withDefaults(p);
  return { ...d, skillsText: d.skills.join(", "), achievementsText: d.achievements.join("\n") };
}

function fromDraft(d) {
  const { skillsText, achievementsText, ...rest } = d;
  return {
    ...rest,
    skills: skillsText.split(/[,\n]/).map((x) => x.trim()).filter(Boolean),
    achievements: achievementsText.split("\n").map((x) => x.trim()).filter(Boolean),
  };
}

function Field({ label, value, onChange, placeholder, multiline, maxLength, type = "text", help }) {
  return (
    <label className="pf-field">
      <span>{label}</span>
      {multiline ? (
        <textarea className="field-input" rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} />
      ) : (
        <input className="field-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} />
      )}
      {help && <small>{help}</small>}
    </label>
  );
}

// a list the person can add to and remove from (projects, certifications ...)
function Repeater({ title, hint, items, fields, blank, onChange, addLabel, max = 12, heading }) {
  const set = (i, key, value) => onChange(items.map((it, n) => (n === i ? { ...it, [key]: value } : it)));
  return (
    <div className="panel pf-block">
      <h2 className="panel-title">{title}</h2>
      {hint && <p className="pf-hint">{hint}</p>}
      {items.map((it, i) => (
        <div className="pf-item" key={i}>
          <div className="pf-item-head">
            <strong>{heading(it, i)}</strong>
            <button type="button" className="linklike" onClick={() => onChange(items.filter((_, n) => n !== i))}>
              Remove
            </button>
          </div>
          <div className="pf-grid">
            {fields.map((f) => (
              <div key={f.key} className={f.wide ? "pf-wide" : ""}>
                <Field label={f.label} value={it[f.key] || ""} placeholder={f.placeholder} multiline={f.multiline} maxLength={f.maxLength} onChange={(v) => set(i, f.key, v)} />
              </div>
            ))}
          </div>
        </div>
      ))}
      {items.length < max && (
        <button type="button" className="btn btn-ghost pf-add" onClick={() => onChange([...items, { ...blank }])}>
          + {addLabel}
        </button>
      )}
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const { ready, email, profile, unavailable, reason, save } = useProfile();
  const [draft, setDraft] = useState(null);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const saved = useRef("");
  const pick = useRef(null);
  const [kept, setKept] = useState({ list: [], loaded: false, missing: false });
  const [vault, setVault] = useState({ busy: "", message: "", bad: false });

  // resumes kept in the account
  useEffect(() => {
    let live = true;
    listSaved()
      .then((list) => live && setKept({ list, loaded: true, missing: false }))
      .catch((err) => live && setKept({ list: [], loaded: true, missing: err.status === 404 }));
    return () => {
      live = false;
    };
  }, []);

  // fill the form once the profile has loaded
  useEffect(() => {
    if (!ready || draft) return;
    const d = toDraft(profile);
    saved.current = JSON.stringify(fromDraft(d));
    setDraft(d);
  }, [ready, profile, draft]);

  const dirty = draft ? JSON.stringify(fromDraft(draft)) !== saved.current : false;
  const progress = useMemo(() => (draft ? completeness(fromDraft(draft)) : { percent: 0, missing: [] }), [draft]);

  if (!draft) return <p className="lib-note">Loading your profile…</p>;

  const set = (key, value) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setStatus({ state: "idle", message: "" });
  };
  const setLink = (key, value) => set("links", { ...draft.links, [key]: value });

  function vaultFail(err) {
    if (err.status === 401) {
      clearToken();
      navigate("/signin", { replace: true });
      return;
    }
    const msg =
      err.status === 404 && err.message === "Not Found"
        ? "The server you are connected to has no resume storage yet. Update the backend first."
        : err.message || "Something went wrong. Try again.";
    setVault({ busy: "", message: msg, bad: true });
  }

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const bad = files.map(fileProblem).filter(Boolean);
    if (bad.length) {
      setVault({ busy: "", message: bad.join(" "), bad: true });
      return;
    }
    setVault({ busy: "upload", message: "", bad: false });
    try {
      for (const f of files) await saveResume(f);
      setKept({ list: await listSaved(), loaded: true, missing: false });
      setVault({ busy: "", message: files.length > 1 ? `${files.length} resumes saved.` : "Resume saved.", bad: false });
    } catch (err) {
      vaultFail(err);
    }
  }

  async function removeKept(r) {
    setVault({ busy: `del${r.id}`, message: "", bad: false });
    try {
      await deleteSaved(r.id);
      setKept((k) => ({ ...k, list: k.list.filter((x) => x.id !== r.id) }));
      setVault({ busy: "", message: `Removed “${r.name}”.`, bad: false });
    } catch (err) {
      vaultFail(err);
    }
  }

  // reads a saved resume into the form; the person reviews it and presses Save
  async function fillFrom(r) {
    setVault({ busy: `fill${r.id}`, message: "", bad: false });
    try {
      const t = await savedText(r.id);
      const out = await autofill(t.text);
      const { profile: merged, added } = mergeAutofill(fromDraft(draft), out.profile);
      setDraft(toDraft(merged));
      setStatus({ state: "idle", message: "" });
      setVault({
        busy: "",
        message:
          added > 0
            ? `Added ${added} ${added === 1 ? "thing" : "things"} from “${r.name}”. Look through the form below, fix anything that is off, then press Save profile. Anything you had already written was kept.`
            : `Nothing new to add from “${r.name}”. Your profile already has what it shows.`,
        bad: false,
      });
    } catch (err) {
      vaultFail(err);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setStatus({ state: "busy", message: "" });
    try {
      const out = await save(fromDraft(draft));
      const d = toDraft(out);
      saved.current = JSON.stringify(fromDraft(d));
      setDraft(d);
      setStatus({ state: "done", message: "Profile saved." });
    } catch (err) {
      if (err.status === 401) {
        clearToken();
        navigate("/signin", { replace: true });
        return;
      }
      setStatus({
        state: "error",
        message:
          err.status === 404
            ? "The server you are connected to has no profile feature. Check VITE_API_URL in frontend\\.env.local, then try again."
            : err.message || "Could not save. Try again.",
      });
    }
  }

  return (
    <form onSubmit={submit}>
      <h1 className="page-title">Your profile.</h1>
      <p className="page-sub">
        Write it once. Rolivo uses only what you put here, the same way it uses your resume, so it can add your links
        and write a resume even when you have none to upload.
      </p>

      {unavailable && (
        <p className="notice" role="alert">
          Rolivo could not reach the profile on the server ({reason || "unknown reason"}), so nothing here can be saved.
          Usually the backend you are connected to is missing the profile feature, or{" "}
          <code>VITE_API_URL</code> in <code>frontend\.env.local</code> points at the online server instead of your own.
        </p>
      )}

      <div className="panel pf-block pf-resumes">
        <h2 className="panel-title">Your resumes</h2>
        <p className="pf-hint">
          Keep your resumes here. Pick one to fill in this profile for you, or use them later when you start a rewrite.
        </p>
        {kept.missing ? (
          <p className="notice" role="alert">
            The server you are connected to cannot store resumes yet. Update the backend first.
          </p>
        ) : (
          <>
            <input
              ref={pick}
              type="file"
              accept=".pdf,.docx,.txt"
              multiple
              hidden
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {kept.list.length > 0 && (
              <ul className="res-list">
                {kept.list.map((r) => (
                  <li key={r.id} className="res-item">
                    <span className="res-name">{r.name}</span>
                    <span className="pf-resume-actions">
                      <button type="button" className="btn btn-ghost res-del" onClick={() => fillFrom(r)} disabled={Boolean(vault.busy)}>
                        {vault.busy === `fill${r.id}` ? "Reading..." : "Fill my profile from this"}
                      </button>
                      <button type="button" className="btn btn-ghost res-del" onClick={() => removeKept(r)} disabled={Boolean(vault.busy)}>
                        {vault.busy === `del${r.id}` ? "Removing..." : "Delete"}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {kept.loaded && kept.list.length === 0 && <p className="pf-hint">No resumes saved yet.</p>}
            <button type="button" className="btn btn-ghost pf-add" onClick={() => pick.current.click()} disabled={Boolean(vault.busy)}>
              {vault.busy === "upload" ? "Saving..." : "+ Upload resumes"}
            </button>
          </>
        )}
        {vault.message && (
          <p className={`notice${vault.bad ? "" : " ok"}`} role="status">
            {vault.message}
          </p>
        )}
      </div>

      <div className="panel pf-progress">
        <div>
          <h2 className="panel-title">{progress.percent}% complete</h2>
          <p className="pf-hint">
            {progress.percent === 100 ? "Everything is filled in." : `Next: ${progress.missing.slice(0, 3).join(", ")}.`}
          </p>
        </div>
        <div className="meter meter-wide" role="img" aria-label={`Profile ${progress.percent}% complete`}>
          <div style={{ "--p": progress.percent / 100 }} />
        </div>
      </div>

      <div className="panel pf-block">
        <h2 className="panel-title">About you</h2>
        <div className="pf-grid">
          <Field label="Full name" value={draft.full_name} onChange={(v) => set("full_name", v)} placeholder="Asha Verma" maxLength={80} />
          <Field label="Headline" value={draft.headline} onChange={(v) => set("headline", v)} placeholder="Final-year B.Tech student in AI" maxLength={120} />
          <Field label="Phone" value={draft.phone} onChange={(v) => set("phone", v)} placeholder="+91 99999 11111" maxLength={40} />
          <Field label="Location" value={draft.location} onChange={(v) => set("location", v)} placeholder="Hyderabad, India" maxLength={80} />
          <div className="pf-wide">
            <Field label="Short summary (optional)" value={draft.summary} onChange={(v) => set("summary", v)} multiline maxLength={600} placeholder="Two or three honest sentences about you." />
          </div>
        </div>
        <p className="pf-hint">Your account email, {email || "…"}, goes on the resume automatically.</p>
      </div>

      <div className="panel pf-block">
        <h2 className="panel-title">Links</h2>
        <p className="pf-hint">These become clickable links on your resume.</p>
        <div className="pf-grid">
          <Field label="LinkedIn" value={draft.links.linkedin} onChange={(v) => setLink("linkedin", v)} placeholder="linkedin.com/in/yourname" />
          <Field label="GitHub" value={draft.links.github} onChange={(v) => setLink("github", v)} placeholder="github.com/yourname" />
          <Field label="LeetCode" value={draft.links.leetcode} onChange={(v) => setLink("leetcode", v)} placeholder="leetcode.com/u/yourname" />
          <Field label="Portfolio or website" value={draft.links.portfolio} onChange={(v) => setLink("portfolio", v)} placeholder="yourname.dev" />
        </div>
      </div>

      <Repeater
        title="Other coding profiles"
        hint="Kaggle, HackerRank, Codeforces, CodeChef, Medium, anything you want a recruiter to see."
        items={draft.other_links}
        fields={[
          { key: "label", label: "Name", placeholder: "Kaggle", maxLength: 40 },
          { key: "url", label: "Link", placeholder: "kaggle.com/yourname" },
        ]}
        blank={{ label: "", url: "" }}
        onChange={(v) => set("other_links", v)}
        addLabel="Add a link"
        max={8}
        heading={(it, i) => it.label || `Link ${i + 1}`}
      />

      <div className="panel pf-block">
        <h2 className="panel-title">Skills</h2>
        <Field label="Skills you really have" value={draft.skillsText} onChange={(v) => set("skillsText", v)} multiline placeholder="Python, PyTorch, SQL, React" help="Separate with commas. Rolivo will not add a skill that is not in this list or your resume." />
      </div>

      <Repeater
        title="Projects"
        hint="Describe what you built and any real result. Add a link so it can be clicked."
        items={draft.projects}
        fields={[
          { key: "name", label: "Project name", placeholder: "Medicare Fraud Detection", maxLength: 80 },
          { key: "tech", label: "Tech used", placeholder: "Python, Flask", maxLength: 120 },
          { key: "link", label: "Link (GitHub or live demo)", placeholder: "github.com/you/project", wide: true },
          { key: "description", label: "What you built, and the result", placeholder: "Built a fraud detector with a 4-member team...", multiline: true, wide: true, maxLength: 500 },
        ]}
        blank={{ name: "", tech: "", link: "", description: "" }}
        onChange={(v) => set("projects", v)}
        addLabel="Add a project"
        heading={(it, i) => it.name || `Project ${i + 1}`}
      />

      <Repeater
        title="Experience"
        hint="Internships, part-time work, open-source, anything you did for a team."
        items={draft.experience}
        fields={[
          { key: "title", label: "Role", placeholder: "ML Intern", maxLength: 100 },
          { key: "company", label: "Company or team", placeholder: "Acme AI", maxLength: 100 },
          { key: "dates", label: "Dates", placeholder: "Jun 2025 - Aug 2025", maxLength: 40 },
          { key: "details", label: "What you did", placeholder: "Cleaned data and trained a baseline model...", multiline: true, wide: true, maxLength: 500 },
        ]}
        blank={{ title: "", company: "", dates: "", details: "" }}
        onChange={(v) => set("experience", v)}
        addLabel="Add experience"
        max={8}
        heading={(it, i) => [it.title, it.company].filter(Boolean).join(" at ") || `Experience ${i + 1}`}
      />

      <Repeater
        title="Education"
        items={draft.education}
        fields={[
          { key: "degree", label: "Degree", placeholder: "B.Tech, Artificial Intelligence", maxLength: 120 },
          { key: "school", label: "College", placeholder: "Example University", maxLength: 120 },
          { key: "dates", label: "Years", placeholder: "2022 - 2026", maxLength: 40 },
          { key: "details", label: "Details (CGPA, honours)", placeholder: "CGPA 8.6", maxLength: 200 },
        ]}
        blank={{ degree: "", school: "", dates: "", details: "" }}
        onChange={(v) => set("education", v)}
        addLabel="Add education"
        max={6}
        heading={(it, i) => it.degree || it.school || `Education ${i + 1}`}
      />

      <Repeater
        title="Certifications"
        hint="Add a link to the certificate if there is one."
        items={draft.certifications}
        fields={[
          { key: "name", label: "Certification", placeholder: "AWS Cloud Practitioner", maxLength: 120 },
          { key: "issuer", label: "Issued by", placeholder: "Amazon Web Services", maxLength: 80 },
          { key: "year", label: "Year", placeholder: "2025", maxLength: 10 },
          { key: "link", label: "Certificate link", placeholder: "credly.com/badges/..." },
        ]}
        blank={{ name: "", issuer: "", year: "", link: "" }}
        onChange={(v) => set("certifications", v)}
        addLabel="Add a certification"
        max={20}
        heading={(it, i) => it.name || `Certification ${i + 1}`}
      />

      <div className="panel pf-block">
        <h2 className="panel-title">Achievements</h2>
        <Field label="Hackathons, awards, rankings, publications" value={draft.achievementsText} onChange={(v) => set("achievementsText", v)} multiline placeholder={"Winner, college hackathon 2025\nTop 5% on a coding contest"} help="One per line." />
      </div>

      <div className="pf-bar">
        <span className={`pf-note${status.state === "error" ? " bad" : ""}`} role="status">
          {status.message || (dirty ? "You have unsaved changes." : "")}
        </span>
        <button type="submit" className="btn btn-red" disabled={!dirty || status.state === "busy"}>
          {status.state === "busy" ? "Saving..." : "Save profile"}
        </button>
      </div>
    </form>
  );
}
