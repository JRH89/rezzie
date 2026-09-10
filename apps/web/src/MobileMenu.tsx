import { ReactNode, useEffect, useId, useState } from "react";

export function MobileMenu({ children, isOpen, onClose, onToggle, label = "Navigation menu" }: { children: ReactNode; isOpen: boolean; onClose: () => void; onToggle: () => void; label?: string }) {
  const drawerId = useId();
  const [mounted, setMounted] = useState(isOpen);
  const [visible, setVisible] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), 300);
    return () => window.clearTimeout(timer);
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", closeOnEscape); };
  }, [isOpen, onClose]);
  return <div className="mobile-menu"><button aria-controls={drawerId} aria-expanded={isOpen} aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"} className={`mobile-menu-toggle${isOpen ? " is-open" : ""}`} onClick={onToggle} type="button"><span /><span /><span /></button>{mounted && <><div aria-hidden={!visible} className={`mobile-menu-backdrop${visible ? " is-open" : ""}`} onClick={onClose} /><nav aria-hidden={!visible} aria-label={label} className={`mobile-menu-drawer${visible ? " is-open" : ""}`} id={drawerId}><div className="mobile-menu-drawer-heading">{label}</div><div className="mobile-menu-items">{children}</div></nav></>}</div>;
}
