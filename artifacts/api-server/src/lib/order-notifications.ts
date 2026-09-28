import { adminsTable, type Order, type OrderItem, db } from "@workspace/db";
import { sendResendEmail } from "./resend-email";

export async function sendNewOrderNotification(order: Order, items: OrderItem[]): Promise<void> {
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

  if (recipients.length === 0) {
    return;
  }

  const itemName = (item: OrderItem) => `${item.cakeName}${item.variantLabel ? ` (${item.variantLabel})` : ""}`;

  const itemList = items
    .map((item) => `<li><strong>${item.quantity}x</strong> ${escapeHtml(itemName(item))} - KES ${parseFloat(item.subtotal).toLocaleString()}</li>`)
    .join("");

  const itemSummary = items
    .map((item) => `${item.quantity}x ${itemName(item)} (KES ${parseFloat(item.subtotal).toLocaleString()})`)
    .join(", ");

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
      <p><strong>Payment status:</strong> ${escapeHtml(order.paymentStatus)}</p>
      <p><strong>Items:</strong></p>
      <ul>${itemList}</ul>
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
      `Payment status: ${order.paymentStatus}`,
      `Items: ${itemSummary}`,
    ].filter(Boolean).join("\n"),
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
