import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasContent } from "../profile.js";
import { useProfile } from "../profileContext.jsx";
import { useFlow } from "../flow.jsx";
import useEnter from "../useEnter.js";
import { MAX_RESUMES, fileProblem, listSaved, sizeLabel } from "../vault.js";
import DocArt from "../components/DocArt.jsx";

export default function Resume() {
  const navigate = useNavigate();
  const { resumes, hasResume, fromProfile, addResumes, removeResume, setFromProfile } = useFlow();
  const { profile } = useProfile();
  const canBuild = hasContent(profile);
  const ready = Boolean(hasResume || fromProfile);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState([]);
  const input = useRef(null);
  const next = useCallback(() => navigate("/job"), [navigate]);
  useEnter(next, ready);

  // resumes the person already keeps in their profile (an older server has none; then this stays hidden)
  useEffect(() => {
    let live = true;
    listSaved()
      .then((rows) => live && setSaved(rows))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const room = MAX_RESUMES - resumes.length;
  const keyOf = (f) => `f:${f.name}:${f.size}:${f.lastModified}`;

  function take(fileList) {
    setError("");
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const problems = [];
    const have = new Set(resumes.map((r) => r.key));
    const items = [];
    files.forEach((f) => {
      const p = fileProblem(f);
      if (p) problems.push(p);
      else if (have.has(keyOf(f))) problems.push(`“${f.name}” is already added.`);
      else items.push({ key: keyOf(f), name: f.name, size: f.size, file: f });
    });
    if (items.length > room) {
      problems.push(`You can add up to ${MAX_RESUMES} resumes. The extra ones were left out.`);
    }
    if (items.length) addResumes(items.slice(0, room));
    if (problems.length) setError(problems.join(" "));
  }

  function useSaved(r) {
    setError("");
    if (resumes.some((x) => x.key === `s:${r.id}`)) return;
    if (room <= 0) {
      setError(`You can add up to ${MAX_RESUMES} resumes.`);
      return;
    }
    addResumes([{ key: `s:${r.id}`, name: r.name, savedId: r.id }]);
  }

  const availableSaved = saved.filter((r) => !resumes.some((x) => x.key === `s:${r.id}`));

  return (
    <section>
      <h1 className="page-title">Start with your resume.</h1>
      <p className="page-sub">
        Upload the version you send today. Rolivo only uses what it already shows. Have one resume per role? Add them
        all and Rolivo merges them into one.
      </p>

      <div
        className={`drop${over ? " over" : ""}${hasResume ? " has-file" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files);
        }}
      >
        <input
          ref={input}
          type="file"
          accept=".pdf,.docx,.txt"
          multiple
          hidden
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />
        <DocArt kind="upload" />
        <p className="drop-name">{hasResume ? "Add another resume" : "Drop your resumes here"}</p>
        <p className="drop-hint">PDF, Word or text, up to 2 MB each. You can pick several at once.</p>
        <button type="button" className="btn btn-ghost" disabled={room <= 0} onClick={() => input.current.click()}>
          {hasResume ? "Choose more files" : "Choose files"}
        </button>
      </div>

      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}

      {resumes.length > 0 && (
        <ul className="res-list" aria-label="Resumes you added">
          {resumes.map((r, i) => (
            <li key={r.key} className="res-item">
              <span className="res-n">{i + 1}</span>
              <span className="res-name">
                {r.name}
                <small>{r.file ? `${sizeLabel(r.size)} · uploaded` : "saved in your profile"}</small>
              </span>
              <button type="button" className="btn btn-ghost res-del" onClick={() => removeResume(r.key)} aria-label={`Remove ${r.name}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {resumes.length > 1 && (
        <p className="res-merge">
          Rolivo will read all {resumes.length} resumes together and write one resume from them. It uses only what they
          show, and does not repeat the same item twice.
        </p>
      )}

      {availableSaved.length > 0 && room > 0 && (
        <div className="panel res-saved">
          <h2 className="panel-title">Or use one saved in your profile</h2>
          <ul className="res-list">
            {availableSaved.map((r) => (
              <li key={r.id} className="res-item">
                <span className="res-name">{r.name}</span>
                <button type="button" className="btn btn-ghost res-del" onClick={() => useSaved(r)}>
                  Add
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="or-row">
        {fromProfile ? (
          <p className="from-profile">
            Using your profile as the resume.{" "}
            <button type="button" className="linklike" onClick={() => setFromProfile(false)}>
              Use an upload instead
            </button>
          </p>
        ) : canBuild && !hasResume ? (
          <p className="from-profile">
            No resume handy?{" "}
            <button type="button" className="linklike" onClick={() => setFromProfile(true)}>
              Build one from my profile
            </button>
          </p>
        ) : !canBuild && !hasResume ? (
          <p className="from-profile">
            No resume yet? Fill in your{" "}
            <button type="button" className="linklike" onClick={() => navigate("/profile")}>
              profile
            </button>{" "}
            and Rolivo can write one from it.
          </p>
        ) : null}
      </div>

      <div className="actions">
        <button type="button" className="btn btn-red" disabled={!ready} onClick={() => navigate("/job")}>
          Continue to the job
        </button>
      </div>
    </section>
  );
}
