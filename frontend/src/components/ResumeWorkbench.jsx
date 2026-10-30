import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearToken } from "../api.js";
import { downloadFile } from "../files.js";
import { fullSpec, resolveId, useTemplates } from "../templates.js";
import { useAtsScore } from "../ats.js";
import AtsPanel from "./AtsPanel.jsx";
import Burst from "./Burst.jsx";
import ResumePreview from "./ResumePreview.jsx";
import StylePanel from "./StylePanel.jsx";
import TemplateThumb from "./TemplateThumb.jsx";

const MARK = /\[add a number\]/i;
const CHIPS = [
  "Make it fit one page",
  "Shorten the summary",
  "Put projects before experience",
  "Use stronger action verbs",
  "Focus on the skills in the job",
];

// Finds every bullet (or the summary) that still has an [add a number] marker.
function findMarkers(r) {
  const out = [];
  if (MARK.test(r.summary || "")) out.push({ key: "summary", where: "Summary", text: r.summary, path: ["summary"] });
  (r.experience || []).forEach((e, i) =>
    (e.bullets || []).forEach((b, j) => {
      if (MARK.test(b)) out.push({ key: `e${i}-${j}`, where: e.title || e.company || "Experience", text: b, path: ["experience", i, "bullets", j] });
    }),
  );
  (r.projects || []).forEach((p, i) =>
    (p.bullets || []).forEach((b, j) => {
      if (MARK.test(b)) out.push({ key: `p${i}-${j}`, where: p.name || "Project", text: b, path: ["projects", i, "bullets", j] });
    }),
  );
  return out;
}

function replaceAt(resume, path, value) {
  const next = JSON.parse(JSON.stringify(resume));
  let node = next;
  for (let k = 0; k < path.length - 1; k++) node = node[path[k]];
  const last = path[path.length - 1];
  if (value === null && Array.isArray(node)) node.splice(last, 1);
  else node[last] = String(node[last]).replace(MARK, value);
  return next;
}

// edits made by typing on the preview: set one value, add or remove bullets, entries and items
function setAtPath(resume, path, raw) {
  const next = JSON.parse(JSON.stringify(resume));
  let node = next;
  for (let k = 0; k < path.length - 1; k++) {
    if (node[path[k]] === undefined || node[path[k]] === null) node[path[k]] = typeof path[k + 1] === "number" ? [] : {};
    node = node[path[k]];
  }
  const last = path[path.length - 1];
  node[last] = last === "items" ? String(raw).split(",").map((x) => x.trim()).filter(Boolean) : raw;
  return next;
}

const BLANK = {
  experience: () => ({ title: "", company: "", location: "", dates: "", bullets: [""] }),
  projects: () => ({ name: "", tech: "", link: "", bullets: [""] }),
  education: () => ({ degree: "", school: "", dates: "", details: "" }),
  skills: () => ({ group: "", items: [] }),
};

// what goes to the server: no empty bullets, no empty entries
export function tidy(resume) {
  const r = JSON.parse(JSON.stringify(resume));
  const keep = (x) => typeof x === "string" && x.trim();
  ["experience", "projects"].forEach((k) => {
    r[k] = (r[k] || [])
      .map((e) => ({ ...e, bullets: (e.bullets || []).filter(keep) }))
      .filter((e) => keep(e.title) || keep(e.company) || keep(e.name));
  });
  r.education = (r.education || []).filter((e) => keep(e.degree) || keep(e.school));
  r.skills = (r.skills || []).filter((g) => (g && typeof g === "object" ? (g.items || []).length : keep(g)));
  ["certifications", "achievements"].forEach((k) => {
    if (Array.isArray(r[k])) r[k] = r[k].filter((c) => (typeof c === "string" ? keep(c) : c && keep(c.name)));
  });
  if (r.contact && Array.isArray(r.contact.links)) r.contact.links = r.contact.links.filter(keep);
  return r;
}

function guardRows(check = {}, left = 0, hadMarkers = false) {
  const rows = [];
  (check.removed_skills || []).forEach((s) => rows.push({ kind: "removed", text: `Removed “${s}”: it is not in your resume.` }));
  (check.flags || []).forEach((f) => rows.push({ kind: "flag", text: `Flag: ${f.type} “${f.value}” in ${f.where}.` }));
  (check.notes || []).forEach((n) => rows.push({ kind: "note", text: String(n) }));
  if (check.repaired) rows.push({ kind: "note", text: "Fixed problems the first draft had." });
  if (left > 0) {
    rows.push({
      kind: "warn",
      text: `${left} ${left === 1 ? "line is" : "lines are"} marked [add a number]. Add a real result below, or remove the line, before you export.`,
    });
  } else if (hadMarkers) {
    rows.push({ kind: "ok", text: "All numbers added. Ready to export." });
  }
  if (check.passed) rows.push({ kind: "ok", text: "Final check passed. Every claim traces back to your resume." });
  if (rows.length === 0) rows.push({ kind: "ok", text: Object.keys(check).length ? "Nothing needed removing." : "Ready to export." });
  return rows;
}

const ICON = { removed: "✕", flag: "!", note: "↺", warn: "!", ok: "✓" };

function FillIn({ marker, onApply }) {
  const [value, setValue] = useState("");
  const ok = value.trim().length > 0;
  return (
    <form
      className="fill-item"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onApply(marker, value.trim());
      }}
    >
      <p className="fill-where">{marker.where}</p>
      <p className="fill-text">{marker.text}</p>
      <div className="fill-row">
        <input
          className="field-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 91% accuracy on 12,000 records"
          aria-label={`Real result for ${marker.where}`}
        />
        <button type="submit" className="btn btn-ghost fill-btn" disabled={!ok}>
          Use this
        </button>
        {marker.path.length === 4 && (
          <button type="button" className="linklike" onClick={() => onApply(marker, null)}>
            Remove this line
          </button>
        )}
      </div>
    </form>
  );
}

export default function ResumeWorkbench({
  resume: startResume,
  template: startTemplate = "",
  suggestedId = "",
  layout = null, // the layout found in the person's own uploaded resume, if any
  check = null,
  jobText = "",
  facts = "",
  saveLabel = "Save to library",
  savedMessage = "Saved to your library.",
  onSave,
}) {
  const navigate = useNavigate();
  const { templates, groups } = useTemplates();
  const yours = useMemo(() => fullSpec(layout), [layout]);
  const [resume, setResume] = useState(startResume);
  const [history, setHistory] = useState([]); // earlier versions, for Undo
  const [tid, setTid] = useState(yours ? "yours" : resolveId(startTemplate));
  const [group, setGroup] = useState("all");
  const [gallery, setGallery] = useState(false);
  const [hadMarkers, setHadMarkers] = useState(false);
  const [save, setSave] = useState({ state: "idle", message: "" });
  const [exp, setExp] = useState({ state: "idle", message: "" });
  const [ask, setAsk] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [rf, setRf] = useState({ state: "idle", notes: [], applied: false });
  const [flash, setFlash] = useState(0); // bumps to play a short glow when the resume changes
  const [editing, setEditing] = useState(false);
  const [styling, setStyling] = useState(false);
  const [tweaks, setTweaks] = useState({});

  const tidied = useMemo(() => tidy(resume), [resume]);
  const { report: atsReport } = useAtsScore(tidied);
  const markers = useMemo(() => findMarkers(resume), [resume]);
  useEffect(() => {
    if (markers.length > 0) setHadMarkers(true);
  }, [markers.length]);

  const shownTemplates = group === "all" ? templates : templates.filter((t) => (t.best_for || []).includes(group));
  const all = yours ? [yours, ...shownTemplates] : shownTemplates;
  const pool = yours ? [yours, ...templates] : templates;
  const current = pool.find((t) => t.id === tid) || templates.find((t) => t.id === resolveId(suggestedId)) || templates[0];
  const rows = guardRows(check || {}, markers.length, hadMarkers);
  // the chosen template, plus any style changes the person made on top of it
  const view = useMemo(() => {
    if (!current) return current;
    const v = { ...current, ...tweaks };
    if (tweaks.accent) {
      v.rule = tweaks.accent;
      v.link = tweaks.accent;
    }
    v.headings = { ...(current.headings || {}), ...(tweaks.headings || {}) };
    return v;
  }, [current, tweaks]);

  function touched() {
    setAsk(null);
    setSave({ state: "idle", message: "" });
    setExp({ state: "idle", message: "" });
  }
  function choose(id) {
    setTid(id);
    touched();
  }
  function applyMarker(marker, value) {
    setHistory((h) => [...h, resume]);
    setResume((r) => replaceAt(r, marker.path, value));
    setFlash((f) => f + 1);
    touched();
  }
  function commit(next) {
    setHistory((h) => [...h, resume]);
    setResume(next);
    touched();
  }
  const edit = editing
    ? {
        set: (path, value) => commit(setAtPath(resume, path, value)),
        addBullet: (base) => {
          const next = JSON.parse(JSON.stringify(resume));
          const entry = base.reduce((n, k) => n[k], next);
          entry.bullets = [...(entry.bullets || []), ""];
          commit(next);
        },
        removeBullet: (base, j) => {
          const next = JSON.parse(JSON.stringify(resume));
          const entry = base.reduce((n, k) => n[k], next);
          entry.bullets.splice(j, 1);
          commit(next);
        },
        addEntry: (kind) => {
          const next = JSON.parse(JSON.stringify(resume));
          next[kind] = [...(next[kind] || []), BLANK[kind]()];
          commit(next);
        },
        removeEntry: (kind, i) => {
          const next = JSON.parse(JSON.stringify(resume));
          next[kind].splice(i, 1);
          commit(next);
        },
        addItem: (key) => {
          const next = JSON.parse(JSON.stringify(resume));
          next[key] = [...(next[key] || []), ""];
          commit(next);
        },
        removeItem: (key, i) => {
          const next = JSON.parse(JSON.stringify(resume));
          next[key].splice(i, 1);
          commit(next);
        },
      }
    : null;

  // the style changes that must also reach the Word and PDF files
  function styleForExport() {
    if (Object.keys(tweaks).length === 0) return null;
    const keys = ["font", "size", "accent", "density", "order", "hide"];
    const out = {};
    keys.forEach((k) => {
      if (view[k] !== undefined) out[k] = view[k];
    });
    if (tweaks.accent) {
      out.rule = tweaks.accent;
      out.link = tweaks.accent;
    }
    out.headings = view.headings || {};
    return out;
  }

  function authLost(err) {
    if (err && err.status === 401) {
      clearToken();
      navigate("/signin", { replace: true });
      return true;
    }
    return false;
  }

  function startExport(kind) {
    if (markers.length > 0) {
      setAsk(kind);
      return;
    }
    runExport(kind, false);
  }

  // asks the server to build the real file, then the browser downloads it
  async function runExport(kind, anyway) {
    setAsk(null);
    setExp({ state: "busy", kind, message: "" });
    try {
      const style = styleForExport();
      const layoutArg =
        current.id === "yours"
          ? { template: "plain_ats", spec: { ...layout, id: "yours", ...(style || {}) }, allowPlaceholders: anyway }
          : { template: current.id, spec: style, allowPlaceholders: anyway };
      await downloadFile(kind, tidied, layoutArg);
      setExp({ state: "done", message: kind === "pdf" ? "PDF downloaded." : "Word file downloaded." });
    } catch (err) {
      if (authLost(err)) return;
      setExp({ state: "error", message: err.message || "Could not export. Try again." });
    }
  }

  async function saveNow() {
    setSave({ state: "busy", message: "" });
    try {
      await onSave(tidied, current.id === "yours" ? resolveId(suggestedId) || "plain_ats" : current.id);
      setSave({ state: "done", message: savedMessage });
    } catch (err) {
      if (authLost(err)) return;
      setSave({ state: "error", message: err.message || "Could not save. Try again." });
    }
  }

  async function runRefine() {
    const text = prompt.trim();
    if (text.length < 3) return;
    setRf({ state: "busy", notes: [], applied: false });
    try {
      // the layout on screen goes along, so a request like "one page" is measured on the real file
      const style = styleForExport();
      const la =
        current.id === "yours"
          ? { template: "plain_ats", spec: { ...layout, id: "yours", ...(style || {}) } }
          : { template: current.id, spec: style };
      const out = await api("/refine", { method: "POST", body: { resume, instruction: text, job_text: jobText, facts, template: la.template, spec: la.spec } });
      if (out.applied) {
        setHistory((h) => [...h, resume]);
        setResume(out.resume);
        if (out.style && Object.keys(out.style).length > 0) setTweaks((t) => ({ ...t, ...out.style }));
        setFlash((f) => f + 1);
        setPrompt("");
        touched();
      }
      setRf({ state: "done", notes: out.notes || [], applied: Boolean(out.applied) });
    } catch (err) {
      if (authLost(err)) return;
      const missing = err.status === 404 || err.status === 405;
      setRf({
        state: "error",
        notes: [missing ? "The server does not have this feature yet. Update the backend, then try again." : err.message || "Could not change it. Try again."],
        applied: false,
      });
    }
  }

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      setResume(h[h.length - 1]);
      setFlash((f) => f + 1);
      touched();
      setRf({ state: "idle", notes: [], applied: false });
      return h.slice(0, -1);
    });
  }

  const busy = exp.state === "busy";

  return (
    <>
      <div className="tpl-tools rw-tools">
        <label>
          <span className="sr-only">Show templates for</span>
          <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Show templates for">
            <option value="all">All templates</option>
            {Object.entries(groups).map(([k, label]) => (
              <option key={k} value={k}>
                Best for: {label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-ghost" onClick={() => setGallery((g) => !g)} aria-expanded={gallery}>
          {gallery ? "Hide the comparison" : "See my resume in every template"}
        </button>
      </div>

      <div className="tpl-row" role="list">
        {all.map((t) => {
          const on = t.id === current.id;
          return (
            <button key={t.id} type="button" role="listitem" className={`tpl${on ? " on" : ""}`} aria-pressed={on} onClick={() => choose(t.id)} title={t.blurb}>
              <TemplateThumb spec={t} />
              <span className="tpl-name">{t.label}</span>
              {t.id === "yours" ? <small>from your upload</small> : suggestedId && t.id === resolveId(suggestedId) ? <small>suggested</small> : null}
            </button>
          );
        })}
      </div>
      <p className="tpl-note">{current.blurb}</p>

      {gallery && (
        <div className="gallery">
          <h2 className="panel-title">Your resume in every template</h2>
          <p className="fill-help">Tap one to use it. Word and PDF files come out looking just like the one you pick.</p>
          <div className="gallery-grid">
            {pool.map((t) => (
              <button key={t.id} type="button" className={`gallery-card${t.id === current.id ? " on" : ""}`} onClick={() => choose(t.id)}>
                <div className="gc-clip">
                  <ResumePreview resume={resume} spec={t} mini />
                </div>
                <strong>{t.label}</strong>
                <small>{t.blurb}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rw">
        <div className="rw-main">
          <div className="ed-bar">
            <button type="button" className={`btn ${editing ? "btn-red" : "btn-ghost"}`} aria-pressed={editing} onClick={() => setEditing((v) => !v)}>
              {editing ? "Done editing" : "Edit the text on the page"}
            </button>
            <button type="button" className={`btn ${styling ? "btn-red" : "btn-ghost"}`} aria-pressed={styling} onClick={() => setStyling((v) => !v)}>
              {styling ? "Hide style controls" : "Style and sections"}
            </button>
          </div>
          {editing && <p className="fill-help">Click any text on the page and type. Changes save as you click away. Hover a line to remove it, or use the + links to add more.</p>}
          {styling && <StylePanel view={view} tweaks={tweaks} onChange={setTweaks} resume={resume} onResume={commit} />}
          <div className="paper-stage">
            <div key={view.id} className="paper-fade">
              <ResumePreview resume={resume} spec={view} edit={edit} />
            </div>
            {flash > 0 && <span key={flash} className="paper-flash" aria-hidden="true" />}
          </div>

          {markers.length > 0 && (
            <div className="panel fill">
              <h2 className="panel-title">Add your real numbers</h2>
              <p className="fill-help">Rolivo never invents results. Type a real one from your own work and it replaces the marker.</p>
              {markers.map((m) => (
                <FillIn key={`${m.key}:${m.text}`} marker={m} onApply={applyMarker} />
              ))}
            </div>
          )}

          <div className="panel refine">
            <h2 className="panel-title">Want it changed?</h2>
            <p className="fill-help">Say what you would like in your own words. Rolivo rewrites the resume to match, using only what is already in it.</p>
            <textarea
              className="refine-box"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) runRefine();
              }}
              placeholder="e.g. Make the summary shorter and lead with my machine learning projects"
              aria-label="What should change"
              maxLength={800}
            />
            <div className="refine-chips">
              {CHIPS.map((c) => (
                <button key={c} type="button" className="chip" onClick={() => setPrompt(c)}>
                  {c}
                </button>
              ))}
            </div>
            <div className="actions">
              <button type="button" className="btn btn-red" onClick={runRefine} disabled={rf.state === "busy" || prompt.trim().length < 3}>
                {rf.state === "busy" ? "Rewriting..." : "Rewrite with this"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={undo} disabled={history.length === 0 || rf.state === "busy"}>
                Undo last change
              </button>
            </div>
            {rf.notes.length > 0 && (
              <ul className="rows" role="status">
                {rf.notes.map((n, i) => (
                  <li className={`row ${rf.state === "error" || !rf.applied ? "warn" : "ok"}`} key={i}>
                    <i aria-hidden="true">{rf.state === "error" || !rf.applied ? "!" : "✓"}</i>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <aside className="panel guard">
          {atsReport && (
            <div className="ats-box">
              <AtsPanel report={atsReport} compact />
            </div>
          )}
          <h2 className="panel-title">{check ? "What the guard did" : "Status"}</h2>
          <ul className="rows">
            {rows.map((r, i) => (
              <li className={`row ${r.kind}`} key={i}>
                <i aria-hidden="true">{ICON[r.kind]}</i>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>

          <div className="actions">
            <button type="button" className="btn btn-red" onClick={() => startExport("docx")} disabled={busy} title="Download as a Word file">
              {busy && exp.kind === "docx" ? "Preparing..." : "Download Word"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => startExport("pdf")} disabled={busy} title="Download as a PDF file">
              {busy && exp.kind === "pdf" ? "Preparing..." : "Download PDF"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={saveNow} disabled={save.state === "busy" || save.state === "done"}>
              {save.state === "busy" ? "Saving..." : save.state === "done" ? "Saved" : saveLabel}
            </button>
          </div>
          {ask && (
            <div className="export-ask" role="alert">
              <p>
                {markers.length} {markers.length === 1 ? "line still says" : "lines still say"} “[add a number]” and will show up in the file. Fill{" "}
                {markers.length === 1 ? "it" : "them"} in or remove {markers.length === 1 ? "it" : "them"} first, or download anyway.
              </p>
              <div className="actions">
                <button type="button" className="btn btn-red" onClick={() => runExport(ask, true)}>
                  Download anyway
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setAsk(null)}>
                  I&apos;ll fill them in
                </button>
              </div>
            </div>
          )}
          {exp.message && (
            <p className={`notice${exp.state === "error" ? "" : " ok"}`} role="status">
              {exp.state === "done" && <Burst key={exp.message} />}
              {exp.message}
            </p>
          )}
          {save.message && (
            <p className={`notice${save.state === "error" ? "" : " ok"}`} role="status">
              {save.state === "done" && <Burst key={save.message} />}
              {save.message}
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
