import { useEffect, useState } from "react";
import { LandingPage } from "./LandingPage";
import { Workspace } from "./Workspace";

type View = "landing" | "workspace";

function viewFromHash(): View {
  return window.location.hash === "#workspace" ? "workspace" : "landing";
}

export function App({ accessToken, isAuthenticated = true, onSignIn, onSignUp, onSignOut }: { accessToken?: string; isAuthenticated?: boolean; onSignIn?: () => void; onSignUp?: () => void; onSignOut?: () => void }) {
  const [view, setView] = useState<View>(viewFromHash);

  useEffect(() => {
    const handleHashChange = () => setView(viewFromHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    if (!isAuthenticated && view === "workspace") {
      window.location.hash = "top";
      setView("landing");
    }
  }, [isAuthenticated, view]);

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
    ? <LandingPage isAuthenticated={isAuthenticated} onSignIn={onSignIn} onSignUp={onSignUp ?? onSignIn} onStart={() => navigate("workspace")} />
    : <Workspace accessToken={accessToken} onHome={() => navigate("landing")} onSignOut={onSignOut} />;
}
