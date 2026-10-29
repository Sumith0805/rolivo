import { Suspense } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { MotionConfig } from "motion/react";
import Loader3D from "./Loader3D.jsx";
import { useFlow } from "../flow.jsx";
import { ProfileProvider } from "../profileContext.jsx";
import AccountMenu from "./AccountMenu.jsx";
import TiltEffect from "./TiltEffect.jsx";
import "./AppShell.css";
import "../pages/pages.css";

function Shell() {
  const { hasResume, fromProfile, result } = useFlow();
  const { pathname } = useLocation();
  // a step opens only once the earlier steps have what they need
  const steps = [
    { to: "/resume", label: "Resume", n: 1, open: true },
    { to: "/job", label: "Job", n: 2, open: Boolean(hasResume || fromProfile) },
    { to: "/analysis", label: "Analysis", n: 3, open: Boolean(result) },
    { to: "/rewrite", label: "Rewrite", n: 4, open: Boolean(result) },
  ];

  return (
    <div className="shell">
      <TiltEffect />
      <header className="shell-head">
        <div className="shell-inner">
          <NavLink to="/dashboard" className="wordmark" aria-label="Rolivo">
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
          <AccountMenu />
        </div>
      </header>
      <main className="shell-main">
        <div key={pathname} className="route">
          <Suspense fallback={<Loader3D full label="Loading" />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

export default function AppShell() {
  return (
    <MotionConfig reducedMotion="user">
      <ProfileProvider>
        <Shell />
      </ProfileProvider>
    </MotionConfig>
  );
}
