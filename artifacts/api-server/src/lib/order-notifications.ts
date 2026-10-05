import { adminsTable, type Order, type OrderItem, db } from "@workspace/db";
import { sendResendEmail } from "./resend-email";

// The shop's staff (admin accounts), or ADMIN_EMAIL when there are none.
async function ownerRecipients(): Promise<string[]> {
  const adminEmails = await db
    .select({ email: adminsTable.email })
    .from(adminsTable);

  const recipients = Array.from(
    new Set(
      adminEmails
        .map((row) => row.email.trim())
        .filter(Boolean),
    ),
  );

  if (recipients.length === 0) {
    const fallback = (process.env.ADMIN_EMAIL || "").trim();
    if (fallback) recipients.push(fallback);
  }
  return recipients;
}

// A customer paid the till or paybill themselves and sent their M-Pesa code: the owner checks it and confirms.
export async function sendPaymentCodeNotification(order: Order, code: string, baseUrl: string): Promise<void> {
  const recipients = await ownerRecipients();
  if (recipients.length === 0) return;
  const amount = `KES ${Math.round(parseFloat(order.total)).toLocaleString("en-KE")}`;
  const ordersPage = `${baseUrl}/admin/orders`;
  await sendResendEmail({
    to: recipients,
    subject: `Check payment: order #${order.id}, M-Pesa code ${code}`,
    html: `
      <h2>A customer sent an M-Pesa code</h2>
      <p><strong>${escapeHtml(order.customerName)}</strong> (${escapeHtml(order.customerPhone)}) says they paid <strong>${amount}</strong> for order <strong>#${order.id}</strong>.</p>
      <p style="font-size:22px;font-weight:bold;letter-spacing:2px">${escapeHtml(code)}</p>
      <p>Find this code in your M-Pesa messages or statement. If the payment is there, open <a href="${escapeHtml(ordersPage)}">Admin → Orders</a> and press <strong>Mark paid</strong>. If it isn't, press <strong>Code not found</strong> and the customer is asked to check it.</p>
    `,
    text: `${order.customerName} (${order.customerPhone}) says they paid ${amount} for order #${order.id} with M-Pesa code ${code}.\n\nFind this code in your M-Pesa messages. If the payment is there, press Mark paid in Admin → Orders (${ordersPage}); if not, press Code not found.`,
  });
}

export async function sendNewOrderNotification(order: Order, items: OrderItem[], baseUrl: string): Promise<void> {
  const recipients = await ownerRecipients();
  if (recipients.length === 0) {
    return;
  }

  const itemName = (item: OrderItem) => `${item.cakeName}${item.variantLabel ? ` (${item.variantLabel})` : ""}`;
  const itemChoices = (item: OrderItem) =>
    [
      item.flavour ? `Flavour: ${item.flavour}` : null,
      item.secondFlavour ? `Second flavour: ${item.secondFlavour}` : null,
      item.cakeMessage ? `Message on cake: "${item.cakeMessage}"` : null,
    ].filter(Boolean) as string[];

  const itemList = items
    .map((item) => {
      const choices = itemChoices(item);
      return `<li><strong>${item.quantity}x</strong> ${escapeHtml(itemName(item))} - KES ${parseFloat(item.subtotal).toLocaleString()}${
        choices.length ? `<br><span style="color:#555">${escapeHtml(choices.join(" · "))}</span>` : ""
      }</li>`;
    })
    .join("");

  const itemSummary = items
    .map((item) =>
      [`- ${item.quantity}x ${itemName(item)} (KES ${parseFloat(item.subtotal).toLocaleString()})`, ...itemChoices(item)].join(" — "),
    )
    .join("\n");

  const ordersPage = `${baseUrl}/admin/orders`;
  const payment =
    order.paymentStatus === "paid"
      ? "Paid"
      : `Not paid yet. When the customer sends their M-Pesa code you'll get a "Check payment" email.`;

  // Delivery dates are stored as midnight UTC of the chosen day.
  const deliveryDate = order.deliveryDate
    ? order.deliveryDate.toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : null;

  await sendResendEmail({
    to: recipients,
    subject: `New order received #${order.id}`,
    html: `
      <h2>New cake order received</h2>
      <p><strong>Order #:</strong> ${order.id}</p>
      <p><strong>Customer:</strong> ${escapeHtml(order.customerName)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(order.customerPhone)}</p>
      ${order.customerEmail ? `<p><strong>Email:</strong> ${escapeHtml(order.customerEmail)}</p>` : ""}
      ${deliveryDate ? `<p><strong>Delivery date:</strong> ${escapeHtml(deliveryDate)}</p>` : ""}
      ${order.deliveryAddress ? `<p><strong>Delivery address:</strong> ${escapeHtml(order.deliveryAddress)}</p>` : ""}
      ${order.notes ? `<p><strong>Notes:</strong><br>${escapeHtml(order.notes).replace(/\n/g, "<br>")}</p>` : ""}
      <p><strong>Total:</strong> KES ${parseFloat(order.total).toLocaleString()}</p>
      <p><strong>Payment:</strong> ${escapeHtml(payment)}</p>
      <p><strong>Items:</strong></p>
      <ul>${itemList}</ul>
      <p><a href="${escapeHtml(ordersPage)}">Open Admin → Orders</a></p>
    `,
    text: [
      `New cake order received`,
      `Order #: ${order.id}`,
      `Customer: ${order.customerName}`,
      `Phone: ${order.customerPhone}`,
      order.customerEmail ? `Email: ${order.customerEmail}` : null,
      deliveryDate ? `Delivery date: ${deliveryDate}` : null,
      order.deliveryAddress ? `Delivery address: ${order.deliveryAddress}` : null,
      order.notes ? `Notes:\n${order.notes}` : null,
      `Total: KES ${parseFloat(order.total).toLocaleString()}`,
      `Payment: ${payment}`,
      `Items:\n${itemSummary}`,
      `Admin → Orders: ${ordersPage}`,
    ].filter(Boolean).join("\n"),
  });
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
