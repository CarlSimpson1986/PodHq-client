import "server-only";
import Stripe from "stripe";

/**
 * Server-only Stripe client. Hosted-Checkout flow only (no Stripe.js on the
 * client, no publishable key needed) — the checkout route creates a Session
 * and redirects the browser to its hosted URL.
 */
export function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(key);
}
