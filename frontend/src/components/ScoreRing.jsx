import { useEffect, useState } from "react";
import useCountUp from "../useCountUp.js";

const RADIUS = 70;
const CIRC = 2 * Math.PI * RADIUS;

export default function ScoreRing({ value, label, note }) {
  const target = Math.max(0, Math.min(100, Number(value) || 0));
  const [shown, setShown] = useState(0);
  const counted = useCountUp(target, 1300);

  // sweep from empty to the score after the first paint
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  return (
    <figure className={`ring${target >= 90 ? " great" : ""}`}>
      <div className="ring-dial">
        <svg viewBox="0 0 160 160" width="160" height="160" aria-hidden="true">
          <circle cx="80" cy="80" r={RADIUS} className="ring-track" />
          <circle
            cx="80"
            cy="80"
            r={RADIUS}
            className="ring-bar"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - shown / 100)}
            transform="rotate(-90 80 80)"
          />
        </svg>
        <span className="ring-num">{counted}</span>
      </div>
      <figcaption>
        <strong>{label}</strong>
        {note && <span>{note}</span>}
      </figcaption>
    </figure>
  );
}
