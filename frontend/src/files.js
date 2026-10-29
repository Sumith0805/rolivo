import { getToken } from "./api.js";

// Same address the rest of the app talks to (set in .env.local / on Vercel).
const API = import.meta.env.VITE_API_URL || "";

function filenameFrom(res, fallback) {
  const m = /filename="?([^";]+)"?/i.exec(res.headers.get("Content-Disposition") || "");
  return m ? m[1] : fallback;
}

// Asks the server to build the file (kind is "docx" or "pdf"), then hands it to the browser as a download.
// `layout` is { template: "modern" } or, for the person's own layout, { template: "classic", spec: {...} }.
export async function downloadFile(kind, resume, layout) {
  const token = getToken();
  const res = await fetch(`${API}/render/${kind === "pdf" ? "pdf" : "docx"}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      resume,
      template: layout?.template || "centered_rules",
      spec: layout?.spec || null,
      allow_placeholders: Boolean(layout?.allowPlaceholders),
    }),
  });
  if (!res.ok) {
    let message = `Export failed (${res.status})`;
    if (res.status === 404 || res.status === 405) {
      message = "The server does not have the file export feature yet. Update the backend, then try again.";
    }
    try {
      const data = await res.json();
      if (data && typeof data.detail === "string") message = data.detail;
    } catch {
      /* keep the generic message */
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameFrom(res, kind === "pdf" ? "Resume.pdf" : "Resume.docx");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Cover letters: the server builds the Word or PDF file from the letter text.
export async function downloadLetter(kind, letter) {
  const token = getToken();
  const res = await fetch(`${API}/cover/${kind === "pdf" ? "pdf" : "docx"}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ letter }),
  });
  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    if (res.status === 404 || res.status === 405) message = "The server does not have the cover letter feature yet. Update the backend, then try again.";
    try {
      const data = await res.json();
      if (data && typeof data.detail === "string") message = data.detail;
    } catch {
      /* keep the generic message */
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filenameFrom(res, kind === "pdf" ? "Cover_Letter.pdf" : "Cover_Letter.docx");
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
