import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearToken } from "../api.js";
import { useFlow } from "../flow.jsx";
import "./AppShell.css";
import "../pages/pages.css";

export default function AppShell() {
  const navigate = useNavigate();
  const { resumeFile, result } = useFlow();

  // a step opens only once the earlier steps have what they need
  const steps = [
    { to: "/resume", label: "Resume", n: 1, open: true },
    { to: "/job", label: "Job", n: 2, open: Boolean(resumeFile) },
    { to: "/analysis", label: "Analysis", n: 3, open: Boolean(result) },
    { to: "/rewrite", label: "Rewrite", n: 4, open: Boolean(result) },
  ];

  function signOut() {
    clearToken();
    navigate("/signin", { replace: true });
  }

  return (
    <div className="shell">
      <header className="shell-head">
        <div className="shell-inner">
          <NavLink to="/resume" className="wordmark" aria-label="Rolivo">
            <span>R</span>OLIVO
          </NavLink>
          <nav className="steps" aria-label="Steps">
            {steps.map((s) =>
              s.open ? (
                <NavLink
                  key={s.to}
                  to={s.to}
                  className={({ isActive }) => `step${isActive ? " on" : ""}`}
                >
                  <b>{s.n}</b>
                  {s.label}
                </NavLink>
              ) : (
                <span key={s.to} className="step off" aria-disabled="true">
                  <b>{s.n}</b>
                  {s.label}
                </span>
              ),
            )}
          </nav>
          <button type="button" className="signout" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}
