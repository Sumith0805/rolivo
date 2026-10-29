import { useEffect, useState } from "react";
import ResumeScan from "./ResumeScan.jsx";

// Shows what Rolivo is doing during a long wait. The server does not report progress,
// so the steps advance on a timer and the last one stays lit until the answer arrives.
export default function StagedProgress({ steps, every = 4500, art = true }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= steps.length - 1) return undefined;
    const id = setTimeout(() => setN((v) => v + 1), every);
    return () => clearTimeout(id);
  }, [n, steps.length, every]);

  return (
    <div className={`stages-wrap${art ? " with-art" : ""}`}>
    <div className="stages" role="status" aria-live="polite">
      <div className="stages-bar" aria-hidden="true">
        <i style={{ "--p": (n + 1) / steps.length }} />
      </div>
      <ol>
        {steps.map((s, i) => (
          <li key={s} className={i < n ? "done" : i === n ? "now" : ""}>
            <b aria-hidden="true">{i < n ? "✓" : ""}</b>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
    {art && (
      <div className="stages-art" aria-hidden="true">
        <ResumeScan fast />
      </div>
    )}
    </div>
  );
}
