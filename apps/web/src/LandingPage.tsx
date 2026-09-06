import heroImage from "./assets/rezzie-hero-editorial.png";
import { BrandMark } from "./BrandMark";

type LandingPageProps = { isAuthenticated: boolean; onSignIn?: () => void; onSignUp?: () => void; onStart: () => void };

export function LandingPage({ isAuthenticated, onSignIn, onSignUp, onStart }: LandingPageProps) {
  return (
    <div className="landing">
      <header className="marketing-header">
        <a className="brand-link" href="#top" aria-label="Rezzie home"><BrandMark /></a>
        <nav className="marketing-nav" aria-label="Main navigation">
          <a href="#product">Product</a><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a><a href="#safety">Safety</a>
        </nav>
        <div className="marketing-actions">{!isAuthenticated && onSignIn && <button className="text-button" onClick={onSignIn} type="button">Sign in</button>}<button className="button button-dark button-small" onClick={isAuthenticated ? onStart : onSignUp} type="button">{isAuthenticated ? "Open workspace" : "Create free account"} <span aria-hidden="true">↗</span></button></div>
      </header>
      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="kicker"><span /> AI RESUME TAILORING, GROUNDED IN YOU</p>
            <h1>A stronger match.<br /><em>Still your story.</em></h1>
            <p className="hero-lede">Turn one honest resume into a focused application for every role. Rezzie finds the signal, mirrors the right language, and never invents experience.</p>
            <div className="hero-actions"><button className="button button-primary" onClick={onStart} type="button">Tailor my resume <span aria-hidden="true">→</span></button><a className="text-link" href="#how-it-works">See the 3-minute flow <span aria-hidden="true">↓</span></a></div>
            <div className="trust-row"><span>✓ No credit card to try with your key</span><span>✓ Your claims stay yours</span></div>
          </div>
          <div className="hero-art"><div className="hero-frame"><img src={heroImage} alt="Resume pages arranged with warm stationery" /></div><aside className="proof-card"><span className="proof-number">SOURCE 01</span><p>Every edit traces back to <strong>experience you supplied.</strong></p><span className="proof-line" /></aside><aside className="fit-stamp" aria-hidden="true"><strong>ROLE FIT</strong><span>without fiction</span></aside></div>
        </section>
        <div className="signal-strip"><span>Grounded in your resume</span><b>✦</b><span>Keywords in context</span><b>✦</b><span>Always yours to review</span><b>✦</b><span>Ready to download</span></div>
        <section className="product-section" id="product">
          <div className="section-intro"><p className="section-label">BUILT FOR THE APPLICATION IN FRONT OF YOU</p><h2>Less rewriting.<br /><em>More relevance.</em></h2></div>
          <div className="feature-stage">
            <div className="resume-preview" aria-hidden="true"><div className="preview-top"><span>YOUR EXPERIENCE</span><span className="status-pill">SOURCE-LOCKED</span></div><h3>Senior Product Designer</h3><p className="preview-muted">Experience</p><p><mark>Led cross-functional research</mark> and translated findings into product decisions.</p><p>Built accessible systems used across core customer journeys.</p><div className="preview-note">Matched to: research · systems · accessibility</div></div>
            <div className="feature-copy"><article><span>01</span><div><h3>Bring the source</h3><p>Upload PDF, DOCX, Markdown, or text. Save confirmed experience in a private Career Record so you can reuse it safely.</p></div></article><article><span>02</span><div><h3>Bring the role</h3><p>Paste a description, upload it, or import a public job link. Rezzie isolates what the employer actually values.</p></div></article><article><span>03</span><div><h3>Leave with a draft</h3><p>Review the tailored resume, grounded keywords, and anything that needs your judgment—then copy or download.</p></div></article></div>
          </div>
        </section>
        <section className="method-section" id="how-it-works"><div className="section-intro compact"><p className="section-label light">ONE CLEAR FLOW / NO PROMPT WRITING</p><h2>From application<br />to <em>ready.</em></h2></div><ol className="method-list"><li><span>1</span><div><strong>Add your resume</strong><p>Paste or upload the version you trust.</p></div></li><li><span>2</span><div><strong>Add the job</strong><p>Use text, a file, or a public link.</p></div></li><li><span>3</span><div><strong>Review and download</strong><p>Keep control of every final word.</p></div></li></ol><button className="button button-coral" onClick={onStart} type="button">Start the guided flow <span aria-hidden="true">→</span></button></section>
        <section className="safety-section" id="safety"><div><p className="section-label">THE LINE REZZIE WILL NOT CROSS</p><h2>Your career is<br />not a prompt.</h2></div><div className="safety-copy"><p>AI should help you communicate the truth—not improvise a more convenient version of it.</p><ul><li><span>✓</span><div><strong>No invented credentials</strong><small>Employers, dates, metrics, tools, and achievements must come from you.</small></div></li><li><span>✓</span><div><strong>Review gates for saved facts</strong><small>Imported Career Record facts remain off-limits until you confirm them.</small></div></li><li><span>✓</span><div><strong>Transparent review notes</strong><small>Uncertain or unsupported requirements stay visible for your judgment.</small></div></li></ul></div></section>
        <section className="closing-section"><p className="section-label">YOUR NEXT APPLICATION DESERVES A SHARPER STORY</p><h2>Make your case.<br /><em>Keep it yours.</em></h2><button className="button button-dark" onClick={onStart} type="button">Open Rezzie <span aria-hidden="true">→</span></button></section>
        <section className="pricing-section" id="pricing"><div className="section-intro"><p className="section-label">SIMPLE, FLEXIBLE ACCESS</p><h2>Bring your key.<br /><em>Or let us run it.</em></h2><p>Start with your own Anthropic key at no Rezzie cost. Use credits for one-off applications or a monthly plan for an active search.</p></div><div className="pricing-grid"><article className="price-card"><p className="eyebrow">BRING YOUR OWN KEY</p><h3>$0</h3><p>Your Anthropic key is used only for the request and never stored.</p><button className="button button-outline" onClick={onStart} type="button">Use my key</button></article><article className="price-card"><p className="eyebrow">FLEX CREDITS</p><h3>Pay as you go</h3><p>Buy credits and use one per completed tailored resume.</p><button className="button button-outline" onClick={onStart} type="button">Get credits</button></article><article className="price-card featured"><p className="eyebrow">MONTHLY</p><h3>For active searches</h3><p>Receive a fresh monthly allowance. Manage or cancel anytime through Stripe.</p><button className="button button-primary" onClick={onStart} type="button">Choose monthly</button></article></div></section>
      </main>
      <footer className="marketing-footer"><a className="brand-link" href="#top"><BrandMark /></a><p>Tailor the signal. Keep the truth.</p><span>© {new Date().getFullYear()} Rezzie</span></footer>
    </div>
  );
}
