import { useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../api.js";
import ResumePreview from "../components/ResumePreview.jsx";
import { useFlow } from "../flow.jsx";

const TEMPLATES = [
  { id: "classic", label: "Classic", accent: "#1b1b2f" },
  { id: "projects_first", label: "Projects-first", accent: "#4e50de" },
  { id: "technical", label: "Technical", accent: "#33359f" },
  { id: "compact", label: "Compact", accent: "#3a3a3a" },
  { id: "modern", label: "Modern", accent: "#c4161d" },
];

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");

// Turns the guard's report into short lines a person can read.
function guardRows(check = {}) {
  const rows = [];
  (check.removed_skills || []).forEach((s) =>
    rows.push({ kind: "removed", text: `Removed “${s}”: it is not in your resume.` }),
  );
  (check.flags || []).forEach((f) =>
    rows.push({ kind: "flag", text: `Flag: ${f.type} “${f.value}” in ${f.where}.` }),
  );
  (check.notes || []).forEach((n) => rows.push({ kind: "note", text: String(n) }));
  if (check.repaired) rows.push({ kind: "note", text: "Fixed problems the first draft had." });
  if (check.placeholders > 0) {
    rows.push({
      kind: "warn",
      text: `${check.placeholders} bullets are marked [add a number]. Add a real result before you export.`,
    });
  }
  if (check.passed) rows.push({ kind: "ok", text: "Final check passed. Every claim traces back to your resume." });
  if (rows.length === 0) rows.push({ kind: "ok", text: "Nothing needed removing." });
  return rows;
}

const ICON = { removed: "✕", flag: "!", note: "↺", warn: "!", ok: "✓" };

export default function Rewrite() {
  const { result, jobText, jobTitle, jobCompany } = useFlow();
  const [save, setSave] = useState({ state: "idle", message: "" });
  if (!result) return <Navigate to="/resume" replace />;

  const current = TEMPLATES.find((t) => norm(t.label) === norm(result.template?.label)) ?? TEMPLATES[0];
  const order = result.template?.order || ["summary", "skills", "experience", "projects", "education"];
  const rows = guardRows(result.check);

  async function saveToLibrary() {
    setSave({ state: "busy", message: "" });
    try {
      await api("/library/save", {
        method: "POST",
        body: {
          job: { title: jobTitle || "Untitled job", company: jobCompany || "", text: jobText },
          original: { name: result.resume?.name || "", summary: "" },
          tailored: result.resume,
          template: result.template?.id ?? result.template?.key ?? current.id,
          role: result.role?.id ?? result.role?.key ?? "general",
          before: result.before,
          after: result.after,
          changes: result.changes || [],
        },
      });
      setSave({ state: "done", message: "Saved to your library." });
    } catch (err) {
      setSave({ state: "error", message: err.message || "Could not save. Try again." });
    }
  }

  return (
    <section>
      <h1 className="page-title">Your resume, rewritten.</h1>
      <p className="page-sub">
        Tailored to the job using only what your resume already shows. Pick a template, then export.
      </p>

      <div className="pills" role="list">
        {TEMPLATES.map((t) => {
          const on = t.id === current.id;
          return (
            <button
              key={t.id}
              type="button"
              role="listitem"
              className={`pill${on ? " on" : ""}`}
              disabled={!on}
              title={on ? "Suggested for this job" : "More templates arrive in the next step"}
            >
              {t.label}
              {on && <small>suggested</small>}
            </button>
          );
        })}
      </div>

      <div className="rw">
        <ResumePreview resume={result.resume} order={order} accent={current.accent} />

        <aside className="panel guard">
          <h2 className="panel-title">What the guard did</h2>
          <ul className="rows">
            {rows.map((r, i) => (
              <li className={`row ${r.kind}`} key={i}>
                <i aria-hidden="true">{ICON[r.kind]}</i>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>

          <div className="actions">
            <button
              type="button"
              className="btn btn-red"
              disabled
              title="Word export is wired in the next step"
            >
              Export Word
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={saveToLibrary}
              disabled={save.state === "busy" || save.state === "done"}
            >
              {save.state === "busy" ? "Saving..." : save.state === "done" ? "Saved" : "Save to library"}
            </button>
          </div>
          {save.message && (
            <p className={`notice${save.state === "error" ? "" : " ok"}`} role="status">
              {save.message}
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
