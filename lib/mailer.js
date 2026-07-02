// Optional order-notification email.
// Disabled by default. To enable: `npm install nodemailer` and set SMTP_* env vars
// (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ORDER_NOTIFY_TO).
// Orders are always saved to the database regardless — email is just a convenience.

let transporter = null;
let attempted = false;

async function getTransporter() {
  if (attempted) return transporter;
  attempted = true;
  if (!process.env.SMTP_HOST || !process.env.ORDER_NOTIFY_TO) {
    console.log('[mailer] email notifications disabled (set SMTP_HOST + ORDER_NOTIFY_TO to enable).');
    return null;
  }
  try {
    const nodemailer = (await import('nodemailer')).default;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
    console.log('[mailer] email notifications enabled.');
  } catch {
    console.log('[mailer] nodemailer not installed — run `npm install nodemailer` to enable email.');
  }
  return transporter;
}

export async function notifyNewOrder(order) {
  const tx = await getTransporter();
  if (!tx) return;
  const lines = order.items.map(i => `  ${i.qty} × ${i.name} — £${(i.price * i.qty).toFixed(2)}`).join('\n');
  const where = order.fulfilment === 'delivery'
    ? `Delivery to ${order.address}, ${order.postcode}`
    : 'Collection from home';
  await tx.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || 'orders@bakedbyprii.local',
    to: process.env.ORDER_NOTIFY_TO,
    subject: `New order ${order.ref} — £${order.total.toFixed(2)} (${order.payment})`,
    text:
`New order: ${order.ref}
Customer: ${order.name} · ${order.email} · ${order.phone}
Required: ${order.required_date}
${where}
Payment: ${order.payment}

${lines}
Subtotal: £${order.subtotal.toFixed(2)}
Delivery: ${order.delivery_fee ? '£' + order.delivery_fee.toFixed(2) : 'Free'}
Total: £${order.total.toFixed(2)}

Notes: ${order.notes || '—'}
`
  });
}
