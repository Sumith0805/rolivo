import { useEffect } from "react";

// Runs `handler` when Enter is pressed while nothing interactive has focus.
export default function useEnter(handler, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    function onKey(e) {
      if (e.key !== "Enter" || e.defaultPrevented || e.isComposing) return;
      const tag = (e.target?.tagName || "").toLowerCase();
      if (["input", "textarea", "select", "button", "a"].includes(tag)) return;
      handler();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler, enabled]);
}
