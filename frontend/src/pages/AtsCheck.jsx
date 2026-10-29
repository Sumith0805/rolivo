import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearToken } from "../api.js";
import { checkResumeFile } from "../ats.js";
import { fileProblem } from "../vault.js";
import { mergeProfile, profileToFacts } from "../profile.js";
import { useProfile } from "../profileContext.jsx";
import AtsFix from "../components/AtsFix.jsx";
import Burst from "../components/Burst.jsx";
import StagedProgress from "../components/StagedProgress.jsx";
import AtsPanel from "../components/AtsPanel.jsx";
import ResumeWorkbench from "../components/ResumeWorkbench.jsx";

export default function AtsCheck() {
  const navigate = useNavigate();
  const { profile, email } = useProfile();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [state, setState] = useState({ phase: "idle", error: "", report: null, resume: null });
  const [fixed, setFixed] = useState(null); // { resume, report, notes, before }
  const [editing, setEditing] = useState(false);
  const [busyFix, setBusyFix] = useState(false);
  const [fixError, setFixError] = useState("");

  function fail(err, fallback) {
    if (err.status === 401) {
      clearToken();
      navigate("/signin", { replace: true });
      return "";
    }
    const missing = err.status === 404 || err.status === 405;
    return missing ? "The server does not have this feature yet. Update the backend, then try again." : err.message || fallback;
  }

  function pick(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const bad = fileProblem(f);
    if (bad) {
      setFile(null);
      setState({ phase: "error", error: bad, report: null, resume: null });
      return;
    }
    setFile(f);
    setFixed(null);
    setEditing(false);
    setState({ phase: "idle", error: "", report: null, resume: null });
  }

  async function run() {
    setFixed(null);
    setEditing(false);
    setState({ phase: "busy", error: "", report: null, resume: null });
    try {
      const out = await checkResumeFile(file, text);
      setState({ phase: "done", error: "", report: out, resume: out.resume });
    } catch (err) {
      setState({ phase: "error", error: fail(err, "Could not check it. Try again."), report: null, resume: null });
    }
  }

  async function improve(answers) {
    setBusyFix(true);
    setFixError("");
    try {
      const out = await api("/ats/improve", { method: "POST", body: { resume: fixed ? fixed.resume : state.resume, answers } });
      if (!out || !out.resume || !out.report) throw new Error("The server sent back something unexpected. Update the backend, then try again.");
      setFixed(out);
      setEditing(false);
    } catch (err) {
      setFixError(fail(err, "Could not improve it. Try again."));
    } finally {
      setBusyFix(false);
    }
  }

  function saveToLibrary(resume, templateId) {
    return api("/library/save", {
      method: "POST",
      body: {
        job: { title: "ATS-improved resume", company: "", text: "Improved for ATS readiness. No job posting." },
        original: { name: resume.name || "", summary: "" },
        tailored: resume,
        template: templateId,
        role: "general",
        before: { match: 0, ats: fixed ? fixed.before : state.report.score, overall: fixed ? fixed.before : state.report.score },
        after: { match: 0, ats: fixed ? fixed.report.score : state.report.score, overall: fixed ? fixed.report.score : state.report.score },
        changes: fixed ? fixed.notes : [],
      },
    });
  }

  const ready = file || text.trim().length > 40;
  const shownReport = fixed ? fixed.report : state.report;
  const workResume = fixed ? fixed.resume : state.resume;
  const questions = state.report ? state.report.questions || [] : [];

  return (
    <section className="ats-page">
      <h1 className="page-title">ATS check</h1>
      <p className="page-sub">See how cleanly a recruiting system can read your resume, then fix what is missing. No job needed.</p>

      <div className="panel">
        <input ref={input} type="file" accept=".pdf,.docx,.txt" onChange={pick} className="sr-only" aria-label="Choose a resume" />
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={() => input.current && input.current.click()}>
            {file ? "Choose a different file" : "Choose a resume file"}
          </button>
          {file && <span className="fill-help">{file.name}</span>}
        </div>
        {!file && (
          <>
            <p className="fill-help">Or paste the text of your resume.</p>
            <textarea className="refine-box" value={text} onChange={(e) => setText(e.target.value)} aria-label="Resume text" maxLength={20000} />
          </>
        )}
        <div className="actions">
          <button type="button" className="btn btn-red" onClick={run} disabled={!ready || state.phase === "busy"}>
            {state.phase === "busy" ? "Checking..." : "Check my resume"}
          </button>
        </div>
        {state.phase === "busy" && <StagedProgress steps={["Reading your resume", "Finding your sections and links", "Running the ATS checks"]} every={3000} />}
        {state.error && (
          <p className="notice" role="alert">
            {state.error}
          </p>
        )}
      </div>

      {shownReport && (
        <div className="panel">
          {fixed && (
            <p className="fill-help" role="status">
              {fixed.report.reached && <Burst key={fixed.report.score} />}
              Score went from <strong>{fixed.before}</strong> to <strong>{fixed.report.score}</strong>.
            </p>
          )}
          <AtsPanel report={shownReport} />
          {fixed && fixed.notes.length > 0 && (
            <ul className="rows">
              {fixed.notes.map((n, i) => (
                <li className="row ok" key={i}>
                  <i aria-hidden="true">✓</i>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}
          {!editing && (
            <div className="actions">
              <button type="button" className="btn btn-red" onClick={() => setEditing(true)}>
                Open it to edit, pick a template and download
              </button>
            </div>
          )}
        </div>
      )}

      {state.report && !fixed && questions.length > 0 && <AtsFix questions={questions} busy={busyFix} error={fixError} onSubmit={improve} />}
      {fixed && fixed.report.questions && fixed.report.questions.filter((x) => !x.auto).length > 0 && (
        <AtsFix key={fixed.report.score} questions={fixed.report.questions} busy={busyFix} error={fixError} onSubmit={(a) => improve(a)} />
      )}

      {editing && workResume && (
        <ResumeWorkbench
          key={fixed ? "fixed" : "plain"}
          resume={mergeProfile(workResume, profile, email)}
          template=""
          suggestedId=""
          facts={profileToFacts(profile)}
          onSave={saveToLibrary}
        />
      )}
    </section>
  );
}
