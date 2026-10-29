import { useEffect } from "react";
import "./TiltEffect.css";

// Cards tilt toward the cursor and red buttons lean toward it.
// Mouse only: touch screens and people who asked for less motion get nothing.
export default function TiltEffect() {
  useEffect(() => {
    let ok = false;
    try {
      ok =
        window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      ok = false;
    }
    if (!ok) return undefined;

    const reset = (el) => {
      if (!el) return;
      ["--rx", "--ry", "--mx", "--my", "--tx", "--ty"].forEach((k) => el.style.removeProperty(k));
    };
    let active = null;

    const onMove = (e) => {
      const t = e.target instanceof Element ? e.target : null;
      const el = t ? t.closest(".lib-card, .btn-red") : null;
      if (active && active !== el) reset(active);
      active = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (el.classList.contains("lib-card")) {
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--rx", `${((0.5 - py) * 7).toFixed(2)}deg`);
        el.style.setProperty("--ry", `${((px - 0.5) * 9).toFixed(2)}deg`);
        el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
        el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
      } else {
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.setProperty("--tx", `${(dx * 0.14).toFixed(1)}px`);
        el.style.setProperty("--ty", `${(dy * 0.2).toFixed(1)}px`);
      }
    };
    const onLeave = () => {
      reset(active);
      active = null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return null;
}