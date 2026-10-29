import { api } from "./api.js";

// Resumes kept in the person's account (as plain text), and helpers to read an upload.

export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_RESUMES = 5; // at most this many go into one rewrite
export const OK_TYPE = /\.(pdf|docx|txt)$/i;

export function sizeLabel(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// returns a message when the file cannot be used, otherwise ""
export function fileProblem(file) {
  if (!OK_TYPE.test(file.name)) return `“${file.name}”: use a PDF, a Word file (.docx) or a text file.`;
  if (file.size > MAX_BYTES) return `“${file.name}” is over 2 MB. Use a smaller one.`;
  return "";
}

const formWith = (file) => {
  const f = new FormData();
  f.append("file", file, file.name);
  return f;
};

export async function listSaved() {
  const d = await api("/profile/resumes");
  return Array.isArray(d.resumes) ? d.resumes : [];
}
export const saveResume = (file) => api("/profile/resumes", { method: "POST", form: formWith(file) });
export const deleteSaved = (id) => api(`/profile/resumes/${id}`, { method: "DELETE" });
export const savedText = (id) => api(`/profile/resumes/${id}/text`);
export const extractText = (file) => api("/resumes/extract", { method: "POST", form: formWith(file) });
export const autofill = (text) => api("/profile/autofill", { method: "POST", body: { text } });

const PER_RESUME = 8000;

// several resumes become one text, with a note telling the rewrite to merge them
export function combineTexts(parts) {
  const intro =
    parts.length > 1
      ? `The person gave ${parts.length} versions of their resume, written for different roles. Treat them together as one body of evidence. Write ONE resume that merges them. Use only facts these versions show, and do not repeat an item that appears in more than one.\n\n`
      : "";
  return (
    intro +
    parts.map((p, i) => `=== Resume ${i + 1}: ${p.name} ===\n${String(p.text).slice(0, PER_RESUME)}`).join("\n\n")
  );
}
