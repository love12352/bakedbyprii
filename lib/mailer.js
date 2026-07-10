// Order emails for bakedbyPrii.
//
// Sends from your own address (SMTP_FROM / SMTP_USER) via SMTP — easiest is a
// Gmail App Password (SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER=your
// gmail, SMTP_PASS=the 16-char app password).
//
// Every message is an automated "no-reply" note: it carries Auto-Submitted
// headers and a footer telling the customer not to reply and how to reach you.
//
// If SMTP is not configured the whole thing quietly no-ops — orders still save
// and the site works exactly as before. All send failures are swallowed by the
// caller (fire-and-forget), so email can never block or break an order.

let transporter = null;
let attempted = false;

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || process.env.ORDER_NOTIFY_TO || 'BakedbyPrii@gmail.com';
const CONTACT_PHONE = process.env.CONTACT_PHONE || '+44 7732 262999';
const BRAND = 'bakedbyPrii';

function fromAddress() {
  return process.env.SMTP_FROM || `${BRAND} <${process.env.SMTP_USER || 'orders@bakedbyprii.local'}>`;
}

async function getTransporter() {
  if (attempted) return transporter;
  attempted = true;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    const missing = ['SMTP_HOST', 'SMTP_USER'].filter(k => !process.env[k]);
    console.log(`[mailer] email disabled — missing ${missing.join(' + ')}. Set SMTP_HOST, SMTP_USER and SMTP_PASS to enable (e.g. a Gmail App Password).`);
    return null;
  }
  try {
    const nodemailer = (await import('nodemailer')).default;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    console.log(`[mailer] email enabled — sending as ${fromAddress()}.`);
  } catch {
    console.log('[mailer] nodemailer not installed — run `npm install nodemailer` to enable email.');
  }
  return transporter;
}

// Low-level send with the no-reply headers applied to every message.
async function send({ to, subject, text, html }) {
  const tx = await getTransporter();
  if (!tx || !to) return;
  try {
    const info = await tx.sendMail({
      from: fromAddress(),
      to,
      subject,
      text,
      html,
      headers: { 'Auto-Submitted': 'auto-generated', 'X-Auto-Response-Suppress': 'All' }
    });
    console.log(`[mailer] sent "${subject}" -> ${to} (${info.messageId || 'ok'})`);
  } catch (err) {
    // Never let email break an order — but make the failure loud in the logs.
    console.error(`[mailer] FAILED "${subject}" -> ${to}: ${err.message}`);
  }
}

// Diagnostics: report which SMTP vars are present and whether the credentials
// actually authenticate with the SMTP server (verify() tests auth without sending).
export async function verifyMailer() {
  const present = {
    SMTP_HOST: process.env.SMTP_HOST || null,
    SMTP_PORT: process.env.SMTP_PORT || null,
    SMTP_USER: process.env.SMTP_USER || null,
    SMTP_PASS_length: process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0,
    SMTP_FROM: process.env.SMTP_FROM || null,
    ORDER_NOTIFY_TO: process.env.ORDER_NOTIFY_TO || null,
    PUBLIC_URL: process.env.PUBLIC_URL || null
  };
  const tx = await getTransporter();
  if (!tx) return { configured: false, present, verify: { ok: false, reason: 'transporter disabled — SMTP_HOST or SMTP_USER missing' } };
  try {
    await tx.verify();
    return { configured: true, present, verify: { ok: true } };
  } catch (e) {
    return { configured: true, present, verify: { ok: false, error: e.message } };
  }
}

// ---- helpers ----
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
const gbp = n => '£' + Number(n || 0).toFixed(2);

function whereText(order) {
  return order.fulfilment === 'delivery'
    ? `Delivery to ${order.address}, ${order.postcode}`
    : 'Collection from our home kitchen';
}

function itemLinesText(order) {
  return (order.items || []).map(i => `  ${i.qty} × ${i.name} — ${gbp(i.price * i.qty)}`).join('\n');
}

function itemRowsHtml(order) {
  return (order.items || []).map(i =>
    `<tr><td style="padding:4px 0">${i.qty} × ${esc(i.name)}</td>` +
    `<td style="padding:4px 0;text-align:right">${gbp(i.price * i.qty)}</td></tr>`
  ).join('');
}

function summaryHtml(order) {
  const delivery = order.fulfilment === 'delivery'
    ? (order.delivery_fee ? gbp(order.delivery_fee) : 'Free')
    : 'Free (collection)';
  return `
    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:15px;color:#2a0d18">
      ${itemRowsHtml(order)}
      <tr><td style="padding:6px 0;border-top:1px solid #eee;color:#8a6b76">Subtotal</td>
          <td style="padding:6px 0;border-top:1px solid #eee;text-align:right">${gbp(order.subtotal)}</td></tr>
      <tr><td style="padding:2px 0;color:#8a6b76">${order.fulfilment === 'delivery' ? 'Delivery' : 'Collection'}</td>
          <td style="padding:2px 0;text-align:right">${delivery}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;font-size:17px">Total</td>
          <td style="padding:8px 0;font-weight:700;font-size:17px;text-align:right">${gbp(order.total)}</td></tr>
    </table>`;
}

// Wraps body content in the branded shell + no-reply footer.
function shell(order, headline, intro, bodyHtml) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#faf5f2;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #f0e2e8">
      <div style="background:#fbcfe8;padding:22px 28px">
        <div style="font-size:22px;font-weight:700;color:#2a0d18">${BRAND}</div>
      </div>
      <div style="padding:26px 28px;color:#2a0d18">
        <h1 style="margin:0 0 6px;font-size:22px">${headline}</h1>
        <p style="margin:0 0 18px;color:#6b4a56;font-size:15px;line-height:1.5">${intro}</p>
        <div style="background:#faf5f2;border-radius:12px;padding:16px 18px;margin-bottom:18px">
          <div style="font-size:13px;color:#8a6b76;margin-bottom:10px">
            Order <strong style="color:#2a0d18">${esc(order.ref)}</strong> ·
            ${esc(whereText(order))} · Wanted: ${esc(order.required_date)}
          </div>
          ${summaryHtml(order)}
        </div>
        ${bodyHtml || ''}
      </div>
      <div style="padding:18px 28px;background:#faf5f2;border-top:1px solid #f0e2e8;color:#8a6b76;font-size:12px;line-height:1.6">
        This is an automated message from ${BRAND} — please don't reply to this email.<br>
        For anything at all, contact us at
        <a href="mailto:${CONTACT_EMAIL}" style="color:#c2456e">${CONTACT_EMAIL}</a>
        or <a href="tel:${CONTACT_PHONE.replace(/\s/g, '')}" style="color:#c2456e">${CONTACT_PHONE}</a>.
      </div>
    </div>
  </body></html>`;
}

function footerText() {
  return `\n—\nThis is an automated message from ${BRAND} — please don't reply to this email.\nFor anything at all, contact us at ${CONTACT_EMAIL} or ${CONTACT_PHONE}.`;
}

function summaryText(order) {
  const delivery = order.fulfilment === 'delivery'
    ? (order.delivery_fee ? gbp(order.delivery_fee) : 'Free')
    : 'Free (collection)';
  return `${itemLinesText(order)}
Subtotal: ${gbp(order.subtotal)}
${order.fulfilment === 'delivery' ? 'Delivery' : 'Collection'}: ${delivery}
Total: ${gbp(order.total)}`;
}

// ---- Customer emails ------------------------------------------------------

// Order just placed (status: new). Includes the secret self-cancel link.
export async function sendOrderPlaced(order, baseUrl) {
  const firstName = String(order.name || '').split(' ')[0] || 'there';
  const cancelUrl = `${baseUrl}/cancel?ref=${encodeURIComponent(order.ref)}&token=${encodeURIComponent(order.cancel_token)}`;
  const subject = `Order received — ${order.ref} · ${BRAND}`;

  const introHtml = `Thanks, ${esc(firstName)}! We've received your order and will confirm availability and your ` +
    `${order.fulfilment === 'delivery' ? 'delivery' : 'collection'} time within 1 working day. ` +
    `<strong>No payment has been taken yet.</strong>`;
  const cancelBlockHtml = `
    <p style="margin:0 0 10px;font-size:14px;color:#6b4a56">Changed your mind? While your order is still awaiting confirmation you can cancel it instantly and free:</p>
    <p style="margin:0 0 8px"><a href="${cancelUrl}" style="display:inline-block;background:#2a0d18;color:#fff;text-decoration:none;padding:11px 20px;border-radius:100px;font-size:14px;font-weight:600">Cancel my order</a></p>
    <p style="margin:0;font-size:12px;color:#8a6b76">Once we've accepted your order this link stops working — just contact us to cancel (see our cancellation policy).</p>`;

  const text = `Thanks, ${firstName}! We've received your order ${order.ref}.
We'll confirm availability and your ${order.fulfilment === 'delivery' ? 'delivery' : 'collection'} time within 1 working day. No payment has been taken yet.

${whereText(order)}
Wanted: ${order.required_date}
Payment: ${order.payment}

${summaryText(order)}

Changed your mind? While your order is still awaiting confirmation, cancel it instantly and free here:
${cancelUrl}
Once we've accepted your order this link stops working — just contact us to cancel.
${footerText()}`;

  await send({ to: order.email, subject, text, html: shell(order, 'Order received 🧁', introHtml, cancelBlockHtml) });
}

// Status changes the customer should hear about: confirmed / completed / cancelled.
export async function sendStatusEmail(order, status, baseUrl) {
  const firstName = String(order.name || '').split(' ')[0] || 'there';
  const when = order.fulfilment === 'delivery' ? 'delivery' : 'collection';

  let subject, headline, introHtml, introText, extraHtml = '', extraText = '';

  if (status === 'confirmed') {
    subject = `Your order is confirmed 🎉 — ${order.ref}`;
    headline = 'Your order is confirmed 🎉';
    introHtml = `Great news, ${esc(firstName)} — we've accepted your order and it's all booked in. ` +
      `We'll be in touch with your ${when} details for <strong>${esc(order.required_date)}</strong>.`;
    introText = `Great news, ${firstName} — we've accepted your order ${order.ref} and it's all booked in. We'll be in touch with your ${when} details for ${order.required_date}.`;
  } else if (status === 'completed') {
    subject = `Your order is complete — thank you! ${order.ref}`;
    headline = 'Your order is complete — thank you!';
    introHtml = `That's your order ${when === 'delivery' ? 'delivered' : 'ready and collected'}, ${esc(firstName)} — we hope you love it! ` +
      `Thank you so much for choosing ${BRAND}. 💕`;
    introText = `That's your order ${order.ref} complete, ${firstName} — we hope you love it! Thank you so much for choosing ${BRAND}.`;
  } else if (status === 'cancelled') {
    subject = `Your order has been cancelled — ${order.ref}`;
    headline = 'Your order has been cancelled';
    introHtml = `Your order ${esc(order.ref)} has been cancelled, ${esc(firstName)}.`;
    introText = `Your order ${order.ref} has been cancelled, ${firstName}.`;
    extraHtml = `<p style="margin:0;font-size:14px;color:#6b4a56">If you'd already paid, we'll refund you in line with our cancellation policy. If this wasn't expected, please get in touch and we'll sort it out.</p>`;
    extraText = `\nIf you'd already paid, we'll refund you in line with our cancellation policy. If this wasn't expected, please get in touch and we'll sort it out.`;
  } else {
    return; // no customer email for other transitions (e.g. back to 'new')
  }

  const text = `${introText}

${whereText(order)}
Wanted: ${order.required_date}

${summaryText(order)}${extraText}
${footerText()}`;

  await send({ to: order.email, subject, text, html: shell(order, headline, introHtml, extraHtml) });
}

// ---- Admin emails ---------------------------------------------------------

// New order landed — goes to you (ORDER_NOTIFY_TO). Kept from the original app.
export async function notifyNewOrder(order) {
  if (!process.env.ORDER_NOTIFY_TO) return;
  const text = `New order: ${order.ref}
Customer: ${order.name} · ${order.email} · ${order.phone}
Required: ${order.required_date}
${whereText(order)}
Payment: ${order.payment}

${itemLinesText(order)}
Subtotal: ${gbp(order.subtotal)}
Delivery: ${order.delivery_fee ? gbp(order.delivery_fee) : 'Free'}
Total: ${gbp(order.total)}

Notes: ${order.notes || '—'}
`;
  await send({
    to: process.env.ORDER_NOTIFY_TO,
    subject: `New order ${order.ref} — ${gbp(order.total)} (${order.payment})`,
    text
  });
}

// Heads-up to you when a customer cancels their own order via the email link.
export async function notifyAdminCancelled(order) {
  if (!process.env.ORDER_NOTIFY_TO) return;
  const text = `Order ${order.ref} was cancelled by the customer.
Customer: ${order.name} · ${order.email} · ${order.phone}
Was wanted: ${order.required_date}
${whereText(order)}

${itemLinesText(order)}
Total: ${gbp(order.total)}
`;
  await send({
    to: process.env.ORDER_NOTIFY_TO,
    subject: `Order ${order.ref} cancelled by customer`,
    text
  });
}
