import { useEffect, useState } from "react";
import { api } from "./api.js";
import fallback from "./templatesFallback.json";

// The templates live on the server, so the preview and the downloaded files always match.
// If the server is older than this app, the built-in copy keeps the preview working.
let cache = null;

export function useTemplates() {
  const [state, setState] = useState(() => cache || { templates: fallback.templates, groups: fallback.groups, live: false });
  useEffect(() => {
    if (cache) return undefined;
    let live = true;
    api("/render/templates")
      .then((d) => {
        if (!Array.isArray(d.templates) || d.templates.length === 0) return;
        cache = { templates: d.templates, groups: d.groups || fallback.groups, live: true };
        if (live) setState(cache);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return state;
}

export const BASE_SPEC = fallback.templates.find((t) => t.id === "plain_ats") || fallback.templates[0];

// ids that older versions suggested or saved, mapped to the closest current layout
export const ALIAS = {
  classic: "centered_rules",
  technical: "compact_ats",
  compact: "compact_ats",
};
export const resolveId = (id) => ALIAS[id] || id;

// a spec detected from the person's own resume, filled out so the preview can draw it
export function fullSpec(raw, base = BASE_SPEC) {
  if (!raw) return null;
  const order = Array.isArray(raw.order) ? raw.order : [];
  return {
    ...base,
    ...raw,
    id: "yours",
    label: "Your layout",
    blurb: "The layout of the resume you uploaded: its section order, headings, font style and accent color.",
    best_for: ["general"],
    order: [...order, ...base.order.filter((k) => !order.includes(k))],
    links_in_header: true,
    headings: raw.headings || {},
  };
}
