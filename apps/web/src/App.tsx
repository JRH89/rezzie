import { useEffect, useState } from "react";
import { LandingPage } from "./LandingPage";
import { Workspace } from "./Workspace";

type View = "landing" | "workspace";

function viewFromHash(): View {
  return window.location.hash === "#workspace" ? "workspace" : "landing";
}

export function App({ accessToken, isAuthenticated = true, onSignIn }: { accessToken?: string; isAuthenticated?: boolean; onSignIn?: () => void }) {
  const [view, setView] = useState<View>(viewFromHash);

  useEffect(() => {
    const handleHashChange = () => setView(viewFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  function navigate(next: View) {
    if (next === "workspace" && !isAuthenticated) {
      onSignIn?.();
      return;
    }
    window.location.hash = next === "workspace" ? "workspace" : "top";
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return view === "landing"
    ? <LandingPage isAuthenticated={isAuthenticated} onSignIn={onSignIn} onStart={() => navigate("workspace")} />
    : <Workspace accessToken={accessToken} onHome={() => navigate("landing")} />;
}
