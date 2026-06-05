"use strict";

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { stripe } = require("../services/stripe");

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/payments/webhook — Stripe sends events here
// NOTE: This route receives raw body (wired in app.js before express.json())
router.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    try {
      await prisma.order.updateMany({
        where: { stripeSessionId: session.id },
        data:  { status: "CONFIRMED" },
      });
      console.log(`Order confirmed via Stripe: session ${session.id}`);
    } catch (err) {
      console.error("Failed to update order status:", err);
      // Return 200 so Stripe doesn't retry — log and investigate separately
    }
  }

  res.json({ received: true });
});

module.exports = router;
