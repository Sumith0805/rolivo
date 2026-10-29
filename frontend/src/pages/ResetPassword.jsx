import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import "./SignIn.css";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [check, setCheck] = useState({ state: token ? "loading" : "bad", email: "", message: token ? "" : "This link is missing its code. Ask for a new one." });
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  // look at the link first, so an old or used link is explained before anyone types a password
  useEffect(() => {
    if (!token) return undefined;
    let live = true;
    api(`/auth/reset/check?token=${encodeURIComponent(token)}`)
      .then((d) => live && setCheck({ state: "ok", email: d.email || "", message: "" }))
      .catch((err) => live && setCheck({ state: "bad", email: "", message: err.message || "This link is not valid." }));
    return () => {
      live = false;
    };
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== again) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const out = await api("/auth/reset", { method: "POST", body: { token, password } });
      setDone(out.message || "Your password was changed.");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <section className="auth-card">
        <img className="auth-logo" src="/brand/rolivo-mark.svg" alt="Rolivo" width="84" />
        <p className="auth-word">
          <span>R</span>OLIVO
        </p>
        <h1 className="auth-title">Choose a new password</h1>

        {done ? (
          <div className="auth-form">
            <p className="auth-ok" role="status">
              {done}
            </p>
            <Link to="/signin" className="auth-btn auth-btn-link">
              Go to sign in
            </Link>
          </div>
        ) : check.state === "loading" ? (
          <p className="auth-sub">Checking your link...</p>
        ) : check.state === "bad" ? (
          <div className="auth-form">
            <p className="auth-error" role="alert">
              {check.message}
            </p>
            <Link to="/forgot-password" className="auth-btn auth-btn-link">
              Get a new link
            </Link>
          </div>
        ) : (
          <>
            <p className="auth-sub">For {check.email}</p>
            <form onSubmit={submit} className="auth-form">
              <label>
                New password
                <input type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
              </label>
              <label>
                Type it again
                <input type={show ? "text" : "password"} autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} placeholder="The same password" />
              </label>
              <label className="auth-check">
                <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
                <span>Show passwords</span>
              </label>
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="auth-btn" disabled={busy}>
                {busy ? "Saving..." : "Save new password"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
