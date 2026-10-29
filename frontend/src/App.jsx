import { Suspense, lazy, useCallback, useLayoutEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./api.js";
import { FlowProvider } from "./flow.jsx";
import Intro from "./components/Intro.jsx";
import AppShell from "./components/AppShell.jsx";
const Landing = lazy(() => import("./pages/Landing.jsx"));
import SignIn from "./pages/SignIn.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
const Resume = lazy(() => import("./pages/Resume.jsx"));
const Job = lazy(() => import("./pages/Job.jsx"));
const Analysis = lazy(() => import("./pages/Analysis.jsx"));
const Rewrite = lazy(() => import("./pages/Rewrite.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Settings = lazy(() => import("./pages/Settings.jsx"));
const CoverLetter = lazy(() => import("./pages/CoverLetter.jsx"));
const AtsCheck = lazy(() => import("./pages/AtsCheck.jsx"));
const Profile = lazy(() => import("./pages/Profile.jsx"));
const Library = lazy(() => import("./pages/Library.jsx"));
const LibraryItem = lazy(() => import("./pages/LibraryItem.jsx"));
import Loader3D from "./components/Loader3D.jsx";
import { applyCinema, usePointerDepth } from "./cinema.js";
import "./motion.css";
import "./art.css";
import "./cinema.css";

// The intro plays once per browser session. Add ?intro to the address to replay it.
function shouldPlayIntro() {
  try {
    if (new URLSearchParams(window.location.search).has("intro")) return true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return sessionStorage.getItem("rolivo_intro") !== "1";
  } catch {
    return true;
  }
}

function Protected({ children }) {
  return getToken() ? children : <Navigate to="/signin" replace />;
}

export default function App() {
  const [intro, setIntro] = useState(shouldPlayIntro);
  usePointerDepth();

  useLayoutEffect(() => {
    applyCinema();
  }, []);

  // lets the page below hold its entrance animation until the intro is over
  useLayoutEffect(() => {
    document.documentElement.dataset.intro = intro ? "on" : "off";
  }, [intro]);

  const finishIntro = useCallback(() => {
    try {
      sessionStorage.setItem("rolivo_intro", "1");
    } catch {
      /* storage can be blocked; the intro simply plays again next time */
    }
    setIntro(false);
  }, []);

  return (
    <FlowProvider>
      {intro && <Intro onDone={finishIntro} />}
      <Suspense fallback={<Loader3D full label="Loading" />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          element={
            <Protected>
              <AppShell />
            </Protected>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/ats" element={<AtsCheck />} />
          <Route path="/cover" element={<CoverLetter />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/resume" element={<Resume />} />
          <Route path="/job" element={<Job />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/rewrite" element={<Rewrite />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/:id" element={<LibraryItem />} />
        </Route>
        <Route
          path="*"
          element={<Navigate to={getToken() ? "/dashboard" : "/signin"} replace />}
        />
      </Routes>
      </Suspense>
    </FlowProvider>
  );
}
