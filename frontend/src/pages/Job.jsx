import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, clearToken } from "../api.js";
import { hasContent, profileToFacts, profileToResumeText } from "../profile.js";
import { useProfile } from "../profileContext.jsx";
import { useFlow } from "../flow.jsx";
import StagedProgress from "../components/StagedProgress.jsx";
import { combineTexts, extractText, savedText } from "../vault.js";

const MIN_CHARS = 80;

export default function Job() {
  const navigate = useNavigate();
  const {
    resumes,
    hasResume,
    fromProfile,
    jobText,
    jobTitle,
    jobCompany,
    setJobText,
    setJobTitle,
    setJobCompany,
    setResult,
    setLayout,
  } = useFlow();
  const { profile, email } = useProfile();
  const [useFacts, setUseFacts] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!hasResume && !fromProfile) return <Navigate to="/resume" replace />;
  const canUseFacts = !fromProfile && hasContent(profile);

  const enough = jobText.trim().length >= MIN_CHARS;

  async function run() {
    setError("");
    setBusy(true);
    try {
      const form = new FormData();
      const uploads = resumes.filter((r) => r.file);
      // the layout is read from the first uploaded Word file (or the first upload of any kind)
      const layoutFile = uploads.find((r) => /\.docx$/i.test(r.name))?.file || uploads[0]?.file || null;
      if (fromProfile) {
        form.append("resume_text", profileToResumeText(profile, email));
      } else if (resumes.length === 1 && resumes[0].file) {
        form.append("resume_file", resumes[0].file, resumes[0].name);
        form.append("resume_text", "");
      } else {
        // several resumes (or a saved one): read each, then send them as one text
        const parts = [];
        for (const r of resumes) {
          const t = r.file ? await extractText(r.file) : await savedText(r.savedId);
          parts.push({ name: t.name || r.name, text: t.text || "" });
        }
        form.append("resume_text", combineTexts(parts));
      }
      form.append("job_text", jobText);
      form.append("facts", canUseFacts && useFacts ? profileToFacts(profile) : "");
      // the whole profile, so the rewrite can use projects and experience that are not in the uploaded resume
      form.append("profile_json", fromProfile || (canUseFacts && useFacts) ? JSON.stringify(profile) : "");
      // the layout of the uploaded resume, so the rewrite can come back in the person's own style
      let found = null;
      if (!fromProfile && layoutFile) {
        try {
          const lf = new FormData();
          lf.append("resume_file", layoutFile, layoutFile.name);
          const d = await api("/layout/detect", { method: "POST", form: lf });
          found = d && d.spec ? d.spec : null;
        } catch (err) {
          if (err.status === 401) throw err;
        }
      }
      const out = await api("/rewrite/quick", { method: "POST", form });
      setLayout(found);
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
        <div className="panel working">
          <StagedProgress
            steps={[
              "Reading your resume",
              "Reading the job posting",
              "Scoring how well they match",
              "Rewriting, without inventing anything",
              "Checking every claim against your resume",
            ]}
          />
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
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && enough) run();
          }}
          placeholder="Paste the posting here..."
          rows={12}
        />
      </label>
      <p className="count">
        {jobText.trim().length} characters
        {!enough && jobText.trim().length > 0 ? ` · add at least ${MIN_CHARS}` : ""}
      </p>

      {canUseFacts && (
        <label className="check-row">
          <input type="checkbox" checked={useFacts} onChange={(e) => setUseFacts(e.target.checked)} />
          <span>Also use my profile (projects, experience, skills, links, certifications). Rolivo picks the projects that fit this job best. Only what you wrote there is used.</span>
        </label>
      )}

      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}

      <div className="actions">
        <button type="button" className="btn btn-red" disabled={!enough} onClick={run}>
          Analyze and rewrite
        </button>
        {enough && <span className="key-hint">or press Ctrl + Enter</span>}
        <button type="button" className="btn btn-ghost" onClick={() => navigate("/resume")}>
          Back
        </button>
      </div>
    </section>
  );
}
