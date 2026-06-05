"use strict";

const express  = require("express");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/admin/login
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid)  return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: admin.id, email: admin.email }, process.env.JWT_SECRET, {
      expiresIn: "8h",
    });
    res.json({ token });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/orders — list all orders, newest first
router.get("/orders", verifyToken, async (_req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: { items: { include: { product: true } } },
    });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/orders/:id/status — update order status
router.patch("/orders/:id/status", verifyToken, async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ["PENDING","CONFIRMED","IN_PROGRESS","READY","DELIVERED","CANCELLED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const order = await prisma.order.update({
      where: { id: Number(req.params.id) },
      data:  { status },
    });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/orders/:id — hard delete (use only for test orders)
router.delete("/orders/:id", verifyToken, async (req, res, next) => {
  try {
    await prisma.order.delete({ where: { id: Number(req.params.id) } });
    res.json({ message: "Order deleted" });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/gdpr/delete — UK GDPR Article 17 erasure request
router.post("/gdpr/delete", verifyToken, async (req, res, next) => {
  try {
    const { email, notes } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    // Log the request (required for ICO compliance audit trail)
    const request = await prisma.gdprDeletionRequest.create({
      data: { email, notes: notes || null },
    });

    // Anonymise customer data — orders retained for accounting (legal obligation),
    // but PII is blanked (legitimate interest overrides for tax records)
    await prisma.order.updateMany({
      where: { customerEmail: email },
      data: {
        customerName:  "[deleted]",
        customerEmail: "[deleted]",
        customerPhone: "[deleted]",
        message:       null,
      },
    });

    await prisma.gdprDeletionRequest.update({
      where: { id: request.id },
      data:  { completedAt: new Date() },
    });

    res.json({ message: "Personal data erased. Order records anonymised per UK GDPR Art. 17." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
