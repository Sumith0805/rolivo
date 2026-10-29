import { motion } from "motion/react";
import useCountUp from "../useCountUp.js";
import "./ScoreReveal.css";

const toNum = (v) =>
  v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Math.round(Number(v));

// Shows the overall score before and after the rewrite: numbers count up, the arrow draws itself.
export default function ScoreReveal({ before, after }) {
  const b = toNum(before?.overall);
  const a = toNum(after?.overall);
  const shownBefore = useCountUp(b ?? 0, 900);
  const shownAfter = useCountUp(a ?? 0, 1600);
  if (b === null || a === null) return null;
  const delta = a - b;

  return (
    <motion.div
      className="reveal"
      role="group"
      aria-label={`Overall score went from ${b} to ${a}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <div className="reveal-col">
        <span className="reveal-label">Before</span>
        <span className="reveal-num dim">{shownBefore}</span>
      </div>

      <svg className="reveal-arrow" viewBox="0 0 120 24" aria-hidden="true">
        <motion.path
          d="M4 12 H112 M100 4 L112 12 L100 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.7, duration: 0.8, ease: "easeInOut" }}
        />
      </svg>

      <div className="reveal-col">
        <span className="reveal-label">After</span>
        <motion.span
          className="reveal-num hot"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.9, type: "spring", stiffness: 200, damping: 12 }}
        >
          {shownAfter}
        </motion.span>
      </div>

      {delta !== 0 && (
        <motion.span
          className={`reveal-chip${delta < 0 ? " down" : ""}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.9, type: "spring", stiffness: 300, damping: 14 }}
        >
          {delta > 0 ? `+${delta}` : delta} points
        </motion.span>
      )}
    </motion.div>
  );
}