"use strict";

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  // Admin user — change password before going live
  const hash = await bcrypt.hash("admin123", 10);
  await prisma.adminUser.upsert({
    where:  { email: "admin@bakedbyprii.com" },
    update: {},
    create: { email: "admin@bakedbyprii.com", password: hash },
  });
  console.log("Admin created: admin@bakedbyprii.com / admin123");

  // Seed products
  const products = [
    { name: "Classic Choc-Chip",  description: "Brown-butter cookies loaded with dark chocolate.", category: "cookies",  pricePence: 650,  unit: "/ box of 6",  tag: "Bestseller", allergens: JSON.stringify(["Gluten","Eggs","Milk","Soya"]) },
    { name: "Double Chocolate",   description: "Fudgy cocoa cookies with melty chunks.",            category: "cookies",  pricePence: 700,  unit: "/ box of 6",  tag: "",           allergens: JSON.stringify(["Gluten","Eggs","Milk","Soya"]) },
    { name: "Peanut Butter",      description: "Soft, nutty & lightly salted.",                     category: "cookies",  pricePence: 650,  unit: "/ box of 6",  tag: "Veg",        allergens: JSON.stringify(["Gluten","Eggs","Milk","Peanuts"]) },
    { name: "Classic Vanilla",    description: "Soft vanilla sponge with silky buttercream.",       category: "cakes",    pricePence: 2200, unit: "/ 500g",       tag: "",           allergens: JSON.stringify(["Gluten","Eggs","Milk"]) },
    { name: "Chocolate Truffle",  description: "Rich chocolate layers & ganache drip.",             category: "cakes",    pricePence: 2500, unit: "/ 500g",       tag: "Bestseller", allergens: JSON.stringify(["Gluten","Eggs","Milk","Soya"]) },
    { name: "Red Velvet",         description: "Velvety cocoa cake with cream cheese frosting.",    category: "cakes",    pricePence: 2700, unit: "/ 500g",       tag: "New",        allergens: JSON.stringify(["Gluten","Eggs","Milk"]) },
    { name: "Vanilla Swirl",      description: "Fluffy sponge, classic buttercream swirl.",         category: "cupcakes", pricePence: 900,  unit: "/ set of 6",  tag: "",           allergens: JSON.stringify(["Gluten","Eggs","Milk"]) },
    { name: "Choco Overload",     description: "Chocolate cupcake topped with ganache.",            category: "cupcakes", pricePence: 1000, unit: "/ set of 6",  tag: "Bestseller", allergens: JSON.stringify(["Gluten","Eggs","Milk","Soya"]) },
    { name: "Berry Bliss",        description: "Berry-kissed sponge & whipped frosting.",           category: "cupcakes", pricePence: 1100, unit: "/ set of 6",  tag: "New",        allergens: JSON.stringify(["Gluten","Eggs","Milk"]) },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where:  { id: products.indexOf(p) + 1 },
      update: p,
      create: p,
    });
  }
  console.log(`Seeded ${products.length} products`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
