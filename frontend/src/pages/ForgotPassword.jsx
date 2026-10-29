import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import OtpReset from "../components/OtpReset.jsx";
import "./SignIn.css";

export default function ForgotPassword() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null); // { ticket, message } once the code is sent
  const [finished, setFinished] = useState("");

  const send = () => api("/auth/otp/request", { method: "POST", body: { email: email.trim() } });

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const out = await send();
      setDone(out);
    } catch (err) {
      const missing = err.status === 404 && err.message === "Not Found";
      setError(missing ? "The server does not have the code feature yet. Update the backend first." : err.message || "Something went wrong. Please try again.");
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
        <h1 className="auth-title">Forgot your password?</h1>
        <p className="auth-sub">Enter your email. Rolivo sends a 6-digit code that lets you choose a new password.</p>

        {finished ? (
          <div className="auth-form">
            <p className="auth-ok" role="status">
              {finished}
            </p>
            <Link to="/signin" className="auth-btn auth-btn-link">
              Sign in
            </Link>
          </div>
        ) : done ? (
          <OtpReset
            ticket={done.ticket}
            message={done.message}
            onResend={async () => setDone(await send())}
            onDone={setFinished}
          />
        ) : (
          <form onSubmit={submit} className="auth-form">
            <label>
              Email
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="auth-btn" disabled={busy}>
              {busy ? "Sending..." : "Email me a code"}
            </button>
          </form>
        )}
        {!done && !finished && (
          <p className="auth-switch">
            <Link to="/signin" className="link">
              Back to sign in
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}
