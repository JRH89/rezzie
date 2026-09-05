import { AuthProvider, useAuth } from "react-oidc-context";
import { App } from "./App";
import { BrandMark } from "./BrandMark";

const authority = import.meta.env.VITE_OIDC_AUTHORITY;
const clientId = import.meta.env.VITE_OIDC_CLIENT_ID;
const audience = import.meta.env.VITE_OIDC_AUDIENCE;

function AuthenticatedApplication() {
  const auth = useAuth();
  if (auth.isLoading) return <main className="auth-screen"><BrandMark /><div className="auth-card"><span className="auth-loader" /><p>Checking your secure session…</p></div></main>;
  if (auth.error) return <main className="auth-screen"><BrandMark /><div className="auth-card"><p className="eyebrow">SIGN-IN NEEDS ATTENTION</p><h1>We couldn’t complete sign-in.</h1><p>{auth.error.message}</p><button className="button button-primary" onClick={() => void auth.signinRedirect()}>Try again <span>→</span></button></div></main>;
  if (!auth.isAuthenticated) return <main className="auth-screen"><BrandMark /><div className="auth-card"><p className="eyebrow">REZZIE / SECURE ACCESS</p><h1>Your private tailoring workspace.</h1><p>Sign in to use saved Career Records, Rezzie credits, and your application history.</p><button className="button button-primary" onClick={() => void auth.signinRedirect()}>Sign in to continue <span>→</span></button><small>Resume content and API keys are never placed in browser logs.</small></div></main>;
  return <App accessToken={auth.user?.access_token} />;
}

export function ApplicationRoot() {
  if (!authority || !clientId || !audience) return <App />;
  return <AuthProvider authority={authority} client_id={clientId} redirect_uri={window.location.origin} response_type="code" scope="openid profile email" extraQueryParams={{ audience }} onSigninCallback={() => window.history.replaceState({}, document.title, window.location.pathname)}><AuthenticatedApplication /></AuthProvider>;
}
