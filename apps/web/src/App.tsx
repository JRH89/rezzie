import { useEffect, useState } from "react";
import { LandingPage } from "./LandingPage";
import { Workspace } from "./Workspace";

type View = "landing" | "workspace";

function viewFromHash(): View {
  return window.location.hash === "#workspace" ? "workspace" : "landing";
}

export function App({ accessToken }: { accessToken?: string }) {
  const [view, setView] = useState<View>(viewFromHash);

  useEffect(() => {
    const handleHashChange = () => setView(viewFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function navigate(next: View) {
    window.location.hash = next === "workspace" ? "workspace" : "top";
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return view === "landing"
    ? <LandingPage onStart={() => navigate("workspace")} />
    : <Workspace accessToken={accessToken} onHome={() => navigate("landing")} />;
}
