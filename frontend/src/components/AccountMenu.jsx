import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearToken } from "../api.js";
import { getName, nameFromEmail, profileFirstName } from "../profile.js";
import { useProfile } from "../profileContext.jsx";

// the round name button in the header: Profile, Library, Settings, Sign out
export default function AccountMenu() {
  const navigate = useNavigate();
  const { email, profile } = useProfile();
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  const name = profileFirstName(profile) || getName().trim() || nameFromEmail(email);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (box.current && !box.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function go(to) {
    setOpen(false);
    navigate(to);
  }

  return (
    <div className="acct" ref={box}>
      <button
        type="button"
        className="acct-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="acct-dot" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="acct-name">{name}</span>
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => go("/dashboard")}>
            Dashboard
          </button>
          <button type="button" role="menuitem" onClick={() => go("/profile")}>
            Profile
          </button>
          <button type="button" role="menuitem" onClick={() => go("/library")}>
            Library
          </button>
          <button type="button" role="menuitem" onClick={() => go("/settings")}>
            Settings
          </button>
          <hr />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              clearToken();
              navigate("/signin", { replace: true });
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
