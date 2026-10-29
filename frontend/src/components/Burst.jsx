import { useMemo } from "react";

// A quick burst of sparks to mark something good happening (a download, a saved resume, a 90+ score).
export default function Burst({ n = 16 }) {
  const dots = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => ({
        a: Math.round((360 / n) * i + (i % 2 ? 9 : -7)),
        d: 34 + (i % 3) * 16,
        s: 4 + (i % 3) * 2,
        c: i % 3 === 0 ? "#f32e35" : i % 3 === 1 ? "#4e50de" : "#e9e8f7",
      })),
    [n],
  );
  return (
    <span className="burst" aria-hidden="true">
      {dots.map((d, i) => (
        <i key={i} style={{ "--a": `${d.a}deg`, "--d": `${d.d}px`, "--s": `${d.s}px`, "--c": d.c }} />
      ))}
    </span>
  );
}
