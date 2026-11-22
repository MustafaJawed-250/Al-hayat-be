import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
}

const FROM = process.env.RESEND_FROM_EMAIL || 'AL HAYAT <onboarding@resend.dev>';
const ADMIN_TO = process.env.ADMIN_NOTIFICATION_EMAIL || '';

function brandHeader() {
  return `
  <div style="background:#0B3D2E;padding:24px 28px;text-align:center;">
    <div style="color:#D4A017;font-size:14px;font-weight:700;letter-spacing:0.05em;">ماشاءاللہ</div>
    <div style="color:#E31C23;font-size:28px;font-weight:900;font-style:italic;font-family:Georgia,serif;margin:4px 0;">AL HAYAT</div>
    <div style="color:#F9F5ED;font-size:13px;font-style:italic;">Roll Point & Fast Food</div>
  </div>`;
}

function itemsTable(items) {
  const rows = (items || [])
    .map(
      (i) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${i.name}${i.variantName ? ` (${i.variantName})` : ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${i.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">Rs. ${(i.price * i.quantity).toFixed(2)}</td>
    </tr>`
    )
    .join('');
  return `
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;">
    <thead>
      <tr style="background:#F9F5ED;">
        <th style="padding:8px 12px;text-align:left;">Item</th>
        <th style="padding:8px 12px;text-align:center;">Qty</th>
        <th style="padding:8px 12px;text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export function isEmailConfigured() {
  return Boolean(resend && ADMIN_TO && process.env.RESEND_API_KEY);
}

export async function sendAdminNewOrderEmail(order) {
  if (!resend || !ADMIN_TO) {
    console.warn('[email] Resend/ADMIN_NOTIFICATION_EMAIL not configured — skip admin notification');
    return { skipped: true };
  }
  const placed = new Date(order.createdAt || Date.now()).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });
  const html = `
  <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
    ${brandHeader()}
    <div style="padding:28px;">
      <h2 style="color:#0B3D2E;margin:0 0 8px;">New order received</h2>
      <p style="color:#555;margin:0 0 16px;">Order <strong>${order.orderId}</strong> · ${placed}</p>
      <p style="margin:4px 0;"><strong>Customer:</strong> ${order.customer.fullName}</p>
      <p style="margin:4px 0;"><strong>Phone:</strong> ${order.customer.phone}</p>
      <p style="margin:4px 0;"><strong>Email:</strong> ${order.customer.email || '—'}</p>
      <p style="margin:4px 0;"><strong>Address:</strong> ${order.customer.address}, ${order.customer.city}</p>
      ${order.customer.notes ? `<p style="margin:4px 0;"><strong>Notes:</strong> ${order.customer.notes}</p>` : ''}
      ${itemsTable(order.items)}
      <p style="margin:4px 0;">Subtotal: <strong>Rs. ${Number(order.subtotal).toFixed(2)}</strong></p>
      <p style="margin:4px 0;">Delivery: <strong>Rs. ${Number(order.deliveryCharge).toFixed(2)}</strong></p>
      <p style="margin:12px 0 0;font-size:18px;color:#0B3D2E;">Total: <strong>Rs. ${Number(order.total).toFixed(2)}</strong></p>
      <p style="margin-top:20px;color:#888;font-size:13px;">Confirm this order in the AL HAYAT admin dashboard.</p>
    </div>
  </div>`;

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: ADMIN_TO,
      subject: `New AL HAYAT Order ${order.orderId}`,
      html,
    });
    return { success: true, id: result?.data?.id };
  } catch (err) {
    console.error('[email] Admin notification failed:', err.message);
    return { success: false, error: err.message };
  }
}

export async function sendCustomerConfirmationEmail(order) {
  if (!resend) {
    console.warn('[email] Resend not configured — skip customer confirmation');
    return { skipped: true };
  }
  const to = order.customer?.email;
  if (!to) {
    return { success: false, error: 'Customer email missing' };
  }
  const html = `
  <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
    ${brandHeader()}
    <div style="padding:28px;">
      <h2 style="color:#0B3D2E;margin:0 0 8px;">Your order has been confirmed</h2>
      <p style="color:#555;line-height:1.6;">
        Thank you for ordering from <strong>AL HAYAT Roll Point &amp; Fast Food</strong>.
        Your order has been received and confirmed by our team.
      </p>
      <p style="margin:16px 0;"><strong>Order ID:</strong> ${order.orderId}</p>
      ${itemsTable(order.items)}
      <p style="margin:12px 0;font-size:18px;color:#0B3D2E;">Total: <strong>Rs. ${Number(order.total).toFixed(2)}</strong> (Cash on Delivery)</p>
      <p style="margin-top:24px;color:#555;">Questions? Call us at <strong>0307 7622276</strong>.</p>
      <p style="color:#888;font-size:13px;margin-top:8px;">Soldier Bazaar, Karachi</p>
    </div>
  </div>`;

  try {
    const result = await resend.emails.send({
      from: FROM,
      to,
      subject: 'Your AL HAYAT Order Has Been Confirmed',
      html,
    });
    return { success: true, id: result?.data?.id };
  } catch (err) {
    console.error('[email] Customer confirmation failed:', err.message);
    return { success: false, error: err.message };
  }
}
