import { useEffect, useState } from "react";
import { LandingPage } from "./LandingPage";
import { BillingPage } from "./BillingPage";
import { MarketingPage } from "./MarketingPages";
import { Workspace } from "./Workspace";

type View = "landing" | "workspace" | "account" | "about" | "features" | "how-it-works" | "safety" | "pricing" | "faq" | "blog" | "blog-post";
type PurchaseIntent = "credits" | "subscription";

function viewFromHash(): View {
  if (window.location.hash === "#workspace") return "workspace"; if (window.location.hash.startsWith("#account")) return "account";
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const routes: Record<string, View> = { "/about": "about", "/features": "features", "/how-it-works": "how-it-works", "/safety": "safety", "/pricing": "pricing", "/faq": "faq", "/blog": "blog" };
  return path.startsWith("/blog/") ? "blog-post" : (routes[path] ?? "landing");
}

function purchaseIntentFromHash(): PurchaseIntent | undefined {
  const purchase = new URLSearchParams(window.location.hash.split("?")[1]).get("purchase");
  return purchase === "credits" || purchase === "subscription" ? purchase : undefined;
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
    if (!isAuthenticated && (view === "workspace" || view === "account")) {
      window.location.hash = "top";
      setView("landing");
    }
  }, [isAuthenticated, view]);

  function navigate(next: View, purchaseIntent?: PurchaseIntent) {
    if (next === "workspace" && !isAuthenticated) {
      onSignIn?.();
      return;
    }
    window.location.hash = next === "landing" ? "top" : next === "account" && purchaseIntent ? `account?purchase=${purchaseIntent}` : next;
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return view === "landing"
    ? <LandingPage isAuthenticated={isAuthenticated} onBuyCredits={() => isAuthenticated ? navigate("account", "credits") : (onSignUp ?? onSignIn)?.()} onSignIn={onSignIn} onSignUp={onSignUp ?? onSignIn} onStart={() => navigate("workspace")} onSubscribe={() => isAuthenticated ? navigate("account", "subscription") : (onSignUp ?? onSignIn)?.()} />
    : view === "workspace" ? <Workspace accessToken={accessToken} onBilling={intent => navigate("account", intent)} onHome={() => navigate("landing")} onSignOut={onSignOut} />
    : view === "account" ? <BillingPage accessToken={accessToken} onBack={() => navigate("workspace")} purchaseIntent={purchaseIntentFromHash()} />
      : <MarketingPage isAuthenticated={isAuthenticated} kind={view} onBuyCredits={() => isAuthenticated ? navigate("account", "credits") : (onSignUp ?? onSignIn)?.()} onSignIn={onSignIn} onStart={() => isAuthenticated ? navigate("workspace") : (onSignUp ?? onSignIn)?.()} onSubscribe={() => isAuthenticated ? navigate("account", "subscription") : (onSignUp ?? onSignIn)?.()} />;
}
