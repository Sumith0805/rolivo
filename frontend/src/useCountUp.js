import { useEffect, useRef, useState } from "react";

// Counts a number up (or down) to `target`. Jumps straight there for people who asked for less motion.
export default function useCountUp(target, ms = 1000) {
  const goal = Number.isFinite(Number(target)) ? Number(target) : 0;
  const [value, setValue] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    let reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduce = false;
    }
    if (reduce || ms <= 0) {
      from.current = goal;
      setValue(goal);
      return undefined;
    }
    const start = performance.now();
    const begin = from.current;
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = Math.round(begin + (goal - begin) * eased);
      from.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [goal, ms]);

  return value;
}
