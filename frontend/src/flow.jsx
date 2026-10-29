import { createContext, useContext, useMemo, useState } from "react";

const FlowContext = createContext(null);

// Holds what the person has entered so far, so the four steps can share it.
export function FlowProvider({ children }) {
  // every resume the person added: { key, name, size, file } for an upload, { key, name, savedId } for a saved one
  const [resumes, setResumesRaw] = useState([]);
  const [fromProfile, setFromProfileRaw] = useState(false);
  const [jobText, setJobTextRaw] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobCompany, setJobCompany] = useState("");
  const [result, setResult] = useState(null);
  const [layout, setLayout] = useState(null); // the layout found in the uploaded resume

  const resumeFile = resumes.find((r) => r.file)?.file || null; // the first uploaded file
  const hasResume = resumes.length > 0;

  const value = useMemo(
    () => ({
      resumes,
      resumeFile,
      hasResume,
      fromProfile,
      jobText,
      jobTitle,
      jobCompany,
      result,
      layout,
      setLayout,
      setJobTitle,
      setJobCompany,
      setResult,
      // changing the inputs makes an old result out of date
      addResumes: (items) => {
        setResumesRaw((list) => [...list, ...items].slice(0, 5));
        setFromProfileRaw(false);
        setLayout(null);
        setResult(null);
      },
      removeResume: (key) => {
        setResumesRaw((list) => list.filter((r) => r.key !== key));
        setLayout(null);
        setResult(null);
      },
      // true when the resume is built from the person's profile instead of an upload
      setFromProfile: (on) => {
        setFromProfileRaw(on);
        if (on) {
          setResumesRaw([]);
          setLayout(null);
        }
        setResult(null);
      },
      setJobText: (t) => {
        setJobTextRaw(t);
        setResult(null);
      },
    }),
    [resumes, fromProfile, jobText, jobTitle, jobCompany, result, layout],
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  return useContext(FlowContext);
}
