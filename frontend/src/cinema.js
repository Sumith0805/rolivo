import { useEffect } from "react";

// "Cinematic effects": page curtain, 3D cards, 3D scenes. People can switch them off in Settings,
// and they are always off for anyone who asked their device for less motion.
const KEY = "rolivo_cinema";

export function reducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
export function cinemaOn() {
  if (reducedMotion()) return false;
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}
export function applyCinema() {
  document.documentElement.dataset.cinema = cinemaOn() ? "on" : "off";
}
export function setCinema(on) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* storage can be blocked; the choice then lasts until the page reloads */
  }
  applyCinema();
}

const TILT = "[data-tilt], .auth-card";

// One pointer listener for the whole app. It tilts the card under the pointer in 3D with a soft
// glare, and nudges 3D scenes (.deck) and the sign-in backdrop (.auth) to follow the pointer.
export function usePointerDepth() {
  useEffect(() => {
    let fine = false;
    try {
      fine = window.matchMedia("(pointer: fine)").matches;
    } catch {
      fine = false;
    }
    if (!fine) return undefined;

    let raf = 0;
    let last = null;
    let current = null;

    const clear = (el) => {
      if (!el) return;
      el.classList.remove("tilting");
      el.style.removeProperty("--rx");
      el.style.removeProperty("--ry");
    };
    const apply = () => {
      raf = 0;
      if (!last || document.documentElement.dataset.cinema === "off") return;
      const { x, y, target } = last;
      const card = target && target.closest ? target.closest(TILT) : null;
      if (card !== current) {
        clear(current);
        current = card;
      }
      if (card) {
        const r = card.getBoundingClientRect();
        const px = (x - r.left) / r.width - 0.5;
        const py = (y - r.top) / r.height - 0.5;
        const max = card.classList.contains("auth-card") ? 4 : 9;
        card.classList.add("tilting");
        card.style.setProperty("--rx", `${(-py * max).toFixed(2)}deg`);
        card.style.setProperty("--ry", `${(px * max).toFixed(2)}deg`);
        card.style.setProperty("--gx", `${x - r.left}px`);
        card.style.setProperty("--gy", `${y - r.top}px`);
      }
      const mx = (x / window.innerWidth - 0.5).toFixed(3);
      const my = (y / window.innerHeight - 0.5).toFixed(3);
      for (const sel of [".deck", ".auth"]) {
        const el = document.querySelector(sel);
        if (el) {
          el.style.setProperty("--mx", mx);
          el.style.setProperty("--my", my);
        }
      }
    };
    const onMove = (e) => {
      last = { x: e.clientX, y: e.clientY, target: e.target };
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      clear(current);
      current = null;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
      clear(current);
    };
  }, []);
}
