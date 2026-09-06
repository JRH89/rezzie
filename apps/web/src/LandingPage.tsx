import heroImage from "./assets/rezzie-hero-editorial.png";
import { PricingCards } from "./PricingCards";
import { PublicFooter, PublicHeader } from "./SiteChrome";

type LandingPageProps = { isAuthenticated: boolean; onBuyCredits: () => void; onSignIn?: () => void; onSignUp?: () => void; onStart: () => void; onSubscribe: () => void };

export function LandingPage({ isAuthenticated, onBuyCredits, onSignIn, onSignUp, onStart, onSubscribe }: LandingPageProps) {
  const startAction = isAuthenticated ? onStart : onSignUp;
  return (
    <div className="landing">
      <PublicHeader isAuthenticated={isAuthenticated} onSignIn={onSignIn} onStart={startAction ?? onStart} />
      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="kicker"><span /> AI RESUME TAILORING, GROUNDED IN YOU</p>
            <h1>A stronger match.<br /><em>Still your story.</em></h1>
            <p className="hero-lede">Turn one honest resume into a focused application for every role. Rezzie finds the signal, mirrors the right language, and never invents experience.</p>
            <div className="hero-actions"><button className="button button-primary" onClick={startAction} type="button">Tailor my resume <span aria-hidden="true">→</span></button><a className="text-link" href="#how-it-works">See the 3-minute flow <span aria-hidden="true">↓</span></a></div>
            <div className="trust-row"><span>✓ No credit card to try with your key</span><span>✓ Your claims stay yours</span></div>
          </div>
          <div className="hero-art"><div className="hero-frame"><img src={heroImage} alt="Resume pages arranged with warm stationery" /></div><aside className="proof-card"><span className="proof-number">SOURCE 01</span><p>Every edit traces back to <strong>experience you supplied.</strong></p><span className="proof-line" /></aside><aside className="fit-stamp" aria-hidden="true"><strong>ROLE FIT</strong><span>without fiction</span></aside></div>
        </section>
        <div className="signal-strip"><span>Grounded in your resume</span><b>✦</b><span>Keywords in context</span><b>✦</b><span>Always yours to review</span><b>✦</b><span>Ready to download</span></div>
        <section className="product-section" id="product">
          <div className="section-intro"><p className="section-label">BUILT FOR THE APPLICATION IN FRONT OF YOU</p><h2>Less rewriting.<br /><em>More relevance.</em></h2><a className="section-page-link" href="/features">Explore all features →</a></div>
          <div className="feature-stage">
            <div className="resume-preview" aria-hidden="true"><div className="preview-top"><span>YOUR EXPERIENCE</span><span className="status-pill">SOURCE-LOCKED</span></div><h3>Senior Product Designer</h3><p className="preview-muted">Experience</p><p><mark>Led cross-functional research</mark> and translated findings into product decisions.</p><p>Built accessible systems used across core customer journeys.</p><div className="preview-note">Matched to: research · systems · accessibility</div></div>
            <div className="feature-copy"><article><span>01</span><div><h3>Bring the source</h3><p>Upload PDF, DOCX, Markdown, or text. Save confirmed experience in a private Career Record so you can reuse it safely.</p></div></article><article><span>02</span><div><h3>Bring the role</h3><p>Paste a description, upload it, or import a public job link. Rezzie isolates what the employer actually values.</p></div></article><article><span>03</span><div><h3>Leave with a draft</h3><p>Review the tailored resume, grounded keywords, and anything that needs your judgment—then copy or download.</p></div></article></div>
          </div>
        </section>
        <section className="method-section" id="how-it-works"><div className="section-intro compact"><p className="section-label light">ONE CLEAR FLOW / NO PROMPT WRITING</p><h2>From application<br />to <em>ready.</em></h2></div><ol className="method-list"><li><span>1</span><div><strong>Add your resume</strong><p>Paste or upload the version you trust.</p></div></li><li><span>2</span><div><strong>Add the job</strong><p>Use text, a file, or a public link.</p></div></li><li><span>3</span><div><strong>Review and download</strong><p>Keep control of every final word.</p></div></li></ol><button className="button button-coral" onClick={startAction} type="button">Start the guided flow <span aria-hidden="true">→</span></button></section>
        <section className="safety-section" id="safety"><div><p className="section-label">THE LINE REZZIE WILL NOT CROSS</p><h2>Your career is<br />not a prompt.</h2></div><div className="safety-copy"><p>AI should help you communicate the truth—not improvise a more convenient version of it.</p><ul><li><span>✓</span><div><strong>No invented credentials</strong><small>Employers, dates, metrics, tools, and achievements must come from you.</small></div></li><li><span>✓</span><div><strong>Review gates for saved facts</strong><small>Imported Career Record facts remain off-limits until you confirm them.</small></div></li><li><span>✓</span><div><strong>Transparent review notes</strong><small>Uncertain or unsupported requirements stay visible for your judgment.</small></div></li></ul></div></section>
        <section className="closing-section"><p className="section-label">YOUR NEXT APPLICATION DESERVES A SHARPER STORY</p><h2>Make your case.<br /><em>Keep it yours.</em></h2><button className="button button-dark" onClick={startAction} type="button">Open Rezzie <span aria-hidden="true">→</span></button></section>
        <section className="pricing-section" id="pricing"><div className="section-intro"><p className="section-label">SIMPLE, FLEXIBLE ACCESS</p><h2>Bring your key.<br /><em>Or let us run it.</em></h2><p>Start with your own Anthropic key at no Rezzie cost. Use 20 credits for $5, or receive 50 credits monthly for $9.99 while your search is active.</p></div><PricingCards onBuyCredits={onBuyCredits} onStart={startAction ?? onStart} onSubscribe={onSubscribe} /></section>
      </main>
      <PublicFooter />
    </div>
  );
}
