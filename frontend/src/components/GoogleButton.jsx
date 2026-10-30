import { useEffect, useRef, useState } from "react";
import { api, setToken } from "../api.js";
import "./AuthExtras.css";

// "Continue with Google". The button only appears when the server has a Google client id,
// so the site works the same without it. The client id is public; no secret is used here.
let loading = null;
function loadGoogle() {
  if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = resolve;
      s.onerror = () => {
        loading = null;
        reject(new Error("Google could not be loaded"));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export default function GoogleButton({ onDone, onError }) {
  const box = useRef(null);
  const handlers = useRef({ onDone, onError });
  handlers.current = { onDone, onError };
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    let off = false;
    api("/auth/google/config")
      .then((d) => {
        if (!off) setClientId((d && d.client_id) || "");
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId || !box.current) return undefined;
    let off = false;
    loadGoogle()
      .then(() => {
        if (off || !box.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (resp) => {
            try {
              const d = await api("/auth/google", { method: "POST", body: { credential: resp.credential } });
              setToken(d.token);
              handlers.current.onDone();
            } catch (err) {
              handlers.current.onError(err.message || "Google sign-in failed. Please try again.");
            }
          },
        });
        box.current.innerHTML = "";
        window.google.accounts.id.renderButton(box.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: Math.min(360, Math.max(240, box.current.offsetWidth || 320)),
        });
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [clientId]);

  if (!clientId) return null;
  return (
    <div className="g-wrap">
      <div className="g-or">
        <span>or</span>
      </div>
      <div ref={box} className="g-box" />
    </div>
  );
}
