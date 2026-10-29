import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, clearToken } from "../api.js";
import ResumeWorkbench from "../components/ResumeWorkbench.jsx";
import { formatDate } from "./Library.jsx";

export default function LibraryItem() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "loading", item: null, message: "" });
  const [del, setDel] = useState({ ask: false, busy: false, message: "" });

  useEffect(() => {
    let live = true;
    setState({ status: "loading", item: null, message: "" });
    api(`/library/${id}`)
      .then((item) => live && setState({ status: "ready", item, message: "" }))
      .catch((err) => {
        if (!live) return;
        if (err.status === 401) {
          clearToken();
          navigate("/signin", { replace: true });
          return;
        }
        setState({ status: "error", item: null, message: err.message || "Could not open this resume." });
      });
    return () => {
      live = false;
    };
  }, [id, navigate]);

  async function remove() {
    setDel({ ask: true, busy: true, message: "" });
    try {
      await api(`/library/${id}`, { method: "DELETE" });
      navigate("/library", { replace: true });
    } catch (err) {
      setDel({ ask: false, busy: false, message: err.message || "Could not delete. Try again." });
    }
  }

  if (state.status === "loading") return <p className="lib-note">Opening…</p>;
  if (state.status === "error" || !state.item?.tailored || !Object.keys(state.item.tailored).length) {
    return (
      <section>
        <h1 className="page-title">Not found.</h1>
        <p className="page-sub">{state.message || "This saved resume is empty or no longer exists."}</p>
        <Link to="/library" className="btn btn-ghost">
          Back to library
        </Link>
      </section>
    );
  }

  const { item } = state;
  const title = item.job?.title || "Untitled job";

  return (
    <section>
      <Link to="/library" className="back-link">
        ← Library
      </Link>
      <h1 className="page-title">{title}.</h1>
      <p className="page-sub">
        {[item.job?.company, formatDate(item.created_at)].filter(Boolean).join(" · ")}
        {item.after?.overall != null && ` · score ${item.before?.overall ?? "–"} → ${item.after.overall}`}
      </p>

      <ResumeWorkbench
        key={item.id}
        resume={item.tailored}
        template={item.template || ""}
        jobText={item.job?.text || ""}
        saveLabel="Save changes"
        savedMessage="Changes saved."
        onSave={(resume, templateId) =>
          api(`/library/${item.id}`, { method: "PUT", body: { resume, template: templateId } })
        }
      />

      <div className="lib-danger">
        {del.ask ? (
          <>
            <span>Delete this saved resume for good?</span>
            <button type="button" className="btn btn-ghost" onClick={remove} disabled={del.busy}>
              {del.busy ? "Deleting..." : "Yes, delete"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setDel({ ask: false, busy: false, message: "" })} disabled={del.busy}>
              Keep it
            </button>
          </>
        ) : (
          <button type="button" className="linklike" onClick={() => setDel({ ask: true, busy: false, message: "" })}>
            Delete this resume
          </button>
        )}
        {del.message && <p className="notice">{del.message}</p>}
      </div>
    </section>
  );
}
