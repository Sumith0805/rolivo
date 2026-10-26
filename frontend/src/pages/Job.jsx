import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, clearToken } from "../api.js";
import { useFlow } from "../flow.jsx";

const MIN_CHARS = 80;

export default function Job() {
  const navigate = useNavigate();
  const {
    resumeFile,
    jobText,
    jobTitle,
    jobCompany,
    setJobText,
    setJobTitle,
    setJobCompany,
    setResult,
  } = useFlow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!resumeFile) return <Navigate to="/resume" replace />;

  const enough = jobText.trim().length >= MIN_CHARS;

  async function run() {
    setError("");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("resume_file", resumeFile, resumeFile.name);
      form.append("job_text", jobText);
      form.append("resume_text", "");
      form.append("facts", "");
      const out = await api("/rewrite/quick", { method: "POST", form });
      setResult(out);
      navigate("/analysis");
    } catch (err) {
      if (err.status === 401) {
        clearToken();
        navigate("/signin", { replace: true });
        return;
      }
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (busy) {
    return (
      <section>
        <h1 className="page-title">Reading both sides.</h1>
        <p className="page-sub">
          Rolivo is scoring your resume against the job, rewriting it, and checking every claim
          against what you already wrote. This can take up to a minute.
        </p>
        <div className="panel working" role="status" aria-live="polite">
          <div className="shimmer" />
          <div className="shimmer short" />
          <div className="shimmer" />
        </div>
      </section>
    );
  }

  return (
    <section>
      <h1 className="page-title">Now the job.</h1>
      <p className="page-sub">
        Paste the full posting. The more of it you include, the more accurate the match.
      </p>

      <div className="fields">
        <label>
          Job title <span>(optional)</span>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="ML Intern"
          />
        </label>
        <label>
          Company <span>(optional)</span>
          <input
            type="text"
            value={jobCompany}
            onChange={(e) => setJobCompany(e.target.value)}
            placeholder="Test Co"
          />
        </label>
      </div>

      <label className="block-label">
        Job description
        <textarea
          value={jobText}
          onChange={(e) => setJobText(e.target.value)}
          placeholder="Paste the posting here..."
          rows={12}
        />
      </label>
      <p className="count">
        {jobText.trim().length} characters
        {!enough && jobText.trim().length > 0 ? ` · add at least ${MIN_CHARS}` : ""}
      </p>

      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}

      <div className="actions">
        <button type="button" className="btn btn-red" disabled={!enough} onClick={run}>
          Analyze and rewrite
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => navigate("/resume")}>
          Back
        </button>
      </div>
    </section>
  );
}
