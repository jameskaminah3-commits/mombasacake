import type { Order, OrderItem } from "@workspace/db";
import { logger } from "./logger";
import { escapeHtml } from "./order-notifications";
import { sendResendEmail } from "./resend-email";

export type CustomerEmailKind = "received" | "paid" | "status";

// "Your order #12 …"
const STATUS_WORDS: Record<string, string> = {
  confirmed: "is confirmed",
  preparing: "is being made",
  ready: "is ready",
  delivered: "has been delivered. Enjoy!",
  cancelled: "has been cancelled",
};

// The customer's private link to their order.
export function orderLink(baseUrl: string, order: Pick<Order, "id" | "accessToken">) {
  return `${baseUrl}/order/${order.id}${order.accessToken ? `?t=${encodeURIComponent(order.accessToken)}` : ""}`;
}

const kes = (value: string | number) => `KES ${Math.round(Number(value)).toLocaleString("en-KE")}`;

// Emails the customer about their order, when they gave an email address and the shop can send email.
// Never throws: an email problem must not get in the way of the order or payment it is about.
export async function emailCustomerAboutOrder(order: Order, items: OrderItem[], kind: CustomerEmailKind, baseUrl: string) {
  const to = order.customerEmail?.trim();
  if (!to || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return;
  if (kind === "status" && !STATUS_WORDS[order.status]) return;

  const name = order.customerName.trim().split(/\s+/)[0] || order.customerName;
  const link = orderLink(baseUrl, order);
  const subject =
    kind === "received"
      ? `We've got your cake order #${order.id}`
      : kind === "paid"
        ? `Payment received for order #${order.id}`
        : `Your order #${order.id} ${STATUS_WORDS[order.status].replace(/\.\s.*$/, "")}`;
  const lines =
    kind === "received"
      ? [
          `Thank you for your order! Here is what you ordered:`,
          ...items.map(
            (item) =>
              `${item.quantity} × ${item.cakeName}${item.variantLabel ? ` (${item.variantLabel})` : ""}${item.flavour ? `, ${item.flavour}` : ""}${
                item.secondFlavour ? ` + ${item.secondFlavour}` : ""
              }${item.cakeMessage ? `, message "${item.cakeMessage}"` : ""}: ${kes(item.subtotal)}`,
          ),
          `Total: ${kes(order.total)}`,
          order.paymentStatus === "paid"
            ? "We've received your payment."
            : "If you haven't paid yet, your order page shows how to pay with M-Pesa.",
        ]
      : kind === "paid"
        ? [`We've received your payment of ${kes(order.total)}${order.mpesaReceiptNo ? ` (M-Pesa ${order.mpesaReceiptNo})` : ""}. We'll get baking!`]
        : [`Your order #${order.id} ${STATUS_WORDS[order.status]}`];

  try {
    await sendResendEmail({
      to,
      subject,
      html: `
        <p>Hi ${escapeHtml(name)},</p>
        ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
        <p><a href="${escapeHtml(link)}">See your order</a></p>
        <p>Questions? Reply on WhatsApp: +254 721 868 212<br>Channah Cake House, Mombasa</p>
      `,
      text: [`Hi ${name},`, ...lines, `See your order: ${link}`, "Questions? WhatsApp +254 721 868 212", "Channah Cake House, Mombasa"].join("\n\n"),
    });
  } catch (err) {
    logger.error({ err, orderId: order.id, kind }, "Customer order email failed");
  }
}
