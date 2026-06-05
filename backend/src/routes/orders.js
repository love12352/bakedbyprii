"use strict";

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { createCheckoutSession } = require("../services/stripe");
const { sendOrderConfirmation, sendBakerAlert } = require("../services/email");

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/orders — create order, return Stripe checkout URL or confirmation
router.post("/", async (req, res, next) => {
  try {
    const { name, email, phone, item, date, message, payment, gdprConsent } = req.body;

    // Basic validation
    if (!name || !email || !phone || !item || !date || !payment) {
      return res.status(400).json({
        error: "name, email, phone, item, date, and payment are required",
      });
    }
    if (!gdprConsent) {
      return res.status(400).json({ error: "GDPR consent is required to place an order" });
    }

    const neededBy = new Date(date);
    if (isNaN(neededBy.getTime())) {
      return res.status(400).json({ error: "Invalid date" });
    }

    // Create order (items/price stored as a placeholder; real product linking
    // happens via admin when they confirm the order)
    const order = await prisma.order.create({
      data: {
        customerName:  name,
        customerEmail: email,
        customerPhone: phone,
        neededBy,
        message:       message || null,
        paymentMethod: payment === "stripe" ? "STRIPE" : "PAY_ON_DELIVERY",
        totalPence:    0, // set when baker confirms the order
        gdprConsent:   true,
        status:        "PENDING",
      },
    });

    // Send confirmation emails (non-blocking — don't fail the request if email fails)
    sendOrderConfirmation({ name, email, item, date, orderId: order.id }).catch(console.error);
    sendBakerAlert({ name, email, phone, item, date, message, payment, orderId: order.id }).catch(console.error);

    if (payment === "stripe") {
      const session = await createCheckoutSession({
        orderId:     order.id,
        customerEmail: email,
        description: `bakedbyPrii order: ${item}`,
        // Price determined after baker confirms — use a deposit amount for now
        amountPence: 500, // £5 deposit; update to full price in your flow
      });

      // Persist Stripe session ID so webhook can match it
      await prisma.order.update({
        where: { id: order.id },
        data:  { stripeSessionId: session.id },
      });

      return res.status(201).json({ orderId: order.id, checkoutUrl: session.url });
    }

    // Pay on delivery — no Stripe needed
    res.status(201).json({ orderId: order.id, message: "Order received. We'll confirm via WhatsApp shortly." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
