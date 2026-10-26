import { useCallback, useLayoutEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./api.js";
import { FlowProvider } from "./flow.jsx";
import Intro from "./components/Intro.jsx";
import AppShell from "./components/AppShell.jsx";
import SignIn from "./pages/SignIn.jsx";
import Resume from "./pages/Resume.jsx";
import Job from "./pages/Job.jsx";
import Analysis from "./pages/Analysis.jsx";
import Rewrite from "./pages/Rewrite.jsx";

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
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route
          element={
            <Protected>
              <AppShell />
            </Protected>
          }
        >
          <Route path="/resume" element={<Resume />} />
          <Route path="/job" element={<Job />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/rewrite" element={<Rewrite />} />
        </Route>
        <Route
          path="*"
          element={<Navigate to={getToken() ? "/resume" : "/signin"} replace />}
        />
      </Routes>
    </FlowProvider>
  );
}
