import { Navigate } from "react-router-dom";
import { api } from "../api.js";
import ResumeWorkbench from "../components/ResumeWorkbench.jsx";
import ScoreReveal from "../components/ScoreReveal.jsx";
import { mergeProfile, profileToFacts } from "../profile.js";
import { useProfile } from "../profileContext.jsx";
import { useFlow } from "../flow.jsx";

export default function Rewrite() {
  const { result, layout, jobText, jobTitle, jobCompany } = useFlow();
  const { profile, email } = useProfile();
  if (!result) return <Navigate to="/resume" replace />;

  function saveToLibrary(resume, templateId) {
    return api("/library/save", {
      method: "POST",
      body: {
        job: { title: jobTitle || "Untitled job", company: jobCompany || "", text: jobText },
        original: { name: resume.name || "", summary: "" },
        tailored: resume,
        template: templateId,
        role: result.role?.id || "general",
        before: result.before,
        after: result.after,
        changes: result.changes || [],
      },
    });
  }

  return (
    <section>
      <h1 className="page-title">Your resume, rewritten.</h1>
      <p className="page-sub">
        Tailored to the job using only what your resume already shows. It starts in your own layout when we could read one. Try other templates, ask for changes, then download.
      </p>
      <ScoreReveal before={result.before} after={result.after} />
      <ResumeWorkbench
        resume={mergeProfile(result.resume, profile, email)}
        template={result.template?.id || ""}
        suggestedId={result.template?.id || ""}
        layout={layout}
        jobText={jobText}
        facts={profileToFacts(profile)}
        check={result.check}
        onSave={saveToLibrary}
      />
    </section>
  );
}