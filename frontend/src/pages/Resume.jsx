import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFlow } from "../flow.jsx";

const MAX_BYTES = 2 * 1024 * 1024;

function size(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Resume() {
  const navigate = useNavigate();
  const { resumeFile, setResumeFile } = useFlow();
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const input = useRef(null);

  function take(file) {
    setError("");
    if (!file) return;
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) {
      setError("Use a PDF, a Word file (.docx) or a text file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That file is over 2 MB. Use a smaller one.");
      return;
    }
    setResumeFile(file);
  }

  return (
    <section>
      <h1 className="page-title">Start with your resume.</h1>
      <p className="page-sub">
        Upload the version you send today. Rolivo only uses what it already shows.
      </p>

      <div
        className={`drop${over ? " over" : ""}${resumeFile ? " has-file" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files?.[0]);
        }}
      >
        <input
          ref={input}
          type="file"
          accept=".pdf,.docx,.txt"
          hidden
          onChange={(e) => take(e.target.files?.[0])}
        />
        {resumeFile ? (
          <>
            <p className="drop-name">{resumeFile.name}</p>
            <p className="drop-hint">{size(resumeFile.size)} · ready</p>
            <button type="button" className="btn btn-ghost" onClick={() => input.current.click()}>
              Choose a different file
            </button>
          </>
        ) : (
          <>
            <p className="drop-name">Drop your resume here</p>
            <p className="drop-hint">PDF, Word or text, up to 2 MB</p>
            <button type="button" className="btn btn-ghost" onClick={() => input.current.click()}>
              Choose a file
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}

      <div className="actions">
        <button
          type="button"
          className="btn btn-red"
          disabled={!resumeFile}
          onClick={() => navigate("/job")}
        >
          Continue to the job
        </button>
      </div>
    </section>
  );
}
