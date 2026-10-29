import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, clearToken } from "../api.js";
import DocArt from "../components/DocArt.jsx";
import Loader3D from "../components/Loader3D.jsx";

export function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function Library() {
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading", items: [], message: "" });
  const [labels, setLabels] = useState({ roles: {}, templates: {} });
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState(null); // { id, value }
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState({ kind: "", text: "" });

  useEffect(() => {
    let live = true;
    api("/library")
      .then((items) => live && setState({ status: "ready", items: Array.isArray(items) ? items : [], message: "" }))
      .catch((err) => {
        if (!live) return;
        if (err.status === 401) {
          clearToken();
          navigate("/signin", { replace: true });
          return;
        }
        setState({ status: "error", items: [], message: err.message || "Could not load your library." });
      });
    api("/roles")
      .then((d) => {
        if (!live) return;
        const roles = {};
        const templates = {};
        (d.roles || []).forEach((r) => (roles[r.id] = r.label));
        (d.templates || []).forEach((t) => (templates[t.id] = t.label));
        setLabels({ roles, templates });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [navigate]);

  async function reload() {
    const items = await api("/library");
    setState({ status: "ready", items: Array.isArray(items) ? items : [], message: "" });
  }

  // there is no rename route on the server, so a copy is saved under the new title
  async function copyAs(it, title, removeOld) {
    setBusy(String(it.id));
    setMsg({ kind: "", text: "" });
    try {
      const full = await api(`/library/${it.id}`);
      await api("/library/save", {
        method: "POST",
        body: {
          job: { ...(full.job || {}), title },
          original: full.original || {},
          tailored: full.tailored || {},
          template: full.template || "",
          role: full.role || "",
          before: full.before || {},
          after: full.after || {},
          changes: full.changes || [],
        },
      });
      if (removeOld) await api(`/library/${it.id}`, { method: "DELETE" });
      await reload();
      setMsg({ kind: "ok", text: removeOld ? "Renamed." : "Duplicated. The copy is at the top." });
    } catch (err) {
      if (err.status === 401) {
        clearToken();
        navigate("/signin", { replace: true });
        return;
      }
      setMsg({ kind: "err", text: err.message || "Something went wrong. Nothing was lost." });
    } finally {
      setBusy("");
      setRenaming(null);
    }
  }

  const q = query.trim().toLowerCase();
  const shown = state.items.filter((it) => {
    if (!q) return true;
    const hay = [it.job_title, it.company, labels.roles[it.role], labels.templates[it.template]].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });

  return (
    <section>
      <h1 className="page-title">Your library.</h1>
      <p className="page-sub">Every resume you saved, ready to open, edit and export again.</p>

      {state.status === "loading" && <Loader3D small label="Loading your saved resumes" />}
      {state.status === "error" && (
        <p className="notice" role="alert">
          {state.message}
        </p>
      )}

      {state.status === "ready" && state.items.length === 0 && (
        <div className="panel lib-empty">
          <DocArt />
          <h2 className="panel-title">Nothing saved yet</h2>
          <p>Rewrite a resume and press “Save to library” to keep it here.</p>
          <Link to="/resume" className="btn btn-red">
            Start a resume
          </Link>
        </div>
      )}

      {state.items.length > 0 && (
        <div className="lib-tools">
          <input
            className="field-input lib-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by job, company, role or template"
            aria-label="Search your library"
          />
          <span className="lib-count">
            {shown.length} of {state.items.length}
          </span>
        </div>
      )}
      {msg.text && (
        <p className={`notice${msg.kind === "ok" ? " ok" : ""}`} role="status">
          {msg.text}
        </p>
      )}
      {state.items.length > 0 && shown.length === 0 && <p className="lib-note">Nothing matches “{query}”.</p>}

      {shown.length > 0 && (
        <ul className="lib-grid">
          {shown.map((it) => (
            <li key={it.id}>
              <Link to={`/library/${it.id}`} className="lib-card">
                <h2>{it.job_title || "Untitled job"}</h2>
                {it.company && <p className="lib-company">{it.company}</p>}
                <p className="lib-meta">
                  {[labels.roles[it.role], labels.templates[it.template]].filter(Boolean).join(" · ")}
                </p>
                <div className="lib-foot">
                  <span className="lib-score">
                    {it.before?.overall ?? "–"} <i aria-hidden="true">→</i> <b>{it.after?.overall ?? "–"}</b>
                  </span>
                  <span className="lib-date">{formatDate(it.created_at)}</span>
                </div>
              </Link>
              {renaming && renaming.id === it.id ? (
                <form
                  className="lib-actions"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (renaming.value.trim()) copyAs(it, renaming.value.trim().slice(0, 120), true);
                  }}
                >
                  <input className="field-input" autoFocus value={renaming.value} onChange={(e) => setRenaming({ id: it.id, value: e.target.value })} aria-label="New name" maxLength={120} />
                  <button type="submit" className="linklike" disabled={busy === String(it.id)}>
                    Save name
                  </button>
                  <button type="button" className="linklike" onClick={() => setRenaming(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="lib-actions">
                  <button type="button" className="linklike" onClick={() => setRenaming({ id: it.id, value: it.job_title || "" })} disabled={busy !== ""}>
                    Rename
                  </button>
                  <button type="button" className="linklike" onClick={() => copyAs(it, `${it.job_title || "Untitled job"} (copy)`.slice(0, 120), false)} disabled={busy !== ""}>
                    {busy === String(it.id) ? "Working..." : "Duplicate"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
