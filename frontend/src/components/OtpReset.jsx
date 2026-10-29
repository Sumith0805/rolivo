import { useEffect, useState } from "react";
import { api } from "../api.js";

// Second half of "forgot password" and "change password": the person types the 6-digit code
// from their email plus a new password. `ticket` comes from the request step.
// variant "auth" uses the sign-in card look, "panel" the Settings look.
export default function OtpReset({ ticket, message, onResend, onDone, variant = "auth" }) {
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wait, setWait] = useState(30);
  const auth = variant === "auth";

  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (code.replace(/\D/g, "").length !== 6) return setError("Type the 6-digit code from the email.");
    if (pw.length < 8) return setError("Use a password with at least 8 characters.");
    if (pw !== pw2) return setError("The two passwords do not match.");
    setBusy(true);
    try {
      const v = await api("/auth/otp/verify", { method: "POST", body: { ticket, code } });
      const out = await api("/auth/reset", { method: "POST", body: { token: v.token, password: pw } });
      onDone(out.message || "Your password was changed.");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function again() {
    setError("");
    setCode("");
    try {
      await onResend();
      setWait(30);
    } catch (err) {
      setError(err.message || "Could not send a new code.");
    }
  }

  const inputClass = auth ? undefined : "field-input";
  return (
    <form onSubmit={submit} className={auth ? "auth-form" : "otp-form"}>
      {message && (
        <p className={auth ? "auth-ok" : "notice ok"} role="status">
          {message}
        </p>
      )}
      <label>
        6-digit code
        <input
          className={inputClass}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          aria-label="6-digit code"
        />
      </label>
      <label>
        New password
        <input className={inputClass} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" />
      </label>
      <label>
        Type it again
        <input className={inputClass} type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </label>
      {error && (
        <p className={auth ? "auth-error" : "notice"} role="alert">
          {error}
        </p>
      )}
      <button type="submit" className={auth ? "auth-btn" : "btn btn-red"} disabled={busy}>
        {busy ? "Saving..." : "Set new password"}
      </button>
      <button type="button" className={auth ? "linklike" : "linklike"} onClick={again} disabled={wait > 0 || busy}>
        {wait > 0 ? `Send a new code in ${wait}s` : "Send me a new code"}
      </button>
    </form>
  );
}
