import React from 'react';
import creatorPlan from './creator-plan.json';

const price = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: creatorPlan.currency, maximumFractionDigits: 0,
}).format(creatorPlan.amount / 100);

export function Plans() {
  return <main className="main-content billing-page">
    <nav aria-label="Plans navigation">
      <a className="btn btn-secondary" href="/">SocialStudio</a>
      <a className="btn btn-secondary" href="/demo">Explore Demo</a>
    </nav>
    <h1>Plans</h1>
    <section className="billing-panel" aria-labelledby="creator-plan-heading">
      <h2 id="creator-plan-heading">{creatorPlan.name}</h2>
      <p className="creator-plan-price">{price}</p>
      <p>{creatorPlan.credits} credits per pack</p>
      <p>Public checkout is unavailable. Test checkout is available in the private Studio preview.</p>
    </section>
  </main>;
}
