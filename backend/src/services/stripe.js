"use strict";

const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
});

async function createCheckoutSession({ orderId, customerEmail, description, amountPence }) {
  const session = await stripe.checkout.sessions.create({
    mode:                "payment",
    customer_email:      customerEmail,
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency:     "gbp",
          unit_amount:  amountPence, // in pence
          product_data: { name: description },
        },
        quantity: 1,
      },
    ],
    metadata: { orderId: String(orderId) },
    success_url: `${process.env.FRONTEND_URL}/?order=success&id=${orderId}`,
    cancel_url:  `${process.env.FRONTEND_URL}/?order=cancelled`,
  });

  return session;
}

module.exports = { stripe, createCheckoutSession };
