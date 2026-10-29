import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, clearToken } from "../api.js";
import { setName } from "../profile.js";
import { useProfile } from "../profileContext.jsx";
import OtpReset from "../components/OtpReset.jsx";
import { cinemaOn, reducedMotion, setCinema } from "../cinema.js";

export default function Settings() {
  const navigate = useNavigate();
  const { email } = useProfile();
  const [note, setNote] = useState("");
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [em, setEm] = useState({ state: "idle", message: "", ticket: "", value: "", code: "" });
  const [cin, setCin] = useState(cinemaOn);
  const [pw, setPw] = useState({ state: "idle", message: "", ticket: "" });

  async function wipe(kind) {
    setBusy(true);
    setError("");
    try {
      if (kind === "library") {
        try {
          // this route keeps your profile; an older backend only has the plain one
          await api("/profile/library", { method: "DELETE" });
        } catch (err) {
          if (err.status !== 404 && err.status !== 405) throw err;
          await api("/library", { method: "DELETE" });
        }
        setNote("All saved resumes deleted. Your profile is untouched.");
        setAsk("");
      } else {
        await api("/auth/me", { method: "DELETE" });
        setName("");
        clearToken();
        navigate("/signin", { replace: true });
      }
    } catch (err) {
      if (err.status === 401) {
        clearToken();
        navigate("/signin", { replace: true });
        return;
      }
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // the code goes to the email on the account, which proves it is really you
  async function sendCode() {
    setPw({ state: "busy", message: "", ticket: "" });
    try {
      const out = await api("/auth/change-password/request", { method: "POST" });
      if (!out.ticket) throw new Error("The server is on an older version. Update the backend first.");
      setPw({ state: "code", message: out.message || "Check your inbox for the code.", ticket: out.ticket });
    } catch (err) {
      if (err.status === 401) {
        clearToken();
        navigate("/signin", { replace: true });
        return;
      }
      const missing = err.status === 404 || err.status === 405;
      setPw({ state: "error", ticket: "", message: missing ? "The server does not have this feature yet. Update the backend first." : err.message || "Could not send the email." });
    }
  }

  async function sendEmailCode(e) {
    e.preventDefault();
    setEm((s) => ({ ...s, state: "busy", message: "" }));
    try {
      const out = await api("/auth/email/request", { method: "POST", body: { new_email: em.value.trim() } });
      setEm((s) => ({ ...s, state: "code", ticket: out.ticket, message: out.message || "Check that inbox for the code.", code: "" }));
    } catch (err) {
      if (err.status === 401) {
        clearToken();
        navigate("/signin", { replace: true });
        return;
      }
      const missing = err.status === 404 || err.status === 405;
      setEm((s) => ({ ...s, state: "error", message: missing ? "The server does not have this feature yet. Update the backend first." : err.message || "Could not send the code." }));
    }
  }

  async function confirmEmail(e) {
    e.preventDefault();
    setEm((s) => ({ ...s, state: "busy" }));
    try {
      const out = await api("/auth/email/confirm", { method: "POST", body: { ticket: em.ticket, code: em.code } });
      setEm({ state: "done", message: (out.message || "Your email was changed.") + " Reloading...", ticket: "", value: "", code: "" });
      setTimeout(() => window.location.reload(), 900);
    } catch (err) {
      setEm((s) => ({ ...s, state: "code", message: err.message || "Could not confirm the code." }));
    }
  }

  function signOut() {
    clearToken();
    navigate("/signin", { replace: true });
  }

  return (
    <section>
      <h1 className="page-title">Settings.</h1>
      <p className="page-sub">Your account and your data.</p>

      <div className="set-grid">
        <div className="panel">
          <h2 className="panel-title">Profile</h2>
          <p className="set-help">
            Your name, links, projects and certifications live on your profile page.
          </p>
          <div className="actions">
            <Link to="/profile" className="btn btn-red">
              Open my profile
            </Link>
          </div>
        </div>

        <div className="panel">
          <h2 className="panel-title">Account</h2>
          <p className="set-row">
            <span>Email</span>
            <strong>{email || "…"}</strong>
          </p>
          <p className="set-help">
            To change your password, Rolivo emails a 6-digit code to the address above. Type the code here and choose a new password. The code works for 10 minutes.
          </p>
          {pw.state === "code" ? (
            <OtpReset
              variant="panel"
              ticket={pw.ticket}
              message={pw.message}
              onResend={async () => {
                const out = await api("/auth/change-password/request", { method: "POST" });
                setPw((p) => ({ ...p, ticket: out.ticket, message: out.message }));
              }}
              onDone={(m) => setPw({ state: "done", message: m, ticket: "" })}
            />
          ) : (
            <>
              <div className="actions">
                <button type="button" className="btn btn-red" onClick={sendCode} disabled={pw.state === "busy"}>
                  {pw.state === "busy" ? "Sending..." : "Email me a code to change my password"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={signOut}>
                  Sign out
                </button>
              </div>
              {pw.message && (
                <p className={`notice${pw.state === "error" ? "" : " ok"}`} role="status">
                  {pw.message}
                </p>
              )}
            </>
          )}
        </div>

        <div className="panel">
          <h2 className="panel-title">Change email</h2>
          <p className="set-help">Rolivo sends a 6-digit code to the new address. Type it here to confirm that it is yours.</p>
          {em.state === "code" || (em.state === "busy" && em.ticket) ? (
            <form className="otp-form" onSubmit={confirmEmail}>
              <p className="notice ok" role="status">
                {em.message}
              </p>
              <label>
                6-digit code
                <input className="field-input" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={em.code} onChange={(e) => setEm({ ...em, code: e.target.value })} placeholder="123456" aria-label="Email code" />
              </label>
              <div className="actions">
                <button type="submit" className="btn btn-red" disabled={em.state === "busy" || em.code.replace(/\D/g, "").length !== 6}>
                  {em.state === "busy" ? "Checking..." : "Confirm new email"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setEm({ state: "idle", message: "", ticket: "", value: "", code: "" })}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <form className="otp-form" onSubmit={sendEmailCode}>
              <label>
                New email
                <input className="field-input" type="email" autoComplete="email" value={em.value} onChange={(e) => setEm({ ...em, value: e.target.value })} placeholder="you@example.com" aria-label="New email" />
              </label>
              <div className="actions">
                <button type="submit" className="btn btn-red" disabled={em.state === "busy" || !em.value.includes("@")}>
                  {em.state === "busy" ? "Sending..." : "Send me a code"}
                </button>
              </div>
              {em.message && (
                <p className={`notice${em.state === "error" ? "" : " ok"}`} role="status">
                  {em.message}
                </p>
              )}
            </form>
          )}
        </div>

        <div className="panel">
          <h2 className="panel-title">Cinematic effects</h2>
          <p className="set-help">
            {reducedMotion()
              ? "Your device is set to reduce motion, so these effects are off."
              : "Page transitions, 3D cards and animated scenes. Turn them off on a slow device, or when you want everything instant."}
          </p>
          <div className="actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={reducedMotion()}
              onClick={() => {
                setCinema(!cin);
                setCin(!cin);
              }}
            >
              {cin ? "Turn effects off" : "Turn effects on"}
            </button>
          </div>
        </div>

        <div className="panel set-wide">
          <h2 className="panel-title">Your data</h2>
          <p className="set-help">
            Rolivo keeps only what you choose to save. You can remove it whenever you like.
          </p>

          {ask === "library" ? (
            <div className="lib-danger">
              <span>Delete every saved resume for good?</span>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => wipe("library")}>
                {busy ? "Deleting..." : "Yes, delete them"}
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setAsk("")}>
                Keep them
              </button>
            </div>
          ) : ask === "account" ? (
            <div className="lib-danger">
              <span>Delete your account and everything saved in it? This cannot be undone.</span>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => wipe("account")}>
                {busy ? "Deleting..." : "Yes, delete my account"}
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setAsk("")}>
                Keep my account
              </button>
            </div>
          ) : (
            <div className="actions">
              <button type="button" className="btn btn-ghost" onClick={() => setAsk("library")}>
                Delete all saved resumes
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setAsk("account")}>
                Delete my account
              </button>
            </div>
          )}
        </div>
      </div>

      {note && (
        <p className="notice ok" role="status">
          {note}
        </p>
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
