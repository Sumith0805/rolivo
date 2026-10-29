import { Link, Navigate, useNavigate } from "react-router-dom";
import { useFlow } from "../flow.jsx";

// fixes arrive as "medium: message"; split the level from the text when it is there
function splitFix(text) {
  const m = /^(high|medium|low)\s*:\s*(.*)$/i.exec(String(text));
  return m ? { level: m[1].toLowerCase(), text: m[2] } : { level: "", text: String(text) };
}

const METRICS = [
  {
    key: "match",
    title: "Job match",
    about: "How closely your resume's skills and wording line up with this job posting.",
  },
  {
    key: "ats",
    title: "ATS readiness",
    about:
      "How easily applicant-tracking software can read your resume: clear sections, plain structure, nothing that trips a scanner. This is Rolivo's own estimate, not any employer's score.",
  },
  {
    key: "overall",
    title: "Overall",
    about: "75% job match plus 25% ATS readiness, so job match counts three times as much.",
  },
];

function Bar({ label, value, kind }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={`bar bar-${kind}`}>
      <span className="bar-label">{label}</span>
      <div className="bar-track" aria-hidden="true">
        <div className="bar-fill" style={{ "--v": v / 100 }} />
      </div>
      <b className="bar-num">{value ?? "–"}</b>
    </div>
  );
}

const TIER_NAMES = { required: "Required skills", tools: "Tools", preferred: "Nice to have", keywords: "Other keywords" };

function Keywords({ data }) {
  const tiers = Object.entries(data || {}).filter(([, v]) => v.found.length || v.missing.length);
  if (tiers.length === 0) return null;
  const missingAll = tiers.reduce((n, [, v]) => n + v.missing.length, 0);
  return (
    <div className="panel kwpanel">
      <h2 className="panel-title">Keywords from the job</h2>
      <p className="fill-help">
        {missingAll === 0
          ? "Your rewritten resume shows every keyword in this posting."
          : "Red ones are not on your resume. Add one only if it is true: put it in a bullet where you really used it. Never add a skill you do not have."}
      </p>
      {tiers.map(([name, v]) => (
        <div className="kw-tier" key={name}>
          <h3>{TIER_NAMES[name] || name}</h3>
          <p className="kw-chips">
            {v.found.map((k) => (
              <span className="kw ok" key={`f-${k}`}>
                ✓ {k}
              </span>
            ))}
            {v.missing.map((m) => (
              <span className="kw no" key={`m-${m.term}`} title={m.any_of.length ? `Any of: ${m.any_of.join(", ")}` : undefined}>
                {m.term}
                {m.any_of.length ? ` (or ${m.any_of.slice(0, 3).join(", ")})` : ""}
              </span>
            ))}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function Analysis() {
  const navigate = useNavigate();
  const { result } = useFlow();
  if (!result) return <Navigate to="/resume" replace />;

  const { before = {}, after = {}, role, template } = result;
  const fixes = (result.before_fixes || []).map(splitFix);
  const left = (result.after_fixes || []).map(splitFix);

  return (
    <section>
      <h1 className="page-title">Your match, measured.</h1>
      <p className="page-sub">
        Your original resume against the job
        {role?.label ? `, read as ${role.label}` : ""}, and the rewritten version beside it. Every score is out of 100,
        and higher is better.
        {template?.label ? ` Suggested layout: ${template.label}.` : ""}
      </p>

      <div className="metrics">
        {METRICS.map((m) => {
          const b = Number(before[m.key]);
          const a = Number(after[m.key]);
          const delta = Number.isFinite(a) && Number.isFinite(b) ? a - b : null;
          return (
            <article className="panel metric" key={m.key}>
              <h2>{m.title}</h2>
              <p className="metric-about">{m.about}</p>
              <Bar label="Your resume" value={before[m.key]} kind="before" />
              <Bar label="Rewritten" value={after[m.key]} kind="after" />
              {delta !== null && (
                <p className={`metric-delta${delta > 0 ? " up" : ""}`}>
                  {delta > 0 ? `+${delta} after the rewrite` : delta === 0 ? "No change after the rewrite" : `${delta} after the rewrite`}
                </p>
              )}
            </article>
          );
        })}
      </div>
      <p className="honest-note">
        Rolivo only rewrites with what your resume already shows, so the match can rise only as far as your real
        skills allow. To raise it honestly, add real skills, projects and certifications to your{" "}
        <Link to="/profile">profile</Link>.
      </p>
      <p className="fineprint">
        Scores come from fixed rules, not from any employer&apos;s system. Treat them as a guide.
      </p>

      <Keywords data={result.keywords} />

      <div className="panel rows">
        <h2 className="panel-title">What to fix in your original</h2>
        {fixes.length === 0 && <p className="row">Nothing to fix. Your resume already reads cleanly.</p>}
        {fixes.map((f, i) => (
          <p className="row" key={i}>
            {f.level && <em className={`level ${f.level}`}>{f.level}</em>}
            <span>{f.text}</span>
          </p>
        ))}
      </div>

      {left.length > 0 && (
        <div className="panel rows">
          <h2 className="panel-title">Still open after the rewrite</h2>
          {left.map((f, i) => (
            <p className="row" key={i}>
              {f.level && <em className={`level ${f.level}`}>{f.level}</em>}
              <span>{f.text}</span>
            </p>
          ))}
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn btn-red" onClick={() => navigate("/rewrite")}>
          See the rewrite
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => navigate("/job")}>
          Change the job
        </button>
      </div>
    </section>
  );
}
