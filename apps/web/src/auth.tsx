import { AuthProvider, useAuth } from "react-oidc-context";
import { App } from "./App";

const authority = import.meta.env.VITE_OIDC_AUTHORITY;
const clientId = import.meta.env.VITE_OIDC_CLIENT_ID;
const audience = import.meta.env.VITE_OIDC_AUDIENCE;

function AuthenticatedApplication() {
  const auth = useAuth();
  if (auth.isLoading) return <main><p className="eyebrow">REZZIE</p><p>Checking your secure session…</p></main>;
  if (auth.error) return <main><p className="error">We could not complete sign-in. {auth.error.message}</p></main>;
  if (!auth.isAuthenticated) return <main><p className="eyebrow">REZZIE / SECURE ACCESS</p><h1>Resume tailoring, grounded in your experience.</h1><button className="primary" onClick={() => void auth.signinRedirect()}>Sign in to continue</button></main>;
  return <App accessToken={auth.user?.access_token}/>;
}

export function ApplicationRoot() {
  if (!authority || !clientId || !audience) return <App/>;
  return <AuthProvider authority={authority} client_id={clientId} redirect_uri={window.location.origin} response_type="code" scope="openid profile email" extraQueryParams={{ audience }} onSigninCallback={() => window.history.replaceState({}, document.title, window.location.pathname)}><AuthenticatedApplication/></AuthProvider>;
}
