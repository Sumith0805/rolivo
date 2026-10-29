import { lazy, Suspense, useEffect } from "react";
import { Link } from "react-router-dom";
import Lenis from "lenis";
import { MotionConfig, motion, useReducedMotion, useScroll, useSpring } from "motion/react";
import { getToken } from "../api.js";
import ResumeScan from "../components/ResumeScan.jsx";
import TiltEffect from "../components/TiltEffect.jsx";
import "./Landing.css";
import "./LandingMore.css";

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

const STEPS = [
  { n: "1", title: "Add your resume", text: "Upload one, or build one from your profile." },
  { n: "2", title: "Paste the job", text: "Get a rewritten version plus your scores." },
  { n: "3", title: "Download", text: "Try other templates, ask for changes, then download." },
];

const TOOLS = [
  { title: "Cover letter", text: "Write a letter for a job using only facts from your resume." },
  { title: "ATS check", text: "See how readable your resume is to recruiting systems, with a score and what to fix." },
];

// fades and rises into place the first time it scrolls into view
function Reveal({ children, delay = 0, className = "" }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function Landing() {
  const signedIn = Boolean(getToken());
  const show3D = canUse3D();
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  const go = signedIn ? "/dashboard" : "/signin";

  // smooth, weighty scrolling (skipped for people who asked for less motion)
  useEffect(() => {
    if (reduce) return undefined;
    const lenis = new Lenis({ lerp: 0.1 });
    let id = 0;
    const raf = (time) => {
      lenis.raf(time);
      id = requestAnimationFrame(raf);
    };
    id = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
    };
  }, [reduce]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="land">
        <TiltEffect />
        <motion.div className="land-progress" style={{ scaleX: progress }} aria-hidden="true" />

        <header className="land-nav">
          <span className="land-mark">
            <span>R</span>OLIVO
          </span>
          <Link to={go} className="land-link">
            {signedIn ? "Open app" : "Sign in"}
          </Link>
        </header>

        <main>
          <section className="land-hero">
            <div className="land-copy">
              <h1 className="land-title">
                Your resume, <em>tailored</em> to the job.
              </h1>
              <p className="land-sub">
                Tailor a resume to a job without claiming a single skill you don&apos;t have.
              </p>
              <div className="land-cta">
                <Link to={go} className="btn btn-red">
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
          </section>

          <section className="land-section">
            <Reveal>
              <h2 className="land-h2">Three steps.</h2>
            </Reveal>
            <ol className="land-steps">
              {STEPS.map((s, i) => (
                <li key={s.n}>
                  <Reveal delay={i * 0.12} className="panel land-step">
                    <b>{s.n}</b>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </section>

          <section className="land-section land-promise">
            <Reveal>
              <h2 className="land-h2">Only what your resume already shows.</h2>
              <p className="land-sub land-sub-center">
                Tailored to the job using only what your resume already shows.
              </p>
            </Reveal>
          </section>

          <section className="land-section">
            <ul className="land-tools">
              {TOOLS.map((t, i) => (
                <li key={t.title}>
                  <Reveal delay={i * 0.12} className="lib-card land-tool">
                    <h2>{t.title}</h2>
                    <p className="lib-company">{t.text}</p>
                  </Reveal>
                </li>
              ))}
            </ul>
          </section>

          <section className="land-section land-final">
            <Reveal>
              <h2 className="land-h2">Ready when you are.</h2>
              <Link to={go} className="btn btn-red">
                {signedIn ? "Open Rolivo" : "Get started"}
              </Link>
            </Reveal>
          </section>
        </main>
      </div>
    </MotionConfig>
  );
}