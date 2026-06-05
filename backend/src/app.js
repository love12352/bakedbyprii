"use strict";

require("dotenv").config();
const express    = require("express");
const helmet     = require("helmet");
const cors       = require("cors");
const rateLimit  = require("express-rate-limit");

const productsRouter = require("./routes/products");
const ordersRouter   = require("./routes/orders");
const paymentsRouter = require("./routes/payments");
const adminRouter    = require("./routes/admin");

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── Security headers ────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS — only allow the frontend origin ────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
}));

// Stripe webhooks need the raw body BEFORE express.json()
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/products",  productsRouter);
app.use("/api/orders",    ordersRouter);
app.use("/api/payments",  paymentsRouter);
app.use("/api/admin",     adminRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => console.log(`bakedbyPrii API running on port ${PORT}`));

module.exports = app;
