import { BrandMark } from "./BrandMark";

export type PublicHeaderProps = { isAuthenticated: boolean; onSignIn?: () => void; onStart: () => void };

export function PublicHeader({ isAuthenticated, onSignIn, onStart }: PublicHeaderProps) {
  return <header className="marketing-header"><a className="brand-link" href="/" aria-label="Rezzie home"><BrandMark /></a><nav className="marketing-nav" aria-label="Main navigation"><a href="/features">Features</a><a href="/how-it-works">How it works</a><a href="/pricing">Pricing</a><a href="/safety">Safety</a><a href="/blog">Resources</a></nav><div className="marketing-actions">{!isAuthenticated && onSignIn && <button className="text-button" onClick={onSignIn} type="button">Sign in</button>}<button className="button button-dark button-small" onClick={onStart} type="button">{isAuthenticated ? "Open workspace" : "Create free account"} <span aria-hidden="true">↗</span></button></div></header>;
}

export function PublicFooter() {
  return <footer className="marketing-footer"><a className="brand-link" href="/"><BrandMark /></a><nav className="footer-links" aria-label="Footer navigation"><a href="/features">Features</a><a href="/how-it-works">How it works</a><a href="/pricing">Pricing</a><a href="/safety">Safety</a><a href="/chrome-extension">Chrome extension</a><a href="/about">About</a><a href="/blog">Blog</a><a href="/faq">FAQ</a><a href="/#support">Support</a><a href="/privacy">Privacy</a></nav><p>Tailor the signal. Keep the truth.</p><span>© {new Date().getFullYear()} Rezzie</span></footer>;
}
