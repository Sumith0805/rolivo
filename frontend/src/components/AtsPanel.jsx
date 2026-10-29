import useCountUp from "../useCountUp.js";
import ScoreRing from "./ScoreRing.jsx";

const TONE = { fail: "warn", warn: "warn", pass: "ok" };

// Shows an ATS readiness report: the score, whether it reached 90, and what is holding it back.
export default function AtsPanel({ report, compact = false }) {
  const shownScore = useCountUp(report ? report.score : 0, 700);
  if (!report) return null;
  const { score, target, reached, potential, markers, holding_back: holding = [] } = report;
  const gain = markers > 0 && potential > score;
  return (
    <div className="ats">
      {!compact && <ScoreRing value={score} label="ATS readiness" note={reached ? `Above ${target}` : `Target ${target}+`} />}
      {compact && (
        <p className="ats-line">
          <strong className="ats-num">{shownScore}</strong>
          <span>ATS readiness{reached ? ` · above ${target}` : ` · target ${target}+`}</span>
        </p>
      )}
      {reached ? (
        <p className="fill-help">A recruiting system can read this resume cleanly.</p>
      ) : (
        <p className="fill-help">
          {gain
            ? `Filling in your real numbers can lift this to about ${potential}.`
            : "Fix the items below to get past 90."}
        </p>
      )}
      {holding.length > 0 && (
        <ul className="rows">
          {holding.map((h) => (
            <li className={`row ${TONE[h.status]}`} key={h.id}>
              <i aria-hidden="true">!</i>
              <span>
                <strong>{h.label}</strong>: {h.detail}. {h.fix} <em>(+{h.points})</em>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
