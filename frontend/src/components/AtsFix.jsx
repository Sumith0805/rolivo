import { useState } from "react";

// Asks only for what the ATS check found missing. Every answer is the person's own fact.
export default function AtsFix({ questions, busy, error, onSubmit }) {
  const [contact, setContact] = useState({});
  const [skills, setSkills] = useState("");
  const [edu, setEdu] = useState({});
  const [dates, setDates] = useState({});
  const [results, setResults] = useState({});

  const q = (id) => questions.find((x) => x.id === id);
  const ask = questions.filter((x) => !x.auto);

  function submit(e) {
    e.preventDefault();
    const answers = { contact, skills, education: edu, dates: [], results: [] };
    (q("dates")?.items || []).forEach((it, n) => {
      if ((dates[n] || "").trim()) answers.dates.push({ kind: it.kind, i: it.i, value: dates[n] });
    });
    (q("results")?.items || []).forEach((it, n) => {
      if ((results[n] || "").trim()) answers.results.push({ kind: it.kind, i: it.i, j: it.j, value: results[n] });
    });
    onSubmit(answers);
  }

  return (
    <form className="panel atsfix" onSubmit={submit}>
      <h2 className="panel-title">Fill in what is missing</h2>
      <p className="fill-help">
        These are the gaps holding your score back. Type only what is true: Rolivo never makes up details. You can skip any box.
      </p>

      {q("contact") && (
        <fieldset>
          <legend>{q("contact").title}</legend>
          <div className="fix-grid">
            {q("contact").fields.map((f) => (
              <label key={f.key}>
                {f.label}
                <input className="field-input" value={contact[f.key] || ""} placeholder={f.placeholder} onChange={(e) => setContact({ ...contact, [f.key]: e.target.value })} />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {q("skills") && (
        <fieldset>
          <legend>{q("skills").title}</legend>
          <p className="fill-help">{q("skills").help}</p>
          <input className="field-input" value={skills} placeholder="e.g. Git, Docker, REST APIs" onChange={(e) => setSkills(e.target.value)} aria-label="More skills" />
        </fieldset>
      )}

      {q("education") && (
        <fieldset>
          <legend>{q("education").title}</legend>
          <div className="fix-grid">
            {q("education").fields.map((f) => (
              <label key={f.key}>
                {f.label}
                <input className="field-input" value={edu[f.key] || ""} placeholder={f.placeholder} onChange={(e) => setEdu({ ...edu, [f.key]: e.target.value })} />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {q("dates") && (
        <fieldset>
          <legend>{q("dates").title}</legend>
          <div className="fix-grid">
            {q("dates").items.map((it, n) => (
              <label key={n}>
                Dates for {it.label}
                <input className="field-input" value={dates[n] || ""} placeholder="Jan 2025 - Mar 2025" onChange={(e) => setDates({ ...dates, [n]: e.target.value })} />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {q("results") && (
        <fieldset>
          <legend>{q("results").title}</legend>
          <p className="fill-help">{q("results").help}</p>
          {q("results").items.map((it, n) => (
            <div className="fill-item" key={n}>
              <p className="fill-where">{it.where}</p>
              <p className="fill-text">{it.text}</p>
              <input className="field-input" value={results[n] || ""} placeholder="e.g. serving 200 requests a day" onChange={(e) => setResults({ ...results, [n]: e.target.value })} aria-label={`Real result for ${it.where}`} />
            </div>
          ))}
        </fieldset>
      )}

      {q("summary") && <p className="fill-help">{q("summary").help}</p>}

      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="btn btn-red" disabled={busy}>
          {busy ? "Improving..." : ask.length ? "Improve my resume" : "Clean it up"}
        </button>
      </div>
    </form>
  );
}
