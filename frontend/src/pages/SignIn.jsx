import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, login, setToken } from "../api.js";
import GoogleButton from "../components/GoogleButton.jsx";
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
  // sign-up has a second step: the 6-digit code that was emailed
  const [ticket, setTicket] = useState("");
  const [notice, setNotice] = useState("");
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(0);

  const isRegister = mode === "register";
  const confirming = isRegister && Boolean(ticket);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  function fail(err) {
    // the server says exactly what is wrong: no such account, wrong password, or the account already exists
    setError(err.message || "Something went wrong. Please try again.");
    setProblem(
      err.status === 409
        ? "exists"
        : err.status === 401 && /no account/i.test(err.message || "")
          ? "missing"
          : err.status === 401
            ? "password"
            : "",
    );
  }

  async function sendCode() {
    const out = await api("/auth/signup/request", { method: "POST", body: { email: email.trim(), password } });
    setTicket(out.ticket);
    setNotice(out.message || "We sent you a 6-digit code.");
    setCode("");
    setWait(30);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setProblem("");
    setBusy(true);
    try {
      if (confirming) {
        if (code.replace(/\D/g, "").length !== 6) throw new Error("Type the 6-digit code from the email.");
        const out = await api("/auth/signup/verify", { method: "POST", body: { ticket, code, password } });
        setToken(out.token);
        navigate("/dashboard", { replace: true });
      } else if (isRegister) {
        await sendCode();
      } else {
        await login(email.trim(), password);
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError("");
    setBusy(true);
    try {
      await sendCode();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  function backToForm() {
    setTicket("");
    setNotice("");
    setCode("");
    setError("");
    setProblem("");
  }

  function switchMode() {
    setMode(isRegister ? "signin" : "register");
    backToForm();
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
        <h1 className="auth-title">
          {confirming ? "Check your email" : isRegister ? "Create your account" : "Welcome back"}
        </h1>
        <p className="auth-sub">
          {confirming
            ? "Type the 6-digit code we sent to confirm this is your email."
            : "Resumes tailored to the job, without claiming a single skill you don't have."}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {confirming ? (
            <>
              {notice && (
                <p className="auth-ok" role="status">
                  {notice}
                </p>
              )}
              <label>
                6-digit code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  aria-label="6-digit code"
                  autoFocus
                />
              </label>
            </>
          ) : (
            <>
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
            </>
          )}

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
            {busy
              ? "Please wait..."
              : confirming
                ? "Confirm and create account"
                : isRegister
                  ? "Email me a code"
                  : "Sign in"}
          </button>

          {confirming && (
            <>
              <button type="button" className="linklike" onClick={resend} disabled={wait > 0 || busy}>
                {wait > 0 ? `Send a new code in ${wait}s` : "Send me a new code"}
              </button>
              <button type="button" className="linklike" onClick={backToForm}>
                Use a different email
              </button>
            </>
          )}
        </form>

        {!confirming && (
          <GoogleButton
            onDone={() => navigate("/dashboard", { replace: true })}
            onError={(message) => {
              setProblem("");
              setError(message);
            }}
          />
        )}

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
