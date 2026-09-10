import { useState } from "react";
import { BrandMark } from "./BrandMark";
import { MobileMenu } from "./MobileMenu";

export type PublicHeaderProps = { isAuthenticated: boolean; onSignIn?: () => void; onStart: () => void };

export function PublicHeader({ isAuthenticated, onSignIn, onStart }: PublicHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const start = () => { closeMenu(); onStart(); };
  const signIn = () => { closeMenu(); onSignIn?.(); };
  return <header className="marketing-header"><a className="brand-link" href="/" aria-label="Rezzie home"><BrandMark /></a><nav className="marketing-nav" aria-label="Main navigation"><a href="/features">Features</a><a href="/how-it-works">How it works</a><a href="/pricing">Pricing</a><a href="/safety">Safety</a><a href="/blog">Resources</a></nav><div className="marketing-actions">{!isAuthenticated && onSignIn && <button className="text-button" onClick={onSignIn} type="button">Sign in</button>}<button className="button button-dark button-small" onClick={onStart} type="button">{isAuthenticated ? "Open workspace" : "Create free account"} <span aria-hidden="true">↗</span></button></div><MobileMenu isOpen={menuOpen} label="Main navigation" onClose={closeMenu} onToggle={() => setMenuOpen(current => !current)}><a href="/features" onClick={closeMenu}>Features</a><a href="/how-it-works" onClick={closeMenu}>How it works</a><a href="/pricing" onClick={closeMenu}>Pricing</a><a href="/safety" onClick={closeMenu}>Safety</a><a href="/blog" onClick={closeMenu}>Resources</a>{!isAuthenticated && onSignIn && <button onClick={signIn} type="button">Sign in</button>}<button className="mobile-menu-primary" onClick={start} type="button">{isAuthenticated ? "Open workspace" : "Create free account"}</button></MobileMenu></header>;
}

export function PublicFooter() {
  return <footer className="marketing-footer"><div className="footer-main"><div className="footer-brand"><a className="brand-link" href="/"><BrandMark /></a><p>Truth-preserving AI resume tailoring for the role in front of you.</p></div><nav className="footer-links" aria-label="Footer navigation"><section><strong>Product</strong><a href="/features">Features</a><a href="/how-it-works">How it works</a><a href="/pricing">Pricing</a><a href="/chrome-extension">Chrome extension</a></section><section><strong>Resources</strong><a href="/blog">Blog</a><a href="/faq">FAQ</a><a href="/safety">Safety</a></section><section><strong>Company</strong><a href="/about">About</a><a href="/#support">Support</a><a href="/privacy">Privacy</a></section></nav></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Rezzie</span><p>Tailor the signal. Keep the truth.</p></div></footer>;
}
