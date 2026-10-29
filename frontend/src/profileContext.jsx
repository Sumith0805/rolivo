import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearToken } from "./api.js";
import { withDefaults } from "./profile.js";

const Ctx = createContext(null);

// Loads the signed-in person's email and profile once, and lets any page save the profile.
export function ProfileProvider({ children }) {
  const navigate = useNavigate();
  const [state, setState] = useState({ ready: false, email: "", profile: withDefaults(null), unavailable: false, reason: "" });

  useEffect(() => {
    let live = true;
    const lost = (err) => {
      if (err && err.status === 401) {
        clearToken();
        navigate("/signin", { replace: true });
        return true;
      }
      return false;
    };
    Promise.all([
      api("/auth/me").catch((err) => {
        lost(err);
        return {};
      }),
      api("/profile").catch((err) => {
        if (lost(err)) return null;
        return { unavailable: true, reason: `${err.status ? `error ${err.status}` : "no answer"}: ${err.message || "unknown"}` };
      }),
    ]).then(([me, prof]) => {
      if (!live) return;
      setState({
        ready: true,
        email: me?.email || "",
        profile: withDefaults(prof?.profile),
        unavailable: Boolean(prof?.unavailable),
        reason: prof?.reason || "",
      });
    });
    return () => {
      live = false;
    };
  }, [navigate]);

  const save = useCallback(async (profile) => {
    const out = await api("/profile", { method: "PUT", body: { profile } });
    const next = withDefaults(out.profile);
    setState((s) => ({ ...s, profile: next, unavailable: false, reason: "" }));
    return next;
  }, []);

  const value = useMemo(() => ({ ...state, save }), [state, save]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile() {
  return useContext(Ctx);
}
