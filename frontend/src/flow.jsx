import { createContext, useContext, useMemo, useState } from "react";

const FlowContext = createContext(null);

// Holds what the person has entered so far, so the four steps can share it.
export function FlowProvider({ children }) {
  const [resumeFile, setResumeFileRaw] = useState(null);
  const [jobText, setJobTextRaw] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobCompany, setJobCompany] = useState("");
  const [result, setResult] = useState(null);

  const value = useMemo(
    () => ({
      resumeFile,
      jobText,
      jobTitle,
      jobCompany,
      result,
      setJobTitle,
      setJobCompany,
      setResult,
      // changing the inputs makes an old result out of date
      setResumeFile: (f) => {
        setResumeFileRaw(f);
        setResult(null);
      },
      setJobText: (t) => {
        setJobTextRaw(t);
        setResult(null);
      },
    }),
    [resumeFile, jobText, jobTitle, jobCompany, result],
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useFlow() {
  return useContext(FlowContext);
}
