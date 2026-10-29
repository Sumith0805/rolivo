import { useEffect, useState } from "react";
import { api } from "./api.js";

// Live ATS readiness for a resume object. Plain arithmetic on the server, so it is quick.
// Returns { report, missing } where missing=true means the server has no /ats yet.
export function useAtsScore(resume, wait = 450) {
  const [state, setState] = useState({ report: null, missing: false });
  useEffect(() => {
    let live = true;
    const id = setTimeout(() => {
      api("/ats/score", { method: "POST", body: { resume } })
        .then((report) => live && setState({ report, missing: false }))
        .catch((err) => live && setState((s) => ({ report: s.report, missing: err.status === 404 || err.status === 405 })));
    }, wait);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [resume, wait]);
  return state;
}

export function checkResumeFile(file, text) {
  const f = new FormData();
  if (file) f.append("resume_file", file, file.name);
  else f.append("resume_text", text || "");
  return api("/ats/check", { method: "POST", form: f });
}
