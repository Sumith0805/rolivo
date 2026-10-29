import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearToken } from "../api.js";
import { downloadLetter } from "../files.js";
import { useFlow } from "../flow.jsx";
import { fileProblem, listSaved, savedText } from "../vault.js";
import StagedProgress from "../components/StagedProgress.jsx";

const TONES = [
  ["professional", "Professional"],
  ["warm", "Warm and friendly"],
  ["concise", "Short and direct"],
];

export default function CoverLetter() {
  const navigate = useNavigate();
  const flow = useFlow();
  const input = useRef(null);
  const latest = flow.result && flow.result.resume ? flow.result.resume : null;
  const [saved, setSaved] = useState([]);
  const [source, setSource] = useState(latest ? "latest" : "");
  const [file, setFile] = useState(null);
  const [job, setJob] = useState(flow.jobText || "");
  const [company, setCompany] = useState(flow.jobCompany || "");
  const [role, setRole] = useState(flow.jobTitle || "");
  const [tone, setTone] = useState("professional");
  const [facts, setFacts] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [out, setOut] = useState(null); // { letter, removed }
  const [dl, setDl] = useState({ state: "idle", message: "" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    listSaved()
      .then((r) => live && setSaved(r))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  function fail(err, fallback) {
    if (err.status === 401) {
      clearToken();
      navigate("/signin", { replace: true });
      return "";
    }
    return err.status === 404 || err.status === 405 ? "The server does not have the cover letter feature yet. Update the backend, then try again." : err.message || fallback;
  }

  function pick(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const bad = fileProblem(f);
    if (bad) return setError(bad);
    setError("");
    setFile(f);
    setSource("file");
  }

  async function generate(e) {
    e.preventDefault();
    setError("");
    setOut(null);
    setBusy(true);
    try {
      const f = new FormData();
      if (source === "latest" && latest) f.append("resume_json", JSON.stringify(latest));
      else if (source === "file" && file) f.append("resume_file", file, file.name);
      else if (source.startsWith("saved:")) {
        const d = await savedText(source.slice(6));
        f.append("resume_text", d.text || "");
      } else {
        setError("Choose which resume to use first.");
        setBusy(false);
        return;
      }
      f.append("job_text", job);
      f.append("company", company);
      f.append("role", role);
      f.append("tone", tone);
      f.append("facts", facts);
      setOut(await api("/cover/generate", { method: "POST", form: f }));
    } catch (err) {
      setError(fail(err, "Could not write the letter. Try again."));
    } finally {
      setBusy(false);
    }
  }

  function setPara(i, v) {
    setOut((o) => ({ ...o, letter: { ...o.letter, paragraphs: o.letter.paragraphs.map((p, n) => (n === i ? v : p)) } }));
  }
  function dropPara(i) {
    setOut((o) => ({ ...o, letter: { ...o.letter, paragraphs: o.letter.paragraphs.filter((_, n) => n !== i) } }));
  }
  const textOf = (L) => [L.greeting, ...L.paragraphs, L.closing, L.name].join("\n\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(textOf(out.letter));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setDl({ state: "error", message: "Could not copy. Select the text and copy it yourself." });
    }
  }
  async function download(kind) {
    setDl({ state: "busy", message: "" });
    try {
      await downloadLetter(kind, out.letter);
      setDl({ state: "done", message: kind === "pdf" ? "PDF downloaded." : "Word file downloaded." });
    } catch (err) {
      setDl({ state: "error", message: fail(err, "Could not download.") });
    }
  }

  const L = out && out.letter;
  return (
    <section className="cover-page">
      <h1 className="page-title">Cover letter</h1>
      <p className="page-sub">A letter written only from what is on your resume. Rolivo removes any tool, number or name that is not there.</p>

      <form className="panel" onSubmit={generate}>
        <label className="cv-field">
          Which resume should it use?
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="" disabled>
              Choose one
            </option>
            {latest && <option value="latest">My latest rewrite</option>}
            {saved.map((r) => (
              <option key={r.id} value={`saved:${r.id}`}>
                Saved: {r.name}
              </option>
            ))}
            {file && <option value="file">Uploaded: {file.name}</option>}
          </select>
        </label>
        <input ref={input} type="file" accept=".pdf,.docx,.txt" onChange={pick} className="sr-only" aria-label="Upload a resume" />
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={() => input.current && input.current.click()}>
            Upload a different resume
          </button>
        </div>

        <div className="cv-grid">
          <label className="cv-field">
            Company
            <input className="field-input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme Labs" maxLength={80} />
          </label>
          <label className="cv-field">
            Role
            <input className="field-input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Machine Learning Intern" maxLength={80} />
          </label>
          <label className="cv-field">
            Tone
            <select value={tone} onChange={(e) => setTone(e.target.value)}>
              {TONES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="cv-field">
          The job posting
          <textarea className="refine-box" value={job} onChange={(e) => setJob(e.target.value)} placeholder="Paste the job description" maxLength={12000} />
        </label>
        <label className="cv-field">
          Anything true you want mentioned (optional)
          <textarea className="refine-box cv-small" value={facts} onChange={(e) => setFacts(e.target.value)} placeholder="e.g. I won my college hackathon in 2025" maxLength={1500} />
        </label>

        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        {busy && (
          <StagedProgress steps={["Reading your resume", "Reading the job", "Writing your letter", "Checking it uses only your facts"]} every={3500} />
        )}
        <div className="actions">
          <button type="submit" className="btn btn-red" disabled={busy}>
            {busy ? "Writing..." : out ? "Write it again" : "Write my cover letter"}
          </button>
        </div>
      </form>

      {L && (
        <div className="panel cv-letter">
          <h2 className="panel-title">Your letter</h2>
          <p className="fill-help">Edit any paragraph. Only add things that are true.</p>
          {out.removed && out.removed.length > 0 && (
            <p className="notice" role="status">
              Left out because they are not on your resume: {out.removed.join(", ")}.
            </p>
          )}
          <p className="cv-head">
            <strong>{L.name}</strong>
            <br />
            {L.contact.join("  |  ")}
          </p>
          <p className="cv-meta">
            {L.date}
            <br />
            {L.recipient}
            {L.subject && (
              <>
                <br />
                <strong>{L.subject}</strong>
              </>
            )}
          </p>
          <p>{L.greeting}</p>
          {L.paragraphs.map((p, i) => (
            <div className="cv-para" key={i}>
              <textarea className="refine-box" value={p} onChange={(e) => setPara(i, e.target.value)} aria-label={`Paragraph ${i + 1}`} rows={Math.max(3, Math.ceil(p.length / 90))} />
              <button type="button" className="linklike" onClick={() => dropPara(i)}>
                Remove this paragraph
              </button>
            </div>
          ))}
          <p>
            {L.closing}
            <br />
            {L.name}
          </p>
          <div className="actions">
            <button type="button" className="btn btn-red" onClick={() => download("docx")} disabled={dl.state === "busy"}>
              Download Word
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => download("pdf")} disabled={dl.state === "busy"}>
              Download PDF
            </button>
            <button type="button" className="btn btn-ghost" onClick={copy}>
              {copied ? "Copied" : "Copy the text"}
            </button>
          </div>
          {dl.message && (
            <p className={`notice${dl.state === "error" ? "" : " ok"}`} role="status">
              {dl.message}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
