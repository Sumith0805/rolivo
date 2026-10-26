import { Navigate, useNavigate } from "react-router-dom";
import ScoreRing from "../components/ScoreRing.jsx";
import { useFlow } from "../flow.jsx";

// fixes arrive as "medium: message"; split the level from the text when it is there
function splitFix(text) {
  const m = /^(high|medium|low)\s*:\s*(.*)$/i.exec(String(text));
  return m ? { level: m[1].toLowerCase(), text: m[2] } : { level: "", text: String(text) };
}

export default function Analysis() {
  const navigate = useNavigate();
  const { result } = useFlow();
  if (!result) return <Navigate to="/resume" replace />;

  const { before = {}, after = {}, role, template } = result;
  const fixes = (result.before_fixes || []).map(splitFix);

  return (
    <section>
      <h1 className="page-title">Your match, measured.</h1>
      <p className="page-sub">
        This is your original resume against the job
        {role?.label ? `, read as ${role.label}` : ""}.
        {template?.label ? ` Suggested layout: ${template.label}.` : ""}
      </p>

      <div className="rings">
        <ScoreRing value={before.match} label="Job match" note={`After rewrite: ${after.match ?? "-"}`} />
        <ScoreRing value={before.ats} label="ATS readiness" note={`After rewrite: ${after.ats ?? "-"}`} />
        <ScoreRing value={before.overall} label="Overall" note={`After rewrite: ${after.overall ?? "-"}`} />
      </div>
      <p className="fineprint">
        Scores come from fixed rules, not from any employer&apos;s system. Treat them as a guide.
      </p>

      <div className="panel rows">
        <h2 className="panel-title">What to fix</h2>
        {fixes.length === 0 && <p className="row">Nothing to fix. Your resume already reads cleanly.</p>}
        {fixes.map((f, i) => (
          <p className="row" key={i}>
            {f.level && <em className={`level ${f.level}`}>{f.level}</em>}
            <span>{f.text}</span>
          </p>
        ))}
      </div>

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
