"use strict";

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password
  },
});

// Email to the customer confirming their order
async function sendOrderConfirmation({ name, email, item, date, orderId }) {
  await transporter.sendMail({
    from:    `"bakedbyPrii" <${process.env.EMAIL_USER}>`,
    to:      email,
    subject: `Order Received — #${orderId}`,
    html: `
      <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#333">
        <h2 style="color:#c0687b">Thanks for your order, ${escHtml(name)}!</h2>
        <p>We've received your order and will confirm it via WhatsApp within a few hours.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:6px 0;font-weight:bold">Order #</td><td>${orderId}</td></tr>
          <tr><td style="padding:6px 0;font-weight:bold">Item</td><td>${escHtml(item)}</td></tr>
          <tr><td style="padding:6px 0;font-weight:bold">Needed by</td><td>${escHtml(date)}</td></tr>
        </table>
        <p style="font-size:0.85rem;color:#888">
          Please inform us of any allergies or dietary requirements if you haven't already.<br>
          Full allergen information is available on request in accordance with Natasha's Law.
        </p>
        <p>— Priya at bakedbyPrii</p>
        <hr style="border:none;border-top:1px solid #eee">
        <p style="font-size:0.75rem;color:#aaa">
          bakedbyPrii · Didcot, Oxfordshire, UK<br>
          Registered with Oxfordshire County Council Food Business Register<br>
          <a href="${process.env.FRONTEND_URL}/#privacy">Privacy Policy</a>
        </p>
      </div>
    `,
  });
}

// Alert email to the baker for every new order
async function sendBakerAlert({ name, email, phone, item, date, message, payment, orderId }) {
  await transporter.sendMail({
    from:    `"bakedbyPrii Orders" <${process.env.EMAIL_USER}>`,
    to:      process.env.EMAIL_USER,
    subject: `New Order #${orderId} — ${item}`,
    html: `
      <div style="font-family:monospace;font-size:14px">
        <h3>New Order #${orderId}</h3>
        <p><b>Name:</b> ${escHtml(name)}</p>
        <p><b>Email:</b> ${escHtml(email)}</p>
        <p><b>Phone:</b> ${escHtml(phone)}</p>
        <p><b>Item:</b> ${escHtml(item)}</p>
        <p><b>Needed by:</b> ${escHtml(date)}</p>
        <p><b>Payment:</b> ${escHtml(payment)}</p>
        <p><b>Message:</b> ${message ? escHtml(message) : "—"}</p>
      </div>
    `,
  });
}

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = { sendOrderConfirmation, sendBakerAlert };
