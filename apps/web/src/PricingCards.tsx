type PricingCardsProps = { onBuyCredits: () => void; onStart: () => void; onSubscribe: () => void };

export function PricingCards({ onBuyCredits, onStart, onSubscribe }: PricingCardsProps) {
  return <div className="pricing-grid">
    <article className="price-card">
      <p className="eyebrow">BRING YOUR OWN KEY</p>
      <h3>$0</h3>
      <p>Use your Anthropic key for tailoring. It is used only for the request and is never stored.</p>
      <button className="button button-outline" onClick={onStart} type="button">Use my key</button>
    </article>
    <article className="price-card">
      <p className="eyebrow">FLEX CREDITS</p>
      <h3>$5 <small>for 20 credits</small></h3>
      <p>For the roles that matter. One credit covers one completed managed tailoring request.</p>
      <button className="button button-outline" onClick={onBuyCredits} type="button">Get credits</button>
    </article>
    <article className="price-card featured">
      <p className="eyebrow">MONTHLY</p>
      <h3>$9.99 <small>/ month</small></h3>
      <p>Get 50 credits every month while you are actively applying. Manage or cancel through Stripe.</p>
      <button className="button button-primary" onClick={onSubscribe} type="button">Choose monthly</button>
    </article>
  </div>;
}
