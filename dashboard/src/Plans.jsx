import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import creatorPlan from './creator-plan.json';
import { MarketingNav, preview } from './Landing.jsx';

const price = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: creatorPlan.currency, maximumFractionDigits: 0,
}).format(creatorPlan.amount / 100);

export function PlanFaq() {
  return <section className="pricing-faq" aria-labelledby="pricing-faq-title">
    <h2 id="pricing-faq-title">Frequently asked questions</h2>
    <details><summary>Does the plan renew?</summary><p>No. Creator is a one-time credit pack with no recurring subscription.</p></details>
    <details><summary>When do credits appear?</summary><p>Your billing page updates after Razorpay confirms the payment.</p></details>
    <details><summary>Can I try the demo before choosing a plan?</summary><p>Yes. All five sample reels are available without an account.</p></details>
    <details><summary>Will checkout charge my card?</summary><p>Checkout currently uses Razorpay Test Mode. It does not move real money.</p></details>
  </section>;
}

export function Plans({ checkoutHref }) {
  return <main className="marketing-shell">
    <MarketingNav />
    <header className="pricing-heading"><p className="marketing-kicker">Pricing</p><h1>One plan for creators.</h1></header>
    <section className="pricing-card" aria-labelledby="creator-plan-heading">
      <h2 id="creator-plan-heading">{creatorPlan.name}</h2>
      <p className="creator-plan-price">{price} <small>one-time</small></p>
      <p><Check size={17} /> {creatorPlan.credits} credits per pack</p>
      <a className="marketing-primary" href={checkoutHref || preview + '/billing?signin=1'}>Continue to checkout <ArrowRight size={17} /></a>
      <p className="pricing-note">Checkout is currently available to invited Studio users.</p>
    </section>
    <PlanFaq />
  </main>;
}
