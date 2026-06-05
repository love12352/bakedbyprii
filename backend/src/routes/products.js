"use strict";

const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { verifyToken } = require("../middleware/auth");
const { uploadImage } = require("../services/cloudinary");

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/products — public, returns all in-stock products
router.get("/", async (_req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      where: { inStock: true },
      orderBy: { category: "asc" },
    });
    // Convert pence to pounds for the frontend
    res.json(products.map(toPounds));
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id — public
router.get("/:id", async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(toPounds(product));
  } catch (err) {
    next(err);
  }
});

// POST /api/products — admin only, supports image upload
router.post("/", verifyToken, uploadImage.single("image"), async (req, res, next) => {
  try {
    const { name, description, category, price, unit, tag, allergens } = req.body;
    if (!name || !description || !category || !price || !unit) {
      return res.status(400).json({ error: "name, description, category, price, and unit are required" });
    }
    const product = await prisma.product.create({
      data: {
        name,
        description,
        category,
        pricePence: Math.round(Number(price) * 100),
        unit,
        tag:       tag || null,
        allergens: allergens ? JSON.parse(allergens) : [],
        imageUrl:  req.file?.path || null,
      },
    });
    res.status(201).json(toPounds(product));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/products/:id — admin only
router.patch("/:id", verifyToken, uploadImage.single("image"), async (req, res, next) => {
  try {
    const { name, description, category, price, unit, tag, allergens, inStock } = req.body;
    const data = {};
    if (name        !== undefined) data.name        = name;
    if (description !== undefined) data.description = description;
    if (category    !== undefined) data.category    = category;
    if (price       !== undefined) data.pricePence  = Math.round(Number(price) * 100);
    if (unit        !== undefined) data.unit        = unit;
    if (tag         !== undefined) data.tag         = tag;
    if (allergens   !== undefined) data.allergens   = JSON.parse(allergens);
    if (inStock     !== undefined) data.inStock     = inStock === "true" || inStock === true;
    if (req.file?.path)            data.imageUrl    = req.file.path;

    const product = await prisma.product.update({ where: { id: Number(req.params.id) }, data });
    res.json(toPounds(product));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id — admin only (soft delete via inStock = false)
router.delete("/:id", verifyToken, async (req, res, next) => {
  try {
    await prisma.product.update({
      where: { id: Number(req.params.id) },
      data:  { inStock: false },
    });
    res.json({ message: "Product hidden from shop" });
  } catch (err) {
    next(err);
  }
});

function toPounds(p) {
  return { ...p, price: p.pricePence / 100, pricePence: undefined };
}

module.exports = router;
