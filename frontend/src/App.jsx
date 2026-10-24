import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL;

export default function App() {
  const [state, setState] = useState({ status: "checking", text: "" });

  useEffect(() => {
    fetch(`${API}/health`)
      .then(async (res) => {
        const text = await res.text();
        setState({ status: res.ok ? "ok" : "error", text });
      })
      .catch((err) => setState({ status: "error", text: String(err) }));
  }, []);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Rolivo</h1>
      <p>API address: {API}</p>
      <p>API status: {state.status}</p>
      <pre>{state.text}</pre>
    </main>
  );
}