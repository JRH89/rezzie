import { useEffect, useState } from "react";
import { LandingPage } from "./LandingPage";
import { BillingPage } from "./BillingPage";
import { MarketingPage } from "./MarketingPages";
import { Workspace } from "./Workspace";

type View = "landing" | "workspace" | "account" | "about" | "features" | "how-it-works" | "safety" | "pricing" | "faq" | "blog" | "blog-post";

function viewFromHash(): View {
  if (window.location.hash === "#workspace") return "workspace"; if (window.location.hash === "#account") return "account";
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const routes: Record<string, View> = { "/about": "about", "/features": "features", "/how-it-works": "how-it-works", "/safety": "safety", "/pricing": "pricing", "/faq": "faq", "/blog": "blog" };
  return path.startsWith("/blog/") ? "blog-post" : (routes[path] ?? "landing");
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
    : view === "workspace" ? <Workspace accessToken={accessToken} onBilling={() => navigate("account")} onHome={() => navigate("landing")} onSignOut={onSignOut} />
    : view === "account" ? <BillingPage accessToken={accessToken} onBack={() => navigate("workspace")} />
      : <MarketingPage isAuthenticated={isAuthenticated} kind={view} onSignIn={onSignIn} onStart={() => isAuthenticated ? navigate("workspace") : (onSignUp ?? onSignIn)?.()} />;
}
