import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, register } from "../api.js";
import "./SignIn.css";

export default function SignIn() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isRegister) await register(email.trim(), password);
      else await login(email.trim(), password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      // the server says exactly what is wrong: no such account, wrong password, or the account already exists
      setError(err.message || "Something went wrong. Please try again.");
      setProblem(err.status === 409 ? "exists" : err.status === 401 && /no account/i.test(err.message || "") ? "missing" : err.status === 401 ? "password" : "");
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(isRegister ? "signin" : "register");
    setError("");
    setProblem("");
  }

  return (
    <main className="auth">
      <div className="auth-art" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <section className="auth-card">
        <img className="auth-logo" src="/brand/rolivo-mark.svg" alt="Rolivo" width="84" />
        <p className="auth-word">
          <span>R</span>OLIVO
        </p>
        <h1 className="auth-title">{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-sub">
          Resumes tailored to the job, without claiming a single skill you don&apos;t have.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              type={show ? "text" : "password"}
              autoComplete={isRegister ? "new-password" : "current-password"}
              required
              minLength={isRegister ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isRegister ? "At least 8 characters" : "Your password"}
            />
          </label>
          <div className="auth-row">
            <label className="auth-check">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              <span>Show password</span>
            </label>
            {!isRegister && (
              <Link to={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="link">
                Forgot password?
              </Link>
            )}
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
              {problem === "exists" && (
                <>
                  {" "}
                  <button type="button" className="link" onClick={switchMode}>
                    Sign in instead
                  </button>
                </>
              )}
              {problem === "missing" && (
                <>
                  {" "}
                  <button type="button" className="link" onClick={switchMode}>
                    Create an account
                  </button>
                </>
              )}
              {problem === "password" && (
                <>
                  {" "}
                  <Link to={`/forgot-password?email=${encodeURIComponent(email)}`} className="link">
                    Reset it
                  </Link>
                </>
              )}
            </p>
          )}

          <button type="submit" className="auth-btn" disabled={busy}>
            {busy ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {isRegister ? "Already have an account?" : "New to Rolivo?"}{" "}
          <button type="button" className="link" onClick={switchMode}>
            {isRegister ? "Sign in" : "Create an account"}
          </button>
        </p>
        <p className="auth-note">
          The first request can take up to a minute while the free server wakes up.
        </p>
      </section>
    </main>
  );
}
