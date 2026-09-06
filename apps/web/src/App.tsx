import { useEffect, useState } from "react";
import { LandingPage } from "./LandingPage";
import { MarketingPage } from "./MarketingPages";
import { Workspace } from "./Workspace";

type View = "landing" | "workspace" | "about" | "features" | "faq" | "blog" | "keyword-tailoring" | "honest-resume-tailoring" | "job-description";

function viewFromHash(): View {
  if (window.location.hash === "#workspace") return "workspace";
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const routes: Record<string, View> = { "/about": "about", "/features": "features", "/faq": "faq", "/blog": "blog", "/blog/keyword-tailoring": "keyword-tailoring", "/blog/honest-resume-tailoring": "honest-resume-tailoring", "/blog/job-description": "job-description" };
  return routes[path] ?? "landing";
}

export function App({ accessToken, isAuthenticated = true, onSignIn, onSignUp, onSignOut }: { accessToken?: string; isAuthenticated?: boolean; onSignIn?: () => void; onSignUp?: () => void; onSignOut?: () => void }) {
  const [view, setView] = useState<View>(viewFromHash);

  useEffect(() => {
    const handleHashChange = () => setView(viewFromHash());
    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("popstate", handleHashChange);
    return () => { window.removeEventListener("hashchange", handleHashChange); window.removeEventListener("popstate", handleHashChange); };
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
    : view === "workspace" ? <Workspace accessToken={accessToken} onHome={() => navigate("landing")} onSignOut={onSignOut} />
      : <MarketingPage kind={view} onStart={() => navigate("workspace")} />;
}
