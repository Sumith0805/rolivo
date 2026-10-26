import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearToken, fetchMe } from "../api.js";

export default function Dashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  useEffect(() => {
    fetchMe()
      .then((me) => setEmail(me.email))
      .catch(() => {
        clearToken();
        navigate("/signin", { replace: true });
      });
  }, [navigate]);

  function signOut() {
    clearToken();
    navigate("/signin", { replace: true });
  }

  return (
    <main style={{ padding: "2rem" }}>
      <h1>Dashboard</h1>
      <p>{email ? `Signed in as ${email}` : "Loading..."}</p>
      <button onClick={signOut}>Sign out</button>
    </main>
  );
}