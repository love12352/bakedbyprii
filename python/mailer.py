"""Order emails for bakedbyPrii — Python port of ``node-express/lib/mailer.js``.

Sends from your own address via SMTP (easiest is a Gmail App Password:
SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER=your gmail,
SMTP_PASS=the 16-char app password).

Every message is an automated "no-reply" note: it carries Auto-Submitted headers
and a footer telling the customer not to reply and how to reach you.

If SMTP is not configured the whole thing quietly no-ops — orders still save and
the site works exactly as before.

Node → Python mapping:
    nodemailer.createTransport(...)         ->  smtplib.SMTP / SMTP_SSL
    transporter.sendMail({from,to,...})     ->  EmailMessage + smtp.send_message()
    async fire-and-forget (.catch(() => {}))->  a background daemon thread (see fire)

Why a thread? Node's mailer is async and doesn't block the HTTP response. In sync
Python, talking to Gmail could add ~1s to a request, so we hand each send to a
short-lived background thread — the customer gets their confirmation page
instantly, exactly like the Node app. Failures are logged, never raised.
"""

import os
import smtplib
import threading
from email.message import EmailMessage
from email.utils import formataddr

BRAND = "bakedbyPrii"


def _contact_email():
    return os.environ.get("CONTACT_EMAIL") or os.environ.get("ORDER_NOTIFY_TO") or "BakedbyPrii@gmail.com"


def _contact_phone():
    return os.environ.get("CONTACT_PHONE") or "+44 7732 262999"


def _from_address():
    """The From header. SMTP_FROM wins; otherwise 'bakedbyPrii <SMTP_USER>'."""
    explicit = os.environ.get("SMTP_FROM")
    if explicit:
        return explicit
    user = os.environ.get("SMTP_USER") or "orders@bakedbyprii.local"
    return formataddr((BRAND, user))


# ---- Low-level send -------------------------------------------------------

def _send(to, subject, text, html=None):
    """Build and send one message, with no-reply headers, over SMTP.

    No-ops (with a one-line log) when SMTP isn't configured or ``to`` is empty,
    so email can never block or break an order. All errors are caught here.
    """
    if not to:
        return

    host = os.environ.get("SMTP_HOST")
    user = os.environ.get("SMTP_USER")
    if not host or not user:
        missing = [k for k in ("SMTP_HOST", "SMTP_USER") if not os.environ.get(k)]
        print(f"[mailer] email disabled — missing {' + '.join(missing)}. "
              f"Set SMTP_HOST, SMTP_USER and SMTP_PASS to enable (e.g. a Gmail App Password).")
        return

    msg = EmailMessage()
    msg["From"] = _from_address()
    msg["To"] = to
    msg["Subject"] = subject
    # Mark as automated so mail clients don't auto-reply / show "reply" prompts.
    msg["Auto-Submitted"] = "auto-generated"
    msg["X-Auto-Response-Suppress"] = "All"
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    port = int(os.environ.get("SMTP_PORT") or 587)
    password = os.environ.get("SMTP_PASS") or ""

    try:
        # Port 465 = implicit TLS (SMTP_SSL); anything else = STARTTLS upgrade.
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=15) as smtp:
                smtp.login(user, password)
                smtp.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=15) as smtp:
                smtp.starttls()
                smtp.login(user, password)
                smtp.send_message(msg)
        print(f'[mailer] sent "{subject}" -> {to}')
    except Exception as err:  # noqa: BLE001 — never let email break an order
        print(f'[mailer] FAILED "{subject}" -> {to}: {err}')


def fire(fn, *args):
    """Run a send in a background daemon thread (fire-and-forget, like Node).

    The Node app does ``sendOrderPlaced(...).catch(() => {})`` so email never
    blocks the response. This is the Python equivalent: hand the work to a
    daemon thread and return immediately.
    """
    threading.Thread(target=fn, args=args, daemon=True).start()


# ---- helpers --------------------------------------------------------------

def _esc(s):
    """Escape the four HTML-significant characters (matches ``esc`` in mailer.js)."""
    return (str("" if s is None else s)
            .replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def _gbp(n):
    return "£" + f"{float(n or 0):.2f}"


def _where_text(order):
    if order["fulfilment"] == "delivery":
        return f"Delivery to {order['address']}, {order['postcode']}"
    return "Collection from our home kitchen"


def _item_lines_text(order):
    return "\n".join(
        f"  {i['qty']} × {i['name']} — {_gbp(i['price'] * i['qty'])}"
        for i in order.get("items", [])
    )


def _item_rows_html(order):
    return "".join(
        f'<tr><td style="padding:4px 0">{i["qty"]} × {_esc(i["name"])}</td>'
        f'<td style="padding:4px 0;text-align:right">{_gbp(i["price"] * i["qty"])}</td></tr>'
        for i in order.get("items", [])
    )


def _summary_html(order):
    if order["fulfilment"] == "delivery":
        delivery = _gbp(order["delivery_fee"]) if order["delivery_fee"] else "Free"
    else:
        delivery = "Free (collection)"
    delivery_label = "Delivery" if order["fulfilment"] == "delivery" else "Collection"
    return f"""
    <table role="presentation" width="100%" style="border-collapse:collapse;font-size:15px;color:#2a0d18">
      {_item_rows_html(order)}
      <tr><td style="padding:6px 0;border-top:1px solid #eee;color:#8a6b76">Subtotal</td>
          <td style="padding:6px 0;border-top:1px solid #eee;text-align:right">{_gbp(order["subtotal"])}</td></tr>
      <tr><td style="padding:2px 0;color:#8a6b76">{delivery_label}</td>
          <td style="padding:2px 0;text-align:right">{delivery}</td></tr>
      <tr><td style="padding:8px 0;font-weight:700;font-size:17px">Total</td>
          <td style="padding:8px 0;font-weight:700;font-size:17px;text-align:right">{_gbp(order["total"])}</td></tr>
    </table>"""


def _shell(order, headline, intro_html, body_html=""):
    """Wrap body content in the branded shell + no-reply footer (matches ``shell``)."""
    contact_email = _contact_email()
    contact_phone = _contact_phone()
    phone_href = contact_phone.replace(" ", "")
    return f"""<!DOCTYPE html><html><body style="margin:0;background:#faf5f2;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #f0e2e8">
      <div style="background:#fbcfe8;padding:22px 28px">
        <div style="font-size:22px;font-weight:700;color:#2a0d18">{BRAND}</div>
      </div>
      <div style="padding:26px 28px;color:#2a0d18">
        <h1 style="margin:0 0 6px;font-size:22px">{headline}</h1>
        <p style="margin:0 0 18px;color:#6b4a56;font-size:15px;line-height:1.5">{intro_html}</p>
        <div style="background:#faf5f2;border-radius:12px;padding:16px 18px;margin-bottom:18px">
          <div style="font-size:13px;color:#8a6b76;margin-bottom:10px">
            Order <strong style="color:#2a0d18">{_esc(order["ref"])}</strong> ·
            {_esc(_where_text(order))} · Wanted: {_esc(order["required_date"])}
          </div>
          {_summary_html(order)}
        </div>
        {body_html or ""}
      </div>
      <div style="padding:18px 28px;background:#faf5f2;border-top:1px solid #f0e2e8;color:#8a6b76;font-size:12px;line-height:1.6">
        This is an automated message from {BRAND} — please don't reply to this email.<br>
        For anything at all, contact us at
        <a href="mailto:{contact_email}" style="color:#c2456e">{contact_email}</a>
        or <a href="tel:{phone_href}" style="color:#c2456e">{contact_phone}</a>.
      </div>
    </div>
  </body></html>"""


def _footer_text():
    return (f"\n—\nThis is an automated message from {BRAND} — please don't reply to this email.\n"
            f"For anything at all, contact us at {_contact_email()} or {_contact_phone()}.")


def _summary_text(order):
    if order["fulfilment"] == "delivery":
        delivery = _gbp(order["delivery_fee"]) if order["delivery_fee"] else "Free"
    else:
        delivery = "Free (collection)"
    delivery_label = "Delivery" if order["fulfilment"] == "delivery" else "Collection"
    return (f"{_item_lines_text(order)}\n"
            f"Subtotal: {_gbp(order['subtotal'])}\n"
            f"{delivery_label}: {delivery}\n"
            f"Total: {_gbp(order['total'])}")


# ---- Customer emails ------------------------------------------------------

def send_order_placed(order, base_url):
    """Order just placed (status: new). Includes the secret self-cancel link."""
    first_name = (str(order.get("name") or "").split(" ")[0]) or "there"
    from urllib.parse import quote
    cancel_url = f"{base_url}/cancel?ref={quote(order['ref'])}&token={quote(order['cancel_token'])}"
    subject = f"Order received — {order['ref']} · {BRAND}"
    when = "delivery" if order["fulfilment"] == "delivery" else "collection"

    intro_html = (f"Thanks, {_esc(first_name)}! We've received your order and will confirm "
                  f"availability and your {when} time within 1 working day. "
                  f"<strong>No payment has been taken yet.</strong>")
    cancel_block_html = (
        '<p style="margin:0 0 10px;font-size:14px;color:#6b4a56">Changed your mind? While your order is '
        'still awaiting confirmation you can cancel it instantly and free:</p>'
        f'<p style="margin:0 0 8px"><a href="{cancel_url}" style="display:inline-block;background:#2a0d18;'
        'color:#fff;text-decoration:none;padding:11px 20px;border-radius:100px;font-size:14px;font-weight:600">'
        'Cancel my order</a></p>'
        '<p style="margin:0;font-size:12px;color:#8a6b76">Once we\'ve accepted your order this link stops '
        'working — just contact us to cancel (see our cancellation policy).</p>')

    text = f"""Thanks, {first_name}! We've received your order {order['ref']}.
We'll confirm availability and your {when} time within 1 working day. No payment has been taken yet.

{_where_text(order)}
Wanted: {order['required_date']}
Payment: {order['payment']}

{_summary_text(order)}

Changed your mind? While your order is still awaiting confirmation, cancel it instantly and free here:
{cancel_url}
Once we've accepted your order this link stops working — just contact us to cancel.
{_footer_text()}"""

    _send(order["email"], subject, text, _shell(order, "Order received 🧁", intro_html, cancel_block_html))


def send_status_email(order, status, base_url):
    """Status changes the customer should hear about: confirmed / completed / cancelled."""
    first_name = (str(order.get("name") or "").split(" ")[0]) or "there"
    when = "delivery" if order["fulfilment"] == "delivery" else "collection"
    extra_html = ""
    extra_text = ""

    if status == "confirmed":
        subject = f"Your order is confirmed 🎉 — {order['ref']}"
        headline = "Your order is confirmed 🎉"
        intro_html = (f"Great news, {_esc(first_name)} — we've accepted your order and it's all booked in. "
                      f"We'll be in touch with your {when} details for <strong>{_esc(order['required_date'])}</strong>.")
        intro_text = (f"Great news, {first_name} — we've accepted your order {order['ref']} and it's all "
                      f"booked in. We'll be in touch with your {when} details for {order['required_date']}.")
    elif status == "completed":
        subject = f"Your order is complete — thank you! {order['ref']}"
        headline = "Your order is complete — thank you!"
        done = "delivered" if when == "delivery" else "ready and collected"
        intro_html = (f"That's your order {done}, {_esc(first_name)} — we hope you love it! "
                      f"Thank you so much for choosing {BRAND}. 💕")
        intro_text = (f"That's your order {order['ref']} complete, {first_name} — we hope you love it! "
                      f"Thank you so much for choosing {BRAND}.")
    elif status == "cancelled":
        subject = f"Your order has been cancelled — {order['ref']}"
        headline = "Your order has been cancelled"
        intro_html = f"Your order {_esc(order['ref'])} has been cancelled, {_esc(first_name)}."
        intro_text = f"Your order {order['ref']} has been cancelled, {first_name}."
        extra_html = ('<p style="margin:0;font-size:14px;color:#6b4a56">If you\'d already paid, we\'ll refund '
                      'you in line with our cancellation policy. If this wasn\'t expected, please get in touch '
                      'and we\'ll sort it out.</p>')
        extra_text = ("\nIf you'd already paid, we'll refund you in line with our cancellation policy. "
                      "If this wasn't expected, please get in touch and we'll sort it out.")
    else:
        return  # no customer email for other transitions (e.g. back to 'new')

    text = f"""{intro_text}

{_where_text(order)}
Wanted: {order['required_date']}

{_summary_text(order)}{extra_text}
{_footer_text()}"""

    _send(order["email"], subject, text, _shell(order, headline, intro_html, extra_html))


# ---- Admin emails ---------------------------------------------------------

def notify_new_order(order):
    """New order landed — goes to you (ORDER_NOTIFY_TO)."""
    if not os.environ.get("ORDER_NOTIFY_TO"):
        return
    delivery = _gbp(order["delivery_fee"]) if order["delivery_fee"] else "Free"
    text = f"""New order: {order['ref']}
Customer: {order['name']} · {order['email']} · {order['phone']}
Required: {order['required_date']}
{_where_text(order)}
Payment: {order['payment']}

{_item_lines_text(order)}
Subtotal: {_gbp(order['subtotal'])}
Delivery: {delivery}
Total: {_gbp(order['total'])}

Notes: {order['notes'] or '—'}
"""
    _send(os.environ["ORDER_NOTIFY_TO"],
          f"New order {order['ref']} — {_gbp(order['total'])} ({order['payment']})", text)


def notify_admin_cancelled(order):
    """Heads-up to you when a customer cancels their own order via the email link."""
    if not os.environ.get("ORDER_NOTIFY_TO"):
        return
    text = f"""Order {order['ref']} was cancelled by the customer.
Customer: {order['name']} · {order['email']} · {order['phone']}
Was wanted: {order['required_date']}
{_where_text(order)}

{_item_lines_text(order)}
Total: {_gbp(order['total'])}
"""
    _send(os.environ["ORDER_NOTIFY_TO"], f"Order {order['ref']} cancelled by customer", text)
