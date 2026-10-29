import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { completeness, getName, nameFromEmail, profileFirstName } from "../profile.js";
import { useProfile } from "../profileContext.jsx";
import useEnter from "../useEnter.js";
import DeckScene from "../components/DeckScene.jsx";

export default function Dashboard() {
  const navigate = useNavigate();
  const { email, profile, ready } = useProfile();
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    let live = true;
    api("/library")
      .then((items) => live && setSaved(Array.isArray(items) ? items.length : 0))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const start = useCallback(() => navigate("/resume"), [navigate]);
  useEnter(start);

  const name = profileFirstName(profile) || getName().trim() || nameFromEmail(email);
  const done = completeness(profile);

  return (
    <section>
      <div className="dash-hero">
        <div>
          <h1 className="page-title">Welcome, {ready ? name : "…"}.</h1>
          <p className="page-sub">
            Tailor a resume to a job without claiming a single skill you don&apos;t have.
          </p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <DeckScene />
        </div>
      </div>

      <ul className="lib-grid dash-grid">
        <li>
          <Link to="/resume" className="lib-card dash-main">
            <h2>Tailor a resume</h2>
            <p className="lib-company">
              Upload a resume, or build one from your profile. Paste a job and get a rewritten version plus your scores.
            </p>
            <p className="lib-meta">Press Enter to start</p>
          </Link>
        </li>
        <li>
          <Link to="/cover" className="lib-card">
            <h2>Cover letter</h2>
            <p className="lib-company">Write a letter for a job using only facts from your resume.</p>
          </Link>
        </li>
        <li>
          <Link to="/ats" className="lib-card">
            <h2>ATS check</h2>
            <p className="lib-company">See how readable your resume is to recruiting systems, with a score and what to fix.</p>
          </Link>
        </li>
        <li>
          <Link to="/profile" className="lib-card">
            <h2>Your profile</h2>
            <p className="lib-company">
              {done.percent === 100
                ? "Complete. Rolivo has everything it needs."
                : `Add ${done.missing.slice(0, 2).join(" and ")} to make your resumes stronger.`}
            </p>
            <div className="meter" role="img" aria-label={`Profile ${done.percent}% complete`}>
              <div style={{ "--p": done.percent / 100 }} />
            </div>
            <p className="lib-meta">{done.percent}% complete</p>
          </Link>
        </li>
        <li>
          <Link to="/library" className="lib-card">
            <h2>Your library</h2>
            <p className="lib-company">
              {saved === null
                ? "Open, edit and export what you saved."
                : saved === 0
                  ? "Nothing saved yet."
                  : `${saved} saved ${saved === 1 ? "resume" : "resumes"}. Open, edit and export.`}
            </p>
          </Link>
        </li>
        <li>
          <Link to="/settings" className="lib-card">
            <h2>Settings</h2>
            <p className="lib-company">Your account and your data.</p>
          </Link>
        </li>
      </ul>
    </section>
  );
}
