import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { getToken } from "../api.js";
import ResumeScan from "../components/ResumeScan.jsx";
import "./Landing.css";

// three.js is big, so it loads only on this page, and only when the screen can handle it
const Hero3D = lazy(() => import("../components/Hero3D.jsx"));

function canUse3D() {
  try {
    const small = window.matchMedia("(max-width: 720px)").matches;
    return !small && Boolean(window.WebGLRenderingContext);
  } catch {
    return false;
  }
}

export default function Landing() {
  const signedIn = Boolean(getToken());
  const show3D = canUse3D();

  return (
    <div className="land">
      <header className="land-nav">
        <span className="land-mark">
          <span>R</span>OLIVO
        </span>
        <Link to={signedIn ? "/dashboard" : "/signin"} className="land-link">
          {signedIn ? "Open app" : "Sign in"}
        </Link>
      </header>

      <main className="land-hero">
        <div className="land-copy">
          <h1 className="land-title">
            Your resume, <em>tailored</em> to the job.
          </h1>
          <p className="land-sub">
            Tailor a resume to a job without claiming a single skill you don&apos;t have.
          </p>
          <div className="land-cta">
            <Link to={signedIn ? "/dashboard" : "/signin"} className="btn btn-red">
              {signedIn ? "Open Rolivo" : "Get started"}
            </Link>
          </div>
        </div>

        <div className="land-art">
          {show3D ? (
            <Suspense fallback={<ResumeScan />}>
              <Hero3D />
            </Suspense>
          ) : (
            <div className="land-art-flat">
              <ResumeScan />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}