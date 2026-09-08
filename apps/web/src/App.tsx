import { useEffect, useState } from "react";
import { LandingPage } from "./LandingPage";
import { BillingPage } from "./BillingPage";
import { MarketingPage } from "./MarketingPages";
import { Workspace } from "./Workspace";
import { SupportPage } from "./SupportPage";

type View = "landing" | "workspace" | "account" | "support" | "admin" | "about" | "features" | "how-it-works" | "safety" | "pricing" | "faq" | "privacy" | "blog" | "blog-post";
type PurchaseIntent = "credits" | "subscription";

function viewFromHash(): View {
  if (window.location.hash === "#workspace") return "workspace"; if (window.location.hash.startsWith("#account")) return "account";
  if (window.location.hash === "#support") return "support"; if (window.location.hash === "#admin") return "admin";
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const routes: Record<string, View> = { "/about": "about", "/features": "features", "/how-it-works": "how-it-works", "/safety": "safety", "/pricing": "pricing", "/faq": "faq", "/privacy": "privacy", "/blog": "blog" };
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
    if (!isAuthenticated && (view === "workspace" || view === "account" || view === "support" || view === "admin")) {
      window.location.hash = "top";
      setView("landing");
    }
  }, [isAuthenticated, view]);

  function navigate(next: View, purchaseIntent?: PurchaseIntent) {
    if ((next === "workspace" || next === "support" || next === "admin") && !isAuthenticated) {
      onSignIn?.();
      return;
    }
    window.location.hash = next === "landing" ? "top" : next === "account" && purchaseIntent ? `account?purchase=${purchaseIntent}` : next;
    setView(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return view === "landing"
    ? <LandingPage isAuthenticated={isAuthenticated} onBuyCredits={() => isAuthenticated ? navigate("account", "credits") : (onSignUp ?? onSignIn)?.()} onSignIn={onSignIn} onSignUp={onSignUp ?? onSignIn} onStart={() => navigate("workspace")} onSubscribe={() => isAuthenticated ? navigate("account", "subscription") : (onSignUp ?? onSignIn)?.()} />
    : view === "workspace" ? <Workspace accessToken={accessToken} onBilling={intent => navigate("account", intent)} onHome={() => navigate("landing")} onSignOut={onSignOut} onSupport={() => navigate("support")} />
    : view === "account" ? <BillingPage accessToken={accessToken} onBack={() => navigate("workspace")} purchaseIntent={purchaseIntentFromHash()} />
      : view === "support" ? <SupportPage accessToken={accessToken} onBack={() => navigate("workspace")} />
      : view === "admin" ? <SupportPage accessToken={accessToken} admin onBack={() => navigate("workspace")} />
      : <MarketingPage isAuthenticated={isAuthenticated} kind={view} onBuyCredits={() => isAuthenticated ? navigate("account", "credits") : (onSignUp ?? onSignIn)?.()} onSignIn={onSignIn} onStart={() => isAuthenticated ? navigate("workspace") : (onSignUp ?? onSignIn)?.()} onSubscribe={() => isAuthenticated ? navigate("account", "subscription") : (onSignUp ?? onSignIn)?.()} />;
}
